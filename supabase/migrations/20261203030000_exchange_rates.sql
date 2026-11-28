-- Slice S48: exchange rates for the "about" estimate (design 2026-11-24, section 12.3).
-- Bank of Tanzania (BoT) indicative rates by default, an admin override from a named source otherwise.
-- Display only: Kwetuly never charges or settles in these rates.
--
-- Needs: 20261012000800_notifications.sql (notification_outbox), 20261014000000_push_and_chat_alerts.sql
--   (private.notify_user with channels), 20261016001400_admin_two_step_business_gate_deposits_leads.sql
--   (private.is_admin() = admin role AND a two-step aal2 session), 20261031214101_feature_switches.sql
--   (private.feature_on), 20261122000000_person_documents_identifiers.sql (private.tz_today),
--   20261126000000_feature_switch_admin.sql (row feature.local_prices). pg_net and Vault are used only
--   when the schedule below is set up.
--
-- What it adds:
--   1. The allow-list: the check constraint exchange_rates_currency_allowed and
--      private.rate_currencies() (both the same list as RATE_CURRENCIES in
--      packages/shared/src/currencies.ts; packages/shared/src/currencies.test.ts checks all three).
--      PLN is not on the BoT list: it can only come from an admin override (Walter, 2026-11-27: source
--      National Bank of Poland, the source name and rate date are shown with the estimate).
--   2. public.exchange_rates: append-only. Only `status` may change (active -> ended, suspect -> active
--      or ended), enforced by a trigger that also refuses deletes and truncate, for every role.
--      No client role and not service_role can write to it directly; writes go through the
--      security definer functions below. Anyone reads active rows (not `note` or `entered_by`);
--      admins read everything through public.admin_exchange_rates().
--   3. Private tables: exchange_fetch_log (counts, ok flag, error code; never page content),
--      exchange_fetch_requests ("Fetch now" requests, for the 2-minute limit),
--      exchange_override_pending (first calls of an override that needs confirming) and
--      exchange_rate_actions (who set, ended, used or ignored which row).
--   4. public.current_rates(): per currency, an active override whose valid_until is today or later
--      wins; else the newest active BoT row at most 7 days old; else nothing. Empty when the switch
--      feature.local_prices is off.
--   5. Service functions for the `exchange-rates` Edge Function (service_role only):
--      svc_exchange_rates_save (checks every row again: allow-list, decimals, buying <= mean <= selling,
--      mean = average, date not in the future and at most 7 days old; a currency more than 15% away
--      from its last active BoT mean is saved as `suspect` and admins are alerted; without a good USD
--      row nothing is saved and admins are alerted) and svc_exchange_fetch_failed.
--   6. Scheduled helpers (created here, scheduled only by Walter): private.run_exchange_rates_fetch()
--      calls the Edge Function with the key from Vault and does nothing without it;
--      private.exchange_rates_watchdog() alerts admins when no fetch succeeded for 48 hours, even if the
--      Edge Function never runs or never logs.
--   7. Admin functions (two-step session): admin_rates_fetch_request ("Fetch now", recorded at once,
--      one every 2 minutes), admin_set_rate_override (source name required; a rate more than 25% from
--      the reference, or a first rate with no reference, is saved only by a second identical call
--      with p_confirm_far = true within 10 minutes), admin_end_rate_override,
--      admin_review_suspect_rate ("Use anyway" / "Ignore"), admin_exchange_rates,
--      admin_exchange_fetch_log, admin_exchange_rate_actions.
--
-- Schedule: NOT run by this migration. Walter runs these himself, in this order, following
-- supabase/README-exchange-rates.md (step 5, where the same lines are ready to paste). Secrets go in
-- Vault and the function's secrets, never in this file:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/exchange-rates', 'exchange_rates_url');
--   select vault.create_secret('<EXCHANGE_RATES_SECRET>', 'exchange_rates_key');
--   -- 10:00 and 16:00 East Africa time = 07:00 and 13:00 UTC (pg_cron runs in UTC).
--   select cron.schedule('exchange-rates', '0 7,13 * * *', 'select private.run_exchange_rates_fetch()');
--   select cron.schedule('exchange-rates-watchdog', '30 8 * * *', 'select private.exchange_rates_watchdog()');
--
-- Undo (only while no rate is relied on; dropping the tables deletes their rows), in this order:
--   select cron.unschedule('exchange-rates');            -- if it was scheduled
--   select cron.unschedule('exchange-rates-watchdog');   -- if it was scheduled
--   drop function public.admin_exchange_rate_actions(int), public.admin_exchange_fetch_log(int),
--     public.admin_exchange_rates(text, int), public.admin_review_suspect_rate(uuid, boolean),
--     public.admin_end_rate_override(uuid),
--     public.admin_set_rate_override(text, numeric, text, text, date, date, text, boolean),
--     public.admin_rates_fetch_request(), public.svc_exchange_fetch_failed(text, text, uuid),
--     public.svc_exchange_rates_save(jsonb, text, uuid, int, int), public.current_rates(),
--     private.run_exchange_rates_fetch(), private.exchange_rates_watchdog();
--   drop table private.exchange_rate_actions, private.exchange_override_pending,
--     private.exchange_fetch_requests, private.exchange_fetch_log, public.exchange_rates;
--   drop function private.exchange_rates_guard(), private.exchange_rates_alert(text, jsonb, interval),
--     private.rate_currencies();
--   and delete the Vault secrets exchange_rates_url and exchange_rates_key in the dashboard if they were added.

-- ---------------------------------------------------------------------------
-- 1. Allow-list
-- ---------------------------------------------------------------------------
create or replace function private.rate_currencies()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'AED', 'AUD', 'BIF', 'BWP', 'CAD', 'CHF', 'CNY', 'DKK', 'DZD', 'EUR', 'GBP', 'HKD', 'IDR', 'INR',
    'IQD', 'JPY', 'KES', 'KRW', 'KWD', 'MWK', 'MYR', 'NAD', 'NGN', 'NOK', 'NZD', 'PKR', 'QAR', 'RWF',
    'SAR', 'SEK', 'SGD', 'TRY', 'UGX', 'USD', 'ZAR', 'ZMW',
    'PLN'
  ]::text[];
$$;

comment on function private.rate_currencies() is
  'Currencies that may have a rate. Same list as the check constraint exchange_rates_currency_allowed and RATE_CURRENCIES in packages/shared/src/currencies.ts. PLN: admin override only.';

revoke execute on function private.rate_currencies() from public;
grant execute on function private.rate_currencies() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Rates
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  currency char(3) not null,
  tzs_per_unit numeric(18, 6) not null check (tzs_per_unit > 0),
  buying numeric(18, 6),
  selling numeric(18, 6),
  source text not null check (source in ('bot', 'admin')),
  source_name text not null check (char_length(btrim(source_name)) between 2 and 120),
  source_url text check (source_url is null or (source_url ~ '^https://[^[:space:]]+$' and char_length(source_url) <= 500)),
  rate_date date not null,
  valid_until date,
  status text not null default 'active' check (status in ('active', 'suspect', 'ended')),
  note text check (note is null or char_length(note) <= 300),
  entered_by uuid, -- the admin who set an override; no foreign key, so the row outlives the account
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  -- The allow-list (same list as private.rate_currencies() and RATE_CURRENCIES in currencies.ts).
  constraint exchange_rates_currency_allowed check (currency in (
    'AED', 'AUD', 'BIF', 'BWP', 'CAD', 'CHF', 'CNY', 'DKK', 'DZD', 'EUR', 'GBP', 'HKD', 'IDR', 'INR',
    'IQD', 'JPY', 'KES', 'KRW', 'KWD', 'MWK', 'MYR', 'NAD', 'NGN', 'NOK', 'NZD', 'PKR', 'QAR', 'RWF',
    'SAR', 'SEK', 'SGD', 'TRY', 'UGX', 'USD', 'ZAR', 'ZMW',
    'PLN')),
  constraint exchange_rates_shape check (
    (source = 'bot'
      and buying is not null and selling is not null
      and buying > 0 and buying <= tzs_per_unit and tzs_per_unit <= selling
      and currency <> 'PLN'
      and source_url is not null and valid_until is null and entered_by is null and fetched_at is not null)
    or
    (source = 'admin'
      and buying is null and selling is null
      and valid_until is not null and valid_until >= rate_date
      and entered_by is not null and status <> 'suspect')
  )
);

comment on table public.exchange_rates is
  'TZS per 1 unit, for display estimates only. Append-only: only status changes (trigger). Writes only through svc_/admin_ functions.';

create unique index exchange_rates_bot_day on public.exchange_rates (currency, source, rate_date) where source = 'bot';
create index exchange_rates_active_idx on public.exchange_rates (currency, source, rate_date desc) where status = 'active';
-- At most one active override per currency (admin_set_rate_override also takes a per-currency lock).
create unique index exchange_rates_one_active_override on public.exchange_rates (currency) where source = 'admin' and status = 'active';

-- Append-only: only status may change, along allowed steps; no deletes, no truncate (any role).
create or replace function private.exchange_rates_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'exchange rates are kept; end a row by changing its status' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'exchange rates cannot be changed, only their status' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not ((old.status = 'suspect' and new.status in ('active', 'ended'))
              or (old.status = 'active' and new.status = 'ended')) then
    raise exception 'status cannot go from % to %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.exchange_rates_guard() from public, anon, authenticated;

create trigger exchange_rates_guard_row
  before update or delete on public.exchange_rates
  for each row execute function private.exchange_rates_guard();

create trigger exchange_rates_guard_truncate
  before truncate on public.exchange_rates
  for each statement execute function private.exchange_rates_guard();

alter table public.exchange_rates enable row level security;

create policy "Anyone reads active rates" on public.exchange_rates
  for select to anon, authenticated
  using (status = 'active');

create policy "Admins read all rates" on public.exchange_rates
  for select to authenticated
  using ((select private.is_admin()));

revoke all on public.exchange_rates from anon, authenticated;
-- service_role keeps read access only: every write goes through the security definer functions.
revoke insert, update, delete, truncate, references, trigger on public.exchange_rates from service_role;
-- note and entered_by are left out on purpose; admins get them from admin_exchange_rates().
grant select (id, currency, tzs_per_unit, buying, selling, source, source_name, source_url, rate_date,
              valid_until, status, fetched_at, created_at)
  on public.exchange_rates to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Logs (private schema, no client access)
-- ---------------------------------------------------------------------------
create table private.exchange_fetch_log (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  trigger text not null check (trigger in ('cron', 'admin')),
  requested_by uuid, -- the admin for "Fetch now"; no foreign key
  ok boolean not null,
  rows_saved int not null default 0 check (rows_saved >= 0),
  rows_suspect int not null default 0 check (rows_suspect >= 0),
  rows_skipped int not null default 0 check (rows_skipped >= 0), -- already stored for that day
  rows_dropped int not null default 0 check (rows_dropped >= 0), -- not on the allow-list
  rows_refused int not null default 0 check (rows_refused >= 0), -- failed a check
  error_code text check (error_code is null or error_code ~ '^[a-z_]{2,40}$')
);

create index exchange_fetch_log_run_idx on private.exchange_fetch_log (run_at desc);

create table private.exchange_rate_actions (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid not null,
  action text not null check (action in ('override_set', 'override_set_far', 'override_ended',
                                         'override_replaced', 'suspect_used', 'suspect_ignored')),
  rate_id uuid not null,
  currency char(3) not null
);

-- "Fetch now" requests, written when a request is accepted (counted in the 2-minute limit at once).
create table private.exchange_fetch_requests (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid not null
);

create index exchange_fetch_requests_at_idx on private.exchange_fetch_requests (at desc);

-- First call of an override that needs confirming; the second, identical call must come within 10 minutes.
-- digest = md5 of every field of the form (currency, rate, source name, link, dates, note).
create table private.exchange_override_pending (
  admin_id uuid not null,
  currency char(3) not null,
  digest text not null check (digest ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  primary key (admin_id, currency)
);

alter table private.exchange_fetch_log enable row level security;
alter table private.exchange_fetch_requests enable row level security;
alter table private.exchange_override_pending enable row level security;
alter table private.exchange_rate_actions enable row level security;
revoke all on private.exchange_fetch_log, private.exchange_fetch_requests, private.exchange_override_pending,
  private.exchange_rate_actions from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. What screens use
-- ---------------------------------------------------------------------------
create or replace function public.current_rates()
returns table (currency text, tzs_per_unit numeric, source text, source_name text, source_url text, rate_date date)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select private.tz_today() as d),
  overrides as (
    select distinct on (r.currency)
           r.currency::text as currency, r.tzs_per_unit, r.source, r.source_name, r.source_url, r.rate_date
      from public.exchange_rates r, today t
     where r.source = 'admin' and r.status = 'active'
       and r.valid_until >= t.d and r.rate_date <= t.d
       and r.currency::text = any (private.rate_currencies())
     order by r.currency, r.created_at desc
  ),
  bot as (
    select distinct on (r.currency)
           r.currency::text as currency, r.tzs_per_unit, r.source, r.source_name, r.source_url, r.rate_date
      from public.exchange_rates r, today t
     where r.source = 'bot' and r.status = 'active'
       and r.rate_date between t.d - 7 and t.d
       and r.currency::text = any (private.rate_currencies())
     order by r.currency, r.rate_date desc, r.created_at desc
  )
  select o.* from overrides o where private.feature_on('local_prices')
  union all
  select b.* from bot b
   where private.feature_on('local_prices')
     and not exists (select 1 from overrides o where o.currency = b.currency)
  order by 1;
$$;

comment on function public.current_rates() is
  'Per currency: active override within valid_until, else newest active BoT row at most 7 days old, else nothing. Empty when feature.local_prices is off.';

revoke execute on function public.current_rates() from public;
grant execute on function public.current_rates() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Alerts and service functions (Edge Function `exchange-rates`)
-- ---------------------------------------------------------------------------
-- Email to every admin; at most one per event within p_throttle (null = no limit). Payloads carry
-- codes and counts only.
create or replace function private.exchange_rates_alert(p_event text, p_payload jsonb, p_throttle interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  if p_throttle is not null and exists (
       select 1 from public.notification_outbox o
        where o.event = p_event and o.created_at > now() - p_throttle) then
    return;
  end if;
  for v_admin in select p.id from public.profiles p where p.role = 'admin' loop
    perform private.notify_user(p_event, v_admin, p_payload, null, array['email']);
  end loop;
end;
$$;

revoke execute on function private.exchange_rates_alert(text, jsonb, interval) from public, anon, authenticated, service_role;

-- p_rows: [{currency, buying, selling, mean, rate_date (yyyy-mm-dd)}] as text, from parse.ts.
-- Every row is checked again here. Without a good USD row nothing is saved.
create or replace function public.svc_exchange_rates_save(
  p_rows jsonb, p_trigger text, p_requested_by uuid default null, p_dropped int default 0, p_refused int default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.tz_today();
  v_dec text := '^[0-9]{1,12}([.][0-9]{1,6})?$';
  v_row record;
  v_b numeric;
  v_s numeric;
  v_m numeric;
  v_d date;
  v_last numeric;
  v_status text;
  v_id uuid;
  v_good jsonb := '[]'::jsonb;
  v_refused int := greatest(coalesce(p_refused, 0), 0);
  v_dropped int := greatest(coalesce(p_dropped, 0), 0);
  v_saved int := 0;
  v_suspect int := 0;
  v_skipped int := 0;
  v_suspect_codes text[] := '{}';
  v_item jsonb;
begin
  if p_trigger is null or p_trigger not in ('cron', 'admin') then
    raise exception 'unknown trigger' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then
    insert into private.exchange_fetch_log (trigger, requested_by, ok, error_code)
    values (p_trigger, p_requested_by, false, 'bad_input');
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  -- Pass 1: check every row.
  for v_row in
    select x.currency, x.buying, x.selling, x.mean, x.rate_date
      from jsonb_to_recordset(p_rows) as x(currency text, buying text, selling text, mean text, rate_date text)
  loop
    if v_row.currency is null or v_row.currency !~ '^[A-Z]{3}$'
       or not (v_row.currency = any (private.rate_currencies())) or v_row.currency = 'PLN' then
      v_dropped := v_dropped + 1;
      continue;
    end if;
    if coalesce(v_row.buying, '') !~ v_dec or coalesce(v_row.selling, '') !~ v_dec
       or coalesce(v_row.mean, '') !~ v_dec or coalesce(v_row.rate_date, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or exists (select 1 from jsonb_array_elements(v_good) as g(v) where g.v ->> 'currency' = v_row.currency) then
      v_refused := v_refused + 1;
      continue;
    end if;
    begin
      v_d := v_row.rate_date::date;
    exception when others then
      v_refused := v_refused + 1;
      continue;
    end;
    v_b := v_row.buying::numeric;
    v_s := v_row.selling::numeric;
    v_m := v_row.mean::numeric;
    if not (v_b > 0 and v_b <= v_m and v_m <= v_s)
       or abs(v_m - (v_b + v_s) / 2) > greatest(0.0005, v_m * 0.0001)
       or v_d > v_today or v_d < v_today - 7 then
      v_refused := v_refused + 1;
      continue;
    end if;
    v_good := v_good || jsonb_build_array(jsonb_build_object(
      'currency', v_row.currency, 'buying', v_b, 'selling', v_s, 'mean', v_m, 'rate_date', v_d));
  end loop;

  if not exists (select 1 from jsonb_array_elements(v_good) as g(v) where g.v ->> 'currency' = 'USD') then
    insert into private.exchange_fetch_log (trigger, requested_by, ok, rows_dropped, rows_refused, error_code)
    values (p_trigger, p_requested_by, false, v_dropped, v_refused, 'no_usd');
    perform private.exchange_rates_alert('exchange_rates_failed', jsonb_build_object('error', 'no_usd'), interval '12 hours');
    return jsonb_build_object('ok', false, 'error', 'no_usd', 'dropped', v_dropped, 'refused', v_refused);
  end if;

  -- Pass 2: compare with the last active BoT mean and save.
  for v_item in select g.v from jsonb_array_elements(v_good) as g(v) loop
    v_m := (v_item ->> 'mean')::numeric;
    select r.tzs_per_unit into v_last
      from public.exchange_rates r
     where r.currency = (v_item ->> 'currency') and r.source = 'bot' and r.status = 'active'
     order by r.rate_date desc, r.created_at desc
     limit 1;
    v_status := case when v_last is not null and abs(v_m - v_last) / v_last > 0.15 then 'suspect' else 'active' end;
    v_id := null;
    insert into public.exchange_rates (currency, tzs_per_unit, buying, selling, source, source_name, source_url,
                                       rate_date, status, fetched_at)
    values (v_item ->> 'currency', round(v_m, 6), round((v_item ->> 'buying')::numeric, 6),
            round((v_item ->> 'selling')::numeric, 6), 'bot', 'Bank of Tanzania',
            'https://www.bot.go.tz/ExchangeRate/excRates?lang=en', (v_item ->> 'rate_date')::date, v_status, now())
    on conflict (currency, source, rate_date) where source = 'bot' do nothing
    returning id into v_id;
    if v_id is null then
      v_skipped := v_skipped + 1;
    elsif v_status = 'suspect' then
      v_suspect := v_suspect + 1;
      v_suspect_codes := v_suspect_codes || (v_item ->> 'currency');
    else
      v_saved := v_saved + 1;
    end if;
  end loop;

  insert into private.exchange_fetch_log (trigger, requested_by, ok, rows_saved, rows_suspect, rows_skipped,
                                          rows_dropped, rows_refused)
  values (p_trigger, p_requested_by, true, v_saved, v_suspect, v_skipped, v_dropped, v_refused);

  if v_suspect > 0 then
    perform private.exchange_rates_alert('exchange_rates_suspect',
      jsonb_build_object('currencies', array_to_string(v_suspect_codes, ', '), 'link', '/admin/rates'), null);
  end if;

  return jsonb_build_object('ok', true, 'saved', v_saved, 'suspect', v_suspect, 'skipped', v_skipped,
                            'dropped', v_dropped, 'refused', v_refused);
end;
$$;

revoke all on function public.svc_exchange_rates_save(jsonb, text, uuid, int, int) from public, anon, authenticated;
grant execute on function public.svc_exchange_rates_save(jsonb, text, uuid, int, int) to service_role;

-- A run that read nothing. A changed or moved page, a page not updated for more than 7 days, or a
-- failure on our side alerts at once; a site that does not answer (timeout, network, http_status)
-- alerts only when there was no good run in the last 48 hours (BoT often refuses a connection, and
-- publishes on working days only). At most one alert every 12 hours.
create or replace function public.svc_exchange_fetch_failed(p_error text, p_trigger text, p_requested_by uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_error text := case when p_error ~ '^[a-z_]{2,40}$' then p_error else 'unknown' end;
begin
  if p_trigger is null or p_trigger not in ('cron', 'admin') then
    raise exception 'unknown trigger' using errcode = '22023';
  end if;
  insert into private.exchange_fetch_log (trigger, requested_by, ok, error_code)
  values (p_trigger, p_requested_by, false, v_error);
  if v_error not in ('timeout', 'network', 'http_status')
     or not exists (select 1 from private.exchange_fetch_log l where l.ok and l.run_at > now() - interval '48 hours') then
    perform private.exchange_rates_alert('exchange_rates_failed', jsonb_build_object('error', v_error), interval '12 hours');
  end if;
end;
$$;

revoke all on function public.svc_exchange_fetch_failed(text, text, uuid) from public, anon, authenticated;
grant execute on function public.svc_exchange_fetch_failed(text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Scheduled helpers (created here; Walter schedules them, see the header and the README)
-- ---------------------------------------------------------------------------
-- Calls the Edge Function with the key from Vault. Without the Vault entries it does nothing.
-- The function answers at once (202) and works in the background, so 30 s is plenty.
create or replace function private.run_exchange_rates_fetch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'exchange_rates_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'exchange_rates_key');
begin
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-exchange-rates-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end;
$$;

revoke execute on function private.run_exchange_rates_fetch() from public, anon, authenticated, service_role;

-- Safety net that does not depend on the Edge Function: no good fetch logged in 48 hours (or none at
-- all) alerts every admin, at most once every 12 hours.
create or replace function private.exchange_rates_watchdog()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.exchange_fetch_log l where l.ok and l.run_at > now() - interval '48 hours') then
    perform private.exchange_rates_alert('exchange_rates_failed', jsonb_build_object('error', 'no_good_run_48h'), interval '12 hours');
  end if;
end;
$$;

revoke execute on function private.exchange_rates_watchdog() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Admin functions (private.is_admin() requires a two-step session)
-- ---------------------------------------------------------------------------
-- "Fetch now": the Edge Function calls this with the admin's own token, before it starts. The request
-- is recorded at once, so a second request within 2 minutes is refused even while the first is still
-- running. Returns the admin's id.
create or replace function public.admin_rates_fetch_request()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  -- One request at a time across admins (the lock is released at the end of this call).
  perform pg_advisory_xact_lock(hashtext('exchange_rates_fetch_request'));
  if exists (select 1 from private.exchange_fetch_requests r where r.at > now() - interval '2 minutes') then
    raise exception 'a fetch was requested less than 2 minutes ago' using errcode = 'P0001';
  end if;
  insert into private.exchange_fetch_requests (admin_id) values (v_admin);
  return v_admin;
end;
$$;

revoke all on function public.admin_rates_fetch_request() from public, anon;
grant execute on function public.admin_rates_fetch_request() to authenticated;

-- Returns {saved: true, id} or {saved: false, needs_confirm: true, reason, reference_rate, diff_pct}
-- (reference_rate and diff_pct are null for reason 'first').
-- Reference: the current BoT rate (at most 7 days old). Without one, both the newest override for that
-- currency and the last active BoT rate of any age are references (PLN only ever has overrides).
-- Confirming is needed when the rate is more than 25% from a reference ('far') or there is no
-- reference at all ('first'). Then the first call saves nothing and remembers a digest of the whole
-- form; only a second call by the same admin with exactly the same form, p_confirm_far = true and
-- within 10 minutes, saves it. p_confirm_far on its own never skips the check. A new override ends
-- the currency's earlier active override.
create or replace function public.admin_set_rate_override(
  p_currency text, p_tzs_per_unit numeric, p_source_name text, p_source_url text,
  p_rate_date date, p_valid_until date, p_note text default null, p_confirm_far boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_today date := private.tz_today();
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_name text := btrim(coalesce(p_source_name, ''));
  v_url text := nullif(btrim(coalesce(p_source_url, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_rate numeric := round(p_tzs_per_unit, 6);
  v_ref numeric;
  v_ref2 numeric;
  v_diff numeric;
  v_diff2 numeric;
  v_digest text;
  v_reason text;
  v_old uuid;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  if not (v_currency = any (private.rate_currencies())) then
    raise exception 'currency is not on the list' using errcode = '22023';
  end if;
  if v_rate is null or v_rate <= 0 or v_rate >= 1000000000000 then
    raise exception 'TZS per 1 unit must be a positive number' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'source name is required (2 to 120 characters)' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 500) then
    raise exception 'source link must start with https://' using errcode = '22023';
  end if;
  if p_rate_date is null or p_rate_date > v_today or p_rate_date < v_today - 30 then
    raise exception 'source date must be within the last 30 days' using errcode = '22023';
  end if;
  if p_valid_until is null or p_valid_until < v_today or p_valid_until > v_today + 30 then
    raise exception 'valid until must be between today and 30 days from today' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'note is at most 300 characters' using errcode = '22023';
  end if;

  -- One override change per currency at a time.
  perform pg_advisory_xact_lock(hashtext('exchange_override:' || v_currency));
  v_digest := md5(concat_ws('|', v_currency, v_rate::text, v_name, coalesce(v_url, ''), p_rate_date::text,
                            p_valid_until::text, coalesce(v_note, '')));

  select r.tzs_per_unit into v_ref
    from public.exchange_rates r
   where r.currency = v_currency and r.source = 'bot' and r.status = 'active'
     and r.rate_date between v_today - 7 and v_today
   order by r.rate_date desc, r.created_at desc, r.id desc
   limit 1;
  if v_ref is null then
    -- Newest override (the active one first, then the newest ended one), and the last BoT rate of any age.
    select r.tzs_per_unit into v_ref
      from public.exchange_rates r
     where r.currency = v_currency and r.source = 'admin'
     order by (r.status = 'active') desc, r.created_at desc, r.id desc
     limit 1;
    select r.tzs_per_unit into v_ref2
      from public.exchange_rates r
     where r.currency = v_currency and r.source = 'bot' and r.status = 'active'
     order by r.rate_date desc, r.created_at desc, r.id desc
     limit 1;
    if v_ref is null then
      v_ref := v_ref2;
      v_ref2 := null;
    end if;
  end if;
  if v_ref is null then
    v_reason := 'first';
  else
    v_diff := abs(v_rate - v_ref) / v_ref;
    if v_ref2 is not null then
      v_diff2 := abs(v_rate - v_ref2) / v_ref2;
      if v_diff2 > v_diff then
        v_diff := v_diff2;
        v_ref := v_ref2;
      end if;
    end if;
    if v_diff > 0.25 then v_reason := 'far'; end if;
  end if;

  if v_reason is not null then
    if coalesce(p_confirm_far, false) and exists (
         select 1 from private.exchange_override_pending p
          where p.admin_id = v_admin and p.currency = v_currency and p.digest = v_digest
            and p.created_at > now() - interval '10 minutes') then
      delete from private.exchange_override_pending p where p.admin_id = v_admin and p.currency = v_currency;
    else
      insert into private.exchange_override_pending (admin_id, currency, digest)
      values (v_admin, v_currency, v_digest)
      on conflict (admin_id, currency) do update set digest = excluded.digest, created_at = now();
      return jsonb_build_object('saved', false, 'needs_confirm', true, 'reason', v_reason,
                                'reference_rate', v_ref, 'diff_pct', round(v_diff * 100, 1));
    end if;
  end if;

  for v_old in
    select r.id from public.exchange_rates r
     where r.currency = v_currency and r.source = 'admin' and r.status = 'active'
  loop
    update public.exchange_rates set status = 'ended' where id = v_old;
    insert into private.exchange_rate_actions (admin_id, action, rate_id, currency)
    values (v_admin, 'override_replaced', v_old, v_currency);
  end loop;

  insert into public.exchange_rates (currency, tzs_per_unit, source, source_name, source_url, rate_date,
                                     valid_until, status, note, entered_by)
  values (v_currency, v_rate, 'admin', v_name, v_url, p_rate_date, p_valid_until, 'active', v_note, v_admin)
  returning id into v_id;

  insert into private.exchange_rate_actions (admin_id, action, rate_id, currency)
  values (v_admin, case when v_reason is not null then 'override_set_far' else 'override_set' end, v_id, v_currency);

  return jsonb_build_object('saved', true, 'id', v_id);
end;
$$;

revoke all on function public.admin_set_rate_override(text, numeric, text, text, date, date, text, boolean) from public, anon;
grant execute on function public.admin_set_rate_override(text, numeric, text, text, date, date, text, boolean) to authenticated;

create or replace function public.admin_end_rate_override(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text;
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  update public.exchange_rates r set status = 'ended'
   where r.id = p_id and r.source = 'admin' and r.status = 'active'
  returning r.currency into v_currency;
  if v_currency is null then
    raise exception 'no active override with this id' using errcode = 'P0002';
  end if;
  insert into private.exchange_rate_actions (admin_id, action, rate_id, currency)
  values ((select auth.uid()), 'override_ended', p_id, v_currency);
end;
$$;

revoke all on function public.admin_end_rate_override(uuid) from public, anon;
grant execute on function public.admin_end_rate_override(uuid) to authenticated;

-- "Use anyway" (p_use = true) or "Ignore" (false) for a suspect BoT row. Logged.
create or replace function public.admin_review_suspect_rate(p_id uuid, p_use boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text;
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  if p_use is null then
    raise exception 'choose use or ignore' using errcode = '22023';
  end if;
  update public.exchange_rates r set status = case when p_use then 'active' else 'ended' end
   where r.id = p_id and r.source = 'bot' and r.status = 'suspect'
  returning r.currency into v_currency;
  if v_currency is null then
    raise exception 'no suspect rate with this id' using errcode = 'P0002';
  end if;
  insert into private.exchange_rate_actions (admin_id, action, rate_id, currency)
  values ((select auth.uid()), case when p_use then 'suspect_used' else 'suspect_ignored' end, p_id, v_currency);
end;
$$;

revoke all on function public.admin_review_suspect_rate(uuid, boolean) from public, anon;
grant execute on function public.admin_review_suspect_rate(uuid, boolean) to authenticated;

create or replace function public.admin_exchange_rates(p_currency text default null, p_limit int default 200)
returns setof public.exchange_rates
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  return query
    select r.* from public.exchange_rates r
     where p_currency is null or r.currency = upper(p_currency)
     order by r.rate_date desc, r.created_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

revoke all on function public.admin_exchange_rates(text, int) from public, anon;
grant execute on function public.admin_exchange_rates(text, int) to authenticated;

create or replace function public.admin_exchange_fetch_log(p_limit int default 20)
returns table (run_at timestamptz, trigger text, ok boolean, rows_saved int, rows_suspect int, rows_skipped int,
               rows_dropped int, rows_refused int, error_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  return query
    select l.run_at, l.trigger, l.ok, l.rows_saved, l.rows_suspect, l.rows_skipped, l.rows_dropped,
           l.rows_refused, l.error_code
      from private.exchange_fetch_log l
     order by l.run_at desc
     limit least(greatest(coalesce(p_limit, 20), 1), 200);
end;
$$;

revoke all on function public.admin_exchange_fetch_log(int) from public, anon;
grant execute on function public.admin_exchange_fetch_log(int) to authenticated;

create or replace function public.admin_exchange_rate_actions(p_limit int default 50)
returns table (at timestamptz, admin_id uuid, action text, rate_id uuid, currency text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins with two-step sign-in only' using errcode = '42501';
  end if;
  return query
    select a.at, a.admin_id, a.action, a.rate_id, a.currency::text
      from private.exchange_rate_actions a
     order by a.at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

revoke all on function public.admin_exchange_rate_actions(int) from public, anon;
grant execute on function public.admin_exchange_rate_actions(int) to authenticated;
