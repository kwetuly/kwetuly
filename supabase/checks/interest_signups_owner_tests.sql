-- Tests for migration 20261126000060_interest_signups_owner.sql (slice W1-3, "Please contact me" on /hosts).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users, sign-ups and alerts
-- below never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".

begin;

-- expect_error checks the error code (SQLSTATE) and, when given, a part of the message.
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

-- Shape (as postgres) ------------------------------------------------------------------------
select pg_temp.check((select is_nullable = 'YES' from information_schema.columns
                      where table_schema = 'public' and table_name = 'interest_signups' and column_name = 'user_id'),
                     'user_id exists and is nullable');
select pg_temp.check((select confdeltype = 'c' from pg_constraint
                      where conrelid = 'public.interest_signups'::regclass and contype = 'f'
                        and confrelid = 'auth.users'::regclass), 'user_id cascades on account delete');
select pg_temp.check(not has_function_privilege('anon', 'public.my_interest_exists(text, text)', 'execute'),
                     'anon cannot run my_interest_exists');
select pg_temp.check(has_function_privilege('authenticated', 'public.my_interest_exists(text, text)', 'execute'),
                     'authenticated can run my_interest_exists');
select pg_temp.check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
                      where oid = 'public.my_interest_exists(text, text)'::regprocedure),
                     'my_interest_exists is security definer with an empty search_path');
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interest_signups'
                                 and cmd in ('UPDATE', 'DELETE', 'ALL')), 'no update or delete policy');
select pg_temp.check((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'interest_signups'
                      and cmd = 'SELECT'), 'only the admin select policy');

-- Made-up accounts: traveller A (e1), traveller B (e2), admin (e3) ----------------------------
insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'is-a@example.test', now(), 'authenticated', 'authenticated', '{}'),
       ('e2e2e2e2-0000-4000-8000-0000000000e2', 'is-b@example.test', now(), 'authenticated', 'authenticated', '{}'),
       ('e3e3e3e3-0000-4000-8000-0000000000e3', 'is-admin@example.test', now(), 'authenticated', 'authenticated', '{}');
update public.profiles set role = 'admin', full_name = 'IS test admin' where id = 'e3e3e3e3-0000-4000-8000-0000000000e3';

-- Signed out -----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into public.interest_signups (section, item, kind, name, contact)
values ('tours', 'balloon', 'traveler', 'Anon One', 'Spam@Example.test');
select pg_temp.expect_error($q$insert into public.interest_signups (section, item, kind, name, contact, user_id)
                               values ('tours', 'balloon', 'traveler', 'Anon', 'x@example.test', 'e1e1e1e1-0000-4000-8000-0000000000e1')$q$,
                            'anon cannot link a row to an account', '42501');
select pg_temp.expect_error($q$insert into public.interest_signups (section, item, kind, name, contact)
                               values ('tours', 'balloon', 'traveler', '', 'x@example.test')$q$,
                            'empty name still refused', '42501');
select pg_temp.expect_error($q$select public.my_interest_exists('partners', 'become-host')$q$,
                            'anon cannot ask my_interest_exists', '42501');
select pg_temp.check((select count(*) = 0 from public.interest_signups), 'anon reads no sign-ups');
-- 4 more with the same contact (different case and spaces): 5 in the hour, then refused.
insert into public.interest_signups (section, item, kind, name, contact)
values ('tours', 'balloon', 'traveler', 'Anon Two', 'spam@example.test'),
       ('tours', 'balloon', 'traveler', 'Anon Three', ' SPAM@example.test '),
       ('tours', 'balloon', 'traveler', 'Anon Four', 'spam@example.test'),
       ('tours', 'balloon', 'traveler', 'Anon Five', 'spam@example.test');
select pg_temp.expect_error($q$insert into public.interest_signups (section, item, kind, name, contact)
                               values ('tours', 'balloon', 'traveler', 'Anon Six', 'Spam@example.test')$q$,
                            'sixth signed-out request per contact refused', 'P0001', 'rate_limited');
-- Another contact is not affected.
insert into public.interest_signups (section, item, kind, name, contact)
values ('tours', 'balloon', 'traveler', 'Someone Else', 'other@example.test');
reset role;

select pg_temp.check((select count(*) = 6 from public.interest_signups
                      where name like 'Anon %' or name = 'Someone Else'), 'six signed-out rows stored');
select pg_temp.check(not exists (select 1 from public.interest_signups
                                 where (name like 'Anon %' or name = 'Someone Else') and user_id is not null),
                     'signed-out rows have no user_id');

-- Traveller A ------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-4000-8000-0000000000e1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check(not public.my_interest_exists('partners', 'become-host'), 'A: not sent yet');
insert into public.interest_signups (section, item, kind, name, contact, message)
values ('partners', 'become-host', 'traveler', 'Traveller A', 'is-a@example.test', 'Host sign-up: test');
select pg_temp.check(public.my_interest_exists('partners', 'become-host'), 'A: sent');
select pg_temp.check(not public.my_interest_exists('partners', 'other-item'), 'A: other item not sent');
select pg_temp.expect_error($q$insert into public.interest_signups (section, item, kind, name, contact, user_id)
                               values ('partners', 'become-host', 'traveler', 'Fake', 'b@example.test', 'e2e2e2e2-0000-4000-8000-0000000000e2')$q$,
                            'A cannot file a request as B', '42501');
select pg_temp.check((select count(*) = 0 from public.interest_signups), 'A reads no sign-ups, not even their own');
-- 4 more (5 in the hour), different contacts: the limit is per account, not per contact.
insert into public.interest_signups (section, item, kind, name, contact)
values ('tours', 'a1', 'traveler', 'Traveller A', 'a1@example.test'),
       ('tours', 'a2', 'traveler', 'Traveller A', 'a2@example.test'),
       ('tours', 'a3', 'traveler', 'Traveller A', 'a3@example.test'),
       ('tours', 'a4', 'traveler', 'Traveller A', 'a4@example.test');
select pg_temp.expect_error($q$insert into public.interest_signups (section, item, kind, name, contact)
                               values ('tours', 'a5', 'traveler', 'Traveller A', 'a5@example.test')$q$,
                            'sixth request per account refused', 'P0001', 'rate_limited');
reset role;

select pg_temp.check((select count(*) = 5 from public.interest_signups
                      where user_id = 'e1e1e1e1-0000-4000-8000-0000000000e1'), 'A: five rows linked by default');

-- Traveller B --------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-0000-4000-8000-0000000000e2","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check(not public.my_interest_exists('partners', 'become-host'), 'B does not see A''s request');
-- B's own limit is separate from A's. A signed-in caller may not send an unlinked row (user_id null).
insert into public.interest_signups (section, item, kind, name, contact)
values ('partners', 'become-host', 'traveler', 'Traveller B', 'is-b@example.test');
select pg_temp.expect_error(\ into public.interest_signups (section, item, kind, name, contact, user_id)
  values ('tours', 'b-unlinked', 'traveler', 'Traveller B', 'is-b-unlinked@example.test', null)\
  'signed-in caller cannot send an unlinked row', '42501');
select pg_temp.check(public.my_interest_exists('partners', 'become-host'), 'B: own request seen');
reset role;

-- Admin: not limited ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-0000-4000-8000-0000000000e3","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into public.interest_signups (section, item, kind, name, contact)
select 'tours', 'admin-' || g, 'traveler', 'IS test admin', 'is-admin@example.test' from generate_series(1, 6) g;
select pg_temp.check((select count(*) = 6 from public.interest_signups
                      where user_id = 'e3e3e3e3-0000-4000-8000-0000000000e3'), 'admin is not rate limited');
reset role;

-- Admin alerts carry interest_id ------------------------------------------------------------------------
create temp table a_ids as
  select id::text as id from public.interest_signups where user_id = 'e1e1e1e1-0000-4000-8000-0000000000e1';
select pg_temp.check((select count(distinct o.payload ->> 'interest_id') = 5 from public.notification_outbox o
                      where o.event like 'interest\_%' and o.payload ->> 'interest_id' in (select id from a_ids)),
                     'every request by A queued an admin alert with interest_id');

-- Deleting A removes A's rows and their admin alert copies; B, signed-out rows and other alerts stay ------
delete from auth.users where id = 'e1e1e1e1-0000-4000-8000-0000000000e1';
select pg_temp.check(not exists (select 1 from public.interest_signups where id::text in (select id from a_ids)),
                     'A''s requests deleted');
select pg_temp.check(not exists (select 1 from public.notification_outbox o
                                 where o.payload ->> 'interest_id' in (select id from a_ids)),
                     'admin alert copies of A''s requests deleted');
select pg_temp.check((select count(*) = 1 from public.interest_signups
                      where user_id = 'e2e2e2e2-0000-4000-8000-0000000000e2'), 'B''s request kept');
select pg_temp.check((select count(*) = 6 from public.interest_signups
                      where name like 'Anon %' or name = 'Someone Else'), 'signed-out rows kept');
select pg_temp.check(exists (select 1 from public.notification_outbox o
                             where o.event like 'interest\_%'
                               and o.payload ->> 'interest_id' in (select id::text from public.interest_signups
                                                                   where user_id = 'e2e2e2e2-0000-4000-8000-0000000000e2')),
                     'alerts about B kept');

select 'all passed' as result;

rollback;
