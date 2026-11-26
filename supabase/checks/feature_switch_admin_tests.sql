-- Tests for migration 20261126000000_feature_switch_admin.sql (slice W1-1 / S1, admin feature switches).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users and every switch change
-- below never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".

begin;

-- expect_error checks the error code and, when given, a part of the message (security review L6).
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

-- Seed state (as postgres, no JWT) ---------------------------------------------------------
select pg_temp.check((select count(*) >= 70 from public.site_settings where key like 'feature.%'), 'all switches seeded');
select pg_temp.check(not exists (select 1 from public.site_settings where key like 'feature.%' and (value - 'on') <> '{}'::jsonb),
                     'public rows are exactly {"on": bool}');
select pg_temp.check((select value = '{"on": false}'::jsonb from public.site_settings where key = 'feature.payments_live'), 'payments_live off');
select pg_temp.check((select value = '{"on": false}'::jsonb from public.site_settings where key = 'feature.reservation_commission_billing'),
                     'reservation_commission_billing still off');
select pg_temp.check(private.feature_on('save_to_travel'), 'save_to_travel stays on');
select pg_temp.check(private.feature_on('payments_manual'), 'payments_manual on');
select pg_temp.check((select legal = 'pending' from private.feature_switch_meta where feature_id = 'marketplace'), 'marketplace legal pending');
select pg_temp.check((select legal = 'none' from private.feature_switch_meta where feature_id = 'stories'), 'stories legal none');
select pg_temp.check((select count(*) >= 70 from private.feature_switch_meta), 'admin data for every switch');
select pg_temp.check(not exists (select 1 from private.feature_switch_meta where team_only), 'nothing starts as a team preview');
select pg_temp.check(private.feature_on('stories'), 'feature_on still reads on');
select pg_temp.check(not private.feature_on('no_such_feature'), 'missing row reads off');
select pg_temp.check((select count(*) > 0 from private.feature_switch_log), 'seed changes logged');

-- Money gates
select pg_temp.check(not private.money_feature_on('mobile_money'), 'API money path off while payments_live is off');
select pg_temp.check(private.manual_payments_on('jobs_contact_fees'), 'Lipa payments do not depend on payments_live');
select pg_temp.check(not private.manual_payments_on('no_such_feature'), 'Lipa payments need the feature switch too');

-- Shape and admin data checks (as postgres) ---------------------------------------------------
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true, "legal": "pending"}' where key = 'feature.stories'$q$,
                            'extra key refused', '23514');
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": "yes"}' where key = 'feature.stories'$q$, 'bad on refused', '23514');
select pg_temp.expect_error($q$update private.feature_switch_meta set legal = 'cleared' where feature_id = 'stories'$q$,
                            'cleared without date refused', '23514');
select pg_temp.expect_error($q$update private.feature_switch_meta set team_only = true where feature_id = 'payments_live'$q$,
                            'payments_live never a team preview', '23514');
select pg_temp.expect_error($q$update private.feature_switch_meta set legal = 'cleared', legal_checked_on = date '2099-01-01' where feature_id = 'stories'$q$,
                            'future date refused by the table', 'P0001', 'date out of range');
select pg_temp.expect_error($q$delete from private.feature_switch_meta$q$, 'admin data never deleted', 'P0001', 'cannot be changed');

-- Made-up accounts: member (d1), admin (d2) --------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('d1d1d1d1-0000-4000-8000-0000000000d1', 'fs-member@example.test', 'authenticated', 'authenticated', '{}'),
       ('d2d2d2d2-0000-4000-8000-0000000000d2', 'fs-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set role = 'admin', full_name = 'FS test admin' where id = 'd2d2d2d2-0000-4000-8000-0000000000d2';

-- Team preview on one row, switched off, as postgres.
update public.site_settings set value = '{"on": false}' where key = 'feature.farm_page';
update private.feature_switch_meta set team_only = true where feature_id = 'farm_page';

-- Anonymous visitor ------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check(not private.feature_visible('farm_page'), 'anon: team preview hidden');
select pg_temp.check(not public.feature_visible('farm_page'), 'anon: public wrapper hides it too');
select pg_temp.check(private.feature_visible('stories'), 'anon: on switch visible');
select pg_temp.expect_error($q$select public.admin_set_feature('stories', false)$q$, 'anon cannot set', '42501');
select pg_temp.expect_error($q$select * from public.admin_feature_rows()$q$, 'anon cannot read admin rows', '42501');
select pg_temp.expect_error($q$select * from private.feature_switch_meta$q$, 'anon cannot read admin data', '42501');
select pg_temp.expect_error($q$select * from private.feature_switch_log$q$, 'anon cannot read log table', '42501');
reset role;

-- Signed-in member -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-4000-8000-0000000000d1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_set_feature('stories', false)$q$, 'member cannot set', 'P0001', 'admins only');
select pg_temp.expect_error($q$select * from public.admin_feature_last_changes()$q$, 'member cannot read last changes', 'P0001', 'admins only');
select pg_temp.expect_error($q$select * from public.admin_feature_rows()$q$, 'member cannot read admin rows', 'P0001', 'admins only');
select pg_temp.check(not private.feature_visible('farm_page'), 'member: team preview hidden');
update public.site_settings set value = '{"on": false}' where key = 'feature.stories';   -- RLS: no rows
reset role;
select pg_temp.check(private.feature_on('stories'), 'member update changed nothing');

-- Admin with password only (aal1) ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-4000-8000-0000000000d2","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_set_feature('stories', false)$q$, 'admin without two-step cannot set', 'P0001', 'admins only');
reset role;

-- Admin with two-step (aal2) ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-4000-8000-0000000000d2","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.check(private.feature_visible('farm_page'), 'admin: team preview visible');
select pg_temp.check(public.feature_visible('farm_page'), 'admin: public wrapper shows the preview');
select pg_temp.check(not private.feature_on('farm_page'), 'admin: feature_on still off for the preview');
select pg_temp.check((select count(*) >= 70 from public.admin_feature_rows()), 'admin reads every row');

select public.admin_set_feature('stories', false);
select pg_temp.check(not private.feature_on('stories'), 'admin switched stories off');
select pg_temp.check((select value = '{"on": false}'::jsonb from public.site_settings where key = 'feature.stories'), 'public row stays {"on": bool}');
select pg_temp.check((select changed_by_name = 'FS test admin' and kind = 'switch' and action = 'changed'
                        and (old_value -> 'on') = 'true'::jsonb and (new_value -> 'on') = 'false'::jsonb
                      from public.admin_feature_log(1, 'stories')), 'change logged with the admin');
select pg_temp.check((select changed_by_name = 'FS test admin' from public.admin_feature_last_changes() where feature_id = 'stories'),
                     'last change per switch');
select public.admin_set_feature('stories', true);
select pg_temp.check(private.feature_on('stories'), 'admin switched stories on again');

-- Legal flag and team preview
select public.admin_set_feature('marketplace', true, 'cleared', date '2026-11-20', null);
select pg_temp.check((select legal = 'cleared' and legal_checked_on = date '2026-11-20' from public.admin_feature_rows() where feature_id = 'marketplace'),
                     'legal cleared with date');
select pg_temp.check((select kind = 'meta' and changed_by_name = 'FS test admin' from public.admin_feature_log(1, 'marketplace')), 'legal change logged');
select public.admin_set_feature('marketplace', true, 'pending', date '2026-11-20', null);
select pg_temp.check((select legal = 'pending' and legal_checked_on is null from public.admin_feature_rows() where feature_id = 'marketplace'),
                     'back to pending drops the date');
select pg_temp.expect_error($q$select public.admin_set_feature('marketplace', true, 'cleared', null, null)$q$, 'cleared needs a date', 'P0001', 'date is required');
select pg_temp.expect_error($q$select public.admin_set_feature('marketplace', true, 'cleared', date '2099-01-01', null)$q$, 'future date refused', 'P0001', 'date out of range');
select pg_temp.expect_error($q$select public.admin_set_feature('marketplace', true, 'maybe', null, null)$q$, 'bad legal refused', 'P0001', 'legal must be');
select public.admin_set_feature('marketplace', false, null, null, true);
select pg_temp.check((select team_only and legal = 'pending' and not "on" from public.admin_feature_rows() where feature_id = 'marketplace'),
                     'team preview set, legal kept');

-- The money gate (M1): payments_live is exactly on = false, team_only = false
select pg_temp.expect_error($q$select public.admin_set_feature('payments_live', true)$q$, 'payments_live on refused (function)', 'P0001', 'locked off');
select pg_temp.expect_error($q$select public.admin_set_feature('payments_live', false, null, null, true)$q$, 'payments_live team preview refused (function)', 'P0001', 'locked off');
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true}' where key = 'feature.payments_live'$q$, 'payments_live on refused (direct write)', 'P0001', 'locked off');
select pg_temp.check(not private.feature_visible('payments_live'), 'payments_live never visible as a preview');
select public.admin_set_feature('payments_live', false);   -- switching it off (again) is allowed
select pg_temp.check((select value = '{"on": false}'::jsonb from public.site_settings where key = 'feature.payments_live')
                     and (select not team_only from private.feature_switch_meta where feature_id = 'payments_live'),
                     'payments_live exactly off, no preview');

-- Other switches, unknown ids and direct writes
select public.admin_set_feature('save_to_travel', false);
select public.admin_set_feature('save_to_travel', true);
select pg_temp.check(private.feature_on('save_to_travel'), 'save_to_travel can be switched (not locked)');
select pg_temp.expect_error($q$select public.admin_set_feature('no_such_feature', true)$q$, 'unknown id refused', 'P0001', 'unknown feature');
select pg_temp.expect_error($q$select public.admin_set_feature('Bad-Id', true)$q$, 'bad id refused', 'P0001', 'unknown feature');
select pg_temp.expect_error($q$select public.admin_set_feature('stories', null)$q$, 'on required', 'P0001', 'required');
select pg_temp.expect_error($q$insert into public.site_settings (key, value) values ('feature.made_up', '{"on": true}')$q$, 'admin cannot add a switch', 'P0001', 'unknown feature');
select pg_temp.expect_error($q$delete from public.site_settings where key = 'feature.stories'$q$, 'admin cannot delete a switch', 'P0001', 'never deleted');
select pg_temp.expect_error($q$update public.site_settings set key = 'feature.stories2' where key = 'feature.stories'$q$, 'admin cannot rename a switch', 'P0001', 'renamed');
select pg_temp.expect_error($q$update private.feature_switch_log set action = 'deleted'$q$, 'admin cannot rewrite the log', '42501');
-- Other settings still work for admins as before.
update public.site_settings set value = value where key = 'badge_fee';
reset role;

-- The guard follows the JWT role, not current_user (L1): postgres carrying an API JWT is still limited.
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true}' where key = 'feature.payments_live'$q$,
                            'API JWT limited even as postgres', 'P0001', 'locked off');

-- Service role (server code): not limited by the guard ----------------------------------------
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.site_settings set value = '{"on": false}' where key = 'feature.stories';
reset role;
select pg_temp.check((select value = '{"on": false}'::jsonb from public.site_settings where key = 'feature.stories'),
                     'service role can switch a feature');
update public.site_settings set value = '{"on": true}' where key = 'feature.stories';

-- No JWT: SQL editor ---------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select pg_temp.expect_error($q$delete from private.feature_switch_log$q$, 'log delete refused', 'P0001', 'cannot be changed');
select pg_temp.expect_error($q$update private.feature_switch_log set action = 'deleted'$q$, 'log update refused', 'P0001', 'cannot be changed');
select pg_temp.expect_error($q$truncate private.feature_switch_log$q$, 'log truncate refused', 'P0001', 'cannot be changed');

-- Database roles are not limited by the guard (Walter's own SQL at go-live).
update public.site_settings set value = '{"on": true}' where key = 'feature.payments_live';
select pg_temp.check(private.feature_on('payments_live'), 'SQL editor can still switch payments_live (then rolled back)');
select pg_temp.check(private.money_feature_on('mobile_money'), 'API money path on once payments_live is on');
select pg_temp.check((select changed_by is null from private.feature_switch_log
                      where feature_id = 'payments_live' order by id desc limit 1), 'SQL editor change logged without a user');

select 'all passed';
rollback;
