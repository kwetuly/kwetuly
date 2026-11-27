-- Tests for migration 20261203030000_exchange_rates.sql (slice S48, Bank of Tanzania rates).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up accounts, rates and alerts
-- below never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- Rates used are the BoT means of 27 Nov 2026 (USD 2678.1658, EUR 2941.1617), moved to today's date.

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

grant execute on function pg_temp.expect_error(text, text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated, service_role;

-- Start from an empty table inside this transaction (the guard refuses deletes, so it is disabled
-- here only; ROLLBACK restores it).
alter table public.exchange_rates disable trigger exchange_rates_guard_row;
delete from public.exchange_rates;
alter table public.exchange_rates enable trigger exchange_rates_guard_row;
delete from private.exchange_fetch_log;
update public.site_settings set value = '{"on": true}' where key = 'feature.local_prices';

-- Shape and privileges (as postgres) ------------------------------------------------------------
select pg_temp.check((select relrowsecurity from pg_class where oid = 'public.exchange_rates'::regclass), 'RLS on exchange_rates');
select pg_temp.check((select relrowsecurity from pg_class where oid = 'private.exchange_fetch_log'::regclass), 'RLS on fetch log');
select pg_temp.check(not has_table_privilege('anon', 'public.exchange_rates', 'insert'), 'anon cannot insert');
select pg_temp.check(not has_table_privilege('authenticated', 'public.exchange_rates', 'update'), 'authenticated cannot update');
select pg_temp.check(not has_table_privilege('authenticated', 'public.exchange_rates', 'delete'), 'authenticated cannot delete');
select pg_temp.check(not has_column_privilege('anon', 'public.exchange_rates', 'note', 'select'), 'anon cannot read note');
select pg_temp.check(not has_column_privilege('authenticated', 'public.exchange_rates', 'entered_by', 'select'), 'authenticated cannot read entered_by');
select pg_temp.check(has_column_privilege('anon', 'public.exchange_rates', 'tzs_per_unit', 'select'), 'anon reads tzs_per_unit');
select pg_temp.check(not has_function_privilege('anon', 'public.svc_exchange_rates_save(jsonb, text, uuid, int, int)', 'execute'), 'anon cannot save');
select pg_temp.check(not has_function_privilege('authenticated', 'public.svc_exchange_rates_save(jsonb, text, uuid, int, int)', 'execute'), 'authenticated cannot save');
select pg_temp.check(not has_function_privilege('authenticated', 'public.svc_exchange_fetch_failed(text, text, uuid)', 'execute'), 'authenticated cannot log failures');
select pg_temp.check(has_function_privilege('anon', 'public.current_rates()', 'execute'), 'anon runs current_rates');
select pg_temp.check(not has_function_privilege('anon', 'public.admin_set_rate_override(text, numeric, text, text, date, date, text, boolean)', 'execute'), 'anon cannot set overrides');
select pg_temp.check((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
                      where proname in ('current_rates', 'svc_exchange_rates_save', 'svc_exchange_fetch_failed',
                                        'admin_rates_fetch_request', 'admin_set_rate_override', 'admin_end_rate_override',
                                        'admin_review_suspect_rate', 'admin_exchange_rates', 'admin_exchange_fetch_log',
                                        'admin_exchange_rate_actions')
                        and pronamespace = 'public'::regnamespace),
                     'definer functions have an empty search_path');

-- Made-up accounts: admin (f1), traveller (f2) ---------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
values ('f1f1f1f1-0000-4000-8000-0000000000f1', 'xr-admin@example.test', now(), 'authenticated', 'authenticated', '{}'),
       ('f2f2f2f2-0000-4000-8000-0000000000f2', 'xr-traveller@example.test', now(), 'authenticated', 'authenticated', '{}');
update public.profiles set role = 'admin' where id = 'f1f1f1f1-0000-4000-8000-0000000000f1';

-- Rows as parse.ts sends them, dated today and yesterday (East Africa time).
create temp table t_day as select private.tz_today() as d;
grant select on t_day to service_role, authenticated, anon;

-- Service role: save ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

-- No USD row: nothing saved.
select pg_temp.check((public.svc_exchange_rates_save(
  jsonb_build_array(jsonb_build_object('currency', 'EUR', 'buying', '2926.529', 'selling', '2955.7943', 'mean', '2941.1617',
                                       'rate_date', ((select d from t_day) - 1)::text)), 'cron') ->> 'error') = 'no_usd',
  'no USD row is refused');
select pg_temp.check((select count(*) = 0 from public.exchange_rates), 'nothing saved without USD');

-- A USD row whose mean is not the average counts as no USD.
select pg_temp.check((public.svc_exchange_rates_save(
  jsonb_build_array(jsonb_build_object('currency', 'USD', 'buying', '2664.8416', 'selling', '2691.49', 'mean', '2600',
                                       'rate_date', ((select d from t_day) - 1)::text)), 'cron') ->> 'error') = 'no_usd',
  'bad USD mean is refused');

-- Yesterday: USD and EUR saved; GOLD, PLN and an old date are not.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(
  jsonb_build_object('currency', 'USD', 'buying', '2664.8416', 'selling', '2691.49', 'mean', '2678.1658', 'rate_date', ((select d from t_day) - 1)::text),
  jsonb_build_object('currency', 'EUR', 'buying', '2926.529', 'selling', '2955.7943', 'mean', '2941.1617', 'rate_date', ((select d from t_day) - 1)::text),
  jsonb_build_object('currency', 'GOLD', 'buying', '1', 'selling', '1', 'mean', '1', 'rate_date', ((select d from t_day) - 1)::text),
  jsonb_build_object('currency', 'PLN', 'buying', '700', 'selling', '700', 'mean', '700', 'rate_date', ((select d from t_day) - 1)::text),
  jsonb_build_object('currency', 'GBP', 'buying', '3480', 'selling', '3510', 'mean', '3495', 'rate_date', ((select d from t_day) - 8)::text),
  jsonb_build_object('currency', 'JPY', 'buying', '16.7337', 'selling', '16.901', 'mean', '16.8174', 'rate_date', ((select d from t_day) + 1)::text)
), 'cron') ->> 'saved')::int = 2, 'two rows saved');
select pg_temp.check((select count(*) = 2 from public.exchange_rates where source = 'bot' and status = 'active'), 'two active BoT rows');

-- Same day again: skipped, not doubled.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(
  jsonb_build_object('currency', 'USD', 'buying', '2664.8416', 'selling', '2691.49', 'mean', '2678.1658', 'rate_date', ((select d from t_day) - 1)::text)
), 'cron') ->> 'skipped')::int = 1, 'same day is skipped');

-- Today: EUR jumps 20% -> suspect, and admins get an alert.
select pg_temp.check((public.svc_exchange_rates_save(jsonb_build_array(
  jsonb_build_object('currency', 'USD', 'buying', '2664.8416', 'selling', '2691.49', 'mean', '2678.1658', 'rate_date', (select d from t_day)::text),
  jsonb_build_object('currency', 'EUR', 'buying', '3500', 'selling', '3560', 'mean', '3530', 'rate_date', (select d from t_day)::text)
), 'cron') ->> 'suspect')::int = 1, 'a 20% jump is suspect');

-- Guard: only status changes, along allowed steps; no deletes (service_role too).
select pg_temp.expect_error($q$update public.exchange_rates set tzs_per_unit = 1 where currency = 'USD'$q$, 'value cannot change', '42501');
select pg_temp.expect_error($q$delete from public.exchange_rates where currency = 'USD'$q$, 'no deletes', '42501');
select pg_temp.expect_error($q$update public.exchange_rates set status = 'suspect' where currency = 'USD'$q$, 'active cannot become suspect', '42501');
reset role;

select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'exchange_rates_suspect' and recipient_user_id = 'f1f1f1f1-0000-4000-8000-0000000000f1'),
                     'admin alerted about the suspect row');
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'exchange_rates_failed' and recipient_user_id = 'f1f1f1f1-0000-4000-8000-0000000000f1'),
                     'admin alerted about no USD, once in 12 hours (two failed runs)');
select pg_temp.check((select count(*) = 5 from private.exchange_fetch_log), 'every run logged');

-- Signed out: current rates --------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check((select tzs_per_unit = 2941.1617 from public.current_rates() where currency = 'EUR'), 'suspect EUR not used; yesterday''s EUR shown');
select pg_temp.check((select rate_date = (select d from t_day) from public.current_rates() where currency = 'USD'), 'newest USD shown');
select pg_temp.check((select count(*) = 0 from public.exchange_rates where status <> 'active'), 'anon sees active rows only');
select pg_temp.expect_error($q$select note from public.exchange_rates$q$, 'anon cannot read notes', '42501');
select pg_temp.expect_error($q$insert into public.exchange_rates (currency, tzs_per_unit, source, source_name, rate_date, valid_until, entered_by)
                               values ('EUR', 1, 'admin', 'Me', current_date, current_date, gen_random_uuid())$q$, 'anon cannot insert', '42501');
select pg_temp.expect_error($q$select public.admin_set_rate_override('EUR', 1, 'x', null, current_date, current_date, null, false)$q$, 'anon cannot run admin functions', '42501');
reset role;

-- Traveller -------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"f2f2f2f2-0000-4000-8000-0000000000f2","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, current_date, current_date + 7, null, false)$q$, 'traveller cannot set overrides', '42501');
select pg_temp.expect_error($q$select public.admin_rates_fetch_request()$q$, 'traveller cannot fetch', '42501');
select pg_temp.expect_error($q$select * from public.admin_exchange_fetch_log(5)$q$, 'traveller cannot read the log', '42501');
reset role;

-- Admin with a one-step session is refused -----------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"f1f1f1f1-0000-4000-8000-0000000000f1","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_end_rate_override(gen_random_uuid())$q$, 'one-step admin refused', '42501');
reset role;

-- Admin with two-step --------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"f1f1f1f1-0000-4000-8000-0000000000f1","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.check(public.admin_rates_fetch_request() = 'f1f1f1f1-0000-4000-8000-0000000000f1', 'admin may fetch now');

-- Override checks.
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, ' ', null, (select d from t_day), (select d from t_day) + 7, null, false)$q$, 'source name required', '22023');
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', 'http://nbp.pl', (select d from t_day), (select d from t_day) + 7, null, false)$q$, 'https only', '22023');
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 31, null, false)$q$, 'at most 30 days', '22023');
select pg_temp.expect_error($q$select public.admin_set_rate_override('XAU', 700, 'Somewhere', null, (select d from t_day), (select d from t_day) + 7, null, false)$q$, 'currency on the list', '22023');
select pg_temp.expect_error($q$select public.admin_set_rate_override('PLN', 0, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, null, false)$q$, 'positive rate', '22023');

-- PLN: no BoT rate, saved at once (figure is test data only).
select pg_temp.check((public.admin_set_rate_override('PLN', 700, 'National Bank of Poland', null, (select d from t_day), (select d from t_day) + 7, 'test', false) ->> 'saved')::boolean,
                     'PLN override saved');

-- EUR more than 25% from BoT needs a second confirming call.
select pg_temp.check((public.admin_set_rate_override('EUR', 4000, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, false) ->> 'needs_confirm')::boolean,
                     'far override asks to confirm');
select pg_temp.check((select count(*) = 0 from public.admin_exchange_rates('EUR', 50) where source = 'admin'), 'nothing saved before confirming');
select pg_temp.check((public.admin_set_rate_override('EUR', 4000, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, true) ->> 'saved')::boolean,
                     'confirmed far override saved');
select pg_temp.check((select tzs_per_unit = 4000 and source = 'admin' from public.current_rates() where currency = 'EUR'), 'override wins');
select pg_temp.check((select source_name = 'National Bank of Poland' and rate_date = (select d from t_day) from public.current_rates() where currency = 'PLN'),
                     'PLN shows source name and date');

-- A second EUR override ends the first.
select public.admin_set_rate_override('EUR', 2950, 'Test source', null, (select d from t_day), (select d from t_day) + 7, null, false);
select pg_temp.check((select count(*) = 1 from public.admin_exchange_rates('EUR', 50) where source = 'admin' and status = 'active'), 'one active override per currency');

-- End the override: BoT again.
select public.admin_end_rate_override((select id from public.admin_exchange_rates('EUR', 50) where source = 'admin' and status = 'active'));
select pg_temp.check((select source = 'bot' and tzs_per_unit = 2941.1617 from public.current_rates() where currency = 'EUR'), 'BoT after ending the override');
select pg_temp.expect_error($q$select public.admin_end_rate_override((select id from public.admin_exchange_rates('USD', 5) limit 1))$q$, 'BoT rows are not overrides', 'P0002');

-- Suspect row: use anyway.
select public.admin_review_suspect_rate((select id from public.admin_exchange_rates('EUR', 50) where status = 'suspect'), true);
select pg_temp.check((select tzs_per_unit = 3530 from public.current_rates() where currency = 'EUR'), 'suspect row used after "Use anyway"');
select pg_temp.check((select count(*) = 6 from public.admin_exchange_rate_actions(50)), 'admin actions logged');
select pg_temp.check((select count(*) >= 5 from public.admin_exchange_fetch_log(20)), 'admin reads the fetch log');
reset role;

-- The switch off hides every estimate.
update public.site_settings set value = '{"on": false}' where key = 'feature.local_prices';
select pg_temp.check((select count(*) = 0 from public.current_rates()), 'switch off: no rates');
update public.site_settings set value = '{"on": true}' where key = 'feature.local_prices';

select 'all passed';
rollback;
