-- Tests for the manual Lipa payments migrations 20261126001000, 001100, 001200 and 001300.
-- Needs 20261126000000_feature_switch_admin.sql (branch claude/wave1) on the test project first.
-- Run ONLY on a local or test project (never live), after those three files, in the SQL editor or psql
-- as postgres. One transaction that ends with ROLLBACK: nothing below stays. Any failure stops the
-- script with "FAIL: ...". The last line prints "all passed". Every name, number and transaction ID
-- here is invented test data.

begin;

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

create function pg_temp.as_user(p_id uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

grant execute on function pg_temp.expect_code(text, text, text) to authenticated;
grant execute on function pg_temp.check(boolean, text) to authenticated;

-- p1 guide (payer), b1 business owner (payer), a1 and a2 admins; a1 also owns a business.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-0000-4000-8000-0000000000a1', 'lipa-guide@example.test', 'authenticated', 'authenticated', '{}'),
  ('22222222-0000-4000-8000-0000000000b1', 'lipa-owner@example.test', 'authenticated', 'authenticated', '{}'),
  ('33333333-0000-4000-8000-0000000000c1', 'lipa-admin1@example.test', 'authenticated', 'authenticated', '{}'),
  ('44444444-0000-4000-8000-0000000000c2', 'lipa-admin2@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('11111111-0000-4000-8000-0000000000a1', '22222222-0000-4000-8000-0000000000b1',
             '33333333-0000-4000-8000-0000000000c1', '44444444-0000-4000-8000-0000000000c2');
update public.profiles set role = 'admin' where id in ('33333333-0000-4000-8000-0000000000c1', '44444444-0000-4000-8000-0000000000c2');

insert into public.guides (id, owner_id, slug, display_name, base_region, verification_status)
values ('55555555-0000-4000-8000-000000000055', '11111111-0000-4000-8000-0000000000a1', 'lipa-test-guide', 'Lipa Test Guide', 'Arusha', 'approved');
insert into public.providers (id, owner_id, business_name, base_region, business_type, verification_status) values
  ('66666666-0000-4000-8000-000000000066', '22222222-0000-4000-8000-0000000000b1', 'Lipa test lodge', 'Arusha', 'lodge', 'approved'),
  ('77777777-0000-4000-8000-000000000077', '33333333-0000-4000-8000-0000000000c1', 'Lipa admin shop', 'Moshi', 'curio_shop', 'approved');
insert into public.person_document_checks (user_id, kind, method)
values ('11111111-0000-4000-8000-0000000000a1', 'identity', 'nida_card');

-- Test prices (as postgres): guide verification per year and the badge, from today.
update public.price_list set amount_tzs = 50000, active_from = private.tz_today()
where account_type = 'guide' and service_code = 'verification' and period = 'year' and status = 'draft';
update public.price_list set status = 'active'
where account_type = 'guide' and service_code = 'verification' and period = 'year' and status = 'draft';
update public.price_list set amount_tzs = 120000, active_from = private.tz_today()
where account_type = 'business' and service_code = 'business_badge' and status = 'draft';
update public.price_list set status = 'active'
where account_type = 'business' and service_code = 'business_badge' and status = 'draft';

-- ===========================================================================
-- A. Settings, numbers and the chooser
-- ===========================================================================
select pg_temp.check(private.feature_on('payments_manual') and private.feature_on('deposits_via_kwetuly_lipa'),
  'A: payments_manual and deposits_via_kwetuly_lipa seeded on');
select pg_temp.check(not private.feature_on('payments_live'), 'A: payments_live stays off');
select pg_temp.check((select count(*) = 0 from public.payment_numbers), 'A: no Lipa number seeded');
select pg_temp.expect_code($q$insert into public.site_settings (key, value) values ('payments.providers', '{"mobile_money": ["evil"], "bank": [], "card": []}')
  on conflict (key) do update set value = excluded.value$q$, 'site_settings_payments_shape', 'A: unknown provider id refused');
select pg_temp.expect_code($q$update public.site_settings set value = '{"mobile_money": [], "bank": [], "card": ["manual_lipa"]}' where key = 'payments.providers'$q$,
  'site_settings_payments_shape', 'A: Lipa cannot take cards');

-- Payers cannot read the numbers table; admins without two-step cannot add numbers.
select pg_temp.as_user('11111111-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select * from public.payment_numbers$q$, 'permission denied', 'A: payers cannot read payment_numbers');
select pg_temp.expect_code($q$select * from public.payment_orders$q$, 'permission denied', 'A: payers cannot read payment_orders');
select pg_temp.expect_code($q$select public.admin_save_payment_number(null, 'mpesa', '123456', 'Test name', null, null, true, 0)$q$,
  'admins only', 'A: a payer cannot add a number');
-- No number on yet: Lipa is not live.
select pg_temp.check((select state = 'coming_soon' from public.payment_methods_for('verification', 'web') where id = 'manual_lipa'),
  'A: Lipa is not live without a switched-on number');
reset role;

select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1');
set local role authenticated;
select pg_temp.expect_code($q$select public.admin_save_payment_number(null, 'mpesa', '123456', 'Test name', null, null, true, 0)$q$,
  'admins only', 'A: admin without two-step cannot add a number');
reset role;
select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1', 'aal2');
set local role authenticated;
select public.admin_save_payment_number(null, 'mpesa', '000111', 'Kwetuly test till', null, null, true, 0);
select public.admin_save_payment_number(null, 'bank', '000222', 'Kwetuly test bank', 'Test Bank', null, false, 1);
reset role;
select pg_temp.check((select count(*) >= 2 from public.payment_audit_log where action = 'number_added'), 'A: number changes logged');
select pg_temp.expect_code($q$delete from public.payment_numbers$q$, 'never deleted', 'A: numbers are never deleted');
select pg_temp.expect_code($q$update public.payment_audit_log set action = 'x'$q$, 'cannot be changed', 'A: audit log is append-only');

select pg_temp.as_user('11111111-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.check((select count(*) = 1 from public.payment_numbers_for_payers()), 'A: payers see only switched-on numbers');
select pg_temp.check((select state = 'live' and route = 'third_party_in_app' from public.payment_methods_for('verification', 'web') where id = 'manual_lipa'),
  'A: Lipa live on the website');
select pg_temp.check((select state = 'coming_soon' from public.payment_methods_for('verification', 'web') where id = 'flutterwave'),
  'A: Flutterwave coming soon on the website (payments_live off)');
select pg_temp.check((select count(*) = 0 from public.payment_methods_for('verification', 'ios')),
  'A: verification is web only in the iOS app: no rows at all');
select pg_temp.check((select count(*) >= 1 from public.payment_methods_for('offer_deposit', 'android') where state = 'coming_soon'),
  'A: the Android app shows coming-soon methods for deposits (Walter 2026-11-27), not selectable');

-- ===========================================================================
-- B. Guide verification: order, claim, confirm, idempotency
-- ===========================================================================
select pg_temp.expect_code($q$insert into public.payment_orders (reference, user_id, purpose, subject_key, amount_tzs)
  values ('KW222222', '11111111-0000-4000-8000-0000000000a1', 'verification', 'x', 1)$q$, 'permission denied', 'B: payers cannot insert orders');
select pg_temp.expect_code($q$select * from public.start_payment_order('verification', null, 'year', 'guide', null, 'manual_lipa', 'ios')$q$,
  'not_in_app', 'B: verification refused from the iOS app');
select pg_temp.expect_code($q$select * from public.start_payment_order('verification', null, 'year', 'guide', null, 'flutterwave', 'web')$q$,
  'provider_not_live', 'B: a coming-soon provider is refused');
select pg_temp.expect_code($q$select * from public.start_payment_order('verification', null, 'year', 'porter', null, 'manual_lipa', 'web')$q$,
  'crew_fees_not_open', 'B: crew fees refused until a vouching guide can be checked');
create temp table o1 on commit drop as
  select * from public.start_payment_order('verification', null, 'year', 'guide', null, 'manual_lipa', 'web');
select pg_temp.check((select amount_tzs = 50000 and status = 'awaiting_payment' from o1), 'B: amount from price_list');
select pg_temp.check((select reference from public.start_payment_order('verification', null, 'year', 'guide', null, 'manual_lipa', 'web'))
                     = (select reference from o1), 'B: pressing Pay again reopens the same order');
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o1), 'mpesa', 'ab', '0712345678')$q$,
  'transaction_format', 'B: bad transaction id');
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o1), 'mpesa', 'TESTTX0001', '022 123')$q$,
  'phone_format', 'B: bad phone');
select pg_temp.check(public.submit_payment_claim((select reference from o1), 'mpesa', 'testtx 0001', '0712 345 678') = 'submitted',
  'B: claim submitted');
select pg_temp.check((select status = 'submitted' and claim_phone = '+255 7** *** 678' from public.my_payment_orders((select reference from o1))),
  'B: payer sees waiting for confirmation, phone masked');
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o1), 'mpesa', 'TESTTX0002', '0712345678')$q$,
  'claim_waiting', 'B: one waiting claim per order');
select pg_temp.expect_code($q$select public.admin_confirm_payment((select c.id from public.payment_claims c limit 1), 50000, 'key-test-0001')$q$,
  'permission denied', 'B: payers cannot see claims');
reset role;
create temp table c1 on commit drop as
  select c.id from public.payment_claims c join public.payment_orders o on o.id = c.order_id where o.reference = (select reference from o1);
grant select on c1, o1 to authenticated;

select pg_temp.as_user('11111111-0000-4000-8000-0000000000a1', 'aal2');
set local role authenticated;
select pg_temp.expect_code($q$select public.admin_confirm_payment((select id from c1), 50000, 'key-test-0001')$q$,
  'admins only', 'B: the payer cannot confirm his own payment');
reset role;

select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1', 'aal2');
set local role authenticated;
select pg_temp.check((select count(*) = 1 from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0001'), 'B: admin queue shows the claim');
select pg_temp.expect_code($q$select public.admin_confirm_payment((select id from c1), 49000, 'key-test-0001')$q$,
  'amount does not match', 'B: confirm needs the exact amount');
select pg_temp.expect_code($q$select public.admin_confirm_payment((select id from c1), 50000, 'short')$q$,
  'idempotency key needed', 'B: confirm needs an idempotency key');
select pg_temp.check(public.admin_confirm_payment((select id from c1), 50000, 'key-test-0001') = 'confirmed', 'B: confirmed');
select pg_temp.check(public.admin_confirm_payment((select id from c1), 50000, 'key-test-0001') = 'already_confirmed', 'B: same key again: already confirmed');
select pg_temp.check(public.admin_confirm_payment((select id from c1), 50000, 'key-test-0002') = 'already_confirmed', 'B: new key on a confirmed order: already confirmed');
reset role;
select pg_temp.check((select count(*) = 1 from public.member_subscriptions where user_id = '11111111-0000-4000-8000-0000000000a1'),
  'B: the effect ran once');
select pg_temp.check((select paid_until = (private.tz_today() + interval '1 year')::date - 1 from public.member_subscriptions
                      where user_id = '11111111-0000-4000-8000-0000000000a1'), 'B: one year paid');
select pg_temp.check((select count(*) = 1 from public.notification_outbox where event = 'manual_payment_confirmed'
                      and recipient_user_id = '11111111-0000-4000-8000-0000000000a1' and channel = 'email'), 'B: payer told');
select pg_temp.check((select count(*) >= 1 from public.notification_outbox where event = 'manual_payment_submitted'
                      and recipient_user_id = '33333333-0000-4000-8000-0000000000c1'), 'B: admins told of the claim');
select pg_temp.check((select count(*) = 1 from public.payment_audit_log where action = 'confirmed' and reference = (select reference from o1)),
  'B: confirmation logged once');
select pg_temp.check((select count(*) = 0 from public.payment_audit_log where details::text like '%0712345678%' or details::text like '%255712345678%'),
  'B: no full phone number in the audit log');
select pg_temp.expect_code($q$update public.payment_orders set amount_tzs = 1 where reference = (select reference from o1)$q$,
  'cannot change', 'B: amounts are fixed');

-- ===========================================================================
-- C. Badge: duplicate transaction ID, reject, wrong amount then top-up
-- ===========================================================================
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
create temp table o2 on commit drop as
  select * from public.start_payment_order('business_badge', '66666666-0000-4000-8000-000000000066', null, null, null, 'manual_lipa', 'web');
select pg_temp.check((select amount_tzs = 120000 from o2), 'C: badge amount from price_list');
select pg_temp.check(public.submit_payment_claim((select reference from o2), 'mpesa', 'TESTTX0001', '0754000111') = 'duplicate',
  'C: a used transaction ID is refused');
reset role;
select pg_temp.check((select count(*) = 1 from public.payment_audit_log where action = 'duplicate_blocked'), 'C: duplicate logged');
grant select on o2 to authenticated;
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
select pg_temp.check(public.submit_payment_claim((select reference from o2), 'mpesa', 'TESTTX0003', '0754000111') = 'submitted', 'C: claim 1');
reset role;
select pg_temp.as_user('44444444-0000-4000-8000-0000000000c2', 'aal2');
set local role authenticated;
select public.admin_reject_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0003'), 'not_found', 'Not on the statement');
reset role;
select pg_temp.check((select status = 'awaiting_payment' from public.payment_orders where reference = (select reference from o2)), 'C: rejected claim reopens the order');
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
select pg_temp.check(public.submit_payment_claim((select reference from o2), 'mpesa', 'TESTTX0003', '0754000111') = 'duplicate',
  'C: a rejected transaction ID stays blocked');
select pg_temp.check(public.submit_payment_claim((select reference from o2), 'mpesa', 'TESTTX0004', '0754000111') = 'submitted', 'C: claim 2');
reset role;
select pg_temp.as_user('44444444-0000-4000-8000-0000000000c2', 'aal2');
set local role authenticated;
select pg_temp.expect_code($q$select public.admin_mark_wrong_amount((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0004'), 120000)$q$,
  'amount matches', 'C: wrong amount refuses the right amount');
select public.admin_mark_wrong_amount((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0004'), 100000, 'Short by 20,000');
reset role;
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
select pg_temp.check((select status = 'wrong_amount' and received_tzs = 100000 from public.my_payment_orders((select reference from o2))), 'C: payer sees wrong amount');
select pg_temp.check(public.submit_payment_claim((select reference from o2), 'mpesa', 'TESTTX0005', '0754000111') = 'submitted', 'C: top-up claim');
reset role;
-- Switching the badge fee off stops new orders but not confirming a pending one.
update public.site_settings set value = '{"on": false}' where key = 'feature.business_badge_fees';
select pg_temp.as_user('44444444-0000-4000-8000-0000000000c2', 'aal2');
set local role authenticated;
select pg_temp.check(public.admin_confirm_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0005'), 20000, 'key-test-0003') = 'confirmed',
  'C: top-up confirms the total while the fee switch is off');
reset role;
select pg_temp.check((select badge_requested_at is not null from public.providers where id = '66666666-0000-4000-8000-000000000066'),
  'C: paid badge goes into the badge-check queue');

-- ===========================================================================
-- D. Own payment and switches
-- ===========================================================================
update public.site_settings set value = '{"on": true}' where key = 'feature.business_badge_fees';
select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1', 'aal2');
set local role authenticated;
create temp table o3 on commit drop as
  select * from public.start_payment_order('business_badge', '77777777-0000-4000-8000-000000000077', null, null, null, 'manual_lipa', 'web');
select public.submit_payment_claim((select reference from o3), 'mpesa', 'TESTTX0006', '0765000222');
select pg_temp.expect_code($q$select public.admin_confirm_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0006'), 120000, 'key-test-0004')$q$,
  'own payment', 'D: an admin cannot confirm his own payment');
reset role;
update public.site_settings set value = '{"on": false}' where key = 'feature.payments_manual';
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
select pg_temp.expect_code($q$select * from public.start_payment_order('business_badge', '66666666-0000-4000-8000-000000000066', null, null, null, 'manual_lipa', 'web')$q$,
  'payments_off', 'D: payments_manual off stops new orders');
reset role;

update public.site_settings set value = '{"on": true}' where key = 'feature.payments_manual';

-- ===========================================================================
-- E. Security review round (H1, M2, M3, M4, L3, L7-L9) and QA
-- ===========================================================================
-- H1: punctuation and case do not dodge the duplicate check; edges are refused; look-alikes are flagged.
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
create temp table o4 on commit drop as
  select * from public.start_payment_order('business_badge', '66666666-0000-4000-8000-000000000066', null, null, null, 'manual_lipa', 'web');
select pg_temp.check((select reference from public.start_payment_order('business_badge', '66666666-0000-4000-8000-000000000066', null, null, null, 'manual_lipa', 'web'))
                     = (select reference from o4), 'E/L1: pressing Pay again for the badge keeps the same order');
select pg_temp.check(public.submit_payment_claim((select reference from o4), 'mpesa', 'TESTTX-0001', '0754000111') = 'duplicate', 'E/H1: dash does not dodge');
select pg_temp.check(public.submit_payment_claim((select reference from o4), 'mpesa', 'testtx.0001', '0754000111') = 'duplicate', 'E/H1: dot and case do not dodge');
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o4), 'mpesa', '-TESTTX7777', '0754000111')$q$,
  'transaction_format', 'E/H1: leading punctuation refused');
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o4), 'mpesa', 'TESTTX7777.', '0754000111')$q$,
  'transaction_format', 'E/H1: trailing punctuation refused');
select pg_temp.check(public.submit_payment_claim((select reference from o4), 'mpesa', 'TESTTXOOO1', '0754000111') = 'submitted', 'E/H1: look-alike accepted for checking');
-- Cross-user: another payer cannot see or use this reference.
reset role;
grant select on o4 to authenticated;
select pg_temp.as_user('11111111-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o4), 'mpesa', 'TESTTX8888', '0712345678')$q$,
  'order not found', 'E: another payer cannot use this reference');
select pg_temp.check((select count(*) = 0 from public.my_payment_orders((select reference from o4))), 'E: another payer cannot read this order');
reset role;
-- M3: a valid badge is not extended by paying; a re-check is queued.
update public.providers set badge_checks = '{licence}', badge_checked_at = private.tz_today(), badge_valid_until = private.tz_today() + 30,
  badge_requested_at = null where id = '66666666-0000-4000-8000-000000000066';
select pg_temp.as_user('44444444-0000-4000-8000-0000000000c2', 'aal2');
set local role authenticated;
select pg_temp.check((select similar_claims >= 1 and blocked_attempts >= 2 from public.admin_payment_queue('waiting') where transaction_id = 'TESTTXOOO1'),
  'E/H1: the queue warns about the look-alike and the blocked attempts');
select pg_temp.check(public.admin_confirm_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTXOOO1'), 120000, 'key-test-0005') = 'confirmed',
  'E: badge renewal confirmed');
reset role;
select pg_temp.check((select badge_valid_until = private.tz_today() + 30 and badge_requested_at is not null from public.providers
                      where id = '66666666-0000-4000-8000-000000000066'), 'E/M3: paying does not extend the badge; a re-check is queued');
select pg_temp.check((select count(*) = 0 from public.payment_audit_log where reference = (select reference from o4) and action = 'refund_needs_walter'),
  'E: no refund flag on a badge payment');

-- Cancel and rate limits (p1).
update public.price_list set amount_tzs = 5000, active_from = private.tz_today()
where account_type = 'guide' and service_code = 'verification' and period = 'month' and status = 'draft';
update public.price_list set status = 'active'
where account_type = 'guide' and service_code = 'verification' and period = 'month' and status = 'draft';
select pg_temp.as_user('11111111-0000-4000-8000-0000000000a1');
set local role authenticated;
create temp table o5 on commit drop as select * from public.start_payment_order('verification', null, 'month', 'guide', null, 'manual_lipa', 'web');
select public.cancel_payment_order((select reference from o5));
select pg_temp.check((select status = 'cancelled' from public.my_payment_orders((select reference from o5))), 'E: payer cancels an unpaid order');
select pg_temp.expect_code($q$select public.cancel_payment_order((select reference from o5))$q$, 'order_closed', 'E: a cancelled order stays closed');
create temp table o6 on commit drop as select * from public.start_payment_order('verification', null, 'month', 'guide', null, 'manual_lipa', 'web');
select public.submit_payment_claim((select reference from o6), 'mpesa', 'TESTTX0003', '0712345678');
select public.submit_payment_claim((select reference from o6), 'mpesa', 'TESTTX0003', '0712345678');
select public.submit_payment_claim((select reference from o6), 'mpesa', 'TESTTX0003', '0712345678');
select public.submit_payment_claim((select reference from o6), 'mpesa', 'TESTTX0003', '0712345678');
select pg_temp.expect_code($q$select public.submit_payment_claim((select reference from o6), 'mpesa', 'TESTTX0003', '0712345678')$q$,
  'rate_limited', 'E: the sixth attempt in an hour is refused');
-- Commission: billing is off.
select pg_temp.expect_code($q$select * from public.start_payment_order('reservation_commission', '66666666-0000-4000-8000-000000000066', null, null, date_trunc('month', now())::date - 1, 'manual_lipa', 'web')$q$,
  'payments_off', 'E: commission cannot be paid while its billing switch is off');
reset role;

-- Overpayment, close with refund due, refund records (b1).
select pg_temp.as_user('22222222-0000-4000-8000-0000000000b1');
set local role authenticated;
create temp table o7 on commit drop as
  select * from public.start_payment_order('business_badge', '66666666-0000-4000-8000-000000000066', null, null, null, 'manual_lipa', 'web');
select public.submit_payment_claim((select reference from o7), 'mpesa', 'TESTTX0010', '0754000111');
reset role;
grant select on o7 to authenticated;
select pg_temp.as_user('44444444-0000-4000-8000-0000000000c2', 'aal2');
set local role authenticated;
select public.admin_mark_wrong_amount((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0010'), 150000, 'Paid too much');
select pg_temp.expect_code($q$select public.admin_close_order((select reference from o7), 'refund_due', 0)$q$, 'received amount needed', 'E/M2: refund_due needs the amount');
select public.admin_close_order((select reference from o7), 'refund_due', 150000, 'Overpaid; refund to the payer');
select pg_temp.check((select count(*) = 1 from public.admin_refunds_due() where reference = (select reference from o7)), 'E/M2: listed as refund due');
select pg_temp.expect_code($q$select public.admin_record_refund((select reference from o7), 150001, 'mpesa', 'RF12345')$q$,
  'refund more than received', 'E/M2: never more than received');
select public.admin_record_refund((select reference from o7), 150000, 'mpesa', 'RF12345', 'Sent back');
select pg_temp.check((select count(*) = 0 from public.admin_refunds_due() where reference = (select reference from o7)), 'E/M2: refund recorded, nothing due');
select pg_temp.expect_code($q$select public.admin_record_refund((select reference from o7), 1, 'mpesa', 'RF12346')$q$, 'no refund due', 'E/M2: no second refund');
reset role;
select pg_temp.check((select count(*) >= 2 from public.payment_audit_log where reference = (select reference from o7) and action = 'refund_needs_walter'),
  'E/M2: overpayment and close logged for Walter');
select pg_temp.expect_code($q$update public.payment_refund_records set amount_tzs = 1$q$, 'cannot be changed', 'E/M2: refund records are append-only');

-- L7: the rate's range and jump.
select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1', 'aal2');
set local role authenticated;
select pg_temp.expect_code($q$select public.admin_set_manual_rate('50', 'Test source', private.tz_today())$q$, 'rate out of range', 'E/L7: implausible rate');
select public.admin_set_manual_rate('2650', 'Test source', private.tz_today());
select pg_temp.expect_code($q$select public.admin_set_manual_rate('3000', 'Test source', private.tz_today())$q$, 'rate jump', 'E/L7: a jump over 10% needs confirming');
reset role;

-- Deposits: matched against guard_new_payment, confirmed (L9), and received-not-applied (L8, M2).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('88888888-0000-4000-8000-0000000000d8', 'lipa-traveller@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now() where id = '88888888-0000-4000-8000-0000000000d8';
insert into public.trip_requests (id, traveler_id, traveler_name, title, details, specialty, start_date) values
  ('a0a0a0a0-0000-4000-8000-0000000000a0', '88888888-0000-4000-8000-0000000000d8', 'Test Traveller', 'Test climb request', 'A test request with enough words.', 'mountain', private.tz_today() + 30),
  ('b0b0b0b0-0000-4000-8000-0000000000b0', '88888888-0000-4000-8000-0000000000d8', 'Test Traveller', 'Test safari request', 'A test request with enough words.', 'safari', private.tz_today() + 30),
  ('c0c0c0c0-0000-4000-8000-0000000000c0', '88888888-0000-4000-8000-0000000000d8', 'Test Traveller', 'Test city request', 'A test request with enough words.', 'city', private.tz_today() + 30);
insert into public.trip_offers (id, request_id, offered_by, guide_id, price_total_usd, deposit_percent, itinerary, status) values
  ('a1a1a1a1-1111-4000-8000-0000000000a1', 'a0a0a0a0-0000-4000-8000-0000000000a0', '11111111-0000-4000-8000-0000000000a1', '55555555-0000-4000-8000-000000000055', 1000, 30, 'Day one walk, day two climb, day three down.', 'accepted'),
  ('b1b1b1b1-1111-4000-8000-0000000000b1', 'b0b0b0b0-0000-4000-8000-0000000000b0', '11111111-0000-4000-8000-0000000000a1', '55555555-0000-4000-8000-000000000055', 1000, 30, 'Day one drive, day two park, day three back.', 'accepted'),
  ('c1c1c1c1-1111-4000-8000-0000000000c1', 'c0c0c0c0-0000-4000-8000-0000000000c0', '11111111-0000-4000-8000-0000000000a1', '55555555-0000-4000-8000-000000000055', 1000, 30, 'Day one town, day two market, day three back.', 'accepted');
select pg_temp.as_user('88888888-0000-4000-8000-0000000000d8');
set local role authenticated;
create temp table d1 on commit drop as select * from public.start_payment_order('offer_deposit', 'a1a1a1a1-1111-4000-8000-0000000000a1', null, null, null, 'manual_lipa', 'web');
create temp table d2 on commit drop as select * from public.start_payment_order('offer_deposit', 'b1b1b1b1-1111-4000-8000-0000000000b1', null, null, null, 'manual_lipa', 'android');
create temp table d3 on commit drop as select * from public.start_payment_order('offer_deposit', 'c1c1c1c1-1111-4000-8000-0000000000c1', null, null, null, 'manual_lipa', 'web');
select pg_temp.check((select amount_tzs = 795000 and amount_usd = 300 from d1), 'E: deposit amount from the offer and the admin rate (USD 300 at 2650)');
select public.submit_payment_claim((select reference from d1), 'mpesa', 'TESTTX0020', '0765111222');
select public.submit_payment_claim((select reference from d2), 'airtel', 'TESTTX0021', '0685111222');
reset role;
grant select on d1, d2, d3 to authenticated;
select pg_temp.check((select count(*) = 3 from public.payments p join public.payment_orders o on o.payment_id = p.id
                      where o.reference in ((select reference from d1), (select reference from d2), (select reference from d3))
                        and p.status = 'pending' and p.provider = 'manual_lipa' and p.amount_tzs = o.amount_tzs),
  'E: each deposit order has a pending payments row that passed guard_new_payment with the same amount');
-- The trip of d2 moves inside the 8-day cut-off of its claim day.
update public.trip_requests set start_date = private.tz_today() + 3 where id = 'b0b0b0b0-0000-4000-8000-0000000000b0';
select pg_temp.as_user('11111111-0000-4000-8000-0000000000a1', 'aal2');
set local role authenticated;
select pg_temp.expect_code($q$select public.admin_confirm_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0020'), 795000, 'key-test-0006')$q$,
  'admins only', 'E: a guide who is not an admin cannot confirm');
reset role;
select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1', 'aal2');
set local role authenticated;
select pg_temp.check(public.admin_confirm_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0020'), 795000, 'key-test-0007') = 'confirmed',
  'E: deposit confirmed');
select pg_temp.check(public.admin_confirm_payment((select claim_id from public.admin_payment_queue('waiting') where transaction_id = 'TESTTX0021'), 795000, 'key-test-0008') = 'received_not_applied',
  'E/L8: a deposit inside the cut-off is received but not applied');
reset role;
select pg_temp.check((select p.status = 'paid' and p.provider_transaction_id = (select reference from d1) and p.provider_reference is null
                      from public.payments p join public.payment_orders o on o.payment_id = p.id where o.reference = (select reference from d1)),
  'E/L9: the payments row carries the order reference, not the payer''s transaction ID');
select pg_temp.check((select o.status = 'received_not_applied' and o.refund_due and o.received_tzs = 795000 and p.status = 'failed'
                      from public.payment_orders o join public.payments p on p.id = o.payment_id where o.reference = (select reference from d2)),
  'E/M2: received_not_applied keeps the money received and flags a refund');
-- H2: switching deposits off and closing the waiting deposit orders.
update public.site_settings set value = '{"on": false}' where key = 'feature.deposits_via_kwetuly_lipa';
select pg_temp.as_user('33333333-0000-4000-8000-0000000000c1', 'aal2');
set local role authenticated;
select pg_temp.check(public.admin_close_open_deposit_orders() >= 1, 'E/H2: waiting deposit orders closed');
reset role;
select pg_temp.check((select status = 'cancelled' from public.payment_orders where reference = (select reference from d3)), 'E/H2: the unpaid deposit order is closed');

-- M4: phones of claims decided more than 12 months ago are removed; audit rows stay.
update public.payment_claims set decided_at = now() - interval '13 months' where transaction_key = 'TESTTX0001';
select pg_temp.check(private.purge_claim_phones() >= 1, 'E/M4: the purge removed a phone');
select pg_temp.check((select payer_phone is null and phone_purged_at is not null from public.payment_claims where transaction_key = 'TESTTX0001'),
  'E/M4: phone removed, claim kept');
select pg_temp.check((select count(*) >= 1 from public.payment_audit_log where details ->> 'transaction_key' = 'TESTTX0001' or details ->> 'transaction_id' = 'TESTTX0001'),
  'E/M4: audit rows stay');

select 'all passed';
rollback;
