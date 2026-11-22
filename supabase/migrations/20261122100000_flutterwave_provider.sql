-- Flutterwave as the deposit provider (payments-engineer, 2026-11-22; Walter chose Flutterwave on
-- 2026-11-21, Selcom is parked), with the fixes from docs/team/security-review-flutterwave-2026-11-22.md.
-- Deposits stay switched off until the Edge Function has PAYMENTS_PROVIDER=flutterwave and Flutterwave
-- TEST keys; live is refused by the function itself. Not applied to any database until Walter approves
-- (test project first).
--
-- Kept as they are: payment states (pending, paid, failed, review), one pending order per deposit
-- (payments_one_pending_offer / _member), the alerts (on_payment_paid, on_payment_review), the saved
-- member price. Old migration files are not changed.
--
--   A  payments: provider ('selcom' | 'flutterwave'; existing rows 'selcom', new rows 'flutterwave'),
--      provider_transaction_id (one provider transaction settles one order only), status_reason,
--      status_source + last_checked_at + payer_checked_at (who and when, throttles).
--      amount_tzs becomes bigint (an offer of USD 1,000,000 at any rate fits).
--   B  payment_provider_details: the provider's fee and settled amount, admins only (security-reviewer L6:
--      payers and payees do not see Kwetuly's fee).
--   C  payment_events: log of every provider callback: provider, event key, type, tx_ref, transaction id,
--      signature valid yes/no, received time, an allow-listed part of the body (amounts, references,
--      status, type, time: no personal or card data), when processed and the status that followed.
--      Unique on (provider, event_key): a repeated delivery, or unsigned calls for one order in the same
--      hour, are logged once. Admins read; only the Edge Function writes. Rows are deleted after 180 days
--      (proposed retention, Walter to confirm; payments keep status, ids and amounts for the accounts).
--   D  payment_checkout_links: the hosted link of an open order, so pressing Pay again reopens the same
--      page instead of a second payable order (links cannot be cancelled). Service role only.
--   E  public.claim_deposit_checkout: one checkout per offer or member every few seconds.
--   F  One 'paid' payment per offer and per member: a double payment is held as 'review'.
--   G  private.guard_new_payment(), BEFORE INSERT (ported from 26a75bd, security-reviewer M1): a new
--      deposit order only for an accepted spot or offer of the payer, on a trip that starts on or after
--      today + 8 days (Africa/Dar_es_Salaam) or, for flexible or undated requests, an offer still valid;
--      never on a closed request, a cancelled or unapproved trip, a traveller-run trip; only to an
--      approved, non-sample guide or business; for exactly the right amount; never when a paid or
--      in-review payment exists. Refusals: P0001, hint 'kwetuly_deposit_guard'.
--   H  Payout guard with an override and a reason (ported from 26a75bd, M2): private.guard_payout,
--      public.admin_payout_with_override(payment_id, reason), append-only private.payout_overrides,
--      private.payment_refund_open() hook (false until refund records exist). Refusals: P0001, hint
--      'kwetuly_payout_guard'. public.guard_payment no longer silently drops a tick on an unpaid deposit.
--   I  Pending-order sweeper: private.sweep_payments() posts {"action":"sweep"} with the shared secret
--      header x-kwetuly-sweep to the payments function every 5 minutes (URL and secret from Vault).
--   J  Reconciliation hook (M4): public.admin_payments_for_reconciliation(from, to): one row per order in
--      the date range, for matching against Flutterwave's transaction export by tx_ref (= order_id),
--      transaction id and amount. Admins only. The daily check itself is done by hand until it is built.
--   K  The pg_net schema `net` is not readable by anon or signed-in users (L7: the sweep header waits
--      in net.http_request_queue until sent).
--
-- Cron jobs have their own names (kwetuly-flutterwave-sweep, kwetuly-purge-payment-events), so they
-- never replace a job of the parked Selcom work (sweep-payments).
--
-- No payment row is changed except: existing rows get provider = 'selcom'; amount_tzs widens to bigint.
--
-- Set-up for the sweeper (test project first, only with Walter's approval):
--   1. A random secret of at least 32 characters (openssl rand -hex 32). Never in the repo, chat or e-mail.
--   2. Edge Function secret PAYMENTS_SWEEP_SECRET = that value.
--   3. SQL editor of the same project:
--        select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/payments', 'payments_function_url');
--        select vault.create_secret('<the same secret>', 'payments_sweep_secret');
--   4. Check: select status_code, content from net._http_response order by id desc limit 5;
--   5. Check (L7), expect no rows: select grantee, privilege_type from information_schema.role_table_grants
--        where table_schema = 'net' and grantee in ('anon', 'authenticated', 'public');
--
-- Undo (in this order):
--   K  nothing to undo (grants on net are only revoked).
--   J  drop function public.admin_payments_for_reconciliation(date, date);
--   I  select cron.unschedule('kwetuly-flutterwave-sweep'); select cron.unschedule('kwetuly-purge-payment-events');
--      drop function private.sweep_payments(); drop function private.purge_payment_events();
--      drop index public.payments_sweep_idx;
--   H  drop trigger payments_payout_guard on public.payments; drop function private.guard_payout();
--      drop function public.admin_payout_with_override(uuid, text); drop function private.payment_refund_open(uuid);
--      drop table private.payout_overrides; drop function private.payout_overrides_append_only();
--      alter table public.payments drop column payout_override_reason, drop column payout_override_by,
--        drop column payout_override_at;
--      re-create public.guard_payment() from 20261016001600_payments_review_fixes.sql;
--   G  drop trigger payments_guard_new on public.payments; drop function private.guard_new_payment();
--   F  drop index public.payments_one_paid_offer, public.payments_one_paid_member;
--      create index payments_offer_idx on public.payments (trip_offer_id) where status = 'paid';
--      create index payments_member_idx on public.payments (group_member_id) where status = 'paid';
--   E  drop function public.claim_deposit_checkout(text, uuid, integer); drop table private.deposit_checkout_claims;
--   D  drop table public.payment_checkout_links;
--   C  drop table public.payment_events;
--   B  drop table public.payment_provider_details;
--   A  drop index public.payments_provider_tx_unique;
--      alter table public.payments drop column provider, drop column provider_transaction_id,
--        drop column status_reason, drop column status_source, drop column last_checked_at,
--        drop column payer_checked_at;
--      (amount_tzs can go back to integer only while every value fits.)
--   and in Vault: delete from vault.secrets where name in ('payments_function_url', 'payments_sweep_secret');

-- ---------------------------------------------------------------------------
-- 0. Needed extensions and no half-applied parked Selcom work: stop before any change.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text := (
    select string_agg(e, ', ')
    from unnest(array['pg_cron', 'pg_net', 'supabase_vault']) as e
    where not exists (select 1 from pg_extension x where x.extname = e));
begin
  if v_missing is not null then
    raise exception 'flutterwave provider: extension(s) % missing. Turn them on (Database, Extensions) and run this migration again; nothing was changed.', v_missing;
  end if;
  -- The parked 26a75bd migrations create some of the same objects with other shapes.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'payments' and column_name in ('pay_method', 'payout_override_reason')) then
    raise exception 'flutterwave provider: this project has the parked Selcom migrations (20261107000000/100). Ask payments-engineer first; nothing was changed.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A. Provider columns.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists provider text not null default 'selcom' check (provider ~ '^[a-z][a-z0-9_]{1,30}$'),
  add column if not exists provider_transaction_id text check (provider_transaction_id ~ '^[A-Za-z0-9._:-]{1,64}$'),
  add column if not exists status_reason text check (length(status_reason) <= 40),
  add column if not exists status_source text check (status_source in ('checkout', 'payer_check', 'webhook', 'sweeper')),
  add column if not exists last_checked_at timestamptz,
  add column if not exists payer_checked_at timestamptz;

-- Existing rows (Selcom tests, if any) stay 'selcom'; every new row is Flutterwave.
alter table public.payments alter column provider set default 'flutterwave';

-- Whole shillings; integer would overflow for the largest offers.
alter table public.payments alter column amount_tzs type bigint;

create unique index if not exists payments_provider_tx_unique on public.payments (provider, provider_transaction_id)
  where provider_transaction_id is not null;

comment on table public.payments is
  'Deposits for accepted trip offers and group-trip spots, paid on the provider''s hosted page (Flutterwave). Written only by the payments Edge Function; admins may only tick payout_done.';
comment on column public.payments.order_id is 'Kwetuly''s order id (RAF + 32 hex), sent to the provider as tx_ref.';
comment on column public.payments.provider is 'Which payment provider took this order: flutterwave (new rows) or selcom (parked, older rows).';
comment on column public.payments.provider_amount is 'Whole shillings the provider reported for the order, saved when it settles.';
comment on column public.payments.provider_reference is 'The provider''s own reference (Flutterwave flw_ref).';
comment on column public.payments.provider_channel is 'How it was paid, as the provider reports it (e.g. card, mobilemoneytz).';
comment on column public.payments.provider_transaction_id is 'The provider''s transaction id (Flutterwave data.id), used to verify and to reconcile.';
comment on column public.payments.status_reason is 'Why the payments function chose the status (paid, amount_mismatch, fee_charged_to_payer, trip_closed, attempts_unclear, expired, ...).';
comment on column public.payments.status_source is 'Which payments-function path last changed status (checkout, payer_check, webhook, sweeper). With updated_at: who and when.';
comment on column public.payments.last_checked_at is 'When the sweeper last asked the provider about this order (throttle).';
comment on column public.payments.payer_checked_at is 'When the payer''s own status check last asked the provider (throttle, 5 s).';

-- ---------------------------------------------------------------------------
-- B. Provider fee and settled amount, admins only.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_provider_details (
  payment_id uuid primary key references public.payments (id) on delete cascade,
  provider_fee numeric(14, 2) check (provider_fee >= 0),
  provider_fee_currency text check (provider_fee_currency ~ '^[A-Z]{3}$'),
  provider_settled_amount numeric(14, 2) check (provider_settled_amount >= 0),
  provider_settled_currency text check (provider_settled_currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);
alter table public.payment_provider_details enable row level security;
revoke all on public.payment_provider_details from anon, authenticated;
grant select on public.payment_provider_details to authenticated;
drop policy if exists "Admins read provider details" on public.payment_provider_details;
create policy "Admins read provider details" on public.payment_provider_details
  for select to authenticated using (private.is_admin());

comment on table public.payment_provider_details is
  'The provider''s fee (Flutterwave app_fee, paid by Kwetuly, never added to the traveller''s amount) and settled amount (amount_settled). Admins only.';

-- ---------------------------------------------------------------------------
-- C. Callback log.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,30}$'),
  event_key text not null check (length(event_key) <= 160),
  event_type text check (length(event_type) <= 60),
  tx_ref text check (tx_ref ~ '^RAF[0-9a-f]{32}$'),
  provider_transaction_id text check (provider_transaction_id ~ '^[A-Za-z0-9._:-]{1,64}$'),
  signature_valid boolean not null,
  payload jsonb check (pg_column_size(payload) <= 8192),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result_status text check (length(result_status) <= 20),
  unique (provider, event_key)
);

create index if not exists payment_events_tx_ref_idx on public.payment_events (tx_ref, received_at desc);
create index if not exists payment_events_received_idx on public.payment_events (received_at);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;
drop policy if exists "Admins read payment events" on public.payment_events;
create policy "Admins read payment events" on public.payment_events
  for select to authenticated using (private.is_admin());

comment on table public.payment_events is
  'Every provider callback, signature checked; only allow-listed body fields (no personal or card data). Kept 180 days.';

create or replace function private.purge_payment_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.payment_events where received_at < now() - interval '180 days';
$$;
revoke execute on function private.purge_payment_events() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- D. Open payment links (service role only).
-- ---------------------------------------------------------------------------
create table if not exists public.payment_checkout_links (
  payment_id uuid primary key references public.payments (id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 2048),
  created_at timestamptz not null default now()
);
alter table public.payment_checkout_links enable row level security;
revoke all on public.payment_checkout_links from anon, authenticated;

-- ---------------------------------------------------------------------------
-- E. Checkout throttle.
-- ---------------------------------------------------------------------------
create table if not exists private.deposit_checkout_claims (
  kind text not null check (kind in ('offer_deposit', 'group_deposit')),
  target_id uuid not null,
  claimed_at timestamptz not null,
  primary key (kind, target_id)
);
alter table private.deposit_checkout_claims enable row level security;
revoke all on private.deposit_checkout_claims from public, anon, authenticated;

create or replace function public.claim_deposit_checkout(p_kind text, p_target uuid, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  if p_kind is null or p_kind not in ('offer_deposit', 'group_deposit')
     or p_target is null or p_seconds is null or p_seconds < 1 or p_seconds > 300 then
    raise exception 'claim_deposit_checkout: bad arguments' using errcode = '22023';
  end if;
  insert into private.deposit_checkout_claims as c (kind, target_id, claimed_at)
  values (p_kind, p_target, clock_timestamp())
  on conflict (kind, target_id) do update
    set claimed_at = excluded.claimed_at
    where c.claimed_at < clock_timestamp() - make_interval(secs => p_seconds)
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

revoke execute on function public.claim_deposit_checkout(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_deposit_checkout(text, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- F. One 'paid' payment per offer and per member.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.payments where status = 'paid' and trip_offer_id is not null
             group by trip_offer_id having count(*) > 1)
     or exists (select 1 from public.payments where status = 'paid' and group_member_id is not null
                group by group_member_id having count(*) > 1) then
    raise exception 'Several paid deposits exist for the same offer or member. Ask payments-engineer to check them with the provider (one is a double payment to refund; Walter approves), then run this migration again. Nothing was changed.';
  end if;
end;
$$;

drop index if exists public.payments_offer_idx;
drop index if exists public.payments_member_idx;
create unique index if not exists payments_one_paid_offer on public.payments (trip_offer_id)
  where status = 'paid' and trip_offer_id is not null;
create unique index if not exists payments_one_paid_member on public.payments (group_member_id)
  where status = 'paid' and group_member_id is not null;

-- ---------------------------------------------------------------------------
-- G. Guard on new deposit orders (M1). Same rules as loadOrder in supabase/functions/payments/index.ts.
-- ---------------------------------------------------------------------------
create or replace function private.guard_new_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The last day to start a deposit is this many days before the start date (Walter, 2026-11-07).
  -- Same number as DEPOSIT_LAST_DAY_BEFORE_START in supabase/functions/payments/index.ts.
  c_last_day_before_start constant integer := 8;
  v_today date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_cents bigint;
begin
  if new.status is distinct from 'pending' then
    raise exception 'A new deposit order must start as pending.' using errcode = 'check_violation';
  end if;

  -- Never a new order for a deposit that is already paid or whose money is being checked.
  if exists (
    select 1 from public.payments p
    where p.status in ('paid', 'review')
      and ((new.trip_offer_id is not null and p.trip_offer_id = new.trip_offer_id)
           or (new.group_member_id is not null and p.group_member_id = new.group_member_id))) then
    raise exception 'deposit_not_allowed: this deposit is already paid or being checked.'
      using errcode = 'P0001', hint = 'kwetuly_deposit_guard';
  end if;

  if new.kind = 'group_deposit' then
    select m.price_per_person_usd::bigint * m.seats * t.deposit_percent
      into v_cents
    from public.group_trip_members m
    join public.group_trips t on t.id = m.group_trip_id
    where m.id = new.group_member_id
      and m.traveler_id = new.user_id
      and m.status = 'accepted'
      and m.price_per_person_usd is not null
      and m.price_per_person_usd > 0
      and t.status = 'approved'
      and not t.cancelled
      and t.organizer_kind <> 'traveller'
      and t.deposit_percent > 0
      and t.start_date >= v_today + c_last_day_before_start
      and t.organizer_id = new.payee_user_id
      and case
            when t.guide_id is not null then exists (
              select 1 from public.guides g
              where g.id = t.guide_id
                and g.owner_id = t.organizer_id
                and g.verification_status = 'approved'
                and not g.is_sample)
            else exists (
              select 1 from public.providers p
              where p.owner_id = t.organizer_id
                and p.verification_status = 'approved'
                and not p.is_sample)
          end;
    if v_cents is null then
      raise exception 'deposit_not_allowed: no deposit can be started for this group trip spot.'
        using errcode = 'P0001', hint = 'kwetuly_deposit_guard',
              detail = 'Trip not open, starting within 8 days or started, spot not accepted, price missing, or organiser not approved.';
    end if;
  elsif new.kind = 'offer_deposit' then
    select o.price_total_usd::bigint * o.deposit_percent
      into v_cents
    from public.trip_offers o
    join public.trip_requests r on r.id = o.request_id
    where o.id = new.trip_offer_id
      and r.traveler_id = new.user_id
      and o.status = 'accepted'
      and o.deposit_percent > 0
      and o.offered_by = new.payee_user_id
      and r.status <> 'closed'
      and (r.start_date is null or r.start_date >= v_today + c_last_day_before_start)
      and ((r.start_date is not null and not r.flexible_dates) or o.valid_until is null or o.valid_until >= v_today)
      and case
            when o.guide_id is not null then exists (
              select 1 from public.guides g
              where g.id = o.guide_id
                and g.owner_id = o.offered_by
                and g.verification_status = 'approved'
                and not g.is_sample)
            else exists (
              select 1 from public.providers p
              where p.owner_id = o.offered_by
                and p.verification_status = 'approved'
                and not p.is_sample)
          end;
    if v_cents is null then
      raise exception 'deposit_not_allowed: no deposit can be started for this offer.'
        using errcode = 'P0001', hint = 'kwetuly_deposit_guard',
              detail = 'Offer not accepted, request closed, starting within 8 days or started, offer expired, no deposit, or offerer not approved.';
    end if;
  else
    raise exception 'deposit_not_allowed: unknown deposit kind.'
      using errcode = 'P0001', hint = 'kwetuly_deposit_guard';
  end if;

  -- Exact amounts: dollars from whole cents, shillings from the saved rate, rounded up to the next 100
  -- (the same integer rule as depositTzs in packages/shared/src/payment-rules.ts). No floating point.
  if new.amount_usd is distinct from (v_cents::numeric / 100)
     or new.usd_tzs_rate is null
     or new.rate_source is null
     or new.amount_tzs is distinct from (ceil(v_cents * new.usd_tzs_rate * 100 / 1000000) * 100)::bigint then
    raise exception 'deposit_not_allowed: the deposit amount does not match the price, seats and deposit percent.'
      using errcode = 'P0001', hint = 'kwetuly_deposit_guard';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_new_payment() from public, anon, authenticated;

drop trigger if exists payments_guard_new on public.payments;
create trigger payments_guard_new before insert on public.payments
  for each row execute function private.guard_new_payment();

-- ---------------------------------------------------------------------------
-- H. "Paid out" only on paid deposits whose trip or offer is still going ahead, whose member was not
--    declined and whose payee is still approved, or with an admin override that records a reason (M2).
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists payout_override_reason text
    check (payout_override_reason is null or length(payout_override_reason) between 1 and 500),
  -- Bare uuid, no foreign key: deleting an admin account must not be blocked by the guard.
  add column if not exists payout_override_by uuid,
  add column if not exists payout_override_at timestamptz;

comment on column public.payments.payout_override_reason is
  'Why an admin marked this deposit paid out although the trip check refused it (public.admin_payout_with_override).';
comment on column public.payments.payout_override_by is 'Admin who recorded the last payout override.';
comment on column public.payments.payout_override_at is 'When the last payout override was recorded.';

-- Every override, append-only (the columns above keep only the last one).
create table if not exists private.payout_overrides (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments (id) on delete restrict,
  reason text not null check (length(reason) between 1 and 500),
  overridden_by uuid not null,
  overridden_at timestamptz not null default now()
);
alter table private.payout_overrides enable row level security;
revoke all on private.payout_overrides from public, anon, authenticated, service_role;

create or replace function private.payout_overrides_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'payout_overrides is append-only: % is not allowed.', lower(tg_op)
    using errcode = 'P0001', hint = 'kwetuly_payout_guard';
end;
$$;

revoke execute on function private.payout_overrides_append_only() from public, anon, authenticated;

drop trigger if exists payout_overrides_no_change on private.payout_overrides;
create trigger payout_overrides_no_change before update or delete on private.payout_overrides
  for each row execute function private.payout_overrides_append_only();
drop trigger if exists payout_overrides_no_truncate on private.payout_overrides;
create trigger payout_overrides_no_truncate before truncate on private.payout_overrides
  for each statement execute function private.payout_overrides_append_only();

-- Hook for refund records: TODO(refund-records): once refunds are recorded (Walter approves each one),
-- return true while a refund for this payment is requested, approved, sent or confirmed.
create or replace function private.payment_refund_open(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;

revoke execute on function private.payment_refund_open(uuid) from public, anon, authenticated;

-- guard_payment as in 20261016001600, without the line that silently ignored a tick on an unpaid
-- deposit (guard_payout refuses it now, so the admin sees an error instead of nothing).
create or replace function public.guard_payment()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_payout boolean := new.payout_done;
begin
  -- Admins may only tick "paid out": the row is rebuilt from OLD except payout_done.
  if current_user in ('anon', 'authenticated') then
    new := old;
    new.payout_done := v_payout;
  end if;
  -- Record the last change of the payout tick, whoever made it.
  if new.payout_done is distinct from old.payout_done then
    new.payout_by := (select auth.uid());
    new.payout_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.guard_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_ok boolean;
  v_member_ok boolean;
  v_payee_ok boolean;
  -- Set (for this transaction only) by public.admin_payout_with_override, for this one payment.
  v_override boolean := coalesce(current_setting('kwetuly.payout_override', true), '') = old.id::text;
begin
  -- The override columns are written only through public.admin_payout_with_override.
  if (new.payout_override_reason, new.payout_override_by, new.payout_override_at)
     is distinct from (old.payout_override_reason, old.payout_override_by, old.payout_override_at)
     and not v_override then
    raise exception 'payout_not_allowed: a payout override can only be recorded through admin_payout_with_override.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;

  if new.payout_done is not distinct from old.payout_done then
    return new;
  end if;

  -- Never overridable: only money the provider has confirmed can be paid out.
  if old.status is distinct from 'paid' or new.status is distinct from 'paid' then
    raise exception 'payout_not_allowed: only a paid deposit can be marked or unmarked as paid out.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;

  -- Un-ticking (to correct a mistake) on a paid deposit is allowed; payout_by and payout_at record it.
  if not new.payout_done then
    return new;
  end if;

  -- Never overridable: a deposit with a refund recorded or open is not paid out as well.
  if private.payment_refund_open(old.id) then
    raise exception 'payout_not_allowed: a refund is recorded or open for this deposit.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;

  if old.kind = 'group_deposit' then
    -- The trip: not cancelled, 'approved' or 'pending' (back in review after an organiser's edit).
    select exists (
      select 1
      from public.group_trip_members m
      join public.group_trips t on t.id = m.group_trip_id
      where m.id = old.group_member_id
        and not t.cancelled
        and t.status in ('approved', 'pending'))
      into v_trip_ok;
    -- Refused only when the organiser declined the traveller; a traveller's own 'cancelled' is not.
    select not exists (
      select 1 from public.group_trip_members m
      where m.id = old.group_member_id
        and m.status = 'declined')
      into v_member_ok;
    select exists (
      select 1
      from public.group_trip_members m
      join public.group_trips t on t.id = m.group_trip_id
      where m.id = old.group_member_id
        and case
              when t.guide_id is not null then exists (
                select 1 from public.guides g
                where g.id = t.guide_id
                  and g.owner_id = old.payee_user_id
                  and g.verification_status = 'approved'
                  and not g.is_sample)
              else exists (
                select 1 from public.providers p
                where p.owner_id = old.payee_user_id
                  and p.verification_status = 'approved'
                  and not p.is_sample)
            end)
      into v_payee_ok;
  elsif old.kind = 'offer_deposit' then
    select exists (
      select 1 from public.trip_offers o
      where o.id = old.trip_offer_id
        and o.status = 'accepted')
      into v_trip_ok;
    v_member_ok := true;
    select exists (
      select 1 from public.trip_offers o
      where o.id = old.trip_offer_id
        and case
              when o.guide_id is not null then exists (
                select 1 from public.guides g
                where g.id = o.guide_id
                  and g.owner_id = old.payee_user_id
                  and g.verification_status = 'approved'
                  and not g.is_sample)
              else exists (
                select 1 from public.providers p
                where p.owner_id = old.payee_user_id
                  and p.verification_status = 'approved'
                  and not p.is_sample)
            end)
      into v_payee_ok;
  else
    v_trip_ok := false;
  end if;

  v_trip_ok := coalesce(v_trip_ok, false);
  v_member_ok := coalesce(v_member_ok, false);
  v_payee_ok := coalesce(v_payee_ok, false);

  if v_trip_ok and v_member_ok and v_payee_ok then
    return new;
  end if;

  -- Admin override, with a reason and who (checked again here, not only in the function).
  if v_override
     and nullif(btrim(coalesce(new.payout_override_reason, '')), '') is not null
     and new.payout_override_by is not null
     and new.payout_override_at is not null then
    return new;
  end if;

  raise exception 'payout_not_allowed: the trip or offer is cancelled or taken down, the organiser declined this traveller, or the guide or business being paid is no longer approved. Refund instead, or record an override with a reason.'
    using errcode = 'P0001', hint = 'kwetuly_payout_guard',
          detail = concat_ws(',',
            case when not v_trip_ok then 'trip' end,
            case when not v_member_ok then 'member_declined' end,
            case when not v_payee_ok then 'payee_not_approved' end);
end;
$$;

revoke execute on function private.guard_payout() from public, anon, authenticated;

-- Fires after payments_guard (triggers run in name order).
drop trigger if exists payments_payout_guard on public.payments;
create trigger payments_payout_guard before update on public.payments
  for each row execute function private.guard_payout();

-- Admin-only (admin role and two-step sign-in, private.is_admin()): mark a paid deposit as paid out
-- although the trip, member or payee check refuses it, with a reason. The status and refund rules still
-- apply. Errors: 42501 (not an admin), 22023 (no or too long reason), P0001 hint 'kwetuly_payout_guard'.
create or replace function public.admin_payout_with_override(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_reason text := btrim(regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]+', ' ', 'g'));
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'Only an admin can record a payout override.'
      using errcode = '42501', hint = 'kwetuly_payout_guard';
  end if;
  if length(v_reason) = 0 or length(v_reason) > 500 then
    raise exception 'A reason of 1 to 500 characters is needed for a payout override.'
      using errcode = '22023', hint = 'kwetuly_payout_guard';
  end if;

  perform set_config('kwetuly.payout_override', p_payment_id::text, true);
  update public.payments
     set payout_done = true,
         payout_override_reason = v_reason,
         payout_override_by = v_admin,
         payout_override_at = now()
   where id = p_payment_id
     and payout_done = false;
  if not found then
    raise exception 'payout_not_allowed: no such deposit, or it is already marked as paid out.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;
  insert into private.payout_overrides (payment_id, reason, overridden_by)
  values (p_payment_id, v_reason, v_admin);
  perform set_config('kwetuly.payout_override', '', true);
end;
$$;

revoke execute on function public.admin_payout_with_override(uuid, text) from public, anon;
grant execute on function public.admin_payout_with_override(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- I. Sweeper and log retention.
-- ---------------------------------------------------------------------------
create index if not exists payments_sweep_idx on public.payments (status, created_at)
  where status in ('pending', 'failed');

create or replace function private.sweep_payments()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'payments_function_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'payments_sweep_secret');
begin
  if v_url is null or v_secret is null or length(v_secret) < 32 then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kwetuly-sweep', v_secret),
    body := '{"action":"sweep"}'::jsonb,
    timeout_milliseconds := 60000);
end;
$$;

revoke execute on function private.sweep_payments() from public, anon, authenticated;

select cron.schedule('kwetuly-flutterwave-sweep', '*/5 * * * *', 'select private.sweep_payments()');
select cron.schedule('kwetuly-purge-payment-events', '45 3 * * *', 'select private.purge_payment_events()');

-- ---------------------------------------------------------------------------
-- J. Reconciliation hook (M4). Admins export this for a date range (Tanzania dates) and match it with
--    Flutterwave's transaction export by tx_ref (= order_id), transaction id and amount. A row paid or
--    in review here but missing there, or the other way round, is a finding for Walter.
-- ---------------------------------------------------------------------------
create or replace function public.admin_payments_for_reconciliation(p_from date, p_to date)
returns table (
  order_id text,
  provider text,
  provider_transaction_id text,
  status public.payment_status,
  status_reason text,
  amount_tzs bigint,
  provider_amount numeric,
  provider_fee numeric,
  provider_fee_currency text,
  provider_settled_amount numeric,
  provider_settled_currency text,
  created_at timestamptz,
  paid_at timestamptz,
  payout_done boolean,
  payout_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can export payments for reconciliation.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'Give a date range of at most 92 days.' using errcode = '22023';
  end if;
  return query
    select p.order_id, p.provider, p.provider_transaction_id, p.status, p.status_reason, p.amount_tzs,
           p.provider_amount, d.provider_fee, d.provider_fee_currency, d.provider_settled_amount,
           d.provider_settled_currency, p.created_at, p.paid_at, p.payout_done, p.payout_at
    from public.payments p
    left join public.payment_provider_details d on d.payment_id = p.id
    where (p.created_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
    order by p.created_at;
end;
$$;

revoke execute on function public.admin_payments_for_reconciliation(date, date) from public, anon;
grant execute on function public.admin_payments_for_reconciliation(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- K. The net schema is not for users (L7).
-- ---------------------------------------------------------------------------
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all functions in schema net from anon, authenticated;
