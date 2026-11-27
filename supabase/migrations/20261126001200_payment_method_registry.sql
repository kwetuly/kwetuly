-- NOT APPLIED. Manual Lipa payments, part 3 of 3 (payments-engineer, 2026-11-26): the payment-method
-- chooser and the app-store routing. Needs 20261126001000 and 20261126001100 first. Apply only with
-- Walter's yes, after security-reviewer and qa-tester, on a test project first
-- (supabase/checks/manual_lipa_payments_tests.sql).
--
-- What it does:
--   1. public.payment_method_registry: one row per provider the chooser shows (manual_lipa, flutterwave,
--      azampay, selcom, pesapal): display name, method types, badges, admin status (live, coming_soon,
--      hidden) and sort order. Admins edit it on /admin/payments/methods. Adding a provider later is a
--      row here plus its adapter; no screen code.
--   2. private.payment_method_state(provider, purpose): what the server allows NOW. An admin status of
--      'live' is not enough: manual_lipa also needs feature.payments_manual, a method in
--      'payments.providers', at least one switched-on Lipa number and, for deposits,
--      feature.deposits_via_kwetuly_lipa; a hosted provider also needs private.money_feature_on(id)
--      (so feature.payments_live, locked off) and a built adapter (only Flutterwave, deposits only).
--      Anything else shows as coming_soon. The chooser (website and app) reads
--      public.payment_methods_for(purpose, platform) and never decides by itself.
--   3. App-store routing, from docs/legal/app-store-payment-rules-2026-11.md ("per-platform policy
--      values"), admin-editable, until Walter and the advocate decide:
--        'payments.purchase_kinds'  what each order type is (real_world_service, physical_goods,
--                                   digital_feature); saved on every order with its platform.
--        'payments.store_policy'    per platform and item type: third_party_in_app, store_billing (not
--                                   built), web_only, not_offered. Deposits, reservations, marketplace
--                                   items and 100% tips: third_party_in_app (Apple 3.1.3(e), Google
--                                   Payments s.3). Guide and porter verification, the badge and the
--                                   reservation commission: web_only (grey; commission is not in the
--                                   research table, so the safest grey value). Boosts, subscriptions,
--                                   donations: web_only. Web: everything third_party_in_app. A missing
--                                   app value counts as not_offered (fail closed).
--        'payments.store_flags'     show_coming_soon per platform (all true, Walter 2026-11-27, against the research advice for apps:
--                                   Apple 2.1(a) and 2.5.19), show_prices_for_web_only_items_in_app
--                                   (false), link-out lists (empty: Tanzania is in no program).
--      In the apps a web_only item gets NO rows from payment_methods_for: no price, button, link,
--      webview or "go to the website" text.
--   4. public.start_payment_order(..., p_provider, p_platform) (replaces the part 2 draft): refuses a
--      provider that is not live, any route other than third_party_in_app, a switched-off charge path
--      (private.manual_payments_on(private.payment_feature_id(purpose))) and hosted providers (their
--      orders are made by the payments Edge Function).
--
-- Undo: drop function public.start_payment_order(text, uuid, text, text, date, text, text),
--   public.payment_methods_for(text, text), public.admin_payment_methods(), public.admin_save_payment_method(text, text, text, integer, text[]),
--   public.admin_set_store_policy(jsonb, jsonb, jsonb), private.payment_method_state(text, text), private.purchase_kind(text),
--   private.store_route(text, text), private.show_coming_soon(text), private.log_payment_methods(),
--   public.deposit_commission_preview(text, uuid), private.deposit_commission_pct(text, uuid);
--   drop table public.payment_method_registry;
--   delete from public.site_settings where key in ('payments.purchase_kinds', 'payments.store_policy', 'payments.store_flags');

-- ---------------------------------------------------------------------------
-- 1. Registry
-- ---------------------------------------------------------------------------
create table if not exists public.payment_method_registry (
  id text primary key check (id in ('manual_lipa', 'flutterwave', 'azampay', 'selcom', 'pesapal')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  methods text[] not null check (methods <@ array['mobile_money', 'bank', 'card'] and cardinality(methods) between 1 and 3),
  -- Text badges the chooser shows (networks and card schemes). manual_lipa shows the networks of its
  -- switched-on numbers instead, so a badge never promises a number that is not there.
  badges text[] not null default '{}'
    check (badges <@ array['mpesa', 'mixx', 'airtel', 'halopesa', 'bank', 'visa', 'mastercard'] and cardinality(badges) <= 7),
  status text not null default 'coming_soon' check (status in ('live', 'coming_soon', 'hidden')),
  sort integer not null default 50 check (sort between 0 and 99),
  -- Whether this code base has an adapter for it (set by migrations only, never by admins).
  adapter_built boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.payment_method_registry enable row level security;
revoke all on public.payment_method_registry from public, anon, authenticated;
comment on table public.payment_method_registry is
  'Payment methods the chooser shows. status is the admin''s wish; private.payment_method_state() decides what is live.';

insert into public.payment_method_registry (id, display_name, methods, badges, status, sort, adapter_built) values
  ('manual_lipa', 'Lipa number', array['mobile_money', 'bank'], array['mixx', 'mpesa', 'airtel', 'halopesa', 'bank'], 'live', 0, true),
  ('flutterwave', 'Flutterwave', array['card', 'mobile_money'], array['visa', 'mastercard', 'mpesa', 'airtel'], 'coming_soon', 10, true),
  ('azampay', 'AzamPay', array['mobile_money', 'bank'], array['mixx', 'mpesa', 'airtel', 'halopesa'], 'coming_soon', 20, false),
  ('selcom', 'Selcom', array['card', 'mobile_money'], array['visa', 'mastercard', 'mpesa', 'mixx'], 'coming_soon', 30, false),
  ('pesapal', 'Pesapal', array['card', 'mobile_money'], array['visa', 'mastercard', 'mpesa', 'airtel'], 'coming_soon', 40, false)
on conflict (id) do nothing;

create or replace function private.log_payment_methods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- adapter_built is set by migrations only; admin calls cannot change it.
    if private.is_admin() or current_user in ('anon', 'authenticated') then
      new.adapter_built := old.adapter_built;
    end if;
    new.updated_at := now();
    perform private.payment_audit('settings', null, 'method_changed',
      case when private.is_admin() then 'admin' else 'system' end, null,
      jsonb_build_object('id', new.id, 'before', jsonb_build_object('status', old.status, 'sort', old.sort, 'display_name', old.display_name, 'badges', old.badges),
                         'after', jsonb_build_object('status', new.status, 'sort', new.sort, 'display_name', new.display_name, 'badges', new.badges)));
  end if;
  return new;
end;
$$;
revoke execute on function private.log_payment_methods() from public, anon, authenticated;
drop trigger if exists payment_method_registry_log on public.payment_method_registry;
create trigger payment_method_registry_log before update on public.payment_method_registry
  for each row execute function private.log_payment_methods();

-- ---------------------------------------------------------------------------
-- 2. Purchase kinds and store policy (defaults from the research; Walter decides, see the header)
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value) values
  -- Verification and badge: a person checks documents or a business (grey between digital and service).
  ('payments.purchase_kinds', '{"verification": "real_world_service", "business_badge": "real_world_service",
     "reservation_commission": "real_world_service", "offer_deposit": "real_world_service", "group_deposit": "real_world_service"}'),
  ('payments.store_policy', '{
     "web": {"offer_deposit": "third_party_in_app", "group_deposit": "third_party_in_app", "accommodation_reservation": "third_party_in_app",
             "marketplace_item": "third_party_in_app", "tip_person": "third_party_in_app", "verification": "third_party_in_app",
             "crew_verification": "third_party_in_app", "business_badge": "third_party_in_app", "reservation_commission": "third_party_in_app",
             "profile_boost": "third_party_in_app", "subscription_premium": "third_party_in_app", "donation_cause": "third_party_in_app",
             "jobs_contact_fee": "third_party_in_app"},
     "ios": {"offer_deposit": "third_party_in_app", "group_deposit": "third_party_in_app", "accommodation_reservation": "third_party_in_app",
             "marketplace_item": "third_party_in_app", "tip_person": "third_party_in_app", "verification": "web_only",
             "crew_verification": "web_only", "business_badge": "web_only", "reservation_commission": "web_only",
             "profile_boost": "web_only", "subscription_premium": "web_only", "donation_cause": "web_only", "jobs_contact_fee": "web_only"},
     "android": {"offer_deposit": "third_party_in_app", "group_deposit": "third_party_in_app", "accommodation_reservation": "third_party_in_app",
             "marketplace_item": "third_party_in_app", "tip_person": "third_party_in_app", "verification": "web_only",
             "crew_verification": "web_only", "business_badge": "web_only", "reservation_commission": "web_only",
             "profile_boost": "web_only", "subscription_premium": "web_only", "donation_cause": "web_only", "jobs_contact_fee": "web_only"}}'),
  ('payments.store_flags', '{"show_coming_soon": {"web": true, "ios": true, "android": true},
     "show_prices_for_web_only_items_in_app": false, "ios_link_out_storefronts": [], "android_link_out_countries": []}')
on conflict (key) do nothing;

-- Whether coming-soon methods are listed on this platform (missing = no).
create or replace function private.show_coming_soon(p_platform text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value -> 'show_coming_soon' -> p_platform) = 'true'::jsonb
                   from public.site_settings s where s.key = 'payments.store_flags'), false);
$$;
revoke execute on function private.show_coming_soon(text) from public;
grant execute on function private.show_coming_soon(text) to authenticated;

-- Unknown purpose kinds count as digital_feature (the strictest).
create or replace function private.purchase_kind(p_purpose text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.value ->> p_purpose from public.site_settings s where s.key = 'payments.purchase_kinds'), 'digital_feature');
$$;
revoke execute on function private.purchase_kind(text) from public;
grant execute on function private.purchase_kind(text) to authenticated;

-- The route for an item type on a platform. Store rules do not apply to the website, so web defaults to
-- third_party_in_app; a missing app value is not_offered (fail closed).
create or replace function private.store_route(p_platform text, p_item text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.value -> p_platform ->> p_item from public.site_settings s where s.key = 'payments.store_policy'),
    case when p_platform = 'web' then 'third_party_in_app' else 'not_offered' end);
$$;
revoke execute on function private.store_route(text, text) from public;
grant execute on function private.store_route(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. What is live now (the server's answer; screens only show it)
-- ---------------------------------------------------------------------------
create or replace function private.payment_method_state(p_id text, p_purpose text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.payment_method_registry;
begin
  select * into r from public.payment_method_registry where id = p_id;
  if r.id is null or r.status = 'hidden' then
    return 'hidden';
  end if;
  if r.status <> 'live' then
    return 'coming_soon';
  end if;
  if r.id = 'manual_lipa' then
    if (case when p_purpose is null then private.feature_on('payments_manual')
             else private.manual_payments_on(private.payment_feature_id(p_purpose)) end)
       and ((private.provider_for('mobile_money', p_purpose) = 'manual_lipa'
             and exists (select 1 from public.payment_numbers n where n.is_on and n.network <> 'bank'))
         or (private.provider_for('bank', p_purpose) = 'manual_lipa'
             and exists (select 1 from public.payment_numbers n where n.is_on and n.network = 'bank'))) then
      return 'live';
    end if;
    return 'coming_soon';
  end if;
  -- Hosted: switch with payments_live, an adapter in this code, listed for a method, deposits only today.
  if r.adapter_built and private.money_feature_on(r.id)
     and (p_purpose is null or p_purpose in ('offer_deposit', 'group_deposit'))
     and (private.provider_for('card', p_purpose) = r.id or private.provider_for('mobile_money', p_purpose) = r.id
          or private.provider_for('bank', p_purpose) = r.id) then
    return 'live';
  end if;
  return 'coming_soon';
end;
$$;
revoke execute on function private.payment_method_state(text, text) from public;
grant execute on function private.payment_method_state(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. Kwetuly's commission on a deposit (Walter 2026-11-27): the business's agreement
--     (business_agreements.kwetuly_pct, active) when the payee is a business. Shown exactly as
--     computed on this deposit (payouts record no deduction yet, so no other figure is claimed). Guides have no agreement
--     table: null, and the texts say "as agreed". Never invented.
-- ---------------------------------------------------------------------------
create or replace function private.deposit_commission_pct(p_purpose text, p_subject uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  -- kwetuly_pct (20261025000000_brand_rename_kwetuly.sql, kept equal to rafrika_pct by a trigger).
  -- Offers and group trips record only the business's name (company_name), not its id: the business
  -- of the payee with that name is preferred, then the payee's oldest approved business (review LC).
  with payee as (
    select f.offered_by as owner_id, f.company_name from public.trip_offers f
    where p_purpose = 'offer_deposit' and f.id = p_subject and f.guide_id is null
    union all
    select t.organizer_id, t.company_name from public.group_trip_members m join public.group_trips t on t.id = m.group_trip_id
    where p_purpose = 'group_deposit' and m.id = p_subject and t.guide_id is null
  )
  select a.kwetuly_pct
  from payee y
  join public.providers p on p.owner_id = y.owner_id
  join public.business_agreements a on a.provider_id = p.id
  where a.active and a.kwetuly_pct > 0 and p.verification_status = 'approved' and not p.is_sample
  order by (y.company_name is not null and lower(btrim(p.business_name)) = lower(btrim(y.company_name))) desc, p.created_at
  limit 1;
$$;
revoke execute on function private.deposit_commission_pct(text, uuid) from public, anon, authenticated;

-- For the deposit box and the chooser before an order exists: only the traveller of that offer or spot.
create or replace function public.deposit_commission_preview(p_purpose text, p_subject uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_purpose = 'offer_deposit' and exists (
      select 1 from public.trip_offers f join public.trip_requests r on r.id = f.request_id
      where f.id = p_subject and r.traveler_id = (select auth.uid()))
      then private.deposit_commission_pct(p_purpose, p_subject)
    when p_purpose = 'group_deposit' and exists (
      select 1 from public.group_trip_members m where m.id = p_subject and m.traveler_id = (select auth.uid()))
      then private.deposit_commission_pct(p_purpose, p_subject)
  end;
$$;
revoke execute on function public.deposit_commission_preview(text, uuid) from public, anon;
grant execute on function public.deposit_commission_preview(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Payer: start an order (amounts from the server only). p_provider is the method the payer chose
--    in the chooser; the server refuses it unless it is live now. p_platform is what the client says
--    it runs on; it only picks the store route (never a security decision).
-- ---------------------------------------------------------------------------
create or replace function public.start_payment_order(
  p_purpose text, p_subject uuid default null, p_period text default null, p_account_type text default null,
  p_month date default null, p_provider text default 'manual_lipa', p_platform text default 'web')
returns table (reference text, status text, amount_tzs bigint, amount_usd numeric)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_today date := private.tz_today();
  v_price public.price_list;
  v_key text;
  v_amount bigint;
  v_usd numeric(12, 2);
  v_rate numeric(12, 4);
  v_rate_source text;
  v_rate_date date;
  v_cents bigint;
  v_payee uuid;
  v_guide uuid;
  v_provider uuid;
  v_month date;
  v_payment uuid;
  v_open public.payment_orders;
  v_order public.payment_orders;
  v_ref text;
  v_try integer := 0;
  v_kind text;
  v_commission_pct numeric(5, 2);
begin
  if v_user is null then
    raise exception 'sign in first' using errcode = 'P0001';
  end if;
  if p_purpose is null or p_purpose not in ('verification', 'business_badge', 'reservation_commission', 'offer_deposit', 'group_deposit') then
    raise exception 'unknown purpose' using errcode = 'P0001';
  end if;
  if p_platform is null or p_platform not in ('web', 'ios', 'android') then
    raise exception 'unknown platform' using errcode = 'P0001';
  end if;
  v_kind := private.purchase_kind(p_purpose);
  -- Store rules: in the apps only third_party_in_app items can be paid (web_only, store_billing and
  -- not_offered are refused; the app shows no price, button, link or wording for them).
  if private.store_route(p_platform, p_purpose) <> 'third_party_in_app' then
    raise exception 'not_in_app' using errcode = 'P0001', hint = 'The store policy does not allow paying this here';
  end if;
  if p_provider = 'manual_lipa' and not private.manual_payments_on(private.payment_feature_id(p_purpose)) then
    raise exception 'payments_off' using errcode = 'P0001', hint = 'Lipa payments or this fee are switched off';
  end if;
  if private.payment_method_state(p_provider, p_purpose) <> 'live' then
    raise exception 'provider_not_live' using errcode = 'P0001';
  end if;
  if p_provider <> 'manual_lipa' then
    -- Hosted providers make their orders in the payments Edge Function (their own checkout page).
    raise exception 'use_hosted_checkout' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('payment_orders:' || v_user::text, 0));
  if (select count(*) from public.payment_orders o where o.user_id = v_user and o.created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_purpose = 'verification' then
    if p_period not in ('month', 'year') then
      raise exception 'unknown period' using errcode = 'P0001';
    end if;
    if p_account_type is distinct from 'guide' then
      -- Crew and job fees: the payer must be the vouching guide or the operator, never the porter or the
      -- job seeker. Crew accounts and vouches do not exist on this database yet, so nothing can be
      -- checked: refused until they do (and feature.crew_verification_fees is on).
      raise exception 'crew_fees_not_open' using errcode = 'P0001';
    end if;
    select g.id into v_guide from public.guides g where g.owner_id = v_user and not g.is_sample limit 1;
    if v_guide is null then
      raise exception 'not a guide' using errcode = 'P0001';
    end if;
    -- Documents are checked first, then paid (Walter, 2026-11-21 decision 3).
    if not exists (select 1 from public.person_document_checks c
                   where c.user_id = v_user and c.ended_at is null and (c.valid_until is null or c.valid_until >= v_today)) then
      raise exception 'checks_first' using errcode = 'P0001';
    end if;
    select * into v_price from public.price_list pl
    where pl.account_type = 'guide' and pl.business_type is null and pl.service_code = 'verification'
      and pl.period = p_period and pl.status = 'active' and pl.amount_tzs is not null
      and pl.active_from <= v_today and (pl.active_to is null or pl.active_to > v_today)
    order by pl.active_from desc limit 1;
    if v_price.id is null then
      raise exception 'price_not_set' using errcode = 'P0001';
    end if;
    v_amount := v_price.amount_tzs;
    v_key := 'verification:' || v_user::text;

  elsif p_purpose = 'business_badge' then
    select p.id into v_provider from public.providers p
    where p.id = p_subject and p.owner_id = v_user and not p.is_sample and p.verification_status = 'approved';
    if v_provider is null then
      raise exception 'not your approved business' using errcode = 'P0001';
    end if;
    select pl.* into v_price from public.price_list pl, public.providers p
    where p.id = v_provider and pl.account_type = 'business' and pl.service_code = 'business_badge'
      and (pl.business_type is null or pl.business_type = p.business_type)
      and pl.period = 'year' and pl.status = 'active' and pl.amount_tzs is not null
      and pl.active_from <= v_today and (pl.active_to is null or pl.active_to > v_today)
    order by pl.business_type nulls last, pl.active_from desc limit 1;
    if v_price.id is null then
      raise exception 'price_not_set' using errcode = 'P0001';
    end if;
    v_amount := v_price.amount_tzs;
    v_key := 'badge:' || v_provider::text;

  elsif p_purpose = 'reservation_commission' then
    if not private.feature_on('reservation_commission_billing') then
      raise exception 'billing_off' using errcode = 'P0001';
    end if;
    select p.id into v_provider from public.providers p
    where p.id = p_subject and p.owner_id = v_user and not p.is_sample;
    v_month := date_trunc('month', p_month)::date;
    if v_provider is null or v_month is null then
      raise exception 'not your business' using errcode = 'P0001';
    end if;
    select sum(r.commission_tzs) into v_amount from public.reservations r
    where r.provider_ref = v_provider and not r.is_sample and r.commission_status = 'invoiced'
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date >= v_month
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date < (v_month + interval '1 month')::date;
    if coalesce(v_amount, 0) <= 0 then
      raise exception 'nothing_to_pay' using errcode = 'P0001';
    end if;
    v_key := 'commission:' || v_provider::text || ':' || v_month::text;

  else
    -- Deposits that belong to a guide or business, paid to Kwetuly's own Lipa number.
    if not private.feature_on('deposits_via_kwetuly_lipa') then
      raise exception 'deposits_off' using errcode = 'P0001';
    end if;
    select r.rate, r.source, r.as_of into v_rate, v_rate_source, v_rate_date from private.manual_rate() r;
    if v_rate is null then
      raise exception 'rate_not_set' using errcode = 'P0001';
    end if;
    if v_rate_date < v_today - 7 then
      raise exception 'rate_too_old' using errcode = 'P0001';
    end if;
    if p_purpose = 'offer_deposit' then
      select o.price_total_usd::bigint * o.deposit_percent, o.offered_by into v_cents, v_payee
      from public.trip_offers o join public.trip_requests r on r.id = o.request_id
      where o.id = p_subject and r.traveler_id = v_user and o.status = 'accepted' and o.deposit_percent > 0;
      v_key := 'offer:' || coalesce(p_subject::text, '');
    else
      select m.price_per_person_usd::bigint * m.seats * t.deposit_percent, t.organizer_id into v_cents, v_payee
      from public.group_trip_members m join public.group_trips t on t.id = m.group_trip_id
      where m.id = p_subject and m.traveler_id = v_user and m.status = 'accepted' and t.deposit_percent > 0
        and m.price_per_person_usd is not null and m.price_per_person_usd > 0;
      v_key := 'member:' || coalesce(p_subject::text, '');
    end if;
    if v_cents is null or v_cents <= 0 then
      raise exception 'deposit_not_allowed' using errcode = 'P0001';
    end if;
    -- Same integer rule as private.guard_new_payment and depositTzs (packages/shared): no floating point.
    v_usd := v_cents::numeric / 100;
    v_amount := (ceil(v_cents * v_rate * 100 / 1000000) * 100)::bigint;
    v_commission_pct := private.deposit_commission_pct(p_purpose, p_subject);
  end if;

  -- An open order for the same thing is reused; a stale one with no claim is replaced.
  select * into v_open from public.payment_orders o
  where o.subject_key = v_key and o.status in ('awaiting_payment', 'submitted', 'wrong_amount') for update;
  if v_open.id is not null then
    if v_open.user_id <> v_user then
      raise exception 'someone else is paying this' using errcode = 'P0001';
    end if;
    if v_open.status <> 'awaiting_payment'
       or (v_open.amount_tzs = v_amount and v_open.period is not distinct from (case when p_purpose = 'verification' then p_period when p_purpose = 'business_badge' then 'year' end)
           and v_open.price_id is not distinct from v_price.id and v_open.created_at > now() - interval '7 days') then
      return query select v_open.reference, v_open.status, v_open.amount_tzs, v_open.amount_usd;
      return;
    end if;
    update public.payment_orders set status = 'cancelled', status_reason = 'replaced' where id = v_open.id;
    if v_open.payment_id is not null then
      update public.payments set status = 'failed', status_reason = 'manual_replaced', status_source = 'payer_cancel'
      where id = v_open.payment_id and status = 'pending';
    end if;
    perform private.payment_audit('order', v_open.id, 'order_replaced', 'payer', v_open.reference, '{}'::jsonb);
  end if;

  if p_purpose in ('offer_deposit', 'group_deposit') then
    -- private.guard_new_payment checks the offer or spot, the 8-day cut-off, the approved payee and the
    -- exact amount again, and refuses with hint 'kwetuly_deposit_guard'.
    insert into public.payments (user_id, payee_user_id, kind, trip_offer_id, group_member_id, description,
                                 amount_usd, amount_tzs, status, order_id, provider, usd_tzs_rate, rate_source,
                                 status_source)
    values (v_user, v_payee, p_purpose,
            case when p_purpose = 'offer_deposit' then p_subject end,
            case when p_purpose = 'group_deposit' then p_subject end,
            case when p_purpose = 'offer_deposit' then 'Deposit for a trip offer (Lipa number)' else 'Deposit for a group trip spot (Lipa number)' end,
            v_usd, v_amount, 'pending', 'RAF' || replace(gen_random_uuid()::text, '-', ''), 'manual_lipa',
            v_rate, v_rate_source, 'checkout')
    returning id into v_payment;
  end if;

  loop
    v_try := v_try + 1;
    v_ref := private.new_payment_reference();
    begin
      insert into public.payment_orders (reference, user_id, purpose, provider, account_type, period, price_id, guide_id,
                                         provider_id, commission_month, trip_offer_id, group_member_id, payment_id,
                                         subject_key, amount_tzs, amount_usd, usd_tzs_rate, rate_source,
                                         purchase_kind, platform, commission_pct, commission_tzs)
      values (v_ref, v_user, p_purpose, 'manual_lipa',
              case when p_purpose = 'verification' then p_account_type when p_purpose = 'business_badge' then 'business' end,
              case when p_purpose = 'verification' then p_period when p_purpose = 'business_badge' then 'year' end,
              v_price.id, v_guide, v_provider, v_month,
              case when p_purpose = 'offer_deposit' then p_subject end,
              case when p_purpose = 'group_deposit' then p_subject end,
              v_payment, v_key, v_amount, v_usd, v_rate, v_rate_source, v_kind, p_platform,
              v_commission_pct, case when v_commission_pct is not null then round(v_amount * v_commission_pct / 100)::bigint end)
      returning * into v_order;
      exit;
    exception when unique_violation then
      if v_try >= 5 then
        raise;
      end if;
    end;
  end loop;

  perform private.payment_audit('order', v_order.id, 'order_created', 'payer', v_order.reference,
    jsonb_build_object('purpose', p_purpose, 'amount_tzs', v_amount, 'currency', 'TZS', 'amount_usd', v_usd,
                       'usd_tzs_rate', v_rate, 'rate_source', v_rate_source, 'price_id', v_price.id, 'period', v_order.period,
                       'purchase_kind', v_kind, 'platform', p_platform));
  return query select v_order.reference, v_order.status, v_order.amount_tzs, v_order.amount_usd;
end;
$$;
revoke execute on function public.start_payment_order(text, uuid, text, text, date, text, text) from public, anon;
grant execute on function public.start_payment_order(text, uuid, text, text, date, text, text) to authenticated;


-- The chooser's list for a purpose on a platform: every non-hidden method with the server's state
-- ('live' or 'coming_soon'; coming soon only where payments.store_flags shows it) and the store route.
-- Badges of manual_lipa are the networks of its switched-on numbers.
create or replace function public.payment_methods_for(p_purpose text, p_platform text default 'web')
returns table (id text, display_name text, methods text[], badges text[], sort integer, state text,
               route text, purchase_kind text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_platform text := case when p_platform in ('web', 'ios', 'android') then p_platform else 'web' end;
  v_kind text := private.purchase_kind(p_purpose);
  v_route text;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = 'P0001';
  end if;
  if p_purpose is null or p_purpose not in ('verification', 'business_badge', 'reservation_commission', 'offer_deposit', 'group_deposit') then
    raise exception 'unknown purpose' using errcode = 'P0001';
  end if;
  v_route := private.store_route(v_platform, p_purpose);
  -- In the apps anything but third_party_in_app gets no rows at all: the screen then shows no price,
  -- button, link or wording (store rules; the website is not limited).
  if v_platform <> 'web' and v_route <> 'third_party_in_app' then
    return;
  end if;
  return query
    select x.id, x.display_name, x.methods, x.badges, x.sort, x.state, v_route, v_kind
    from (
      select r.id, r.display_name, r.methods,
             case when r.id = 'manual_lipa'
                  then coalesce((select array_agg(distinct n.network order by n.network) from public.payment_numbers n where n.is_on), '{}')
                  else r.badges end as badges,
             r.sort, private.payment_method_state(r.id, p_purpose) as state
      from public.payment_method_registry r
      where r.status <> 'hidden') x
    where x.state = 'live' or (x.state = 'coming_soon' and private.show_coming_soon(v_platform))
    order by x.sort, x.id;
end;
$$;
revoke execute on function public.payment_methods_for(text, text) from public, anon;
grant execute on function public.payment_methods_for(text, text) to authenticated;

create or replace function public.admin_payment_methods()
returns table (id text, display_name text, methods text[], badges text[], status text, sort integer,
               adapter_built boolean, state_now text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.display_name, r.methods, r.badges, r.status, r.sort, r.adapter_built,
           private.payment_method_state(r.id, null), r.updated_at
    from public.payment_method_registry r
    order by r.sort, r.id;
end;
$$;
revoke execute on function public.admin_payment_methods() from public, anon;
grant execute on function public.admin_payment_methods() to authenticated;

-- Admins reorder, rename, hide or mark coming soon. Setting 'live' only allows it: the server state
-- still needs the switches above.
create or replace function public.admin_save_payment_method(p_id text, p_display_name text, p_status text, p_sort integer, p_badges text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  update public.payment_method_registry
  set display_name = btrim(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]]+', ' ', 'g')),
      status = p_status, sort = p_sort, badges = coalesce(p_badges, '{}'), updated_by = (select auth.uid())
  where id = p_id;
  if not found then
    raise exception 'method not found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_save_payment_method(text, text, text, integer, text[]) from public, anon;
grant execute on function public.admin_save_payment_method(text, text, text, integer, text[]) to authenticated;

-- All three are checked by site_settings_payments_shape; changes are logged by the settings trigger.
-- null = leave that setting as it is.
create or replace function public.admin_set_store_policy(p_kinds jsonb, p_policy jsonb, p_flags jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_kinds is not null then
    insert into public.site_settings (key, value) values ('payments.purchase_kinds', p_kinds)
    on conflict (key) do update set value = excluded.value;
  end if;
  if p_policy is not null then
    insert into public.site_settings (key, value) values ('payments.store_policy', p_policy)
    on conflict (key) do update set value = excluded.value;
  end if;
  if p_flags is not null then
    insert into public.site_settings (key, value) values ('payments.store_flags', p_flags)
    on conflict (key) do update set value = excluded.value;
  end if;
end;
$$;
revoke execute on function public.admin_set_store_policy(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.admin_set_store_policy(jsonb, jsonb, jsonb) to authenticated;
