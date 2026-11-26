-- Tests for migration 20261126000000_feature_switch_admin.sql (slice W1-1 / S1, admin feature switches).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users and every switch change
-- below never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".

begin;

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
declare v_ran boolean := false;
begin
  begin
    execute p_sql;
    v_ran := true;
  exception when others then
    null;
  end;
  if v_ran then
    raise exception 'FAIL: % (should have been refused)', p_label;
  end if;
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_label;
  end if;
end $$;

grant execute on function pg_temp.expect_error(text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated, service_role;

-- Seed state (as postgres) ------------------------------------------------------------
select pg_temp.check((select count(*) >= 70 from public.site_settings where key like 'feature.%'), 'all switches seeded');
select pg_temp.check((select (value -> 'on') = 'false'::jsonb from public.site_settings where key = 'feature.payments_live'), 'payments_live off');
select pg_temp.check((select (value -> 'on') = 'true'::jsonb and value ->> 'legal' = 'pending'
                      from public.site_settings where key = 'feature.save_to_travel'), 'save_to_travel stays on, legal pending');
select pg_temp.check(not exists (select 1 from public.site_settings where key like 'feature.%' and (value -> 'team_only') = 'true'::jsonb),
                     'nothing starts as a team-only preview');
select pg_temp.check((select (value -> 'on') = 'true'::jsonb and value ->> 'legal' = 'pending'
                      from public.site_settings where key = 'feature.marketplace'), 'marketplace on, legal pending');
select pg_temp.check((select value ->> 'legal' = 'none' from public.site_settings where key = 'feature.stories'), 'stories legal none');
select pg_temp.check((select value ->> 'legal' = 'pending' from public.site_settings where key = 'feature.tips'), 'tips legal pending added');
select pg_temp.check(not exists (select 1 from public.site_settings where key like 'feature.%' and not (value ? 'legal')),
                     'every switch has a legal flag');
select pg_temp.check(private.feature_on('stories'), 'feature_on still reads on');
select pg_temp.check(not private.feature_on('no_such_feature'), 'missing row reads off');
select pg_temp.check((select count(*) > 0 from private.feature_switch_log), 'seed changes logged');

-- Shape check (as postgres) -----------------------------------------------------------
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true, "extra": 1}' where key = 'feature.stories'$q$, 'extra key refused');
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true, "legal": "maybe"}' where key = 'feature.stories'$q$, 'bad legal refused');
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true, "legal": "cleared"}' where key = 'feature.stories'$q$, 'cleared without date refused');
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true, "team_only": "yes"}' where key = 'feature.stories'$q$, 'bad team_only refused');

-- Made-up accounts: member (d1), admin (d2) --------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('d1d1d1d1-0000-4000-8000-0000000000d1', 'fs-member@example.test', 'authenticated', 'authenticated', '{}'),
       ('d2d2d2d2-0000-4000-8000-0000000000d2', 'fs-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set role = 'admin', full_name = 'FS test admin' where id = 'd2d2d2d2-0000-4000-8000-0000000000d2';

-- Team-only preview: switch one row off with team_only, as postgres.
update public.site_settings set value = '{"on": false, "legal": "none", "legal_checked_on": null, "team_only": true}'
 where key = 'feature.farm_page';

-- Anonymous visitor --------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check(not private.feature_visible('farm_page'), 'anon: team-only preview hidden');
select pg_temp.check(private.feature_visible('stories'), 'anon: on switch visible');
select pg_temp.expect_error($q$select public.admin_set_feature('stories', false)$q$, 'anon cannot set');
select pg_temp.expect_error($q$select * from public.admin_feature_log()$q$, 'anon cannot read log');
select pg_temp.expect_error($q$select * from private.feature_switch_log$q$, 'anon cannot read log table');
reset role;

-- Signed-in member ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-4000-8000-0000000000d1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_set_feature('stories', false)$q$, 'member cannot set');
select pg_temp.expect_error($q$select * from public.admin_feature_last_changes()$q$, 'member cannot read last changes');
select pg_temp.check(not private.feature_visible('farm_page'), 'member: team-only preview hidden');
update public.site_settings set value = '{"on": false}' where key = 'feature.stories';   -- RLS: no rows
reset role;
select pg_temp.check(private.feature_on('stories'), 'member update changed nothing');

-- Admin with password only (aal1) ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-4000-8000-0000000000d2","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_set_feature('stories', false)$q$, 'admin without two-step cannot set');
reset role;

-- Admin with two-step (aal2) -----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-4000-8000-0000000000d2","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.check(private.feature_visible('farm_page'), 'admin: team-only preview visible');
select pg_temp.check(not private.feature_on('farm_page'), 'admin: feature_on still off for the preview');

select public.admin_set_feature('stories', false);
select pg_temp.check(not private.feature_on('stories'), 'admin switched stories off');
select pg_temp.check((select changed_by_name = 'FS test admin' and action = 'changed'
                        and (old_value -> 'on') = 'true'::jsonb and (new_value -> 'on') = 'false'::jsonb
                      from public.admin_feature_log(1, 'stories')), 'change logged with the admin');
select pg_temp.check((select changed_by_name = 'FS test admin' from public.admin_feature_last_changes() where feature_id = 'stories'),
                     'last change per switch');
select public.admin_set_feature('stories', true);
select pg_temp.check(private.feature_on('stories'), 'admin switched stories on again');

-- Legal flag and team-only
select public.admin_set_feature('marketplace', true, 'cleared', date '2026-11-20', null);
select pg_temp.check((select value ->> 'legal' = 'cleared' and value ->> 'legal_checked_on' = '2026-11-20'
                      from public.site_settings where key = 'feature.marketplace'), 'legal cleared with date');
select public.admin_set_feature('marketplace', true, 'pending', date '2026-11-20', null);
select pg_temp.check((select value ->> 'legal' = 'pending' and jsonb_typeof(value -> 'legal_checked_on') = 'null'
                      from public.site_settings where key = 'feature.marketplace'), 'back to pending drops the date');
select pg_temp.expect_error($q$select public.admin_set_feature('marketplace', true, 'cleared', null, null)$q$, 'cleared needs a date');
select pg_temp.expect_error($q$select public.admin_set_feature('marketplace', true, 'cleared', date '2099-01-01', null)$q$, 'future date refused');
select pg_temp.expect_error($q$select public.admin_set_feature('marketplace', true, 'maybe', null, null)$q$, 'bad legal refused');
select public.admin_set_feature('marketplace', false, null, null, true);
select pg_temp.check((select (value -> 'team_only') = 'true'::jsonb and value ->> 'legal' = 'pending'
                      from public.site_settings where key = 'feature.marketplace'), 'team_only set, legal kept');

-- Locks and unknown ids
select pg_temp.expect_error($q$select public.admin_set_feature('payments_live', true)$q$, 'payments_live locked (function)');
select public.admin_set_feature('save_to_travel', false);
select public.admin_set_feature('save_to_travel', true);
select pg_temp.check(private.feature_on('save_to_travel'), 'save_to_travel can be switched (not locked)');
select pg_temp.expect_error($q$update public.site_settings set value = '{"on": true}' where key = 'feature.payments_live'$q$, 'payments_live locked (direct write)');
select pg_temp.expect_error($q$select public.admin_set_feature('no_such_feature', true)$q$, 'unknown id refused');
select pg_temp.expect_error($q$select public.admin_set_feature('Bad-Id', true)$q$, 'bad id refused');
select pg_temp.expect_error($q$select public.admin_set_feature('stories', null)$q$, 'on required');
select pg_temp.expect_error($q$insert into public.site_settings (key, value) values ('feature.made_up', '{"on": true}')$q$, 'admin cannot add a switch');
select pg_temp.expect_error($q$delete from public.site_settings where key = 'feature.stories'$q$, 'admin cannot delete a switch');
select pg_temp.expect_error($q$update public.site_settings set key = 'feature.stories2' where key = 'feature.stories'$q$, 'admin cannot rename a switch');
select pg_temp.expect_error($q$update private.feature_switch_log set action = 'deleted'$q$, 'admin cannot rewrite the log');
-- Other settings still work for admins as before.
update public.site_settings set value = value where key = 'badge_fee';
reset role;

-- Log is append-only for postgres too ----------------------------------------------------
select pg_temp.expect_error($q$delete from private.feature_switch_log$q$, 'log delete refused');
select pg_temp.expect_error($q$update private.feature_switch_log set action = 'deleted'$q$, 'log update refused');
select pg_temp.expect_error($q$truncate private.feature_switch_log$q$, 'log truncate refused');

-- Database roles are not limited by the guard (Walter's own SQL at go-live).
update public.site_settings set value = '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'
 where key = 'feature.payments_live';
select pg_temp.check(private.feature_on('payments_live'), 'postgres can still switch payments_live (then rolled back)');
select pg_temp.check((select changed_by is null from private.feature_switch_log
                      where feature_key = 'feature.payments_live' order by id desc limit 1), 'SQL editor change logged without a user');

select 'all passed';
rollback;
