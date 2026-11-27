-- NOT APPLIED. Manual Lipa payments, part 2 of 2 (payments-engineer, 2026-11-26). Needs
-- 20261126001000_payment_methods_and_lipa_numbers.sql first, and 20261122300000 (reservations) for the
-- commission purpose. Apply only with Walter's yes, after security-reviewer and qa-tester, on a test
-- project first (supabase/checks/manual_lipa_payments_tests.sql).
--
-- The flow (manual_lipa provider):
--   1. The payer presses Pay. public.start_payment_order() works out the amount ON THE SERVER from
--      price_list (verification, badge), the invoiced commission lines, or the accepted offer or spot
--      and the admin-typed rate (deposits), and returns a short reference code (KW + 6 characters).
--      Pressing Pay again returns the same open order. Refused while feature.payments_manual is off.
--   2. The payer sends the money to a Lipa number and submits the network, the transaction ID and the
--      phone number used (public.submit_payment_claim). Status: waiting for confirmation. The payer
--      can never mark anything paid. Duplicate transaction IDs are refused (and logged), submissions
--      are rate-limited. Submitting still works for an open order while the switch is off (the money
--      may already have been sent).
--   3. An admin (two-step session) checks the Lipa statement and in the queue:
--        confirm (amount received typed from the statement; it must equal the order amount, with any
--        earlier wrong-amount part payments) -> the same paid effect a real provider would cause;
--        reject with a reason (the order reopens for another transaction ID, or is closed);
--        mark as wrong amount (amount received saved; Walter decides top-up or refund).
--      Confirming needs an idempotency key; confirming twice never applies the effect twice. An admin
--      cannot confirm an order he paid himself. Switches do not block admin actions on pending orders.
--   4. Every step is written to public.payment_audit_log. The payer is told by the existing notify
--      system (email, WhatsApp, push); admins get an email and push when a claim arrives.
--
-- Paid effects (private.apply_payment_effect):
--   verification     a public.member_subscriptions row from the end of the current paid period (or
--                    today) for one month or year. Guides only: crew fees are refused until crew
--                    accounts exist and the server can check that the payer is the vouching guide or
--                    the operator (never the porter or job seeker), and feature.crew_verification_fees.
--   business_badge   a member_subscriptions row for one year and ALWAYS a re-check in the badge queue
--                    (badge_requested_at). Paying never changes badge_valid_until (review M3).
--   reservation_commission  the invoiced lines of that business and month are marked paid (through
--                    admin_set_reservation_commission). Only while feature.reservation_commission_billing is on.
--   offer_deposit, group_deposit  the public.payments row made at step 1 (provider manual_lipa, passed
--                    private.guard_new_payment) becomes paid, after the 8-day cut-off (from the day the
--                    payer submitted) and the payee's approval are checked again (L8). Its
--                    provider_transaction_id is the order reference, not the payer's ID (L9).
--                    Behind feature.deposits_via_kwetuly_lipa. HOLDS OTHER PEOPLE'S MONEY (see part 1).
--   When an effect cannot run (refusals starting 'not_applicable'), confirming records the money as
--   received_not_applied with refund_due and a refund_needs_walter audit row (M2).
-- Duplicate transaction IDs are checked on transaction_key (A-Z0-9 only, H1); the queue warns about
-- O/0 and I,L/1 look-alikes and earlier blocked attempts. Admins cannot confirm their own payment or
-- a deposit paid to them (L3).
--
-- Access: payment_orders and payment_claims have RLS on and no client grants at all; everything goes
-- through the security definer functions below. member_subscriptions: the member reads his own rows,
-- admins all; no client writes.
--
-- Undo (in this order):
--   drop function public.admin_mark_wrong_amount(uuid, bigint, text), public.admin_reject_payment(uuid, text, text, boolean),
--     public.admin_confirm_payment(uuid, bigint, text, text, boolean), public.admin_payment_queue(text),
--     public.my_payment_orders(text), public.cancel_payment_order(text), public.submit_payment_claim(text, text, text, text),
--     public.my_subscriptions(),
--     private.apply_payment_effect(uuid, uuid), private.payment_notify(text, uuid, jsonb),
--     private.new_payment_reference(), private.normalize_tz_phone(text);
--   drop table public.member_subscriptions, public.payment_claims, public.payment_orders;
--   alter table public.payments drop constraint payments_status_source_check, add constraint payments_status_source_check
--     check (status_source in ('checkout', 'payer_check', 'webhook', 'sweeper'));   -- only if no row uses 'admin_manual'

-- ---------------------------------------------------------------------------
-- 0. payments: an admin confirmation is a status source.
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_status_source_check;
alter table public.payments add constraint payments_status_source_check
  check (status_source in ('checkout', 'payer_check', 'webhook', 'sweeper', 'admin_manual', 'payer_cancel'));

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  -- KW + 6 of 23456789ABCDEFGHJKMNPQRSTUVWXYZ (no 0, 1, I, L, O): easy to read out and to type.
  reference text not null unique check (reference ~ '^KW[2-9A-HJKMNP-Z]{6}$'),
  user_id uuid not null,   -- the payer; no foreign key: money records outlive a deleted account
  purpose text not null check (purpose in ('verification', 'business_badge', 'reservation_commission', 'offer_deposit', 'group_deposit')),
  provider text not null default 'manual_lipa' check (provider in ('manual_lipa', 'flutterwave', 'azampay', 'selcom', 'pesapal')),
  -- What is being paid for, for the app-store rules (site_settings 'payments.purchase_kinds' at creation).
  purchase_kind text not null default 'real_world_service'
    check (purchase_kind in ('real_world_service', 'physical_goods', 'digital_feature')),
  -- Where the payer started it: web, ios or android (as the client said; used for store routing only).
  platform text not null default 'web' check (platform in ('web', 'ios', 'android')),
  account_type text check (account_type in ('porter', 'cook', 'driver', 'assistant_guide', 'guide', 'business')),
  period text check (period in ('month', 'year')),
  price_id uuid references public.price_list (id),
  guide_id uuid,
  provider_id uuid,
  commission_month date,
  trip_offer_id uuid,
  group_member_id uuid,
  payment_id uuid references public.payments (id),
  subject_key text not null check (char_length(subject_key) <= 120),
  amount_tzs bigint not null check (amount_tzs between 1 and 100000000000),
  amount_usd numeric(12, 2) check (amount_usd > 0),
  usd_tzs_rate numeric(12, 4) check (usd_tzs_rate > 0),
  rate_source text check (char_length(rate_source) <= 60),
  -- Deposits only: Kwetuly's commission from the business's agreement (business_agreements.rafrika_pct)
  -- when the payee is a business with an active agreement, copied when the order is made and shown to
  -- the traveller (Walter 2026-11-27). null = no agreed figure: the texts say "as agreed".
  commission_pct numeric(5, 2) check (commission_pct > 0 and commission_pct <= 100),
  commission_tzs bigint check (commission_tzs >= 0),
  -- received_not_applied: the money arrived but the paid effect could not run (deposit no longer
  -- payable, commission lines changed, ...): Walter decides a refund (refund_due).
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'submitted', 'wrong_amount', 'confirmed', 'cancelled', 'received_not_applied')),
  status_reason text check (char_length(status_reason) <= 40),
  -- Money Kwetuly received on this order (whole TZS) when it was closed without the effect, and
  -- whether a refund is due. Refunds are recorded in payment_refund_records (20261126001300).
  received_tzs bigint check (received_tzs between 0 and 100000000000),
  refund_due boolean not null default false,
  refunded_tzs bigint not null default 0 check (refunded_tzs >= 0),
  effect_key text unique check (effect_key ~ '^[A-Za-z0-9-]{8,64}$'),
  effect jsonb,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_deposit_shape check (
    (purpose in ('offer_deposit', 'group_deposit')) = (payment_id is not null and amount_usd is not null
                                                       and usd_tzs_rate is not null and rate_source is not null)),
  constraint payment_orders_fee_shape check (
    purpose not in ('verification', 'business_badge') or (price_id is not null and period is not null and account_type is not null)),
  constraint payment_orders_confirmed_shape check (
    (status = 'confirmed') = (effect_key is not null and confirmed_at is not null and confirmed_by is not null))
);
create unique index if not exists payment_orders_one_open on public.payment_orders (subject_key)
  where status in ('awaiting_payment', 'submitted', 'wrong_amount');
create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders (status, updated_at);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from public, anon, authenticated;
comment on table public.payment_orders is
  'One payment to Kwetuly: amount fixed by the server at creation. Changed only by the functions in 20261126001100. No client grants.';

create table if not exists public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders (id) on delete restrict,
  user_id uuid not null,
  network text not null check (network in ('mpesa', 'mixx', 'airtel', 'halopesa', 'bank')),
  -- As typed (upper case, no spaces), for display only. No leading or trailing punctuation. Exact
  -- formats per network are not enforced: Walter checks them against real statements first.
  transaction_id text not null check (transaction_id ~ '^[A-Z0-9][A-Z0-9._-]{4,38}[A-Z0-9]$'),
  -- The key every duplicate check uses: only A-Z and 0-9 (security review H1: QK12-AB34CD = QK12AB34CD).
  -- Unique over ALL claims ever, rejected ones included.
  transaction_key text generated always as (upper(regexp_replace(transaction_id, '[^A-Za-z0-9]', '', 'g'))) stored,
  -- For the admin warning only: O read as 0 and I or L as 1.
  transaction_loose text generated always as (translate(upper(regexp_replace(transaction_id, '[^A-Za-z0-9]', '', 'g')), 'OIL', '011')) stored,
  payer_phone text check (payer_phone ~ '^255[67][0-9]{8}$'),
  -- Set when the phone is removed (12 months after the decision, or account deletion; M4).
  phone_purged_at timestamptz,
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'rejected', 'wrong_amount')),
  received_tzs bigint check (received_tzs between 1 and 100000000000),
  reason_code text check (reason_code in ('not_found', 'wrong_reference', 'wrong_network', 'duplicate', 'other')),
  admin_note text check (char_length(admin_note) <= 200),
  decided_by uuid,
  decided_at timestamptz,
  submitted_at timestamptz not null default now(),
  constraint payment_claims_phone_needed check (network = 'bank' or payer_phone is not null or phone_purged_at is not null),
  constraint payment_claims_key_length check (char_length(transaction_key) >= 6),
  constraint payment_claims_decided check ((status = 'waiting') = (decided_at is null)),
  constraint payment_claims_received check (status not in ('confirmed', 'wrong_amount') or received_tzs is not null),
  constraint payment_claims_reason check ((status = 'rejected') = (reason_code is not null))
);
create unique index if not exists payment_claims_transaction_unique on public.payment_claims (transaction_key);
create index if not exists payment_claims_loose_idx on public.payment_claims (transaction_loose);
create unique index if not exists payment_claims_one_waiting on public.payment_claims (order_id) where status = 'waiting';
create index if not exists payment_claims_order_idx on public.payment_claims (order_id, submitted_at);
create index if not exists payment_claims_waiting_idx on public.payment_claims (submitted_at) where status = 'waiting';
alter table public.payment_claims enable row level security;
revoke all on public.payment_claims from public, anon, authenticated;
comment on table public.payment_claims is
  'What a payer says he sent (network, transaction ID, phone). Never makes anything paid by itself: only an admin confirmation does.';

create table if not exists public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  service_code text not null check (service_code in ('verification', 'business_badge')),
  account_type text not null,
  provider_id uuid,
  period text not null check (period in ('month', 'year')),
  starts_on date not null,
  paid_until date not null,
  amount_tzs bigint not null check (amount_tzs > 0),
  price_id uuid not null references public.price_list (id),
  order_id uuid not null unique references public.payment_orders (id),
  status text not null default 'active' check (status in ('active', 'ended', 'refunded')),
  created_at timestamptz not null default now(),
  constraint member_subscriptions_dates check (paid_until >= starts_on),
  constraint member_subscriptions_badge check ((service_code = 'business_badge') = (provider_id is not null))
);
create index if not exists member_subscriptions_user_idx on public.member_subscriptions (user_id, service_code, paid_until desc);
alter table public.member_subscriptions enable row level security;
revoke all on public.member_subscriptions from public, anon, authenticated;
grant select on public.member_subscriptions to authenticated;
drop policy if exists "Members read their own paid periods" on public.member_subscriptions;
create policy "Members read their own paid periods" on public.member_subscriptions
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());

create index if not exists payment_audit_actor_idx on public.payment_audit_log (actor, action, created_at desc);
-- The queue's blocked-attempts count (re-review L4).
create index if not exists payment_audit_loose_idx on public.payment_audit_log ((details ->> 'transaction_loose'))
  where action = 'duplicate_blocked';

create or replace function private.touch_payment_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment orders are never deleted' using errcode = 'P0001';
  end if;
  -- Fixed at creation: who pays, for what and how much.
  if (new.reference, new.user_id, new.purpose, new.amount_tzs, new.amount_usd, new.usd_tzs_rate, new.price_id,
      new.payment_id, new.subject_key, new.created_at)
     is distinct from (old.reference, old.user_id, old.purpose, old.amount_tzs, old.amount_usd, old.usd_tzs_rate,
      old.price_id, old.payment_id, old.subject_key, old.created_at) then
    raise exception 'The amount and payer of an order cannot change' using errcode = 'P0001';
  end if;
  if old.status in ('confirmed', 'cancelled', 'received_not_applied') and new.status is distinct from old.status then
    raise exception 'This order is already closed' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.touch_payment_order() from public;
drop trigger if exists payment_orders_guard on public.payment_orders;
create trigger payment_orders_guard before update or delete on public.payment_orders
  for each row execute function private.touch_payment_order();

create or replace function private.guard_payment_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment claims are never deleted' using errcode = 'P0001';
  end if;
  -- The only change to the phone: removing it, with phone_purged_at (retention job, account deletion).
  if new.payer_phone is null and old.payer_phone is not null and new.phone_purged_at is not null then
    new.payer_phone := null;
  elsif new.payer_phone is distinct from old.payer_phone or new.phone_purged_at is distinct from old.phone_purged_at then
    raise exception 'A submitted claim cannot be changed' using errcode = 'P0001';
  end if;
  if (new.order_id, new.user_id, new.network, new.transaction_id, new.submitted_at)
     is distinct from (old.order_id, old.user_id, old.network, old.transaction_id, old.submitted_at) then
    raise exception 'A submitted claim cannot be changed' using errcode = 'P0001';
  end if;
  if old.status in ('confirmed', 'rejected') and new.status is distinct from old.status then
    raise exception 'This claim is already decided' using errcode = 'P0001';
  end if;
  -- A decided claim is frozen (re-review L2): only the phone can still be removed.
  if old.status in ('confirmed', 'rejected')
     and (new.received_tzs, new.decided_by, new.decided_at, new.admin_note, new.reason_code)
         is distinct from (old.received_tzs, old.decided_by, old.decided_at, old.admin_note, old.reason_code) then
    raise exception 'This claim is already decided' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_payment_claim() from public;
drop trigger if exists payment_claims_guard on public.payment_claims;
create trigger payment_claims_guard before update or delete on public.payment_claims
  for each row execute function private.guard_payment_claim();

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
create or replace function private.new_payment_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   -- 31 characters
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := 'KW';
  i integer;
begin
  -- Bytes 0-5 of a random v4 uuid carry no fixed version bits.
  for i in 0..5 loop
    v_code := v_code || substr(c_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return v_code;
end;
$$;
revoke execute on function private.new_payment_reference() from public, anon, authenticated;

-- 0712 345 678, +255 712 345 678, 255712345678, 712345678 -> 255712345678; anything else -> null.
create or replace function private.normalize_tz_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^255[67][0-9]{8}$' then d
    when d ~ '^0[67][0-9]{8}$' then '255' || substr(d, 2)
    when d ~ '^[67][0-9]{8}$' then '255' || d
    else null end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x;
$$;
revoke execute on function private.normalize_tz_phone(text) from public;
grant execute on function private.normalize_tz_phone(text) to authenticated;

-- Alerts through the existing outbox. Payloads carry the reference, amounts and fixed codes only:
-- never a phone number, transaction ID or note.
create or replace function private.payment_notify(p_event text, p_user uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  if p_event = 'manual_payment_submitted' then
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform private.notify_user(p_event, v_admin, p_payload, null, '{email,push}');
    end loop;
  else
    perform private.notify_user(p_event, p_user, p_payload);
  end if;
end;
$$;
revoke execute on function private.payment_notify(text, uuid, jsonb) from public, anon, authenticated;

-- 3. public.start_payment_order() is in 20261126001200_payment_method_registry.sql (it needs the
--    method registry and the store policy).

-- ---------------------------------------------------------------------------
-- 4. Payer: "I have paid" (never makes anything paid), cancel, list
-- ---------------------------------------------------------------------------
-- Returns 'submitted', or a refusal code that is also logged: 'duplicate'. Other refusals raise.
create or replace function public.submit_payment_claim(p_reference text, p_network text, p_transaction_id text, p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.payment_orders;
  v_tx text := upper(regexp_replace(coalesce(p_transaction_id, ''), '\s', '', 'g'));
  -- Same key as payment_claims.transaction_key and normalizeTransactionId (packages/shared).
  v_key text := regexp_replace(upper(coalesce(p_transaction_id, '')), '[^A-Z0-9]', '', 'g');
  v_phone text := private.normalize_tz_phone(p_phone);
  v_claim uuid;
begin
  if v_user is null then
    raise exception 'sign in first' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('payment_claims:' || v_user::text, 0));
  -- Every attempt counts, refused duplicates included.
  if (select count(*) from public.payment_audit_log l
      where l.actor = v_user and l.action in ('claim_submitted', 'duplicate_blocked') and l.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.payment_audit_log l
         where l.actor = v_user and l.action in ('claim_submitted', 'duplicate_blocked') and l.created_at > now() - interval '1 day') >= 15 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_order from public.payment_orders o
  where o.reference = upper(btrim(coalesce(p_reference, ''))) and o.user_id = v_user for update;
  if v_order.id is null then
    raise exception 'order not found' using errcode = 'P0001';
  end if;
  if v_order.status = 'submitted' then
    raise exception 'claim_waiting' using errcode = 'P0001';
  end if;
  if v_order.status not in ('awaiting_payment', 'wrong_amount') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  if p_network is null or p_network not in ('mpesa', 'mixx', 'airtel', 'halopesa', 'bank') then
    raise exception 'unknown network' using errcode = 'P0001';
  end if;
  if v_tx !~ '^[A-Z0-9][A-Z0-9._-]{4,38}[A-Z0-9]$' or char_length(v_key) < 6 then
    raise exception 'transaction_format' using errcode = 'P0001';
  end if;
  if p_network <> 'bank' and v_phone is null then
    raise exception 'phone_format' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is not null and v_phone is null then
    raise exception 'phone_format' using errcode = 'P0001';
  end if;
  if (select count(*) from public.payment_claims c where c.order_id = v_order.id) >= 5 then
    raise exception 'too_many_claims' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.payment_claims c where c.transaction_key = v_key) then
    perform private.payment_audit('order', v_order.id, 'duplicate_blocked', 'payer', v_order.reference,
      jsonb_build_object('network', p_network, 'transaction_id', v_tx, 'transaction_key', v_key,
                         'transaction_loose', translate(v_key, 'OIL', '011'), 'phone', private.mask_phone(v_phone)));
    return 'duplicate';
  end if;

  insert into public.payment_claims (order_id, user_id, network, transaction_id, payer_phone)
  values (v_order.id, v_user, p_network, v_tx, v_phone)
  returning id into v_claim;
  update public.payment_orders set status = 'submitted', status_reason = null where id = v_order.id;
  perform private.payment_audit('claim', v_claim, 'claim_submitted', 'payer', v_order.reference,
    jsonb_build_object('network', p_network, 'transaction_id', v_tx, 'phone', private.mask_phone(v_phone),
                       'amount_tzs', v_order.amount_tzs, 'currency', 'TZS'));
  perform private.payment_notify('manual_payment_submitted', null,
    jsonb_build_object('reference', v_order.reference, 'amount', v_order.amount_tzs::text, 'link', '/admin/payments'));
  return 'submitted';
end;
$$;
revoke execute on function public.submit_payment_claim(text, text, text, text) from public, anon;
grant execute on function public.submit_payment_claim(text, text, text, text) to authenticated;

create or replace function public.cancel_payment_order(p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.payment_orders;
begin
  select * into v_order from public.payment_orders o
  where o.reference = upper(btrim(coalesce(p_reference, ''))) and o.user_id = (select auth.uid()) for update;
  if v_order.id is null then
    raise exception 'order not found' using errcode = 'P0001';
  end if;
  -- After a claim or a part payment only Kwetuly can close it (money may have been sent).
  if v_order.status <> 'awaiting_payment' or exists (select 1 from public.payment_claims c where c.order_id = v_order.id) then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  update public.payment_orders set status = 'cancelled', status_reason = 'payer_cancelled' where id = v_order.id;
  if v_order.payment_id is not null then
    update public.payments set status = 'failed', status_reason = 'manual_cancelled', status_source = 'payer_cancel'
    where id = v_order.payment_id and status = 'pending';
  end if;
  perform private.payment_audit('order', v_order.id, 'order_cancelled', 'payer', v_order.reference, '{}'::jsonb);
end;
$$;
revoke execute on function public.cancel_payment_order(text) from public, anon;
grant execute on function public.cancel_payment_order(text) to authenticated;

-- The payer's own orders (p_reference null = the latest 50), with the latest claim. Phone masked.
-- The rate shown is the one stored on the order (QA 4), never today's rate.
drop function if exists public.my_payment_orders(text);
create or replace function public.my_payment_orders(p_reference text default null)
returns table (reference text, purpose text, account_type text, period text, provider_id uuid,
               amount_tzs bigint, amount_usd numeric, usd_tzs_rate numeric, rate_source text, status text,
               status_reason text, created_at timestamptz, confirmed_at timestamptz, claim_network text,
               claim_transaction_id text, claim_phone text, claim_status text, claim_reason text, claim_note text,
               received_tzs bigint, claims_count integer, refund_due boolean, commission_pct numeric, commission_tzs bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.reference, o.purpose, o.account_type, o.period, o.provider_id, o.amount_tzs, o.amount_usd, o.usd_tzs_rate,
         o.rate_source, o.status, o.status_reason, o.created_at, o.confirmed_at, c.network, c.transaction_id,
         private.mask_phone(c.payer_phone), c.status, c.reason_code, c.admin_note,
         coalesce(o.received_tzs, (select sum(x.received_tzs) from public.payment_claims x
                                   where x.order_id = o.id and x.status in ('wrong_amount', 'confirmed')))::bigint,
         (select count(*) from public.payment_claims x where x.order_id = o.id)::integer,
         o.refund_due, o.commission_pct, o.commission_tzs
  from public.payment_orders o
  left join lateral (
    select * from public.payment_claims c where c.order_id = o.id order by c.submitted_at desc limit 1) c on true
  where o.user_id = (select auth.uid())
    and (p_reference is null or o.reference = upper(btrim(p_reference)))
  order by o.created_at desc
  limit 50;
$$;
revoke execute on function public.my_payment_orders(text) from public, anon;
grant execute on function public.my_payment_orders(text) to authenticated;

create or replace function public.my_subscriptions()
returns table (service_code text, account_type text, provider_id uuid, period text, starts_on date, paid_until date, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.service_code, s.account_type, s.provider_id, s.period, s.starts_on, s.paid_until, s.status
  from public.member_subscriptions s
  where s.user_id = (select auth.uid()) and s.status = 'active'
  order by s.paid_until desc;
$$;
revoke execute on function public.my_subscriptions() from public, anon;
grant execute on function public.my_subscriptions() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The paid effect: the same result a real provider's confirmed payment would have.
--    Called only from admin_confirm_payment (and, later, a hosted provider's verified webhook).
-- ---------------------------------------------------------------------------
create or replace function private.apply_payment_effect(p_order uuid, p_claim uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payment_orders;
  c public.payment_claims;
  v_today date := private.tz_today();
  v_start date;
  v_until date;
  v_count integer;
  v_sum bigint;
  v_ok boolean;
  v_paid_on date;
begin
  select * into o from public.payment_orders where id = p_order for update;
  select * into c from public.payment_claims where id = p_claim;
  if o.status = 'confirmed' then
    raise exception 'effect already applied' using errcode = 'P0001';
  end if;
  -- Refusals that start with 'not_applicable' mean "the money arrived but this effect cannot run":
  -- admin_confirm_payment then closes the order as received_not_applied with a refund due.

  if o.purpose in ('verification', 'business_badge') then
    -- Paying early extends from the end of the paid period, never from today.
    select max(s.paid_until) + 1 into v_start from public.member_subscriptions s
    where s.user_id = o.user_id and s.service_code = case when o.purpose = 'verification' then 'verification' else 'business_badge' end
      and s.status = 'active' and s.provider_id is not distinct from o.provider_id and s.paid_until >= v_today;
    v_start := greatest(coalesce(v_start, v_today), v_today);
    v_until := (v_start + case when o.period = 'year' then interval '1 year' else interval '1 month' end)::date - 1;
    insert into public.member_subscriptions (user_id, service_code, account_type, provider_id, period, starts_on,
                                             paid_until, amount_tzs, price_id, order_id)
    values (o.user_id, case when o.purpose = 'verification' then 'verification' else 'business_badge' end, o.account_type,
            o.provider_id, o.period, v_start, v_until, o.amount_tzs, o.price_id, o.id);
    if o.purpose = 'business_badge' then
      -- Paying never extends the badge itself (security review M3): the paid period is stored above and
      -- a re-check is always queued. badge_valid_until changes only through the admin badge check.
      update public.providers set badge_requested_at = coalesce(badge_requested_at, now()) where id = o.provider_id;
      return jsonb_build_object('effect', 'badge_check_queued', 'starts_on', v_start, 'paid_until', v_until);
    end if;
    return jsonb_build_object('effect', 'verification_paid', 'starts_on', v_start, 'paid_until', v_until);

  elsif o.purpose = 'reservation_commission' then
    -- Checked up front so it lands on the received-but-not-applied path (re-review L6).
    if not private.feature_on('reservation_commission_billing') then
      raise exception 'not_applicable: billing is off' using errcode = 'P0001',
        hint = 'The money is recorded as received and the order is held for a refund decision.';
    end if;
    select sum(r.commission_tzs) into v_sum from public.reservations r
    where r.provider_ref = o.provider_id and not r.is_sample and r.commission_status = 'invoiced'
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date >= o.commission_month
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date < (o.commission_month + interval '1 month')::date;
    if v_sum is distinct from o.amount_tzs then
      raise exception 'not_applicable: commission lines changed' using errcode = 'P0001',
        hint = 'The money is recorded as received and the order is held for a refund decision.';
    end if;
    v_count := public.admin_set_reservation_commission(o.provider_id, o.commission_month, 'paid');
    return jsonb_build_object('effect', 'commission_paid', 'lines', v_count);

  else
    -- Re-checked at confirmation (security review L8), against the day the payer said they paid: the
    -- 8-day cut-off, the offer or spot still accepted, the payee still approved and not a sample.
    v_paid_on := (c.submitted_at at time zone 'Africa/Dar_es_Salaam')::date;
    if o.purpose = 'offer_deposit' then
      select exists (
        select 1 from public.trip_offers f join public.trip_requests r on r.id = f.request_id
        where f.id = o.trip_offer_id and f.status = 'accepted' and r.status <> 'closed'
          and (r.start_date is null or r.start_date >= v_paid_on + 8)
          and case when f.guide_id is not null
                   then exists (select 1 from public.guides g where g.id = f.guide_id and g.owner_id = f.offered_by
                                and g.verification_status = 'approved' and not g.is_sample)
                   else exists (select 1 from public.providers p where p.owner_id = f.offered_by
                                and p.verification_status = 'approved' and not p.is_sample) end)
        into v_ok;
    else
      select exists (
        select 1 from public.group_trip_members m join public.group_trips t on t.id = m.group_trip_id
        where m.id = o.group_member_id and m.status = 'accepted' and t.status = 'approved' and not t.cancelled
          and t.start_date >= v_paid_on + 8
          and case when t.guide_id is not null
                   then exists (select 1 from public.guides g where g.id = t.guide_id and g.owner_id = t.organizer_id
                                and g.verification_status = 'approved' and not g.is_sample)
                   else exists (select 1 from public.providers p where p.owner_id = t.organizer_id
                                and p.verification_status = 'approved' and not p.is_sample) end)
        into v_ok;
    end if;
    -- Another payment of this deposit already paid (e.g. by a provider): never two (re-review L6).
    if exists (select 1 from public.payments p
               where p.id <> o.payment_id and p.status = 'paid'
                 and ((o.trip_offer_id is not null and p.trip_offer_id = o.trip_offer_id)
                      or (o.group_member_id is not null and p.group_member_id = o.group_member_id))) then
      raise exception 'not_applicable: deposit already paid' using errcode = 'P0001',
        hint = 'The money is recorded as received and the order is held for a refund decision.';
    end if;
    if not coalesce(v_ok, false) then
      raise exception 'not_applicable: deposit no longer payable' using errcode = 'P0001',
        hint = 'Trip or offer closed, within the 8-day cut-off, or payee no longer approved.';
    end if;
    -- The order reference, never the payer's own transaction ID: payees can read payments rows (L9).
    update public.payments
    set status = 'paid', paid_at = now(), provider_transaction_id = o.reference,
        provider_reference = null, provider_channel = 'lipa_' || c.network, provider_amount = o.amount_tzs,
        status_reason = 'paid', status_source = 'admin_manual'
    where id = o.payment_id and status = 'pending' and provider = 'manual_lipa';
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'not_applicable: deposit not pending' using errcode = 'P0001',
        hint = 'The money is recorded as received and the order is held for a refund decision.';
    end if;
    return jsonb_build_object('effect', 'deposit_paid', 'payment_id', o.payment_id);
  end if;
end;
$$;
revoke execute on function private.apply_payment_effect(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Admin queue and actions (admin role and two-step session; never on one's own payment)
-- ---------------------------------------------------------------------------
-- p_status: 'waiting' (claims to check), 'wrong_amount' (orders held), 'recent' (latest 200 claims).
-- Full phone numbers here only: the admin matches them against the statement.
-- similar_claims: other claims (any status) whose transaction key matches or differs only by O/0 or
-- I,L/1; blocked_attempts: duplicate_blocked audit rows for that ID (security review H1, L2).
drop function if exists public.admin_payment_queue(text);
create or replace function public.admin_payment_queue(p_status text default 'waiting')
returns table (claim_id uuid, reference text, purpose text, account_type text, period text, amount_tzs bigint,
               amount_usd numeric, received_before_tzs bigint, payer_id uuid, payer_name text, network text,
               transaction_id text, payer_phone text, claim_status text, reason_code text, admin_note text,
               received_tzs bigint, order_status text, submitted_at timestamptz, order_created_at timestamptz,
               similar_claims integer, blocked_attempts integer)
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
    select c.id, o.reference, o.purpose, o.account_type, o.period, o.amount_tzs, o.amount_usd,
           (select sum(x.received_tzs) from public.payment_claims x
             where x.order_id = o.id and x.status = 'wrong_amount' and x.id <> c.id)::bigint,
           o.user_id, coalesce(pf.full_name, 'Account'), c.network, c.transaction_id, c.payer_phone, c.status,
           c.reason_code, c.admin_note, c.received_tzs, o.status, c.submitted_at, o.created_at,
           (select count(*) from public.payment_claims y where y.id <> c.id and y.transaction_loose = c.transaction_loose)::integer,
           (select count(*) from public.payment_audit_log l
             where l.action = 'duplicate_blocked' and l.details ->> 'transaction_loose' = c.transaction_loose)::integer
    from public.payment_claims c
    join public.payment_orders o on o.id = c.order_id
    left join public.profiles pf on pf.id = o.user_id
    where case coalesce(p_status, 'waiting')
            when 'waiting' then c.status = 'waiting'
            when 'wrong_amount' then o.status = 'wrong_amount' and c.status = 'wrong_amount'
            else true end
    order by case when coalesce(p_status, 'waiting') = 'recent' then null else c.submitted_at end asc nulls last,
             c.submitted_at desc
    limit 200;
end;
$$;
revoke execute on function public.admin_payment_queue(text) from public, anon;
grant execute on function public.admin_payment_queue(text) to authenticated;

-- Returns 'confirmed', or 'already_confirmed' when this order was confirmed before (same or another
-- key): the effect is never applied twice.
create or replace function public.admin_confirm_payment(p_claim uuid, p_received_tzs bigint, p_idempotency_key text, p_note text default null,
  p_lookalikes_checked boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  c public.payment_claims;
  o public.payment_orders;
  v_before bigint;
  v_effect jsonb;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g')), '');
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'idempotency key needed' using errcode = 'P0001';
  end if;
  select * into c from public.payment_claims where id = p_claim;
  if c.id is null then
    raise exception 'claim not found' using errcode = 'P0001';
  end if;
  select * into o from public.payment_orders where id = c.order_id for update;
  select * into c from public.payment_claims where id = p_claim for update;

  if o.status = 'confirmed' or o.effect_key = p_idempotency_key then
    perform private.payment_audit('order', o.id, 'confirm_repeated', 'admin', o.reference,
      jsonb_build_object('claim', c.id, 'key', p_idempotency_key));
    return 'already_confirmed';
  end if;
  if exists (select 1 from public.payment_orders x where x.effect_key = p_idempotency_key) then
    raise exception 'idempotency key already used' using errcode = 'P0001';
  end if;
  if c.status <> 'waiting' then
    raise exception 'claim already decided' using errcode = 'P0001';
  end if;
  if o.user_id = v_admin then
    raise exception 'own payment' using errcode = 'P0001', hint = 'Another admin confirms payments you made yourself.';
  end if;
  -- Nor a deposit that is paid to the admin himself (security review L3).
  if o.payment_id is not null and exists (select 1 from public.payments p where p.id = o.payment_id and p.payee_user_id = v_admin) then
    raise exception 'own payment' using errcode = 'P0001', hint = 'Another admin confirms deposits paid to you.';
  end if;
  if o.status in ('cancelled', 'received_not_applied') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  -- Look-alike or blocked transaction IDs need an explicit "I checked" (re-review L5).
  if not coalesce(p_lookalikes_checked, false)
     and (exists (select 1 from public.payment_claims y where y.id <> c.id and y.transaction_loose = c.transaction_loose)
          or exists (select 1 from public.payment_audit_log l
                     where l.action = 'duplicate_blocked' and l.details ->> 'transaction_loose' = c.transaction_loose)) then
    raise exception 'lookalikes not checked' using errcode = 'P0001';
  end if;
  select coalesce(sum(x.received_tzs), 0) into v_before from public.payment_claims x
  where x.order_id = o.id and x.status = 'wrong_amount';
  if p_received_tzs is null or p_received_tzs <= 0 or p_received_tzs + v_before <> o.amount_tzs then
    raise exception 'amount does not match' using errcode = 'P0001',
      hint = 'The amount received must equal the order amount (with earlier part payments). Use "wrong amount" instead.';
  end if;

  begin
    v_effect := private.apply_payment_effect(o.id, c.id);
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'not_applicable%' then
      raise;
    end if;
    -- The money arrived but the effect cannot run (security review M2): record it and hold for Walter.
    update public.payment_claims
    set status = 'confirmed', received_tzs = p_received_tzs, admin_note = left(v_note, 200), decided_by = v_admin, decided_at = now()
    where id = c.id;
    update public.payment_claims set status = 'confirmed', decided_by = v_admin, decided_at = now()
    where order_id = o.id and status = 'wrong_amount';
    update public.payment_orders
    set status = 'received_not_applied', status_reason = left(sqlerrm, 40), received_tzs = p_received_tzs + v_before, refund_due = true
    where id = o.id;
    if o.payment_id is not null then
      update public.payments set status = 'failed', status_reason = 'manual_not_applied', status_source = 'admin_manual'
      where id = o.payment_id and status = 'pending';
    end if;
    perform private.payment_audit('order', o.id, 'received_not_applied', 'admin', o.reference,
      jsonb_build_object('claim', c.id, 'received_tzs', p_received_tzs + v_before, 'currency', 'TZS', 'why', sqlerrm, 'note', v_note));
    perform private.payment_audit('order', o.id, 'refund_needs_walter', 'admin', o.reference,
      jsonb_build_object('received_tzs', p_received_tzs + v_before, 'currency', 'TZS'));
    perform private.payment_notify('manual_payment_held', o.user_id,
      jsonb_build_object('reference', o.reference, 'amount', (p_received_tzs + v_before)::text, 'link', '/payments/orders/' || o.reference));
    return 'received_not_applied';
  end;

  update public.payment_claims
  set status = 'confirmed', received_tzs = p_received_tzs, admin_note = left(v_note, 200), decided_by = v_admin, decided_at = now()
  where id = c.id;
  update public.payment_claims
  set status = 'confirmed', decided_by = v_admin, decided_at = now()
  where order_id = o.id and status = 'wrong_amount';
  update public.payment_orders
  set status = 'confirmed', status_reason = 'confirmed', effect_key = p_idempotency_key, effect = v_effect,
      confirmed_by = v_admin, confirmed_at = now()
  where id = o.id;

  perform private.payment_audit('order', o.id, 'confirmed', 'admin', o.reference,
    jsonb_build_object('claim', c.id, 'received_tzs', p_received_tzs, 'received_before_tzs', v_before, 'currency', 'TZS',
                       'network', c.network, 'transaction_id', c.transaction_id, 'phone', private.mask_phone(c.payer_phone),
                       'note', v_note, 'effect', v_effect, 'key', p_idempotency_key));
  -- Deposits: the existing payment_receipt alert (on_payment_paid) already tells the traveller.
  if o.purpose not in ('offer_deposit', 'group_deposit') then
    perform private.payment_notify('manual_payment_confirmed', o.user_id,
      jsonb_build_object('reference', o.reference, 'amount', o.amount_tzs::text, 'what', o.purpose,
                         'link', '/payments/orders/' || o.reference));
  end if;
  return 'confirmed';
end;
$$;
revoke execute on function public.admin_confirm_payment(uuid, bigint, text, text, boolean) from public, anon;
grant execute on function public.admin_confirm_payment(uuid, bigint, text, text, boolean) to authenticated;

-- Reject a claim. The transaction ID stays blocked. p_close: close the order too (otherwise the payer
-- may send another transaction ID). Closing an order with part payments received means a refund:
-- logged as refund_needs_walter; the refund itself is Walter's decision, outside this function.
create or replace function public.admin_reject_payment(p_claim uuid, p_reason_code text, p_note text default null, p_close boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  c public.payment_claims;
  o public.payment_orders;
  v_received bigint;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g')), '');
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_reason_code is null or p_reason_code not in ('not_found', 'wrong_reference', 'wrong_network', 'duplicate', 'other') then
    raise exception 'reason needed' using errcode = 'P0001';
  end if;
  select * into c from public.payment_claims where id = p_claim;
  if c.id is null then
    raise exception 'claim not found' using errcode = 'P0001';
  end if;
  select * into o from public.payment_orders where id = c.order_id for update;
  select * into c from public.payment_claims where id = p_claim for update;
  if c.status <> 'waiting' then
    raise exception 'claim already decided' using errcode = 'P0001';
  end if;
  if o.user_id = v_admin then
    raise exception 'own payment' using errcode = 'P0001';
  end if;

  update public.payment_claims
  set status = 'rejected', reason_code = p_reason_code, admin_note = left(v_note, 200), decided_by = v_admin, decided_at = now()
  where id = c.id;
  select coalesce(sum(x.received_tzs), 0) into v_received from public.payment_claims x
  where x.order_id = o.id and x.status = 'wrong_amount';

  if coalesce(p_close, false) then
    update public.payment_orders
    set status = 'cancelled', status_reason = case when v_received > 0 then 'closed_refund_needed' else 'closed_by_kwetuly' end,
        received_tzs = v_received, refund_due = v_received > 0
    where id = o.id;
    if o.payment_id is not null then
      update public.payments set status = 'failed', status_reason = 'manual_rejected', status_source = 'admin_manual'
      where id = o.payment_id and status = 'pending';
    end if;
  else
    update public.payment_orders
    set status = case when v_received > 0 then 'wrong_amount' else 'awaiting_payment' end, status_reason = 'claim_rejected'
    where id = o.id;
  end if;

  perform private.payment_audit('claim', c.id, 'rejected', 'admin', o.reference,
    jsonb_build_object('reason', p_reason_code, 'note', v_note, 'closed', coalesce(p_close, false),
                       'network', c.network, 'transaction_id', c.transaction_id, 'phone', private.mask_phone(c.payer_phone)));
  if coalesce(p_close, false) and v_received > 0 then
    perform private.payment_audit('order', o.id, 'refund_needs_walter', 'admin', o.reference,
      jsonb_build_object('received_tzs', v_received, 'currency', 'TZS'));
  end if;
  perform private.payment_notify('manual_payment_rejected', o.user_id,
    jsonb_build_object('reference', o.reference, 'reason', p_reason_code, 'closed', coalesce(p_close, false)::text,
                       'link', '/payments/orders/' || o.reference));
end;
$$;
revoke execute on function public.admin_reject_payment(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_reject_payment(uuid, text, text, boolean) to authenticated;

-- The money arrived but not the right amount. Saved with the amount received; the payer may send the
-- difference (a new claim on the same order) or Walter decides a refund. Overpayment is logged as
-- refund_needs_walter.
create or replace function public.admin_mark_wrong_amount(p_claim uuid, p_received_tzs bigint, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  c public.payment_claims;
  o public.payment_orders;
  v_before bigint;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g')), '');
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into c from public.payment_claims where id = p_claim;
  if c.id is null then
    raise exception 'claim not found' using errcode = 'P0001';
  end if;
  select * into o from public.payment_orders where id = c.order_id for update;
  select * into c from public.payment_claims where id = p_claim for update;
  if c.status <> 'waiting' then
    raise exception 'claim already decided' using errcode = 'P0001';
  end if;
  if o.user_id = v_admin then
    raise exception 'own payment' using errcode = 'P0001';
  end if;
  select coalesce(sum(x.received_tzs), 0) into v_before from public.payment_claims x
  where x.order_id = o.id and x.status = 'wrong_amount';
  if p_received_tzs is null or p_received_tzs <= 0 then
    raise exception 'received amount needed' using errcode = 'P0001';
  end if;
  if p_received_tzs + v_before = o.amount_tzs then
    raise exception 'amount matches' using errcode = 'P0001', hint = 'The amount is right: confirm instead.';
  end if;

  update public.payment_claims
  set status = 'wrong_amount', received_tzs = p_received_tzs, admin_note = left(v_note, 200), decided_by = v_admin, decided_at = now()
  where id = c.id;
  update public.payment_orders set status = 'wrong_amount', status_reason = 'wrong_amount' where id = o.id;

  perform private.payment_audit('claim', c.id, 'wrong_amount', 'admin', o.reference,
    jsonb_build_object('received_tzs', p_received_tzs, 'received_before_tzs', v_before, 'amount_tzs', o.amount_tzs,
                       'currency', 'TZS', 'note', v_note, 'network', c.network, 'transaction_id', c.transaction_id,
                       'phone', private.mask_phone(c.payer_phone)));
  if p_received_tzs + v_before > o.amount_tzs then
    perform private.payment_audit('order', o.id, 'refund_needs_walter', 'admin', o.reference,
      jsonb_build_object('overpaid_tzs', p_received_tzs + v_before - o.amount_tzs, 'currency', 'TZS'));
  end if;
  perform private.payment_notify('manual_payment_wrong_amount', o.user_id,
    jsonb_build_object('reference', o.reference, 'amount', o.amount_tzs::text, 'received', (p_received_tzs + v_before)::text,
                       'link', '/payments/orders/' || o.reference));
end;
$$;
revoke execute on function public.admin_mark_wrong_amount(uuid, bigint, text) from public, anon;
grant execute on function public.admin_mark_wrong_amount(uuid, bigint, text) to authenticated;
