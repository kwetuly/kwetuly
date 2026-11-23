-- Tests for migration 20261122300000_reservations.sql (reservations slice 2).
-- Run ONLY on a local or test project, after 20261122200000 and 20261122300000, in the SQL editor or
-- psql as postgres. One transaction that ends with ROLLBACK: nothing below stays. Any failure stops
-- the script with "FAIL: ...". The last line prints "all passed".
-- Every name, code and number here is invented; the rates are test values, not Walter's.

begin;

-- Helpers -------------------------------------------------------------------
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

-- Like expect_error, but the error message must contain p_code.
create function pg_temp.expect_code(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'FAIL: % (should have been refused)', p_label;
  end if;
  if position(p_code in v_msg) = 0 then
    raise exception 'FAIL: % (refused with "%", expected "%")', p_label, v_msg, p_code;
  end if;
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_label;
  end if;
end $$;

-- A Tanzania local time p_days from today, e.g. pg_temp.at(1, '12:00').
create function pg_temp.at(p_days integer, p_time text) returns timestamptz language sql stable as $$
  select ((private.tz_today() + p_days)::timestamp + p_time::time) at time zone 'Africa/Dar_es_Salaam';
$$;

create function pg_temp.as_user(p_id uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;
grant execute on function pg_temp.expect_code(text, text, text) to anon, authenticated;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;
grant execute on function pg_temp.at(integer, text) to anon, authenticated;

-- Made-up accounts ------------------------------------------------------------
--   a1 owner of e1 (restaurant) and e2 (spa); b2 owner of e3 (salon); c3 admin;
--   t1, t2, t3 travellers; g4 guide with code RSGUIDE1.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('a1a1a1a1-0000-4000-8000-0000000000a1', 'rv-owner@example.test', 'authenticated', 'authenticated', '{}'),
  ('b2b2b2b2-0000-4000-8000-0000000000b2', 'rv-other@example.test', 'authenticated', 'authenticated', '{}'),
  ('c3c3c3c3-0000-4000-8000-0000000000c3', 'rv-admin@example.test', 'authenticated', 'authenticated', '{}'),
  ('d1d1d1d1-0000-4000-8000-0000000000d1', 'rv-trav1@example.test', 'authenticated', 'authenticated', '{}'),
  ('d2d2d2d2-0000-4000-8000-0000000000d2', 'rv-trav2@example.test', 'authenticated', 'authenticated', '{}'),
  ('d3d3d3d3-0000-4000-8000-0000000000d3', 'rv-trav3@example.test', 'authenticated', 'authenticated', '{}'),
  ('f4f4f4f4-0000-4000-8000-0000000000f4', 'rv-guide@example.test', 'authenticated', 'authenticated', '{}'),
  ('d5d5d5d5-0000-4000-8000-0000000000d5', 'rv-new@example.test', 'authenticated', 'authenticated', '{}');
-- t1..t3 are older accounts; d5 is brand new (3 requests a day, review M3).
update auth.users set created_at = now() - interval '10 days'
where id in ('d1d1d1d1-0000-4000-8000-0000000000d1', 'd2d2d2d2-0000-4000-8000-0000000000d2', 'd3d3d3d3-0000-4000-8000-0000000000d3');
update public.profiles set onboarded_at = now() where id = 'd5d5d5d5-0000-4000-8000-0000000000d5';
update public.profiles set onboarded_at = now(), full_name = 'Asha Test'
where id in ('a1a1a1a1-0000-4000-8000-0000000000a1', 'b2b2b2b2-0000-4000-8000-0000000000b2',
             'c3c3c3c3-0000-4000-8000-0000000000c3', 'd1d1d1d1-0000-4000-8000-0000000000d1',
             'd2d2d2d2-0000-4000-8000-0000000000d2', 'd3d3d3d3-0000-4000-8000-0000000000d3',
             'f4f4f4f4-0000-4000-8000-0000000000f4');
update public.profiles set role = 'admin' where id = 'c3c3c3c3-0000-4000-8000-0000000000c3';

insert into public.guides (id, owner_id, slug, display_name, base_region, verification_status)
values ('97979797-0000-4000-8000-000000000097', 'f4f4f4f4-0000-4000-8000-0000000000f4', 'rv-test-guide', 'RV Test Guide', 'Arusha', 'approved');
insert into public.referral_codes (guide_id, code) values ('97979797-0000-4000-8000-000000000097', 'RSGUIDE1');

insert into public.providers (id, owner_id, business_name, base_region, business_type, verification_status,
                              reservation_terms_version, reservation_terms_at)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'RV test kitchen', 'Arusha', 'restaurant', 'approved', private.reservation_terms_version(), now()),
       ('e2e2e2e2-0000-4000-8000-0000000000e2', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'RV test spa', 'Arusha', 'spa', 'approved', private.reservation_terms_version(), now()),
       ('e3e3e3e3-0000-4000-8000-0000000000e3', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'RV test salon', 'Moshi', 'salon', 'approved', private.reservation_terms_version(), now());
insert into public.business_hours (provider_id, weekday, opens, closes)
select p, d, '06:00', '23:00'
from unnest(array['e1e1e1e1-0000-4000-8000-0000000000e1', 'e2e2e2e2-0000-4000-8000-0000000000e2']::uuid[]) p,
     generate_series(0, 6) d;
insert into public.business_closed_dates (provider_id, day) values ('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today() + 6);
insert into public.business_services (id, provider_id, name, duration_min, price_tzs, max_people) values
  ('5e5e5e5e-0000-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-0000000000e2', 'Massage for two', 60, 45005, 2),
  ('5e5e5e5e-0000-4000-8000-000000000002', 'e2e2e2e2-0000-4000-8000-0000000000e2', 'Foot massage', 30, null, 1);
insert into public.person_document_checks (user_id, provider_id, kind, valid_until)
values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'e2e2e2e2-0000-4000-8000-0000000000e2', 'business_licence', private.tz_today() + 300);

-- Test rates (as postgres; on live Walter types them in /admin/prices).
update public.price_list set amount_tzs = 2000, max_guests_counted = 10, active_from = private.tz_today(), status = 'active'
where service_code = 'reservation_commission' and business_type = 'restaurant';
update public.price_list set percent = 10, active_from = private.tz_today(), status = 'active'
where service_code = 'reservation_commission' and business_type in ('spa', 'salon');
update public.price_list set amount_tzs = 3000, active_from = private.tz_today(), status = 'active'
where service_code = 'reservation_unpriced_fee';
update public.providers set takes_reservations = true
where id in ('e1e1e1e1-0000-4000-8000-0000000000e1', 'e2e2e2e2-0000-4000-8000-0000000000e2');

select pg_temp.check(not (select (value -> 'on')::boolean from public.site_settings where key = 'feature.reservation_commission_billing'),
                     'billing switch starts off');

-- 1. Traveller t1 reserves ------------------------------------------------------
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.check((select public.guide_code_status('rsguide1') = 'ok'), 'guide code checked first (QA L-G)');
create temp table rv on commit drop as
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 4,
           'Window table please, call 0712 345 678', 'No peanuts (allergy)', true, 'rsguide1') as id;
reset role;
grant select on rv to authenticated;
select pg_temp.check((select r.status = 'requested' and r.commission_kind = 'per_guest' and r.commission_rate_tzs = 2000
                        and r.max_guests_counted = 10 and r.guide_id = '97979797-0000-4000-8000-000000000097'
                        and r.guide_share_pct = 50 and r.commission_status = 'none' and r.business_name = 'RV test kitchen'
                        and r.note not like '%345%' and r.note like '%[number hidden]%'
                      from public.reservations r where r.id = (select id from rv)),
                     'reservation stored with the rate copied, guide linked, note masked');
select pg_temp.check((select r.answer_by is not null and r.answer_by <= now() + interval '4 hours'
                        and r.answer_by <= r.starts_at - interval '120 minutes'
                      from public.reservations r where r.id = (select id from rv)),
                     'answer-by time: 4 hours, never later than the time minus the notice');
select pg_temp.check((select d.line = 'No peanuts (allergy)' and d.delete_after = private.tz_today() + 1 + 30
                      from public.reservation_diet_lines d where d.reservation_id = (select id from rv)),
                     'diet line stored with its deletion date');
select pg_temp.check((select count(*) >= 1 and bool_and((o.payload - 'reservation_id' - 'link') = '{}'::jsonb)
                        and bool_and(o.payload::text not like '%peanut%' and o.payload::text not like '%345%')
                      from public.notification_outbox o
                      where o.event = 'reservation_requested' and o.recipient_user_id = 'a1a1a1a1-0000-4000-8000-0000000000a1'),
                     'owner alerted with ids only');

select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, now() + interval '30 minutes', 2)$q$,
  'too_soon', 'less than the minimum notice');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '03:00'), 2)$q$,
  'outside_hours', 'outside opening hours');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '22:30'), 2)$q$,
  'outside_hours', 'table time runs past closing');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:10'), 2)$q$,
  'time_not_allowed', 'not on the quarter hour');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(6, '12:00'), 2)$q$,
  'closed_date', 'closed date');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(70, '12:00'), 2)$q$,
  'too_far', 'beyond the maximum days ahead');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 21)$q$,
  'party_size', 'restaurant party above 20');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 2, null, 'Vegan', false)$q$,
  'diet_consent_needed', 'diet line without consent');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 2, null, null, false, 'NOPE')$q$,
  'guide_code_unknown', 'unknown guide code');
select pg_temp.expect_code($q$select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', null, pg_temp.at(1, '12:00'), 1)$q$,
  'service_required', 'spa without a service');
select pg_temp.expect_code($q$select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000001', pg_temp.at(1, '12:00'), 3)$q$,
  'party_size', 'more people than the service takes');
select pg_temp.expect_code($q$select public.place_reservation('e3e3e3e3-0000-4000-8000-0000000000e3', null, pg_temp.at(1, '12:00'), 1)$q$,
  'not_open', 'business that does not take reservations');
select pg_temp.expect_error($q$insert into public.reservations (provider_id, business_name, business_type, starts_at, party_size, commission_kind, commission_rate_tzs, price_list_id)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'x', 'restaurant', now(), 1, 'per_guest', 1, (select id from public.price_list limit 1))$q$,
  'traveller inserts a reservation directly');
select pg_temp.expect_error($q$update public.reservations set commission_rate_tzs = 1$q$, 'traveller updates a reservation directly');
select pg_temp.expect_code($q$select public.reservation_action((select id from rv), 'confirm')$q$,
  'not_allowed', 'traveller confirms');
select pg_temp.check((select count(*) = 1 from public.reservations), 'traveller sees own reservation');
reset role;

-- Guide codes cannot be guessed in a loop (QA L-G).
select pg_temp.as_user('d2d2d2d2-0000-4000-8000-0000000000d2');
set local role authenticated;
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 2, null, null, false, 'RSGUIDE1')$q$,
  'guide_code_unknown', 'a code that was not checked first');
select pg_temp.check((select bool_and(public.guide_code_status('GUESS' || g) = 'unknown') from generate_series(1, 10) g),
                     'ten wrong codes are answered "unknown"');
select pg_temp.check((select public.guide_code_status('RSGUIDE1') = 'too_many'), 'after ten wrong codes, checking stops for an hour');
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 2, null, null, false, 'RSGUIDE1')$q$,
  'guide_code_unknown', 'the right code is not accepted without an ok check');
reset role;
select pg_temp.check((select count(*) = 10 and bool_and(not ok and guide_id is null) from private.guide_code_checks
                      where user_id = 'd2d2d2d2-0000-4000-8000-0000000000d2'),
                     'wrong codes leave only who and when, no code in any form (the stopped one writes nothing)');
select pg_temp.check((select count(*) = 1 and bool_and(ok and guide_id = '97979797-0000-4000-8000-000000000097')
                      from private.guide_code_checks where user_id = 'd1d1d1d1-0000-4000-8000-0000000000d1'),
                     'an ok check keeps only the guide it matched');

-- Final review N1: at most 30 checks of any kind an hour; over that nothing is checked or written.
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.check((select count(*) = 29 from generate_series(1, 29) g where public.guide_code_status('rsguide1') = 'ok'),
                     '29 more ok checks');
select pg_temp.check((select public.guide_code_status('rsguide1') = 'too_many'), 'the 31st check in an hour is stopped');
reset role;
select pg_temp.check((select count(*) = 30 from private.guide_code_checks where user_id = 'd1d1d1d1-0000-4000-8000-0000000000d1'),
                     'the stopped check writes no row');

-- Own business: the owner cannot reserve at it.
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '12:00'), 2)$q$,
  'own_business', 'owner reserves at own business');

-- 2. Owner a1 answers ------------------------------------------------------------
select pg_temp.check((select public.reservation_action((select id from rv), 'confirm', null, 'See you at noon') = 'confirmed'),
                     'owner confirms');
select pg_temp.check((select count(*) = 0 from public.reservations) and (select count(*) = 0 from public.reservation_diet_lines),
                     'owner has no direct read of reservations or diet lines (review L1)');
select pg_temp.check((select diet_line = 'No peanuts (allergy)' and traveller_first_name = 'Asha'
                      from public.business_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today(), private.tz_today() + 2)),
                     'owner sees the first name and the diet line while the reservation is open');
select pg_temp.expect_code($q$select public.reservation_action((select id from rv), 'mark_came', null, null, 3)$q$,
  'too_early', 'marking came before the time');
reset role;

-- Another owner sees nothing.
select pg_temp.as_user('b2b2b2b2-0000-4000-8000-0000000000b2');
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.reservations), 'another owner sees no reservations');
select pg_temp.check((select count(*) = 0 from public.reservation_diet_lines), 'another owner sees no diet lines');
select pg_temp.expect_error($q$select * from public.business_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today(), private.tz_today() + 2)$q$,
  'another owner lists a business''s reservations');
select pg_temp.expect_code($q$select public.reservation_action((select id from rv), 'cancel')$q$, 'not_found', 'another owner cancels');
reset role;

-- 3. The time passes (as postgres): the visit was two days ago --------------------
update public.reservations set starts_at = pg_temp.at(-2, '12:00') where id = (select id from rv);
select pg_temp.expect_error($q$update public.reservations set commission_rate_tzs = 1 where id = (select id from rv)$q$,
  'copied rate changed afterwards, even by server code');

select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select public.reservation_action((select id from rv), 'mark_came', null, null, 5)$q$,
  'came_count', 'more came than booked');
select public.reservation_action((select id from rv), 'mark_came', null, null, 3);
select pg_temp.check((select commission_tzs = 6000 and guide_share_tzs = 3000 and commission_status = 'owed' and came_count = 3
                      from public.reservations where id = (select id from rv)),
                     '3 guests came: 3 x 2000, half recorded for the guide');
select pg_temp.check((select diet_line is null
                      from public.business_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today() - 3, private.tz_today())),
                     'owner no longer sees the diet line once completed');
reset role;

-- 4. "Did your visit happen?" No -> held, admins alerted, admin decides ----------------
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select public.reservation_visit_answer((select id from rv), false);
select pg_temp.expect_code($q$select public.reservation_visit_answer((select id from rv), true)$q$, 'not_allowed', 'answering twice');
reset role;
select pg_temp.check((select disputed_at is not null and commission_status = 'held'
                      from public.reservations where id = (select id from rv)), 'mismatch holds the commission');
select pg_temp.check((select count(*) >= 1 from public.notification_outbox
                      where event = 'reservation_disputed' and recipient_user_id = 'c3c3c3c3-0000-4000-8000-0000000000c3'
                        and (payload - 'reservation_id' - 'link') = '{}'::jsonb),
                     'admins alerted with ids only');

select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal1');
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_resolve_reservation_dispute((select id from rv), 'completed')$q$,
  'admin without two-step resolves');
select pg_temp.check((select count(*) = 0 from public.reservations), 'admin without two-step reads nothing');
reset role;
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
select public.admin_resolve_reservation_dispute((select id from rv), 'completed', 'phoned both, traveller said 555 1234');
select pg_temp.check((select commission_status = 'owed' and commission_tzs = 6000 and dispute_outcome = 'completed'
                      from public.reservations where id = (select id from rv)), 'admin decision releases the commission');
select pg_temp.check((select detail = 'admin' from public.reservation_log
                      where reservation_id = (select id from rv) and action = 'dispute_completed'),
                     'free text never reaches the log (review L8)');
select pg_temp.check((select count(*) >= 4 from public.reservation_log where reservation_id = (select id from rv)),
                     'history is logged');
reset role;
select pg_temp.expect_error($q$update public.reservation_log set detail = 'x'$q$, 'rewriting the reservation log');
select pg_temp.expect_error($q$delete from public.reservation_log$q$, 'deleting the reservation log');

-- 5. A big group, the business never marks it: auto-completed, 10 guests counted -------
select pg_temp.as_user('d2d2d2d2-0000-4000-8000-0000000000d2');
set local role authenticated;
create temp table rv2 on commit drop as
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(2, '19:00'), 14) as id;
reset role;
grant select on rv2 to authenticated;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action((select id from rv2), 'confirm');
reset role;
update public.reservations set starts_at = pg_temp.at(-4, '19:00') where id = (select id from rv2);
select private.run_reservation_jobs();
select pg_temp.check((select status = 'completed' and completed_by = 'auto' and came_count = 14 and commission_tzs = 20000
                        and guide_share_tzs = 0 and commission_status = 'owed'
                      from public.reservations where id = (select id from rv2)),
                     'auto-completed after 3 days: 10 of 14 guests counted, no guide');

-- 6. Spa: priced service (percent) and unpriced service (per person) -----------------
select pg_temp.as_user('d2d2d2d2-0000-4000-8000-0000000000d2');
set local role authenticated;
create temp table rv3 on commit drop as
  select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000001', pg_temp.at(1, '10:00'), 2) as id, 2 as party
  union all
  select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000002', pg_temp.at(1, '15:00'), 1), 1;
reset role;
grant select on rv3 to authenticated;
select pg_temp.check((select count(*) = 1 from public.reservations
                      where id in (select id from rv3) and commission_kind = 'percent' and price_basis_tzs = 45005 and commission_percent = 10)
                     and (select count(*) = 1 from public.reservations
                          where id in (select id from rv3) and commission_kind = 'per_person' and commission_rate_tzs = 3000),
                     'spa rates copied: percent with the listed price, per person without one');
-- A later price change does not change what was copied.
update public.business_services set price_tzs = 90000 where id = '5e5e5e5e-0000-4000-8000-000000000001';
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action(id, 'confirm') from rv3;
select pg_temp.expect_code($q$delete from public.business_services where id = '5e5e5e5e-0000-4000-8000-000000000001'$q$,
  'service_in_use', 'deleting a reserved service');
reset role;
update public.reservations set starts_at = starts_at - interval '2 days' where id in (select id from rv3);
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action(id, 'mark_came', null, null, party) from rv3;
reset role;
select pg_temp.check((select sum(commission_tzs) = 9001 + 3000 from public.reservations where id in (select id from rv3)),
                     'percent of the copied price x 2 people (rounded) plus 3000 per person');

-- 7. Cancellation and other time --------------------------------------------------
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
create temp table rv4 on commit drop as
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(3, '13:00'), 2, 'Birthday dinner') as id;
reset role;
grant select on rv4 to authenticated;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select public.reservation_action((select id from rv4), 'offer_time', pg_temp.at(3, '02:00'))$q$,
  'outside_hours', 'offering a time outside the hours');
select public.reservation_action((select id from rv4), 'offer_time', pg_temp.at(3, '14:00'), 'Busy at one');
reset role;
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select public.reservation_action((select id from rv4), 'accept_offer');
select pg_temp.check((select status = 'confirmed' and starts_at = pg_temp.at(3, '14:00') from public.reservations where id = (select id from rv4)),
                     'traveller accepts the other time');
select public.reservation_action((select id from rv4), 'cancel');
select pg_temp.check((select status = 'cancelled' and cancelled_by = 'traveller' and commission_tzs is null and commission_status = 'none'
                      from public.reservations where id = (select id from rv4)), 'cancelled: nothing owed');
reset role;

-- 7b. Review M1: head counts and late cancels ---------------------------------------
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
create temp table rv7 on commit drop as
  select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000001', pg_temp.at(2, '10:00'), 2) as id;
create temp table rv8 on commit drop as
  select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000002', pg_temp.at(2, '16:00'), 1) as id;
reset role;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action((select id from rv7), 'confirm');
select public.reservation_action((select id from rv8), 'confirm');
reset role;
update public.reservations set starts_at = pg_temp.at(-2, '10:00') where id = (select id from rv7);
update public.reservations set starts_at = now() + interval '1 hour' where id = (select id from rv8);
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action((select id from rv7), 'mark_came', null, null, 1);
select public.reservation_action((select id from rv8), 'cancel', null, 'Sorry, power cut');
reset role;
select pg_temp.check((select business_cancelled_late and cancelled_by = 'business' from public.reservations where id = (select id from rv8)),
                     'business cancel less than 2 hours before is late');
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.check((select asks_people_count from public.my_reservations() where id = (select id from rv7)),
                     'traveller is asked how many came when fewer were counted');
select pg_temp.expect_code($q$select public.reservation_visit_answer((select id from rv7), true, 3)$q$, 'came_count', 'more people than booked');
select public.reservation_visit_answer((select id from rv7), true, 2);
reset role;
select pg_temp.check((select disputed_at is not null and commission_status = 'held' and traveller_said_people = 2
                      from public.reservations where id = (select id from rv7)),
                     'traveller says 2 came, business said 1: commission held');
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
select public.admin_resolve_reservation_dispute((select id from rv7), 'completed', 'phoned_both');
-- The service price was raised to 90000 in section 6 before rv7 was placed, so 90000 was copied.
select pg_temp.check((select came_count = 2 and commission_tzs = 18000 and commission_status = 'owed'
                      from public.reservations where id = (select id from rv7)),
                     'admin decision counts the higher number');
select pg_temp.check((select late_cancel >= 1 and low_count >= 1
                      from public.admin_reservation_quality_month(private.tz_today())
                      where provider_id = 'e2e2e2e2-0000-4000-8000-0000000000e2')
                     or (select late_cancel >= 1
                         from public.admin_reservation_quality_month(private.tz_today())
                         where provider_id = 'e2e2e2e2-0000-4000-8000-0000000000e2'),
                     'quality list shows the late cancel (and the low count when in the same month)');
reset role;

-- 7b2. Group discount (Walter 2026-11-23): price per person, lower from a number of people --------
insert into public.business_services (id, provider_id, name, duration_min, price_tzs, max_people,
                                      group_discount_min_people, group_discount_percent)
values ('5e5e5e5e-0000-4000-8000-000000000003', 'e2e2e2e2-0000-4000-8000-0000000000e2', 'Group massage', 60, 40000, 6, 4, 20);
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_error($q$update public.business_services set group_discount_min_people = 8
  where id = '5e5e5e5e-0000-4000-8000-000000000003'$q$, 'discount minimum above the service''s maximum');
select pg_temp.expect_error($q$update public.business_services set group_discount_percent = null
  where id = '5e5e5e5e-0000-4000-8000-000000000003'$q$, 'discount percent without its minimum');
reset role;
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.check((select group_discount_min_people = 4 and group_discount_percent = 20 from public.business_services
                      where id = '5e5e5e5e-0000-4000-8000-000000000003'),
                     'traveller form reads the group discount with the service');
create temp table rv11 on commit drop as
  select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000003', pg_temp.at(2, '13:00'), 4) as id;
reset role;
select pg_temp.check((select price_basis_tzs = 40000 and group_discount_min_people = 4 and group_discount_percent = 20
                      from public.reservations where id = (select id from rv11)), 'discount copied at request time');
update public.business_services set group_discount_min_people = null, group_discount_percent = null
where id = '5e5e5e5e-0000-4000-8000-000000000003';
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action((select id from rv11), 'confirm');
reset role;
update public.reservations set starts_at = pg_temp.at(-2, '13:00') where id = (select id from rv11);
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action((select id from rv11), 'mark_came', null, null, 3);
reset role;
select pg_temp.check((select commission_tzs = 9600 from public.reservations where id = (select id from rv11)),
                     'booked 4 (discount applies), 3 came: 3 x 32000 x 10% (a later change to the service does not count)');

-- 7c. Review M3: a new account makes at most 3 requests a day -------------------------
select pg_temp.as_user('d5d5d5d5-0000-4000-8000-0000000000d5');
set local role authenticated;
select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(5, '12:00'), 2);
select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(5, '13:00'), 2);
select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000002', pg_temp.at(5, '12:00'), 1);
select pg_temp.expect_code($q$select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000002', pg_temp.at(5, '14:00'), 1)$q$,
  'too_many_requests', 'fourth request of a new account in a day');
reset role;

-- 8. No-shows: 2 in 90 days pause reserving ------------------------------------------
select pg_temp.as_user('d3d3d3d3-0000-4000-8000-0000000000d3');
set local role authenticated;
create temp table rv5 on commit drop as
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '09:00'), 2, null, 'Halal only', true) as id
  union all
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(1, '10:00'), 2);
reset role;
grant select on rv5 to authenticated;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action(id, 'confirm') from rv5;
reset role;
-- Review M2: "did not come" only from 30 minutes after the time.
update public.reservations set starts_at = now() - interval '10 minutes' where id in (select id from rv5);
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select public.reservation_action((select min(id::text)::uuid from rv5), 'mark_no_show')$q$,
  'too_early', 'did not come, 10 minutes after the time');
reset role;
update public.reservations set starts_at = starts_at - interval '2 days' where id in (select id from rv5);
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action(id, 'mark_no_show') from rv5;
reset role;
select pg_temp.check((select bool_and(status = 'no_show' and commission_status = 'none' and commission_tzs is null)
                      from public.reservations where id in (select id from rv5)), 'no-show: nothing owed');
select pg_temp.as_user('d3d3d3d3-0000-4000-8000-0000000000d3');
set local role authenticated;
select pg_temp.expect_code($q$select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(2, '12:00'), 2)$q$,
  'no_show_pause', 'two no-shows pause reserving');
-- The traveller says one visit did happen: that no-show is disputed and no longer counts (M2).
select public.reservation_visit_answer((select min(id::text)::uuid from rv5), true);
select pg_temp.check((select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(2, '12:00'), 2) is not null),
                     'a disputed no-show does not count for the pause');
reset role;
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
select public.admin_resolve_reservation_dispute((select min(id::text)::uuid from rv5), 'business_fault', 'phoned_business');
select pg_temp.check((select status = 'cancelled' and cancelled_by = 'admin' and dispute_outcome = 'business_fault'
                        and commission_status = 'none'
                      from public.reservations where id = (select min(id::text)::uuid from rv5)),
                     'business fault: nothing owed, no strike');
reset role;

-- 9. Hourly job: unanswered requests close; diet lines and notes go after 30 days ----
select pg_temp.as_user('d2d2d2d2-0000-4000-8000-0000000000d2');
set local role authenticated;
create temp table rv6 on commit drop as
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(4, '12:00'), 2, null, 'No pork', true) as id;
reset role;
update public.reservations set starts_at = now() - interval '1 hour' where id = (select id from rv6);
update public.reservation_diet_lines set delete_after = private.tz_today() - 1 where reservation_id = (select id from rv6);
update public.reservations set starts_at = starts_at - interval '31 days' where id = (select id from rv4);

-- QA 2026-11-23: answer-by times. A request the business did not answer and an offer the traveller
-- did not answer both close at their answer-by time, long before the reservation time.
select pg_temp.as_user('d2d2d2d2-0000-4000-8000-0000000000d2');
set local role authenticated;
create temp table rv9 on commit drop as
  select public.place_reservation('e1e1e1e1-0000-4000-8000-0000000000e1', null, pg_temp.at(3, '12:00'), 2) as id;
create temp table rv10 on commit drop as
  select public.place_reservation('e2e2e2e2-0000-4000-8000-0000000000e2', '5e5e5e5e-0000-4000-8000-000000000002', pg_temp.at(3, '11:00'), 1) as id;
select pg_temp.check((select answer_by is not null from public.my_reservations() where id = (select id from rv9)),
                     'traveller sees the answer-by time');
reset role;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.reservation_action((select id from rv10), 'offer_time', pg_temp.at(3, '15:00'));
select pg_temp.check((select answer_by is not null from public.business_reservations('e2e2e2e2-0000-4000-8000-0000000000e2', private.tz_today(), private.tz_today() + 4)
                      where id = (select id from rv10)),
                     'owner sees the answer-by time of the offer');
reset role;
update public.reservations set answer_by = now() - interval '1 minute' where id in ((select id from rv9), (select id from rv10));
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select public.reservation_action((select id from rv9), 'confirm')$q$, 'too_late', 'confirming after the answer-by time');
reset role;
select pg_temp.as_user('d2d2d2d2-0000-4000-8000-0000000000d2');
set local role authenticated;
select pg_temp.expect_code($q$select public.reservation_action((select id from rv10), 'accept_offer')$q$, 'too_late', 'accepting an offer after its answer-by time');
reset role;
select private.run_reservation_jobs();
select pg_temp.check((select bool_and(status = 'declined' and decline_reason = 'no_answer')
                      from public.reservations where id in ((select id from rv9), (select id from rv10))),
                     'both closed by the job at their answer-by time');
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'reservation_expired' and payload ->> 'reservation_id' = (select id from rv9)::text)
                     and (select count(*) = 1 from public.notification_outbox
                          where event = 'reservation_offer_expired' and payload ->> 'reservation_id' = (select id from rv10)::text),
                     'traveller told: no answer from the business / you did not answer the other time');
select pg_temp.check((select status = 'declined' and decline_reason = 'no_answer' from public.reservations where id = (select id from rv6)),
                     'unanswered request closed');
select pg_temp.check((select count(*) = 0 from public.reservation_diet_lines where reservation_id = (select id from rv6)),
                     'diet line deleted after its date');
select pg_temp.check((select note is null and business_note is null and texts_cleared_at is not null
                      from public.reservations where id = (select id from rv4)),
                     'notes cleared 30 days after the date (review M4)');

-- 10. A deleted traveller: note and diet line go, figures stay ----------------------------
delete from auth.users where id = 'd3d3d3d3-0000-4000-8000-0000000000d3';
select pg_temp.check((select bool_and(traveler_id is null and note is null)
                      from public.reservations where id in (select id from rv5)), 'deleted traveller: rows kept, personal parts cleared');
select pg_temp.check((select count(*) = 0 from public.reservation_diet_lines where reservation_id in (select id from rv5)),
                     'deleted traveller: diet line removed');

-- 11. Admin monthly list and marks (billing off) -------------------------------------
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
-- The visits are 2 and 4 days ago, so they may fall in last month: compare with the table itself.
select pg_temp.check((select m.commission_owed_tzs = (
                          select coalesce(sum(r.commission_tzs), 0) from public.reservations r
                          where r.provider_ref = 'e1e1e1e1-0000-4000-8000-0000000000e1' and r.commission_status = 'owed'
                            and date_trunc('month', (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date) = date_trunc('month', private.tz_today() - 2))
                        and not m.billing_on
                      from public.admin_reservation_commission_month(private.tz_today() - 2) m
                      where m.provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'monthly list for the restaurant matches its owed reservations');
select pg_temp.expect_code($q$select public.admin_set_reservation_commission('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today() - 40, 'invoiced')$q$,
  'billing is off', 'marking invoiced while billing is off');
reset role;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.check((select bool_and(not billing_on) and sum(commission_tzs) > 0
                      from public.business_reservation_statement('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today() - 2)),
                     'owner statement says for information (billing off)');
select pg_temp.expect_error($q$select * from public.admin_reservation_commission_month(private.tz_today())$q$, 'owner reads the admin list');
select pg_temp.expect_error($q$select * from public.admin_reservation_quality_month(private.tz_today())$q$, 'owner reads the quality list');
reset role;

-- With billing on (test only) and last month's visit: owed -> invoiced -> waived (final, review L5).
update public.site_settings set value = '{"on": true}' where key = 'feature.reservation_commission_billing';
update public.reservations set starts_at = starts_at - interval '40 days' where id = (select id from rv2);
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
select pg_temp.expect_code($q$select public.admin_set_reservation_commission('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today(), 'invoiced')$q$,
  'month not finished', 'invoicing the running month');
create temp table rv_month on commit drop as
  select (starts_at at time zone 'Africa/Dar_es_Salaam')::date as d from public.reservations where id = (select id from rv2);
select pg_temp.check((select public.admin_set_reservation_commission('e1e1e1e1-0000-4000-8000-0000000000e1', (select d from rv_month), 'invoiced') = 1),
                     'that month invoiced');
select pg_temp.check((select public.admin_set_reservation_commission('e1e1e1e1-0000-4000-8000-0000000000e1', (select d from rv_month), 'waived') = 1),
                     'an invoiced month can be waived');
select pg_temp.check((select public.admin_set_reservation_commission('e1e1e1e1-0000-4000-8000-0000000000e1', (select d from rv_month), 'paid') = 0),
                     'a waived line is not marked paid');
reset role;
select pg_temp.check((select commission_status = 'waived' from public.reservations where id = (select id from rv2)), 'marked waived');
select pg_temp.expect_error($q$update public.reservations set came_count = 2 where id = (select id from rv2)$q$,
  'changing the commission of a waived line');
select pg_temp.expect_error($q$update public.reservations set commission_status = 'owed' where id = (select id from rv2)$q$,
  'reopening a waived line');

select 'all passed';
rollback;
