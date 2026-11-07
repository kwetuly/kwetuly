-- Deposits only on trips that are still going ahead, to approved real payees, for the exact amount,
-- and payouts only on deposits whose trip is still going ahead
-- (payments-engineer, 2026-11-07, after a QA finding, the security-reviewer findings M1, M2, L4, and
-- Walter's decisions of 2026-11-07: last deposit day 8 days before the start date, offer-deposit rule
-- option a, no "paid out" on closed trips, cards at launch).
-- Deposits are still switched off (no Selcom secrets); this makes the database refuse a wrong new
-- deposit order even if the payments Edge Function has a bug.
--
--   A  payments.last_checked_at: when a Selcom webhook or the sweeper last made the Edge Function ask
--      Selcom about this order (throttle: webhook 45 s, sweeper 2 min / 6 h).
--      payments.payer_checked_at: the same for the payer's own status checks (return page, app; at most
--      one Selcom call per order every 5 s). A separate column, so a payer check never makes a webhook
--      that arrives a moment later skip its call.
--      payments.pay_method: what the traveller chose at checkout, 'mobile_money' (Selcom
--      create-order-minimal) or 'card' (Selcom create-order with billing details). The channel Selcom
--      actually used stays in provider_channel. No card data and no billing address are stored.
--      All three written only by the Edge Function (service role).
--
--   B  private.guard_new_payment(), BEFORE INSERT on public.payments. A NEW deposit order is accepted
--      only if ALL of these hold; anything else is refused:
--      * status is 'pending' (nobody can insert a row that is already paid, failed or in review).
--        Refused with errcode 23514 (check_violation): a programming error, not "no deposit".
--      * usd_tzs_rate and rate_source are filled in, and
--        amount_tzs = ceil(cents x usd_tzs_rate / 100) rounded UP to the next 100 shillings, i.e.
--        ceil(cents x usd_tzs_rate x 100 / 1 000 000) x 100, the same integer rule as the function.
--      * group_deposit:
--        - the member row is 'accepted', belongs to the payer (traveler_id = user_id) and has a saved
--          price_per_person_usd (not null, above 0);
--        - the trip is 'approved', not cancelled, not run by a traveller, has deposit_percent above 0,
--          and its start_date is on or after today + 8 days in Tanzania (Africa/Dar_es_Salaam): the
--          last day to start a deposit is 8 days before the start date, so no deposit is ever taken
--          inside the 7-day no-refund window. After that the traveller pays the organiser directly.
--          The 8 is c_last_day_before_start below, the same as DEPOSIT_LAST_DAY_BEFORE_START in the
--          Edge Function (change both together; a candidate for site_settings later);
--        - the payee (payee_user_id) is the trip's organiser (organizer_id);
--        - guide-run trip (guide_id set): that guide is verification_status 'approved', not is_sample,
--          and owner_id = the organiser;
--          business-run trip (guide_id null): the organiser owns at least one provider that is
--          verification_status 'approved' and not is_sample;
--        - amount_usd = price_per_person_usd x seats x deposit_percent / 100, exactly (the function
--          works in whole US cents: dollars x percent = cents).
--      * offer_deposit:
--        - the offer is 'accepted', belongs to the payer's request (trip_requests.traveler_id = user_id)
--          and has deposit_percent above 0;
--        - the request is not 'closed' ('booked', the normal state after accepting, stays payable);
--        - the request has a start_date: it is on or after today + 8 days (same rule as group trips);
--        - the request has flexible dates or no start_date: the offer's valid_until, if set, is today
--          or later (Walter, 2026-11-07, option a). A request with flexible dates and a start date must
--          pass both;
--        - the payee is whoever made the offer (offered_by);
--        - offer made as a guide (guide_id set): that guide is 'approved', not is_sample, and
--          owner_id = offered_by; offer made as a business (guide_id null): offered_by owns an
--          'approved', non-sample provider;
--        - amount_usd = price_total_usd x deposit_percent / 100, exactly.
--      * any other kind is refused.
--      * no 'paid' or 'review' payment exists yet for the same offer or the same member
--        (security-reviewer M2): a deposit already paid, or money being checked, never gets a second order.
--      Refusals other than the 'pending' check raise SQLSTATE P0001 with hint 'kwetuly_deposit_guard'.
--      The Edge Function maps ONLY that code + hint to 'no_deposit'; every other error stays generic.
--      Rows already in the table are not touched, and updates (Selcom results, the payout tick) are not
--      affected: a deposit already paid on a trip that is later cancelled stays recorded and is refunded
--      by hand (Walter approves each refund). The Edge Function holds such late payments as 'review'.
--
--   C  private.on_payment_review() (from 20261016001600) now also tells the PAYER, by email and push,
--      that their payment has reached Kwetuly and is being checked (event 'payment_checking', text in
--      supabase/functions/notify). The payload has only the description and a link: no amounts, no
--      reason, no phone numbers. Admins still get 'payment_review' as before.
--
--   D  "Paid out" only on deposits whose trip is still going ahead, based on the trip or offer itself,
--      with an admin override that records a reason (Walter, decision M3, options 1 and 2, as passed on
--      by the coordinator on 2026-11-07).
--      private.guard_payout(), BEFORE UPDATE on public.payments, after public.guard_payment (triggers
--      fire in name order: payments_guard, then payments_payout_guard). For every role, the service
--      role included. Ticking payout_done (false to true):
--      * always refused unless the deposit's status is 'paid' (before and after the update); the
--        override cannot change this (no payout of money Selcom has not confirmed);
--      * always refused while a refund is recorded or open for the deposit
--        (private.payment_refund_open(); returns false until the refund records table exists, see
--        docs/payments/selcom-sandbox-plan.md section 9); the override cannot change this either;
--      * otherwise allowed only when ALL three checks pass (trip, member, payee):
--        - group_deposit, trip: the trip is not cancelled and its status is 'approved' or 'pending'.
--          'pending' is accepted because an organiser's edit sends an approved trip back to review, and
--          a deposit can only reach 'paid' while the trip was approved (the payments function checks
--          this when Selcom reports the payment), so 'paid' is the record that it was approved when
--          paid. 'rejected' (taken down by an admin) is refused.
--        - group_deposit, member (Walter, 2026-11-07): refused when the member is 'declined' (the
--          organiser declined a traveller who had already paid: a refund case). A traveller's own
--          'cancelled' does NOT block the payout (the refund rule decides what they get back).
--        - offer_deposit, trip: the offer is 'accepted' (accepted offers are final). The request's
--          status is NOT checked: 'closed' is the traveller's own open/closed switch, there is no
--          "cancelled" request state, and a traveller's own action does not block the payout.
--        - payee, both kinds (Walter, 2026-11-07): the guide or business being paid
--          (payments.payee_user_id) is still approved and real, the same test as guard_new_payment:
--          when the trip or offer has guide_id set, that guide is verification_status 'approved',
--          not is_sample and owner_id = payee; when guide_id is null, the payee owns at least one
--          provider that is 'approved' and not is_sample.
--        The error's detail lists every check that refused: 'trip', 'member_declined',
--        'payee_not_approved' (comma-separated).
--      * when the trip, member or payee check refuses, an admin may still tick it through
--        public.admin_payout_with_override(payment_id, reason) only: non-empty reason (at most 500
--        characters), stored on the row (payout_override_reason, payout_override_by,
--        payout_override_at) and, append-only, in private.payout_overrides. The override columns can
--        be written only by that function (a transaction setting it alone sets); admins writing them
--        directly are reset by guard_payment, and any other writer is refused.
--        payout_override_by is a bare uuid with no foreign key, so deleting an admin account is not
--        blocked by the guard (L-A). private.payout_overrides refuses update, delete and truncate for
--        every role and grants nothing to the service role (L-B).
--      Un-ticking (true to false, to correct a mistake) is allowed only on a 'paid' deposit (see L8 in
--      the plan, section 9: to tighten with the refund records).
--      Refusals raise SQLSTATE P0001 with hint 'kwetuly_payout_guard'; the admin page should show it.
--      public.guard_payment no longer silently ignores a tick on an unpaid deposit: it is refused
--      by guard_payout instead, so the admin sees that nothing changed. Who and when stays in
--      payout_by and payout_at (guard_payment).
--
--   E  public.claim_deposit_checkout(kind, target, seconds): one checkout per offer or member every
--      10 seconds (security-reviewer L2), claimed atomically in private.deposit_checkout_claims.
--      Service role only.
--
--   F  One 'paid' payment per offer and per member (security-reviewer M2): the two plain partial
--      indexes from 20261014000200 become unique. A second Selcom payment for the same deposit is held
--      as 'review' by the payments function (and refunded), never 'paid' twice. Stops with a clear
--      message if duplicates already exist (none can: payments were never switched on).
--
-- No data is changed or deleted. Not applied to any database until Walter approves.
--
-- Undo:
--   F  drop index public.payments_one_paid_offer, public.payments_one_paid_member;
--      create index payments_offer_idx on public.payments (trip_offer_id) where status = 'paid';
--      create index payments_member_idx on public.payments (group_member_id) where status = 'paid';
--   E  drop function public.claim_deposit_checkout(text, uuid, integer);
--      drop table private.deposit_checkout_claims;
--   D  drop trigger payments_payout_guard on public.payments; drop function private.guard_payout();
--      drop function public.admin_payout_with_override(uuid, text); drop function private.payment_refund_open(uuid);
--      drop table private.payout_overrides; drop function private.payout_overrides_append_only();
--      alter table public.payments drop column payout_override_reason, drop column payout_override_by,
--        drop column payout_override_at;
--      re-create public.guard_payment() from 20261016001600_payments_review_fixes.sql;
--   B  drop trigger payments_guard_new on public.payments; drop function private.guard_new_payment();
--   C  re-create private.on_payment_review() from 20261016001600_payments_review_fixes.sql;
--   A  alter table public.payments drop column last_checked_at, drop column payer_checked_at,
--        drop column pay_method;

-- ---------------------------------------------------------------------------
-- A. Webhook throttle.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column last_checked_at timestamptz,
  add column payer_checked_at timestamptz,
  add column pay_method text not null default 'mobile_money' check (pay_method in ('mobile_money', 'card'));

comment on column public.payments.last_checked_at is
  'When a Selcom webhook or the sweeper last made the payments function ask Selcom for this order (throttle).';
comment on column public.payments.payer_checked_at is
  'When the payer''s own status check last asked Selcom for this order (throttle, 5 s).';
comment on column public.payments.pay_method is
  'What the traveller chose at checkout: mobile_money or card. Selcom''s actual channel is provider_channel.';

-- ---------------------------------------------------------------------------
-- B. Guard on new deposit orders.
-- ---------------------------------------------------------------------------
create or replace function private.guard_new_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The last day to start a deposit is this many days before the start date (Walter, 2026-11-07).
  -- Same number as DEPOSIT_LAST_DAY_BEFORE_START in supabase/functions/payments/index.ts.
  c_last_day_before_start constant integer := 8;
  v_today date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_cents bigint;
begin
  if new.status is distinct from 'pending' then
    raise exception 'A new deposit order must start as pending.' using errcode = 'check_violation';
  end if;

  -- M2: never a new order for a deposit that is already paid or whose money is being checked.
  if exists (
    select 1 from public.payments p
    where p.status in ('paid', 'review')
      and ((new.trip_offer_id is not null and p.trip_offer_id = new.trip_offer_id)
           or (new.group_member_id is not null and p.group_member_id = new.group_member_id))) then
    raise exception 'deposit_not_allowed: this deposit is already paid or being checked.'
      using errcode = 'P0001', hint = 'kwetuly_deposit_guard';
  end if;

  if new.kind = 'group_deposit' then
    select m.price_per_person_usd::bigint * m.seats * t.deposit_percent
      into v_cents
    from public.group_trip_members m
    join public.group_trips t on t.id = m.group_trip_id
    where m.id = new.group_member_id
      and m.traveler_id = new.user_id
      and m.status = 'accepted'
      and m.price_per_person_usd is not null
      and m.price_per_person_usd > 0
      and t.status = 'approved'
      and not t.cancelled
      and t.organizer_kind <> 'traveller'
      and t.deposit_percent > 0
      and t.start_date >= v_today + c_last_day_before_start
      and t.organizer_id = new.payee_user_id
      and case
            when t.guide_id is not null then exists (
              select 1 from public.guides g
              where g.id = t.guide_id
                and g.owner_id = t.organizer_id
                and g.verification_status = 'approved'
                and not g.is_sample)
            else exists (
              select 1 from public.providers p
              where p.owner_id = t.organizer_id
                and p.verification_status = 'approved'
                and not p.is_sample)
          end;
    if v_cents is null then
      raise exception 'deposit_not_allowed: no deposit can be started for this group trip spot.'
        using errcode = 'P0001', hint = 'kwetuly_deposit_guard',
              detail = 'Trip not open, starting within 8 days, spot not accepted, price missing, or organiser not approved.';
    end if;
  elsif new.kind = 'offer_deposit' then
    select o.price_total_usd::bigint * o.deposit_percent
      into v_cents
    from public.trip_offers o
    join public.trip_requests r on r.id = o.request_id
    where o.id = new.trip_offer_id
      and r.traveler_id = new.user_id
      and o.status = 'accepted'
      and o.deposit_percent > 0
      and o.offered_by = new.payee_user_id
      and r.status <> 'closed'
      and (r.start_date is null or r.start_date >= v_today + c_last_day_before_start)
      and ((r.start_date is not null and not r.flexible_dates) or o.valid_until is null or o.valid_until >= v_today)
      and case
            when o.guide_id is not null then exists (
              select 1 from public.guides g
              where g.id = o.guide_id
                and g.owner_id = o.offered_by
                and g.verification_status = 'approved'
                and not g.is_sample)
            else exists (
              select 1 from public.providers p
              where p.owner_id = o.offered_by
                and p.verification_status = 'approved'
                and not p.is_sample)
          end;
    if v_cents is null then
      raise exception 'deposit_not_allowed: no deposit can be started for this offer.'
        using errcode = 'P0001', hint = 'kwetuly_deposit_guard',
              detail = 'Offer not accepted, request closed, starting within 8 days, offer expired, no deposit, or offerer not approved.';
    end if;
  else
    raise exception 'deposit_not_allowed: unknown deposit kind.'
      using errcode = 'P0001', hint = 'kwetuly_deposit_guard';
  end if;

  -- Exact amounts: US dollars from whole cents, shillings from the saved rate (no floating point).
  if new.amount_usd is distinct from (v_cents::numeric / 100)
     or new.usd_tzs_rate is null
     or new.rate_source is null
     or new.amount_tzs is distinct from (ceil(v_cents * new.usd_tzs_rate * 100 / 1000000) * 100)::integer then
    raise exception 'deposit_not_allowed: the deposit amount does not match the price, seats and deposit percent.'
      using errcode = 'P0001', hint = 'kwetuly_deposit_guard';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_new_payment() from public, anon, authenticated;

create trigger payments_guard_new before insert on public.payments
  for each row execute function private.guard_new_payment();

-- ---------------------------------------------------------------------------
-- C. Review alert: admins as before, plus a neutral note to the payer.
-- ---------------------------------------------------------------------------
create or replace function private.on_payment_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid;
  v_payload jsonb;
begin
  if new.status = 'review' and old.status is distinct from 'review' then
    v_payload := jsonb_build_object(
      'what', new.description,
      'amount', new.amount_tzs,
      'reported', coalesce(new.provider_amount::text, 'unknown'),
      'order', new.order_id,
      'link', '/admin#payments');
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform private.notify_user('payment_review', v_admin, v_payload, null, '{email,push}');
    end loop;

    -- The payer: "your payment reached us and is being checked". No amount or reason.
    perform private.notify_user('payment_checking', new.user_id,
      jsonb_build_object(
        'what', new.description,
        'link', case when new.kind = 'offer_deposit'
                     then '/requests/' || (select request_id from public.trip_offers where id = new.trip_offer_id)
                     else '/group-trips/' || (select group_trip_id from public.group_trip_members where id = new.group_member_id) end),
      null, '{email,push}');
  end if;
  return new;
end;
$$;

revoke execute on function private.on_payment_review() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- D. "Paid out" only on paid deposits whose trip or offer is still going ahead, whose member was not
--    declined and whose payee is still approved, or with an admin override that records a reason
--    (Walter, M3, options 1 and 2; declined member and payee check decided 2026-11-07).
-- ---------------------------------------------------------------------------
alter table public.payments
  add column payout_override_reason text
    check (payout_override_reason is null or length(payout_override_reason) between 1 and 500),
  -- Bare uuid, no foreign key (security-reviewer L-A): an "on delete set null" would be an UPDATE
  -- that guard_payout refuses, so deleting an admin account would fail. The id stays as a record.
  add column payout_override_by uuid,
  add column payout_override_at timestamptz;

comment on column public.payments.payout_override_reason is
  'Why an admin marked this deposit paid out although the trip check refused it (public.admin_payout_with_override).';
comment on column public.payments.payout_override_by is 'Admin who recorded the last payout override.';
comment on column public.payments.payout_override_at is 'When the last payout override was recorded.';

-- Every override, append-only (the columns above keep only the last one).
create table private.payout_overrides (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments (id) on delete restrict,
  reason text not null check (length(reason) between 1 and 500),
  overridden_by uuid not null,
  overridden_at timestamptz not null default now()
);
alter table private.payout_overrides enable row level security;
-- Nobody reads or writes it directly, the service role included (security-reviewer L-B). Rows are
-- added only by public.admin_payout_with_override (security definer, runs as the table owner).
revoke all on private.payout_overrides from public, anon, authenticated, service_role;

-- Append-only for every role, the owner included (L-B): no update, delete or truncate. Fixing a
-- wrong entry means adding a new override, never changing an old one. (Only a superuser could get
-- round this, by switching triggers off.)
create or replace function private.payout_overrides_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'payout_overrides is append-only: % is not allowed.', lower(tg_op)
    using errcode = 'P0001', hint = 'kwetuly_payout_guard';
end;
$$;

revoke execute on function private.payout_overrides_append_only() from public, anon, authenticated;

create trigger payout_overrides_no_change before update or delete on private.payout_overrides
  for each row execute function private.payout_overrides_append_only();
create trigger payout_overrides_no_truncate before truncate on private.payout_overrides
  for each statement execute function private.payout_overrides_append_only();

-- Hook for the refund records (plan, section 9). TODO(refund-records): once public.payment_refunds
-- exists, return true while a refund for this payment is 'requested', 'approved', 'sent' or
-- 'confirmed', so a deposit being refunded can never also be paid out. Until then: no refund recorded.
create or replace function private.payment_refund_open(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;

revoke execute on function private.payment_refund_open(uuid) from public, anon, authenticated;

-- guard_payment as in 20261016001600, without the line that silently ignored a tick on an unpaid
-- deposit (guard_payout refuses it now, so the admin sees an error instead of nothing).
-- Admins writing directly can still change only payout_done; the override columns are reset from OLD.
create or replace function public.guard_payment()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_payout boolean := new.payout_done;
begin
  -- Admins may only tick "paid out": the row is rebuilt from OLD except payout_done.
  if current_user in ('anon', 'authenticated') then
    new := old;
    new.payout_done := v_payout;
  end if;
  -- Record the last change of the payout tick, whoever made it.
  if new.payout_done is distinct from old.payout_done then
    new.payout_by := (select auth.uid());
    new.payout_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.guard_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_ok boolean;
  v_member_ok boolean;
  v_payee_ok boolean;
  -- Set (for this transaction only) by public.admin_payout_with_override, for this one payment.
  v_override boolean := coalesce(current_setting('kwetuly.payout_override', true), '') = old.id::text;
begin
  -- The override columns are written only through public.admin_payout_with_override.
  if (new.payout_override_reason, new.payout_override_by, new.payout_override_at)
     is distinct from (old.payout_override_reason, old.payout_override_by, old.payout_override_at)
     and not v_override then
    raise exception 'payout_not_allowed: a payout override can only be recorded through admin_payout_with_override.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;

  if new.payout_done is not distinct from old.payout_done then
    return new;
  end if;

  -- Never overridable: only money Selcom has confirmed can be paid out.
  if old.status is distinct from 'paid' or new.status is distinct from 'paid' then
    raise exception 'payout_not_allowed: only a paid deposit can be marked or unmarked as paid out.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;

  -- Un-ticking (true to false) on a paid deposit is allowed, to correct a mistake; payout_by and
  -- payout_at (guard_payment) record who and when. To tighten with the refund records (plan, L8).
  if not new.payout_done then
    return new;
  end if;

  -- Never overridable: a deposit with a refund recorded or open is not paid out as well.
  if private.payment_refund_open(old.id) then
    raise exception 'payout_not_allowed: a refund is recorded or open for this deposit.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;

  if old.kind = 'group_deposit' then
    -- The trip: not cancelled, 'approved' or 'pending' (back in review after an organiser's edit;
    -- the deposit reached 'paid' only while the trip was approved).
    select exists (
      select 1
      from public.group_trip_members m
      join public.group_trips t on t.id = m.group_trip_id
      where m.id = old.group_member_id
        and not t.cancelled
        and t.status in ('approved', 'pending'))
      into v_trip_ok;
    -- The member: refused only when the ORGANISER declined them (Walter, 2026-11-07). A traveller's
    -- own 'cancelled' does not block the payout (the refund rule decides).
    select not exists (
      select 1 from public.group_trip_members m
      where m.id = old.group_member_id
        and m.status = 'declined')
      into v_member_ok;
    -- The payee is still an approved, real guide or business (Walter, 2026-11-07), the same test
    -- as guard_new_payment: guide-run trip, that guide is owned by the payee; business-run trip,
    -- the payee owns an approved provider.
    select exists (
      select 1
      from public.group_trip_members m
      join public.group_trips t on t.id = m.group_trip_id
      where m.id = old.group_member_id
        and case
              when t.guide_id is not null then exists (
                select 1 from public.guides g
                where g.id = t.guide_id
                  and g.owner_id = old.payee_user_id
                  and g.verification_status = 'approved'
                  and not g.is_sample)
              else exists (
                select 1 from public.providers p
                where p.owner_id = old.payee_user_id
                  and p.verification_status = 'approved'
                  and not p.is_sample)
            end)
      into v_payee_ok;
  elsif old.kind = 'offer_deposit' then
    -- The offer itself (accepted offers are final). The request's open/closed switch is the
    -- traveller's own and does not block the payout.
    select exists (
      select 1 from public.trip_offers o
      where o.id = old.trip_offer_id
        and o.status = 'accepted')
      into v_trip_ok;
    v_member_ok := true;
    -- The payee (offered_by) is still an approved, real guide or business, as in guard_new_payment.
    select exists (
      select 1 from public.trip_offers o
      where o.id = old.trip_offer_id
        and case
              when o.guide_id is not null then exists (
                select 1 from public.guides g
                where g.id = o.guide_id
                  and g.owner_id = old.payee_user_id
                  and g.verification_status = 'approved'
                  and not g.is_sample)
              else exists (
                select 1 from public.providers p
                where p.owner_id = old.payee_user_id
                  and p.verification_status = 'approved'
                  and not p.is_sample)
            end)
      into v_payee_ok;
  else
    v_trip_ok := false;
  end if;

  v_trip_ok := coalesce(v_trip_ok, false);
  v_member_ok := coalesce(v_member_ok, false);
  v_payee_ok := coalesce(v_payee_ok, false);

  if v_trip_ok and v_member_ok and v_payee_ok then
    return new;
  end if;

  -- Admin override, with a reason and who (checked again here, not only in the function).
  if v_override
     and nullif(btrim(coalesce(new.payout_override_reason, '')), '') is not null
     and new.payout_override_by is not null
     and new.payout_override_at is not null then
    return new;
  end if;

  -- detail names every check that refused, comma-separated: trip, member_declined, payee_not_approved.
  raise exception 'payout_not_allowed: the trip or offer is cancelled or taken down, the organiser declined this traveller, or the guide or business being paid is no longer approved. Refund instead, or record an override with a reason.'
    using errcode = 'P0001', hint = 'kwetuly_payout_guard',
          detail = concat_ws(',',
            case when not v_trip_ok then 'trip' end,
            case when not v_member_ok then 'member_declined' end,
            case when not v_payee_ok then 'payee_not_approved' end);
end;
$$;

revoke execute on function private.guard_payout() from public, anon, authenticated;

create trigger payments_payout_guard before update on public.payments
  for each row execute function private.guard_payout();

-- Admin-only: mark a paid deposit as paid out although the trip, member or payee check refuses it,
-- with a reason.
-- Signed-in admins only (private.is_admin(): admin role and two-step sign-in). The status rule and
-- the refund rule still apply. Errors: 42501 (not an admin), 22023 (no or too long reason), P0001
-- with hint 'kwetuly_payout_guard' (not paid, refund open, unknown or already paid out).
create or replace function public.admin_payout_with_override(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_reason text := btrim(regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]+', ' ', 'g'));
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'Only an admin can record a payout override.'
      using errcode = '42501', hint = 'kwetuly_payout_guard';
  end if;
  if length(v_reason) = 0 or length(v_reason) > 500 then
    raise exception 'A reason of 1 to 500 characters is needed for a payout override.'
      using errcode = '22023', hint = 'kwetuly_payout_guard';
  end if;

  perform set_config('kwetuly.payout_override', p_payment_id::text, true);
  update public.payments
     set payout_done = true,
         payout_override_reason = v_reason,
         payout_override_by = v_admin,
         payout_override_at = now()
   where id = p_payment_id
     and payout_done = false;
  if not found then
    raise exception 'payout_not_allowed: no such deposit, or it is already marked as paid out.'
      using errcode = 'P0001', hint = 'kwetuly_payout_guard';
  end if;
  insert into private.payout_overrides (payment_id, reason, overridden_by)
  values (p_payment_id, v_reason, v_admin);
  perform set_config('kwetuly.payout_override', '', true);
end;
$$;

revoke execute on function public.admin_payout_with_override(uuid, text) from public, anon;
grant execute on function public.admin_payout_with_override(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- E. Checkout throttle: one checkout per offer or member every few seconds (L2).
-- ---------------------------------------------------------------------------
create table private.deposit_checkout_claims (
  kind text not null check (kind in ('offer_deposit', 'group_deposit')),
  target_id uuid not null,
  claimed_at timestamptz not null,
  primary key (kind, target_id)
);
alter table private.deposit_checkout_claims enable row level security;
revoke all on private.deposit_checkout_claims from public, anon, authenticated;

-- true: this caller may start a checkout now; false: another one started less than p_seconds ago.
create or replace function public.claim_deposit_checkout(p_kind text, p_target uuid, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  if p_kind is null or p_kind not in ('offer_deposit', 'group_deposit')
     or p_target is null or p_seconds is null or p_seconds < 1 or p_seconds > 300 then
    raise exception 'claim_deposit_checkout: bad arguments' using errcode = '22023';
  end if;
  insert into private.deposit_checkout_claims as c (kind, target_id, claimed_at)
  values (p_kind, p_target, clock_timestamp())
  on conflict (kind, target_id) do update
    set claimed_at = excluded.claimed_at
    where c.claimed_at < clock_timestamp() - make_interval(secs => p_seconds)
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

revoke execute on function public.claim_deposit_checkout(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_deposit_checkout(text, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- F. One 'paid' payment per offer and per member (M2).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.payments where status = 'paid' and trip_offer_id is not null
             group by trip_offer_id having count(*) > 1)
     or exists (select 1 from public.payments where status = 'paid' and group_member_id is not null
                group by group_member_id having count(*) > 1) then
    raise exception 'Several paid deposits exist for the same offer or member. Ask payments-engineer to check them with Selcom (one is a double payment to refund, Walter approves), then run this migration again.';
  end if;
end;
$$;

drop index if exists public.payments_offer_idx;
drop index if exists public.payments_member_idx;
create unique index payments_one_paid_offer on public.payments (trip_offer_id)
  where status = 'paid' and trip_offer_id is not null;
create unique index payments_one_paid_member on public.payments (group_member_id)
  where status = 'paid' and group_member_id is not null;
