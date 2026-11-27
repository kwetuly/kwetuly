-- NOT APPLIED. Manual Lipa payments, part 1 of 2 (payments-engineer, 2026-11-26). Walter decided on
-- 2026-11-26 to take payments by Lipa (merchant till) numbers while no card or API provider is live.
-- Apply only with Walter's yes, after security-reviewer and qa-tester, on a test project first
-- (supabase/checks/manual_lipa_payments_tests.sql). Part 2 is 20261126001100_manual_lipa_orders.sql.
-- Needs on the database first: 20261031214101 (feature switches), 20261122000000 (tz_today),
-- 20261122100000 (payments provider columns), 20261122200000 (price_list) and
-- 20261126000000_feature_switch_admin.sql (the payments_live lock, manual_payments_on(id),
-- money_feature_on(id)); step 0 stops if that slice is missing (security review M1).
--
-- What this file does:
--   1. Switches. feature.payments_manual, feature.guide_verification_fees and feature.business_badge_fees
--      (ON). feature.deposits_via_kwetuly_lipa on its own marked line for Walter (ON now; the security
--      review recommends OFF). feature.payments_live is not touched (stays locked OFF by the slice).
--      private.payment_feature_id(purpose) names each charge path's switch.
--   2. site_settings 'payments.providers': which provider takes each payment method, chosen by admins,
--      not in code. Default {"mobile_money": ["manual_lipa"], "bank": ["manual_lipa"], "card": []}.
--      Shape check: only known methods and provider ids. A hosted provider (flutterwave, azampay,
--      selcom) listed here is used only while feature.payments_live is on (private.money_feature_on).
--   3. site_settings 'payments.manual_usd_tzs_rate': shillings per US dollar for deposits paid by Lipa,
--      with its source and date, typed by an admin. NOT seeded: no rate = no Lipa deposits.
--   4. public.payment_numbers: Kwetuly's Lipa numbers (network, number, registered business name shown
--      to payers, optional bank name and menu hint, on/off). NOTHING SEEDED: Walter types every number.
--      No client grants; payers read the switched-on numbers through public.payment_numbers_for_payers().
--   5. public.payment_audit_log: append-only log of every money event (orders, claims, numbers,
--      provider settings, rate). Admins read through public.admin_payment_audit(). Phone numbers are
--      stored masked here.
--   6. price_list gains two service codes, 'verification' (month or year, per account type) and
--      'business_badge' (year, business), seeded as drafts with no amount. The /admin/prices functions
--      are re-created so these rows can be saved and activated like the reservation rates.
--   7. Admin functions: admin_payment_numbers, admin_save_payment_number, admin_set_payment_providers,
--      admin_set_manual_rate. All need private.is_admin() (admin role and two-step session).
--
-- WARNING for Walter (holding other people's money): a reservation or trip deposit paid to Kwetuly's
-- Lipa number is money that belongs to a guide or business, held by Kwetuly until paid out. That may
-- need Bank of Tanzania approval (legal to confirm). It is built, behind its own switch
-- feature.deposits_via_kwetuly_lipa, ON per Walter's "everything on". Kwetuly's own fees (verification,
-- badge, commission) do not have this problem.
--
-- Undo (in this order; part 2 first):
--   drop function public.admin_set_manual_rate(text, text, date, boolean), public.admin_set_payment_providers(jsonb),
--     public.admin_save_payment_number(uuid, text, text, text, text, text, boolean, integer),
--     public.admin_payment_numbers(), public.payment_numbers_for_payers(), public.admin_payment_audit(integer, text),
--     private.payment_audit(text, uuid, text, text, text, jsonb), private.mask_phone(text),
--     private.log_payment_settings(), private.log_payment_numbers(), private.guard_payment_numbers(),
--     private.payment_audit_append_only(), private.price_code_editable(text),
--     private.manual_rate(), private.provider_for(text, text), private.payment_feature_id(text);
--   drop table public.payment_audit_log, public.payment_numbers;
--   alter table public.site_settings drop constraint site_settings_payments_shape;
--   delete from public.site_settings where key in ('payments.providers', 'payments.manual_usd_tzs_rate',
--     'feature.payments_manual', 'feature.deposits_via_kwetuly_lipa', 'feature.guide_verification_fees',
--     'feature.business_badge_fees');
--   price_list: the verification and business_badge rows can stay (drafts, no amount); to remove the codes,
--     re-create the price functions and checks from 20261122200000 (only while no row uses the codes).
--   private.manual_payments_on and private.money_feature_on: keep if the switches slice is applied.

-- ---------------------------------------------------------------------------
-- 0. Stop before any change if a needed piece is missing.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private.feature_on(text)') is null
     or to_regprocedure('private.tz_today()') is null
     or to_regclass('public.price_list') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_transaction_id') then
    raise exception 'manual lipa: apply 20261031214101, 20261122000000, 20261122100000 and 20261122200000 first; nothing was changed.';
  end if;
  -- The payments_live lock lives in the switches slice (20261126000000_feature_switch_admin.sql, branch
  -- claude/wave1): its guard trigger keeps feature.payments_live off for every API caller. This file
  -- does not copy the lock; it refuses to run without it (security review M1).
  if to_regprocedure('private.site_settings_feature_guard()') is null
     or not exists (select 1 from pg_trigger
                    where tgname = 'site_settings_feature_guard' and tgrelid = 'public.site_settings'::regclass and not tgisinternal)
     or to_regprocedure('private.manual_payments_on(text)') is null
     or to_regprocedure('private.money_feature_on(text)') is null
     or to_regclass('private.feature_switch_meta') is null then
    raise exception 'manual lipa: apply 20261126000000_feature_switch_admin.sql (the payments_live lock, manual_payments_on and money_feature_on) first; nothing was changed.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Switches
-- ---------------------------------------------------------------------------
-- One switch per charge path, so switching one fee off stops only that fee (W1-1 switch review).
-- guide_verification_fees and business_badge_fees are new ids (ON); crew_verification_fees and
-- jobs_contact_fees belong to the switches slice and are not seeded here.
insert into public.site_settings (key, value) values
  ('feature.payments_manual', '{"on": true}'),
  ('feature.guide_verification_fees', '{"on": true}'),
  ('feature.business_badge_fees', '{"on": true}')
on conflict (key) do nothing;

-- WALTER DECIDES THIS ONE LINE (holding guides' and businesses' money; Bank of Tanzania question for legal).
-- Walter's "everything on" (2026-11-24) = true; the security review recommends false. Flip the word only.
insert into public.site_settings (key, value) values ('feature.deposits_via_kwetuly_lipa', '{"on": true}') on conflict (key) do nothing;

-- Admin data for the three new switches, so /admin/features lists them (switches slice table).
insert into private.feature_switch_meta (feature_id, legal)
select v.id, v.legal from (values
  ('deposits_via_kwetuly_lipa',         'pending'),
  ('guide_verification_fees',           'none'),
  ('business_badge_fees',               'none')
) as v(id, legal)
on conflict (feature_id) do nothing;

-- private.manual_payments_on(id) and private.money_feature_on(id) come from the switches slice
-- (checked in step 0); they are not redefined here.

-- The switch of each charge path (order purpose). Unknown purposes have none (always off).
create or replace function private.payment_feature_id(p_purpose text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_purpose
    when 'verification' then 'guide_verification_fees'
    when 'business_badge' then 'business_badge_fees'
    when 'reservation_commission' then 'reservation_commission_billing'
    when 'offer_deposit' then 'deposits_via_kwetuly_lipa'
    when 'group_deposit' then 'deposits_via_kwetuly_lipa'
    else 'none_' || coalesce(p_purpose, 'x') end;
$$;
revoke execute on function private.payment_feature_id(text) from public;
grant execute on function private.payment_feature_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2 and 3. Provider choice and the deposit rate in site_settings, with a shape check.
-- ---------------------------------------------------------------------------
alter table public.site_settings drop constraint if exists site_settings_payments_shape;
alter table public.site_settings add constraint site_settings_payments_shape check (
  key not like 'payments.%'
  or (key = 'payments.providers'
      and jsonb_typeof(value) = 'object'
      and value ?& array['mobile_money', 'bank', 'card']
      and (value - 'mobile_money' - 'bank' - 'card') = '{}'::jsonb
      and jsonb_typeof(value -> 'mobile_money') = 'array'
      and jsonb_typeof(value -> 'bank') = 'array'
      and jsonb_typeof(value -> 'card') = 'array'
      and jsonb_array_length(value -> 'mobile_money') <= 4
      and jsonb_array_length(value -> 'bank') <= 4
      and jsonb_array_length(value -> 'card') <= 4
      and not jsonb_path_exists(value, '$.*[*] ? (@.type() != "string" || !(@ == "manual_lipa" || @ == "flutterwave" || @ == "azampay" || @ == "selcom" || @ == "pesapal"))')
      -- Lipa numbers cannot take cards.
      and not (value -> 'card') ? 'manual_lipa')
  or (key = 'payments.manual_usd_tzs_rate'
      and jsonb_typeof(value) = 'object'
      and jsonb_typeof(value -> 'rate') = 'string'
      -- Plausible USD-TZS only (re-review L3); case keeps the cast safe.
      and case when (value ->> 'rate') ~ '^[1-9][0-9]{0,5}(\.[0-9]{1,4})?$'
               then (value ->> 'rate')::numeric between 1000 and 10000 else false end
      and jsonb_typeof(value -> 'source') = 'string'
      and char_length(value ->> 'source') between 3 and 120
      and jsonb_typeof(value -> 'as_of') = 'string'
      and (value ->> 'as_of') ~ '^\d{4}-\d{2}-\d{2}$')
  -- What each order type is, for the app-store rules (part 3, 20261126001200).
  or (key = 'payments.purchase_kinds'
      and jsonb_typeof(value) = 'object'
      and (value - array['verification', 'business_badge', 'reservation_commission', 'offer_deposit', 'group_deposit']) = '{}'::jsonb
      and not jsonb_path_exists(value, '$.* ? (@.type() != "string" || !(@ == "real_world_service" || @ == "physical_goods" || @ == "digital_feature"))'))
  -- Per platform and item type: the route (part 3, from docs/legal/app-store-payment-rules-2026-11.md).
  or (key = 'payments.store_policy'
      and jsonb_typeof(value) = 'object'
      and (value - array['web', 'ios', 'android']) = '{}'::jsonb
      and not jsonb_path_exists(value, '$.* ? (@.type() != "object")')
      and not jsonb_path_exists(value, '$.*.keyvalue() ? (!(@.key == "verification" || @.key == "crew_verification" || @.key == "business_badge"
            || @.key == "reservation_commission" || @.key == "offer_deposit" || @.key == "group_deposit" || @.key == "accommodation_reservation"
            || @.key == "marketplace_item" || @.key == "tip_person" || @.key == "donation_cause" || @.key == "profile_boost"
            || @.key == "subscription_premium" || @.key == "jobs_contact_fee"))')
      and not jsonb_path_exists(value, '$.*.* ? (@.type() != "string" || !(@ == "third_party_in_app" || @ == "store_billing" || @ == "web_only" || @ == "not_offered"))'))
  -- Display-only rates for the viewer's own currency, typed by an admin with a source (none seeded):
  -- {"EUR": {"per_usd": "0.92", "source": "...", "as_of": "YYYY-MM-DD"}}. Never used for any charge.
  or (key = 'payments.display_rates'
      and jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value, '$.keyvalue() ? (!(@.key like_regex "^[A-Z]{3}$"))')
      and not jsonb_path_exists(value, '$.* ? (@.type() != "object" || !exists(@.per_usd) || !exists(@.source) || @.per_usd.type() != "string" || @.source.type() != "string")')
      and not jsonb_path_exists(value, '$.*.per_usd ? (!(@ like_regex "^[0-9]{1,6}(\\.[0-9]{1,6})?$"))'))
  -- Store flags: coming-soon methods per platform, link-out lists (empty: Tanzania is in no program).
  or (key = 'payments.store_flags'
      and jsonb_typeof(value) = 'object'
      and (value - array['show_coming_soon', 'show_prices_for_web_only_items_in_app', 'ios_link_out_storefronts', 'android_link_out_countries']) = '{}'::jsonb
      and jsonb_typeof(value -> 'show_coming_soon') = 'object'
      and ((value -> 'show_coming_soon') - array['web', 'ios', 'android']) = '{}'::jsonb
      and not jsonb_path_exists(value, '$.show_coming_soon.* ? (@.type() != "boolean")')
      and coalesce(jsonb_typeof(value -> 'show_prices_for_web_only_items_in_app'), 'boolean') = 'boolean'
      and coalesce(jsonb_typeof(value -> 'ios_link_out_storefronts'), 'array') = 'array'
      and coalesce(jsonb_typeof(value -> 'android_link_out_countries'), 'array') = 'array'));

insert into public.site_settings (key, value) values
  ('payments.providers', '{"mobile_money": ["manual_lipa"], "bank": ["manual_lipa"], "card": []}')
on conflict (key) do nothing;

-- The provider that takes a payment method now: the first one listed that is usable. manual_lipa needs
-- feature.payments_manual; hosted providers need private.money_feature_on(id) (payments_live too).
-- null = nobody takes this method now.
create or replace function private.provider_for(p_method text, p_purpose text default null)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.site_settings s,
       jsonb_array_elements_text(s.value -> p_method) with ordinality as p(id, n)
  where s.key = 'payments.providers'
    and case p.id
          when 'manual_lipa' then case when p_purpose is null then private.feature_on('payments_manual')
                                       else private.manual_payments_on(private.payment_feature_id(p_purpose)) end
          else private.money_feature_on(p.id)
               -- Hosted adapters only take deposits today (supabase/functions/payments).
               and (p_purpose is null or p_purpose in ('offer_deposit', 'group_deposit'))
        end
  order by p.n
  limit 1;
$$;
revoke execute on function private.provider_for(text, text) from public;
grant execute on function private.provider_for(text, text) to authenticated;

-- The admin-typed rate as hundredths-exact numeric with its source, or nulls.
create or replace function private.manual_rate(out rate numeric, out source text, out as_of date)
language sql
stable
security definer
set search_path = ''
as $$
  select (s.value ->> 'rate')::numeric(12, 4),
         -- payments.rate_source holds at most 60 characters.
         left('admin ' || (s.value ->> 'as_of') || ': ' || (s.value ->> 'source'), 60),
         (s.value ->> 'as_of')::date
  from public.site_settings s
  where s.key = 'payments.manual_usd_tzs_rate';
$$;
revoke execute on function private.manual_rate() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lipa numbers
-- ---------------------------------------------------------------------------
create table if not exists public.payment_numbers (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('mpesa', 'mixx', 'airtel', 'halopesa', 'bank')),
  -- Lipa (merchant till) number or bank merchant number exactly as payers type it.
  lipa_number text not null check (lipa_number ~ '^[0-9]{4,15}$'),
  -- The registered name the payer's phone shows before they confirm.
  business_name text not null check (char_length(btrim(business_name)) between 2 and 80),
  bank_name text check (bank_name is null or char_length(btrim(bank_name)) between 2 and 60),
  -- Optional menu or USSD hint typed by Walter, e.g. the network's menu code. Shown as typed.
  menu_hint text check (menu_hint is null or (char_length(menu_hint) <= 40 and menu_hint ~ '^[0-9A-Za-z*# ]+$')),
  is_on boolean not null default false,
  sort integer not null default 0 check (sort between 0 and 99),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_numbers_bank_name check ((network = 'bank') = (bank_name is not null))
);
create unique index if not exists payment_numbers_unique on public.payment_numbers (network, lipa_number);
comment on table public.payment_numbers is
  'Kwetuly''s own Lipa numbers, typed by an admin. Never seeded. No client grants: payers read switched-on rows through payment_numbers_for_payers().';

alter table public.payment_numbers enable row level security;
revoke all on public.payment_numbers from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.payment_audit_log (
  id bigint generated always as identity primary key,
  entity text not null check (entity in ('order', 'claim', 'number', 'settings')),
  entity_id uuid,
  action text not null check (action ~ '^[a-z_]{3,40}$'),
  actor uuid,                -- no foreign key: the record outlives a deleted account
  actor_role text not null check (actor_role in ('payer', 'admin', 'system')),
  reference text,            -- the order's reference code, when there is one
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_audit_entity_idx on public.payment_audit_log (entity, entity_id, created_at desc);
create index if not exists payment_audit_reference_idx on public.payment_audit_log (reference) where reference is not null;
alter table public.payment_audit_log enable row level security;
revoke all on public.payment_audit_log from public, anon, authenticated;
comment on table public.payment_audit_log is
  'Every money event: who, when, what. Append-only for everyone. Phone numbers only masked. Admins read through admin_payment_audit().';

create or replace function private.payment_audit_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The payment audit log cannot be changed or removed' using errcode = 'P0001';
end;
$$;
revoke execute on function private.payment_audit_append_only() from public;
drop trigger if exists payment_audit_no_change on public.payment_audit_log;
create trigger payment_audit_no_change before update or delete on public.payment_audit_log
  for each row execute function private.payment_audit_append_only();
drop trigger if exists payment_audit_no_truncate on public.payment_audit_log;
create trigger payment_audit_no_truncate before truncate on public.payment_audit_log
  for each statement execute function private.payment_audit_append_only();

-- "+255 7** *** 678". Anything that is not a phone number is masked to its last 3 characters.
create or replace function private.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null then null
    when p_phone ~ '^255[0-9]{9}$' then '+255 ' || substr(p_phone, 4, 1) || '** *** ' || right(p_phone, 3)
    else '***' || right(p_phone, 3) end;
$$;
revoke execute on function private.mask_phone(text) from public;
grant execute on function private.mask_phone(text) to authenticated;

create or replace function private.payment_audit(
  p_entity text, p_entity_id uuid, p_action text, p_actor_role text, p_reference text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.payment_audit_log (entity, entity_id, action, actor, actor_role, reference, details)
  values (p_entity, p_entity_id, p_action, (select auth.uid()), p_actor_role, p_reference, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function private.payment_audit(text, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Number changes are logged whoever makes them (the admin functions are the only path for clients).
create or replace function private.log_payment_numbers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.payment_audit('number', new.id, case when tg_op = 'INSERT' then 'number_added' else 'number_changed' end,
    case when private.is_admin() then 'admin' else 'system' end, null,
    jsonb_build_object('network', new.network, 'lipa_number', new.lipa_number, 'business_name', new.business_name,
      'bank_name', new.bank_name, 'menu_hint', new.menu_hint, 'is_on', new.is_on,
      'before', case when tg_op = 'UPDATE' then jsonb_build_object('lipa_number', old.lipa_number,
        'business_name', old.business_name, 'is_on', old.is_on) end));
  return null;
end;
$$;
revoke execute on function private.log_payment_numbers() from public, anon, authenticated;
drop trigger if exists payment_numbers_log on public.payment_numbers;
create trigger payment_numbers_log after insert or update on public.payment_numbers
  for each row execute function private.log_payment_numbers();

create or replace function private.guard_payment_numbers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Lipa numbers are never deleted. Switch the number off instead.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.guard_payment_numbers() from public;
drop trigger if exists payment_numbers_guard on public.payment_numbers;
create trigger payment_numbers_guard before insert or update or delete on public.payment_numbers
  for each row execute function private.guard_payment_numbers();

-- Admins may also write site_settings directly (existing policy): payment keys are logged either way.
create or replace function private.log_payment_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.key like 'payments.%' or new.key in ('feature.payments_manual', 'feature.deposits_via_kwetuly_lipa', 'feature.payments_live') then
    if tg_op = 'UPDATE' and new.value is not distinct from old.value then
      return null;
    end if;
    perform private.payment_audit('settings', null, 'setting_changed',
      case when private.is_admin() then 'admin' else 'system' end, null,
      jsonb_build_object('key', new.key, 'after', new.value,
        'before', case when tg_op = 'UPDATE' then old.value end));
  end if;
  return null;
end;
$$;
revoke execute on function private.log_payment_settings() from public, anon, authenticated;
drop trigger if exists site_settings_payment_log on public.site_settings;
create trigger site_settings_payment_log after insert or update on public.site_settings
  for each row execute function private.log_payment_settings();

-- ---------------------------------------------------------------------------
-- 6. price_list: verification and badge fees, editable in /admin/prices.
-- ---------------------------------------------------------------------------
alter table public.price_list drop constraint if exists price_list_service_code_check;
alter table public.price_list add constraint price_list_service_code_check check (
  service_code in ('reservation_commission', 'reservation_unpriced_fee', 'verification', 'business_badge'));
alter table public.price_list drop constraint if exists price_list_fee_shape;
alter table public.price_list add constraint price_list_fee_shape check (
  (service_code <> 'verification' or (account_type <> 'business' and business_type is null and period in ('month', 'year')))
  and (service_code <> 'business_badge' or (account_type = 'business' and period = 'year')));

create or replace function private.price_code_editable(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_code in ('reservation_commission', 'reservation_unpriced_fee', 'verification', 'business_badge');
$$;
revoke execute on function private.price_code_editable(text) from public;
grant execute on function private.price_code_editable(text) to authenticated;

-- Drafts with no amount: Walter types every price. Crew rows exist so the grid is complete; crew fees
-- are refused by the order function until crew accounts and vouching guides exist (part 2).
insert into public.price_list (account_type, business_type, service_code, period, note)
select x.account_type::public.priced_account_type, x.business_type, x.service_code, x.period, null
from (values
  ('guide', null, 'verification', 'month'), ('guide', null, 'verification', 'year'),
  ('porter', null, 'verification', 'month'), ('porter', null, 'verification', 'year'),
  ('cook', null, 'verification', 'month'), ('cook', null, 'verification', 'year'),
  ('driver', null, 'verification', 'month'), ('driver', null, 'verification', 'year'),
  ('assistant_guide', null, 'verification', 'month'), ('assistant_guide', null, 'verification', 'year'),
  ('business', null, 'business_badge', 'year')
) as x(account_type, business_type, service_code, period)
where not exists (
  select 1 from public.price_list p
  where p.account_type::text = x.account_type and p.business_type is not distinct from x.business_type
    and p.service_code = x.service_code and p.period = x.period);

create or replace function public.admin_price_rows()
returns table (
  id uuid, account_type public.priced_account_type, business_type text, service_code text, period text,
  amount_tzs integer, percent numeric, max_guests_counted integer, active_from date, active_to date,
  status text, note text, updated_at timestamptz, editable boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select pl.id, pl.account_type, pl.business_type, pl.service_code, pl.period, pl.amount_tzs, pl.percent,
           pl.max_guests_counted, pl.active_from, pl.active_to, pl.status, pl.note, pl.updated_at,
           private.price_code_editable(pl.service_code)
    from public.price_list pl
    order by pl.service_code, pl.account_type, pl.business_type nulls last, pl.period, pl.active_from nulls last, pl.created_at;
end;
$$;
revoke execute on function public.admin_price_rows() from public, anon;
grant execute on function public.admin_price_rows() to authenticated;

create or replace function public.admin_save_price_draft(
  p_id uuid, p_amount_tzs integer, p_percent numeric, p_max_guests integer, p_active_from date, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_id for update;
  if not found then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if not private.price_code_editable(r.service_code) then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if r.status <> 'draft' then
    raise exception 'only drafts can be edited' using errcode = 'P0001';
  end if;
  if r.period = 'percent' and p_amount_tzs is not null or r.period <> 'percent' and p_percent is not null then
    raise exception 'wrong value kind' using errcode = 'P0001';
  end if;
  if p_max_guests is not null and not (r.service_code = 'reservation_commission' and r.period = 'once') then
    raise exception 'max guests only for per-guest rates' using errcode = 'P0001';
  end if;
  if p_active_from is not null and p_active_from < private.tz_today() then
    raise exception 'start date in the past' using errcode = 'P0001';
  end if;
  update public.price_list
  set amount_tzs = p_amount_tzs,
      percent = p_percent,
      max_guests_counted = p_max_guests,
      active_from = p_active_from,
      note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id;
end;
$$;
revoke execute on function public.admin_save_price_draft(uuid, integer, numeric, integer, date, text) from public, anon;
grant execute on function public.admin_save_price_draft(uuid, integer, numeric, integer, date, text) to authenticated;

create or replace function public.admin_activate_price(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
  o public.price_list;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_id for update;
  if not found then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if not private.price_code_editable(r.service_code) then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if r.status <> 'draft' then
    raise exception 'only drafts can be activated' using errcode = 'P0001';
  end if;
  if r.amount_tzs is null and r.percent is null then
    raise exception 'value not set' using errcode = 'P0001';
  end if;
  if r.active_from is null or r.active_from < private.tz_today() then
    raise exception 'start date in the past' using errcode = 'P0001';
  end if;
  if r.service_code = 'reservation_commission' and r.period = 'once' and r.max_guests_counted is null then
    raise exception 'max guests not set' using errcode = 'P0001';
  end if;

  -- Reservation rates replace each other across periods; fee prices only within the same period.
  for o in
    select * from public.price_list pl
    where pl.id <> r.id and pl.status = 'active' and pl.account_type = r.account_type
      and pl.business_type is not distinct from r.business_type and pl.service_code = r.service_code
      and (r.service_code in ('reservation_commission', 'reservation_unpriced_fee') or pl.period = r.period)
      and (pl.active_to is null or pl.active_to > r.active_from)
    for update
  loop
    if o.active_from >= r.active_from then
      raise exception 'another price starts on or after this date' using errcode = 'P0001';
    end if;
    update public.price_list set active_to = r.active_from where id = o.id;
  end loop;

  update public.price_list set status = 'active' where id = r.id;
end;
$$;
revoke execute on function public.admin_activate_price(uuid) from public, anon;
grant execute on function public.admin_activate_price(uuid) to authenticated;

create or replace function public.admin_new_price_version(p_from uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_from;
  if not found then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if not private.price_code_editable(r.service_code) then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.price_list pl
             where pl.status = 'draft' and pl.account_type = r.account_type
               and pl.business_type is not distinct from r.business_type and pl.service_code = r.service_code
               and (r.service_code in ('reservation_commission', 'reservation_unpriced_fee') or pl.period = r.period)) then
    raise exception 'a draft already exists' using errcode = 'P0001';
  end if;
  insert into public.price_list (account_type, business_type, service_code, period, amount_tzs, percent,
                                 max_guests_counted, status, created_by)
  values (r.account_type, r.business_type, r.service_code, r.period, r.amount_tzs, r.percent,
          r.max_guests_counted, 'draft', (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.admin_new_price_version(uuid) from public, anon;
grant execute on function public.admin_new_price_version(uuid) to authenticated;

create or replace function public.admin_end_price(p_id uuid, p_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_id for update;
  if not found or r.status <> 'active' then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if not private.price_code_editable(r.service_code) then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if p_on is null or p_on < private.tz_today() or p_on <= r.active_from then
    raise exception 'end date not allowed' using errcode = 'P0001';
  end if;
  if r.active_to is not null and r.active_to <= p_on then
    raise exception 'end date not allowed' using errcode = 'P0001';
  end if;
  update public.price_list set active_to = p_on where id = p_id;
end;
$$;
revoke execute on function public.admin_end_price(uuid, date) from public, anon;
grant execute on function public.admin_end_price(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Functions for payers and admins
-- ---------------------------------------------------------------------------
-- Switched-on numbers for signed-in payers, only while a method uses manual_lipa.
create or replace function public.payment_numbers_for_payers()
returns table (id uuid, network text, lipa_number text, business_name text, bank_name text, menu_hint text)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.network, n.lipa_number, n.business_name, n.bank_name, n.menu_hint
  from public.payment_numbers n
  where n.is_on
    and (select auth.uid()) is not null
    and private.feature_on('payments_manual')
    and ((n.network <> 'bank' and private.provider_for('mobile_money') = 'manual_lipa')
         or (n.network = 'bank' and private.provider_for('bank') = 'manual_lipa'))
  order by n.sort, n.network, n.created_at;
$$;
revoke execute on function public.payment_numbers_for_payers() from public, anon;
grant execute on function public.payment_numbers_for_payers() to authenticated;

create or replace function public.admin_payment_numbers()
returns setof public.payment_numbers
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query select * from public.payment_numbers order by sort, network, created_at;
end;
$$;
revoke execute on function public.admin_payment_numbers() from public, anon;
grant execute on function public.admin_payment_numbers() to authenticated;

-- p_id null = add a number. Returns the row id. Numbers are switched off, never deleted.
create or replace function public.admin_save_payment_number(
  p_id uuid, p_network text, p_lipa_number text, p_business_name text, p_bank_name text, p_menu_hint text,
  p_is_on boolean, p_sort integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_number text := regexp_replace(coalesce(p_lipa_number, ''), '[\s-]', '', 'g');
  v_name text := btrim(regexp_replace(coalesce(p_business_name, ''), '[[:cntrl:]]+', ' ', 'g'));
  v_bank text := nullif(btrim(regexp_replace(coalesce(p_bank_name, ''), '[[:cntrl:]]+', ' ', 'g')), '');
  v_hint text := nullif(btrim(coalesce(p_menu_hint, '')), '');
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_network is distinct from 'bank' then
    v_bank := null;
  end if;
  if p_id is null then
    insert into public.payment_numbers (network, lipa_number, business_name, bank_name, menu_hint, is_on, sort, created_by, updated_by)
    values (p_network, v_number, v_name, v_bank, v_hint, coalesce(p_is_on, false), coalesce(p_sort, 0),
            (select auth.uid()), (select auth.uid()))
    returning id into v_id;
  else
    update public.payment_numbers
    set network = p_network, lipa_number = v_number, business_name = v_name, bank_name = v_bank,
        menu_hint = v_hint, is_on = coalesce(p_is_on, false), sort = coalesce(p_sort, 0), updated_by = (select auth.uid())
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'number not found' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.admin_save_payment_number(uuid, text, text, text, text, text, boolean, integer) from public, anon;
grant execute on function public.admin_save_payment_number(uuid, text, text, text, text, text, boolean, integer) to authenticated;

create or replace function public.admin_set_payment_providers(p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  insert into public.site_settings (key, value) values ('payments.providers', p_value)
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke execute on function public.admin_set_payment_providers(jsonb) from public, anon;
grant execute on function public.admin_set_payment_providers(jsonb) to authenticated;

-- The rate is text so no floating point is involved ("2650" or "2650.75"). Source is required.
-- Plausible USD-TZS only (1000 to 10000, security review L7); a move of more than 10% from the
-- current rate needs p_confirm_jump.
drop function if exists public.admin_set_manual_rate(text, text, date);
create or replace function public.admin_set_manual_rate(p_rate text, p_source text, p_as_of date, p_confirm_jump boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new numeric;
  v_old numeric;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_as_of is null or p_as_of > private.tz_today() or p_as_of < private.tz_today() - 31 then
    raise exception 'rate date not allowed' using errcode = 'P0001';
  end if;
  if btrim(coalesce(p_rate, '')) !~ '^[1-9][0-9]{0,5}(\.[0-9]{1,4})?$' then
    raise exception 'rate out of range' using errcode = 'P0001';
  end if;
  v_new := btrim(p_rate)::numeric;
  if v_new < 1000 or v_new > 10000 then
    raise exception 'rate out of range' using errcode = 'P0001';
  end if;
  select (s.value ->> 'rate')::numeric into v_old from public.site_settings s where s.key = 'payments.manual_usd_tzs_rate';
  if v_old is not null and abs(v_new - v_old) * 10 > v_old and not coalesce(p_confirm_jump, false) then
    raise exception 'rate jump needs confirmation' using errcode = 'P0001';
  end if;
  insert into public.site_settings (key, value)
  values ('payments.manual_usd_tzs_rate',
          jsonb_build_object('rate', btrim(coalesce(p_rate, '')), 'source', btrim(regexp_replace(coalesce(p_source, ''), '[[:cntrl:]]+', ' ', 'g')),
                             'as_of', p_as_of::text))
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke execute on function public.admin_set_manual_rate(text, text, date, boolean) from public, anon;
grant execute on function public.admin_set_manual_rate(text, text, date, boolean) to authenticated;

create or replace function public.admin_payment_audit(p_limit integer default 50, p_reference text default null)
returns table (id bigint, entity text, entity_id uuid, action text, actor_name text, actor_role text,
               reference text, details jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select l.id, l.entity, l.entity_id, l.action, coalesce(pf.full_name, case when l.actor is null then 'Kwetuly' else 'Account' end),
           l.actor_role, l.reference, l.details, l.created_at
    from public.payment_audit_log l
    left join public.profiles pf on pf.id = l.actor
    where p_reference is null or l.reference = p_reference
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;
revoke execute on function public.admin_payment_audit(integer, text) from public, anon;
grant execute on function public.admin_payment_audit(integer, text) to authenticated;
