-- Tests for migration 20261122200000_reservation_setup.sql (reservations slice 1).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users, businesses, hours and
-- prices below never stay (the four seeded draft price rows are changed and then rolled back too).
-- Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- Every name and number here is invented; the rates are test values, not Walter's.

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

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_label;
  end if;
end $$;

grant execute on function pg_temp.expect_error(text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated, service_role;

-- Made-up accounts: owner (a1), other business owner (b2), admin (c3) ------------
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'rs-owner@example.test', 'authenticated', 'authenticated', '{}'),
       ('b2b2b2b2-0000-4000-8000-0000000000b2', 'rs-other@example.test', 'authenticated', 'authenticated', '{}'),
       ('c3c3c3c3-0000-4000-8000-0000000000c3', 'rs-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('a1a1a1a1-0000-4000-8000-0000000000a1', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'c3c3c3c3-0000-4000-8000-0000000000c3');
update public.profiles set role = 'admin' where id = 'c3c3c3c3-0000-4000-8000-0000000000c3';

-- Businesses (as postgres, so they can start approved):
--   e1 restaurant (a1, approved), e2 spa (a1, approved), e3 salon (b2, approved), e4 restaurant (a1, pending)
insert into public.providers (id, owner_id, business_name, base_region, business_type, verification_status)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'RS test kitchen', 'Arusha', 'restaurant', 'approved'),
       ('e2e2e2e2-0000-4000-8000-0000000000e2', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'RS test spa', 'Arusha', 'spa', 'approved'),
       ('e3e3e3e3-0000-4000-8000-0000000000e3', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'RS test salon', 'Moshi', 'salon', 'approved'),
       ('e4e4e4e4-0000-4000-8000-0000000000e4', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'RS test cafe', 'Arusha', 'restaurant', 'pending');

select pg_temp.check((select count(*) = 4 from public.price_list
                      where service_code in ('reservation_commission', 'reservation_unpriced_fee')
                        and status = 'draft' and amount_tzs is null and percent is null),
                     'four seeded draft rows with no value');
select pg_temp.check(not (select takes_reservations from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'new business does not take reservations');

-- 1. Owner a1, password only ---------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select public.set_business_hours('e1e1e1e1-0000-4000-8000-0000000000e1',
  '[{"weekday":1,"opens":"08:00","closes":"11:00"},{"weekday":1,"opens":"12:00","closes":"15:00"},{"weekday":1,"opens":"18:00","closes":"22:00"}]');
select pg_temp.check((select count(*) = 3 from public.business_hours where provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'owner sets hours');
select pg_temp.expect_error($q$insert into public.business_hours (provider_id, weekday, opens, closes)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', 1, '22:30', '23:00')$q$, 'fourth period on one day');
select pg_temp.expect_error($q$insert into public.business_hours (provider_id, weekday, opens, closes)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', 2, '10:00', '09:00')$q$, 'closing before opening');
select pg_temp.expect_error($q$select public.set_business_hours('e1e1e1e1-0000-4000-8000-0000000000e1',
  '[{"weekday":3,"opens":"08:00","closes":"12:00"},{"weekday":3,"opens":"11:00","closes":"14:00"}]')$q$, 'overlapping periods');
select pg_temp.check((select count(*) = 3 from public.business_hours where provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'refused replace keeps the old hours');
select pg_temp.expect_error($q$insert into public.business_hours (provider_id, weekday, opens, closes)
  values ('e3e3e3e3-0000-4000-8000-0000000000e3', 1, '08:00', '17:00')$q$, 'hours for another owner''s business');
select pg_temp.expect_error($q$select public.set_business_hours('e3e3e3e3-0000-4000-8000-0000000000e3', '[]')$q$,
  'replace hours of another owner''s business');
select pg_temp.expect_error($q$insert into public.business_closed_dates (provider_id, day)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today() - 1)$q$, 'closed date in the past');
insert into public.business_closed_dates (provider_id, day, note)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today() + 5, 'Family event');
select pg_temp.expect_error($q$insert into public.business_services (provider_id, name)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'Call 0712345678')$q$, 'phone number in a service name');

-- Terms and the switch are server-only.
update public.providers set reservation_terms_version = private.reservation_terms_version(), reservation_terms_at = now()
where id = 'e1e1e1e1-0000-4000-8000-0000000000e1';
select pg_temp.check((select reservation_terms_version is null from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'owner cannot type the terms acceptance');
select pg_temp.expect_error($q$update public.providers set takes_reservations = true
  where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'$q$, 'switch on directly while rules fail');
select pg_temp.check((select 'terms_not_accepted' = any (b) and 'no_commission_rate' = any (b)
                      from (select public.set_takes_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', true) b) x),
                     'blockers: terms and rate');
select pg_temp.expect_error($q$select public.accept_reservation_terms('e1e1e1e1-0000-4000-8000-0000000000e1', 'old-version')$q$,
  'accepting an old terms version');
select public.accept_reservation_terms('e1e1e1e1-0000-4000-8000-0000000000e1', private.reservation_terms_version());
select pg_temp.check((select reservation_terms_at is not null from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'terms accepted through the function');
select pg_temp.expect_error($q$select public.accept_reservation_terms('e3e3e3e3-0000-4000-8000-0000000000e3', private.reservation_terms_version())$q$,
  'accepting terms for another owner''s business');
select pg_temp.expect_error($q$select * from public.reservation_setup_status('e3e3e3e3-0000-4000-8000-0000000000e3')$q$,
  'setup status of another owner''s business');

-- Prices are admin only.
select pg_temp.expect_error($q$insert into public.price_list (account_type, business_type, service_code, period)
  values ('business', 'restaurant', 'reservation_commission', 'once')$q$, 'owner inserts a price');
select pg_temp.expect_error($q$update public.price_list set amount_tzs = 1 where service_code = 'reservation_commission'$q$,
  'owner updates a price');
select pg_temp.expect_error($q$select note from public.price_list$q$, 'owner reads the admin note');
select pg_temp.expect_error($q$select public.admin_save_price_draft(
  (select id from public.price_list where business_type = 'restaurant' and service_code = 'reservation_commission' limit 1),
  1, null, 1, private.tz_today(), null)$q$, 'owner saves a price');
select pg_temp.check((select count(*) = 0 from public.price_list), 'owner sees no draft prices');
reset role;

-- 2. Admin with a password only (no two-step) ----------------------------------
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-0000000000c3","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select * from public.admin_price_rows()$q$, 'admin without two-step reads prices');
select pg_temp.expect_error($q$select public.admin_activate_price(
  (select id from public.price_list where business_type = 'restaurant' limit 1))$q$, 'admin without two-step activates');
reset role;

-- 3. Admin with two-step: fill in and activate test rates -----------------------
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-0000000000c3","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
create temp table rs_ids on commit drop as
  select id, business_type, service_code from public.admin_price_rows()
  where service_code in ('reservation_commission', 'reservation_unpriced_fee');

select pg_temp.expect_error($q$select public.admin_activate_price((select id from rs_ids where business_type = 'restaurant'))$q$,
  'activating a price with no value');
select pg_temp.expect_error($q$select public.admin_save_price_draft((select id from rs_ids where business_type = 'restaurant'),
  null, 10, null, private.tz_today(), null)$q$, 'percent on a per-guest row');
select pg_temp.expect_error($q$select public.admin_save_price_draft((select id from rs_ids where business_type = 'spa'),
  null, 10, 5, private.tz_today(), null)$q$, 'max guests on a percent row');
select pg_temp.expect_error($q$select public.admin_save_price_draft((select id from rs_ids where business_type = 'restaurant'),
  2000, null, 10, private.tz_today() - 1, null)$q$, 'start date in the past');
select pg_temp.expect_error($q$select public.admin_save_price_draft((select id from rs_ids where business_type = 'spa'),
  null, 80, null, private.tz_today(), null)$q$, 'percent above the typo ceiling');

select public.admin_save_price_draft((select id from rs_ids where business_type = 'restaurant'), 2000, null, 10, private.tz_today(), 'test');
select public.admin_save_price_draft((select id from rs_ids where business_type = 'spa'), null, 10, null, private.tz_today(), null);
select public.admin_save_price_draft((select id from rs_ids where business_type = 'salon'), null, 10, null, private.tz_today(), null);
select public.admin_save_price_draft((select id from rs_ids where service_code = 'reservation_unpriced_fee'), 3000, null, null, private.tz_today(), null);
select public.admin_activate_price(id) from rs_ids;
select pg_temp.check((select count(*) = 4 from public.price_list where status = 'active'), 'four rates active');
select pg_temp.expect_error($q$select public.admin_activate_price((select id from rs_ids where business_type = 'spa'))$q$,
  'activating twice');
select pg_temp.expect_error($q$select public.admin_save_price_draft((select id from rs_ids where business_type = 'spa'),
  null, 12, null, private.tz_today(), null)$q$, 'editing an active price');

-- A new version from a date ends the old one on that date.
select public.admin_save_price_draft(public.admin_new_price_version((select id from rs_ids where business_type = 'restaurant')),
  2500, null, 10, private.tz_today() + 10, null);
select pg_temp.expect_error($q$select public.admin_new_price_version((select id from rs_ids where business_type = 'restaurant'))$q$,
  'a second open draft for the same rate');
select public.admin_activate_price((select id from public.price_list
  where business_type = 'restaurant' and service_code = 'reservation_commission' and status = 'draft'));
select pg_temp.check((select active_to = private.tz_today() + 10 from public.price_list
                      where id = (select id from rs_ids where business_type = 'restaurant')),
                     'old restaurant rate ends when the new one starts');
select pg_temp.check((select amount_tzs = 2000 from public.reservation_rate('e1e1e1e1-0000-4000-8000-0000000000e1')),
                     'today''s rate is still the old one');
select pg_temp.expect_error($q$select public.admin_end_price((select id from rs_ids where business_type = 'salon'), private.tz_today() - 1)$q$,
  'ending a price in the past');
select pg_temp.check((select count(*) >= 7 from public.admin_price_log(100)), 'every save is logged');
reset role;

-- 4. Owner a1 switches on --------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select cardinality(public.set_takes_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', true)) = 0),
                     'restaurant switches on');
select pg_temp.check((select takes_reservations from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'restaurant takes reservations');
select pg_temp.check((select kind = 'per_guest' and amount_tzs = 2000 and max_guests_counted = 10
                      from public.reservation_rate('e1e1e1e1-0000-4000-8000-0000000000e1')), 'restaurant rate per guest');

-- Spa: needs services and a licence check.
select public.accept_reservation_terms('e2e2e2e2-0000-4000-8000-0000000000e2', private.reservation_terms_version());
select public.set_business_hours('e2e2e2e2-0000-4000-8000-0000000000e2', '[{"weekday":2,"opens":"09:00","closes":"18:00"}]');
select pg_temp.check((select 'no_service' = any (b) and 'licence_check_missing' = any (b)
                      from (select public.set_takes_reservations('e2e2e2e2-0000-4000-8000-0000000000e2', true) b) x),
                     'spa blockers: service and licence');
select pg_temp.expect_error($q$insert into public.business_services (id, provider_id, name)
  values (gen_random_uuid(), 'e2e2e2e2-0000-4000-8000-0000000000e2', 'Own id')$q$, 'owner chooses a service id');
insert into public.business_services (provider_id, name, duration_min, price_tzs, max_people)
values ('e2e2e2e2-0000-4000-8000-0000000000e2', '60-minute massage', 60, 50000, 2),
       ('e2e2e2e2-0000-4000-8000-0000000000e2', 'Foot massage', 30, null, 1);
select pg_temp.check((select kind = 'percent' and percent = 10
                      from public.reservation_rate('e2e2e2e2-0000-4000-8000-0000000000e2',
                        (select id from public.business_services where name = '60-minute massage'))),
                     'priced service: percent');
select pg_temp.check((select kind = 'per_person' and amount_tzs = 3000
                      from public.reservation_rate('e2e2e2e2-0000-4000-8000-0000000000e2',
                        (select id from public.business_services where name = 'Foot massage'))),
                     'unpriced service: fee per person');
select pg_temp.check((select b = '{licence_check_missing}'
                      from (select public.set_takes_reservations('e2e2e2e2-0000-4000-8000-0000000000e2', true) b) x),
                     'spa still needs the licence check');
select pg_temp.expect_error($q$insert into public.business_services (provider_id, name)
  values ('e3e3e3e3-0000-4000-8000-0000000000e3', 'Haircut')$q$, 'service for another owner''s business');
reset role;

-- Kwetuly records a current licence check (only server code can).
insert into public.person_document_checks (user_id, provider_id, kind, valid_until)
values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'e2e2e2e2-0000-4000-8000-0000000000e2', 'business_licence', private.tz_today() + 300);

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select cardinality(public.set_takes_reservations('e2e2e2e2-0000-4000-8000-0000000000e2', true)) = 0),
                     'spa switches on with a licence check');
-- Pending business: cannot switch on even with everything else.
select public.accept_reservation_terms('e4e4e4e4-0000-4000-8000-0000000000e4', private.reservation_terms_version());
select public.set_business_hours('e4e4e4e4-0000-4000-8000-0000000000e4', '[{"weekday":1,"opens":"08:00","closes":"17:00"}]');
select pg_temp.check((select b = '{not_approved}'
                      from (select public.set_takes_reservations('e4e4e4e4-0000-4000-8000-0000000000e4', true) b) x),
                     'pending business is refused');
reset role;

-- 5. Signed-out visitor --------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check((select count(*) = 3 from public.business_hours where provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'visitor reads hours of a reserving business');
select pg_temp.check((select count(*) = 0 from public.business_hours where provider_id = 'e4e4e4e4-0000-4000-8000-0000000000e4'),
                     'visitor cannot read hours of a pending business');
select pg_temp.check((select count(*) = 2 from public.business_services where provider_id = 'e2e2e2e2-0000-4000-8000-0000000000e2'),
                     'visitor reads active services of the spa');
select pg_temp.check((select count(*) = 0 from public.price_list where status <> 'active'), 'visitor sees active prices only');
select pg_temp.check((select count(*) = 0 from public.reservation_rate('e4e4e4e4-0000-4000-8000-0000000000e4')),
                     'no rate shown for a pending business');
select pg_temp.expect_error($q$select public.set_takes_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', false)$q$,
  'visitor switches a business off');
reset role;

-- 6. Rules are checked again every day -------------------------------------------
update public.person_document_checks set ended_at = now(), end_reason = 'withdrawn'
where provider_id = 'e2e2e2e2-0000-4000-8000-0000000000e2' and kind = 'business_licence';
select pg_temp.check((select takes_reservations from public.providers where id = 'e2e2e2e2-0000-4000-8000-0000000000e2')
                     and not private.provider_open_for_reservations('e2e2e2e2-0000-4000-8000-0000000000e2'),
                     'spa closes for reservations when the licence check ends');

-- 7. Owner changes and switches off ------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select cardinality(public.set_takes_reservations('e2e2e2e2-0000-4000-8000-0000000000e2', false)) = 0),
                     'owner switches off');
update public.providers set business_type = 'hotel' where id = 'e1e1e1e1-0000-4000-8000-0000000000e1';
select pg_temp.check(not (select takes_reservations from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'a hotel cannot take reservations');
reset role;

select 'all passed';
rollback;
