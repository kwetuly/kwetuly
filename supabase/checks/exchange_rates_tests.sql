-- Tests for migration 20261203030000_exchange_rates.sql (slice S48, Bank of Tanzania rates).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up accounts, rates and alerts
-- below never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- Rates used are the BoT means of 27 Nov 2026 (USD 2678.1658, EUR 2941.1617, KES 20.5617), moved to
-- dates around today. PLN figures are test values only.

begin;

create function pg_temp.expect_error(p_sql text, p_label text, p_state text default 'P0001', p_message text default null)
returns void language plpgsql as $$
declare
  v_ran boolean := false;
  v_state text;
  v_message text;
begin
  begin
    execute p_sql;
    v_ran := true;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  if v_ran then
    raise exception 'FAIL: % (should have been refused)', p_label;
  end if;
  if v_state is distinct from p_state then
    raise exception 'FAIL: % (wrong error %: %)', p_label, v_state, v_message;
  end if;
  if p_message is not null and position(lower(p_message) in lower(v_message)) = 0 then
    raise exception 'FAIL: % (wrong message: %)', p_label, v_message;
  end if;
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_label;
  end if;
end $$;

create temp table t_day as select private.tz_today() as d;
grant select on t_day to service_role, authenticated, anon;

-- One BoT row as parse.ts sends it.
create function pg_temp.r(p_cur text, p_buy text, p_sell text, p_mean text, p_days_ago int) returns jsonb
language sql as $$
  select jsonb_build_object('currency', p_cur, 'buying', p_buy, 'selling', p_sell, 'mean', p_mean,
                            'rate_date', ((select d from t_day) - p_days_ago)::text)
$$;

-- Alerts of one kind to the test admin.
create function pg_temp.alerts(p_event text) returns bigint language sql as $$
  select count(*) from public.notification_outbox
   where event = p_event and recipient_user_id = 'f1f1f1f1-0000-4000-8000-0000000000f1'
$$;

grant execute on function pg_temp.expect_error(text, text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated, service_role;
grant execute on function pg_temp.r(text, text, text, text, int) to service_role, authenticated;

-- Start from empty tables inside this transaction (the guard refuses deletes, so it is disabled here
-- only; ROLLBACK restores everything).
alter table public.exchange_rates disable trigger exchange_rates_guard_row;
delete from public.exchange_rates;
alter table public.exchange_rates enable trigger exchange_rates_guard_row;
delete from private.exchange_fetch_log;
delete from private.exchange_fetch_requests;
delete from private.exchange_override_pending;
delete from public.notification_outbox where event like 'exchange_rates_%';
update public.site_settings set value = '{"on": true}' where key = 'feature.local_prices';

-- Shape and privileges (as postgres) ------------------------------------------------------------
select pg_temp.check((select relrowsecurity from pg_class where oid = 'public.exchange_rates'::regclass), 'RLS on exchange_rates');
select pg_temp.check((select bool_and(relrowsecurity) from pg_class
                      where oid in ('private.exchange_fetch_log'::regclass, 'private.exchange_fetch_requests'::regclass,
                                    'private.exchange_override_pending'::regclass, 'private.exchange_rate_actions'::regclass)),
                     'RLS on the private tables');
select pg_temp.check(not has_table_privilege('anon', 'public.exchange_rates', 'insert'), 'anon cannot insert');
select pg_temp.check(not has_table_privilege('authenticated', 'public.exchange_rates', 'update'), 'authenticated cannot update');
select pg_temp.check(not has_table_privilege('authenticated', 'public.exchange_rates', 'delete'), 'authenticated cannot delete');
select pg_temp.check(not has_table_privilege('service_role', 'public.exchange_rates', 'insert'), 'service_role cannot insert directly');
select pg_temp.check(not has_table_privilege('service_role', 'public.exchange_rates', 'update'), 'service_role cannot update directly');
select pg_temp.check(not has_table_privilege('service_role', 'private.exchange_fetch_log', 'insert'), 'service_role cannot write the log directly');
select pg_temp.check(not has_column_privilege('anon', 'public.exchange_rates', 'note', 'select'), 'anon cannot read note');
select pg_temp.check(not has_column_privilege('authenticated', 'public.exchange_rates', 'entered_by', 'select'), 'authenticated cannot read entered_by');
select pg_temp.check(has_column_privilege('anon', 'public.exchange_rates', 'tzs_per_unit', 'select'), 'anon reads tzs_per_unit');
select pg_temp.check(not has_function_privilege('anon', 'public.svc_exchange_rates_save(jsonb, text, uuid, int, int)', 'execute'), 'anon cannot save');
select pg_temp.check(not has_function_privilege('authenticated', 'public.svc_exchange_rates_save(jsonb, text, uuid, int, int)', 'execute'), 'authenticated cannot save');
select pg_temp.check(not has_function_privilege('authenticated', 'public.svc_exchange_fetch_failed(text, text, uuid)', 'execute'), 'authenticated cannot log failures');
select pg_temp.check(not has_function_privilege('service_role', 'private.run_exchange_rates_fetch()', 'execute'), 'only postgres (cron) runs the fetch call');
select pg_temp.check(not has_function_privilege('authenticated', 'private.exchange_rates_watchdog()', 'execute'), 'only postgres (cron) runs the watchdog');
select pg_temp.check(has_function_privilege('anon', 'public.current_rates()', 'execute'), 'anon runs current_rates');
select pg_temp.check(not has_function_privilege('anon', 'public.admin_set_rate_override(text, numeric, text, text, date, date, text, boolean)', 'execute'), 'anon cannot set overrides');
select pg_temp.check((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
                      where proname in ('current_rates', 'svc_exchange_rates_save', 'svc_exchange_fetch_failed',
                                        'admin_rates_fetch_request', 'admin_set_rate_override', 'admin_end_rate_override',
                                        'admin_review_suspect_rate', 'admin_exchange_rates', 'admin_exchange_fetch_log',
                                        'admin_exchange_rate_actions')
                        and pronamespace = 'public'::regnamespace),
                     'definer functions have an empty search_path');
select pg_temp.expect_error($q$insert into public.exchange_rates (currency, tzs_per_unit, buying, selling, source, source_name, source_url, rate_date, fetched_at)
                               values ('IRR', 1, 1, 1, 'bot', 'Bank of Tanzania', 'https://www.bot.go.tz/', current_date, now())$q$,
                            'check constraint refuses a currency off the list', '23514', 'exchange_rates_currency_allowed');
select pg_temp.expect_error($q$truncate public.exchange_rates$q$, 'truncate refused', '42501', 'exchange rates are kept');

-- Made-up accounts: admin (f1), traveller (f2) ---------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
values ('f1f1f1f1-0000-4000-8000-0000000000f1', 'xr-admin@example.test', now(), 'authenticated', 'authenticated', '{}'),
       ('f2f2f2f2-0000-4000-8000-0000000000f2', 'xr-traveller@example.test', now(), 'authenticated', 'authenticated', '{}');
update public.profiles set role = 'admin' where id = 'f1f1f1f1-0000-4000-8000-0000000000f1';

-- Service role: save ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select pg_temp.expect_error($q$insert into public.exchange_rates (currency, tzs_per_unit, buying, selling, source, source_name, source_url, rate_date, fetched_at)
                               values ('USD', 1, 1, 1, 'bot', 'Bank of Tanzania', 'https://www.bot.go.tz/', current_date, now())$q$,
                            'service_role cannot insert directly', '42501', 'permission denied');

-- 1. No USD row: nothing saved.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(pg_temp.r('EUR', '2926.529', '2955.7943', '2941.1617', 1)), 'cron') ->> 'error') = 'no_usd',
                     'no USD row is refused');
select pg_temp.check((select count(*) = 0 from public.exchange_rates), 'nothing saved without USD');

-- 2. A USD row whose mean is not the average counts as no USD.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(pg_temp.r('USD', '2664.8416', '2691.49', '2600', 1)), 'cron') ->> 'error') = 'no_usd',
                     'bad USD mean is refused');

-- 3. Yesterday: USD and EUR saved; GOLD, PLN, an 8-day-old row and a future row are not.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(
  pg_temp.r('USD', '2664.8416', '2691.49', '2678.1658', 1),
  pg_temp.r('EUR', '2926.529', '2955.7943', '2941.1617', 1),
  pg_temp.r('GOLD', '1', '1', '1', 1),
  pg_temp.r('PLN', '700', '700', '700', 1),
  pg_temp.r('GBP', '3480', '3510', '3495', 8),
  pg_temp.r('JPY', '16.7337', '16.901', '16.8174', -1)
), 'cron') ->> 'saved')::int = 2, 'two rows saved');
select pg_temp.check((select count(*) = 2 from public.exchange_rates where source = 'bot' and status = 'active'), 'two active BoT rows');

-- 4. Same day again: skipped, not doubled.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(pg_temp.r('USD', '2664.8416', '2691.49', '2678.1658', 1)), 'cron') ->> 'skipped')::int = 1,
                     'same day is skipped');

-- 5. Today: EUR jumps 20% -> suspect, and admins get an alert.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(
  pg_temp.r('USD', '2664.8416', '2691.49', '2678.1658', 0),
  pg_temp.r('EUR', '3500', '3560', '3530', 0)
), 'cron') ->> 'suspect')::int = 1, 'a 20% jump is suspect');

-- Guard: only status changes, along allowed steps; no deletes, even through a definer path.
reset role;
select pg_temp.expect_error($q$update public.exchange_rates set tzs_per_unit = 1 where currency = 'USD'$q$, 'value cannot change', '42501', 'only their status');
select pg_temp.expect_error($q$delete from public.exchange_rates where currency = 'USD'$q$, 'no deletes', '42501', 'exchange rates are kept');
select pg_temp.expect_error($q$update public.exchange_rates set status = 'suspect' where currency = 'USD'$q$, 'active cannot become suspect', '42501', 'status cannot go from active to suspect');

select pg_temp.check(pg_temp.alerts('exchange_rates_suspect') = 1, 'admin alerted about the suspect row');
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'admin alerted about no USD, once in 12 hours (two failed runs)');
select pg_temp.check((select count(*) = 5 from private.exchange_fetch_log), 'every run logged');

-- 15% boundary (KES): 14.99% is used, 15.01% is suspect.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.svc_exchange_rates_save(jsonb_build_array(pg_temp.r('USD', '2664.8416', '2691.49', '2678.1658', 3),
                                                        pg_temp.r('KES', '20.5617', '20.5617', '20.5617', 3)), 'cron');
-- 23.6459 / 20.5617 = 1.149997
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(pg_temp.r('USD', '2664.8416', '2691.49', '2678.1658', 2),
                                                                       pg_temp.r('KES', '23.6459', '23.6459', '23.6459', 2)), 'cron') ->> 'suspect')::int = 0,
                     'just under 15% is used');
-- 27.1952 / 23.6459 = 1.150102
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(pg_temp.r('USD', '2664.8416', '2691.49', '2678.1658', 1),
                                                                       pg_temp.r('KES', '27.1952', '27.1952', '27.1952', 1)), 'cron') ->> 'suspect')::int = 1,
                     'just over 15% is suspect');
reset role;

-- Old rows and expired overrides (written as postgres, as only an old database could hold them).
insert into public.exchange_rates (currency, tzs_per_unit, buying, selling, source, source_name, source_url, rate_date, fetched_at)
values ('GBP', 3495, 3480, 3510, 'bot', 'Bank of Tanzania', 'https://www.bot.go.tz/ExchangeRate/excRates?lang=en',
        (select d from t_day) - 8, now() - interval '8 days');
insert into public.exchange_rates (currency, tzs_per_unit, source, source_name, rate_date, valid_until, entered_by)
values ('USD', 2500, 'admin', 'Expired test override', (select d from t_day) - 10, (select d from t_day) - 1,
        'f1f1f1f1-0000-4000-8000-0000000000f1');

-- Failure rules ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
delete from public.notification_outbox where event = 'exchange_rates_failed';
set local role service_role;
select public.svc_exchange_fetch_failed('timeout', 'cron');
reset role;
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 0, 'a timeout with a good run in 48 hours does not alert');

set local role service_role;
select public.svc_exchange_fetch_failed('no_table', 'cron');
select public.svc_exchange_fetch_failed('no_table', 'cron');
reset role;
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'no_table alerts at once, once in 12 hours');

delete from public.notification_outbox where event = 'exchange_rates_failed';
set local role service_role;
select public.svc_exchange_fetch_failed('no_rows', 'cron');
reset role;
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'no_rows alerts at once');

delete from public.notification_outbox where event = 'exchange_rates_failed';
set local role service_role;
select public.svc_exchange_fetch_failed('no_usd', 'cron');
reset role;
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'no_usd alerts at once');

delete from public.notification_outbox where event = 'exchange_rates_failed';
set local role service_role;
select public.svc_exchange_fetch_failed('stale', 'cron');
reset role;
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'stale alerts at once');

-- No good run for 49 hours: a timeout alerts, and so does the watchdog.
update private.exchange_fetch_log set run_at = now() - interval '49 hours';
delete from public.notification_outbox where event = 'exchange_rates_failed';
set local role service_role;
select public.svc_exchange_fetch_failed('timeout', 'cron');
reset role;
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'a timeout after 48 hours without a good run alerts');
delete from public.notification_outbox where event = 'exchange_rates_failed';
select private.exchange_rates_watchdog();
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 1, 'watchdog alerts without a good run in 48 hours');
update private.exchange_fetch_log set run_at = now() where ok;
delete from public.notification_outbox where event = 'exchange_rates_failed';
select private.exchange_rates_watchdog();
select pg_temp.check(pg_temp.alerts('exchange_rates_failed') = 0, 'watchdog quiet after a good run');

-- Signed out: current rates --------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check((select tzs_per_unit = 2941.1617 from public.current_rates() where currency = 'EUR'), 'suspect EUR not used; yesterday''s EUR shown');
select pg_temp.check((select source = 'bot' and rate_date = (select d from t_day) from public.current_rates() where currency = 'USD'),
                     'expired override not used; newest BoT USD shown');
select pg_temp.check(not exists (select 1 from public.current_rates() where currency = 'GBP'), 'an 8-day-old BoT row is not shown');
select pg_temp.check((select tzs_per_unit = 23.6459 from public.current_rates() where currency = 'KES'), 'KES under 15% used, over 15% not');
select pg_temp.check((select count(*) = 0 from public.exchange_rates where status <> 'active'), 'anon sees active rows only');
select pg_temp.expect_error($q$select note from public.exchange_rates$q$, 'anon cannot read notes', '42501', 'permission denied');
select pg_temp.expect_error($q$insert into public.exchange_rates (currency, tzs_per_unit, source, source_name, rate_date, valid_until, entered_by)
                               values ('EUR', 1, 'admin', 'Me', current_date, current_date, gen_random_uuid())$q$, 'anon cannot insert', '42501', 'permission denied');
select pg_temp.expect_error($q$select public.admin_set_rate_override('EUR', 1, 'x', null, current_date, current_date, null, false)$q$,
                            'anon cannot run admin functions', '42501', 'permission denied');
reset role;

-- Traveller -------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"f2f2f2f2-0000-4000-8000-0000000000f2","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, current_date, current_date + 7, null, false)$q$,
                            'traveller cannot set overrides', '42501', 'two-step');
select pg_temp.expect_error($q$select public.admin_rates_fetch_request()$q$, 'traveller cannot fetch', '42501', 'two-step');
select pg_temp.expect_error($q$select * from public.admin_exchange_fetch_log(5)$q$, 'traveller cannot read the log', '42501', 'two-step');
reset role;

-- Admin with a one-step session is refused -----------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"f1f1f1f1-0000-4000-8000-0000000000f1","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_end_rate_override(gen_random_uuid())$q$, 'one-step admin refused', '42501', 'two-step');
select pg_temp.expect_error($q$select public.admin_rates_fetch_request()$q$, 'one-step admin cannot fetch', '42501', 'two-step');
reset role;

-- Admin with two-step --------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"f1f1f1f1-0000-4000-8000-0000000000f1","aal":"aal2"}', true);
set local role authenticated;

-- "Fetch now": recorded at once, a second request within 2 minutes is refused.
select pg_temp.check(public.admin_rates_fetch_request() = 'f1f1f1f1-0000-4000-8000-0000000000f1', 'admin may fetch now');
select pg_temp.expect_error($q$select public.admin_rates_fetch_request()$q$, 'second fetch within 2 minutes refused', 'P0001', 'less than 2 minutes');

-- Override input checks.
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, ' ', null, (select d from t_day), (select d from t_day) + 7, null, false)$q$,
                            'source name required', '22023', 'source name is required');
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', 'http://nbp.pl', (select d from t_day), (select d from t_day) + 7, null, false)$q$,
                            'https only', '22023', 'https://');
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 31, null, false)$q$,
                            'at most 30 days', '22023', '30 days from today');
select pg_temp.expect_error($q$select public.admin_set_rate_override('XAU', 700, 'Somewhere', null, (select d from t_day), (select d from t_day) + 7, null, false)$q$,
                            'currency on the list', '22023', 'not on the list');
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 0, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, null, false)$q$,
                            'positive rate', '22023', 'positive number');

-- First PLN override (no BoT rate, no earlier override): always needs the confirming second call.
select pg_temp.check((select (x ->> 'needs_confirm')::boolean and x ->> 'reason' = 'first'
                        from public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, 'test', true) x),
                     'first PLN override: confirm flag alone does not save');
select pg_temp.check((public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, 'test', true) ->> 'saved')::boolean,
                     'first PLN override saved on the second, identical call');
select pg_temp.check((select source_name = 'National Bank of Poland' and rate_date = (select d from t_day) from public.current_rates() where currency = 'PLN'),
                     'PLN shows source name and date');
-- Next PLN override is compared with the newest PLN override: 720 is close, 1000 is not.
select pg_temp.check((public.admin_set_rate_override('PLN', 720, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, null, false) ->> 'saved')::boolean,
                     'close PLN override saved at once');
select pg_temp.check((select x ->> 'reason' = 'far' and (x ->> 'reference_rate')::numeric = 720
                        from public.admin_set_rate_override('PLN', 1000, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, null, false) x),
                     'far PLN override compared with the newest PLN override');

-- EUR more than 25% from BoT: the second call must repeat the same rate.
select pg_temp.check((select (x ->> 'needs_confirm')::boolean and x ->> 'reason' = 'far'
                        from public.admin_set_rate_override('EUR', 4000, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, false) x),
                     'far override asks to confirm');
select pg_temp.check((public.admin_set_rate_override('EUR', 4100, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, true) ->> 'saved')::boolean is false,
                     'confirming a different rate does not save');
select pg_temp.check((select count(*) = 0 from public.admin_exchange_rates('EUR', 50) where source = 'admin'), 'nothing saved before confirming');
select pg_temp.check((public.admin_set_rate_override('EUR', 4100, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, true) ->> 'saved')::boolean,
                     'confirmed far override saved');
select pg_temp.check((select tzs_per_unit = 4100 and source = 'admin' from public.current_rates() where currency = 'EUR'), 'override wins');

-- A second EUR override ends the first.
select public.admin_set_rate_override('EUR', 2950, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, false);
select pg_temp.check((select count(*) = 1 from public.admin_exchange_rates('EUR', 50) where source = 'admin' and status = 'active'), 'one active override per currency');

-- End the override: BoT again.
select public.admin_end_rate_override((select id from public.admin_exchange_rates('EUR', 50) where source = 'admin' and status = 'active'));
select pg_temp.check((select source = 'bot' and tzs_per_unit = 2941.1617 from public.current_rates() where currency = 'EUR'), 'BoT after ending the override');
select pg_temp.expect_error($q$select public.admin_end_rate_override((select id from public.admin_exchange_rates('USD', 50) where source = 'bot' limit 1))$q$,
                            'BoT rows are not overrides', 'P0002', 'no active override');

-- Suspect row: use anyway, and ignore.
select public.admin_review_suspect_rate((select id from public.admin_exchange_rates('EUR', 50) where status = 'suspect'), true);
select pg_temp.check((select tzs_per_unit = 3530 from public.current_rates() where currency = 'EUR'), 'suspect row used after "Use anyway"');
select public.admin_review_suspect_rate((select id from public.admin_exchange_rates('KES', 50) where status = 'suspect'), false);
select pg_temp.check((select tzs_per_unit = 23.6459 from public.current_rates() where currency = 'KES'), 'ignored row stays unused');
select pg_temp.expect_error($q$select public.admin_review_suspect_rate((select id from public.admin_exchange_rates('KES', 50) where status = 'ended' limit 1), true)$q$,
                            'an ignored row cannot be used later', 'P0002', 'no suspect rate');
select pg_temp.check((select count(*) filter (where action = 'override_set_far') = 2
                         and count(*) filter (where action = 'override_replaced') = 2
                         and count(*) filter (where action = 'override_ended') = 1
                         and count(*) filter (where action = 'suspect_used') = 1
                         and count(*) filter (where action = 'suspect_ignored') = 1
                        from public.admin_exchange_rate_actions(100)), 'admin actions logged');
select pg_temp.check((select count(*) >= 5 from public.admin_exchange_fetch_log(50)), 'admin reads the fetch log');
reset role;

-- The switch off hides every estimate.
update public.site_settings set value = '{"on": false}' where key = 'feature.local_prices';
select pg_temp.check((select count(*) = 0 from public.current_rates()), 'switch off: no rates');
update public.site_settings set value = '{"on": true}' where key = 'feature.local_prices';

select 'all passed';
rollback;
