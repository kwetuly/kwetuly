-- Payments review fixes (payments-engineer review of the deposit code, 2026-10-16).
-- Deposits are still switched off (no Selcom secrets); this makes the rules right for when they go on.
--
--   A  payments: provider_amount (what Selcom reported), usd_tzs_rate and rate_source (how the
--      shillings were worked out). Written only by the payments Edge Function (service role).
--   B  guard_payment: the "paid out" tick only moves on a paid deposit. Admins still change nothing else.
--   C  Admin alert (email + push, never WhatsApp) when a deposit is held for review.
--   D  Group members: the price per person is taken once, when a member is first accepted into an
--      approved trip; nobody can accept members while the trip waits for Rafrika's review; signed-in
--      users (admins included) cannot change a saved price. Only the service role can, and such a
--      change is logged as a notice.
--
-- No data is changed or deleted. Not applied to the live project until Walter approves.
--
-- Undo:
--   A  alter table public.payments drop column provider_amount, drop column usd_tzs_rate,
--      drop column rate_source;
--   B  re-create public.guard_payment() from 20261016001100_security_review_fixes.sql;
--   C  drop trigger payments_review on public.payments; drop function private.on_payment_review();
--   D  re-create private.snapshot_member_price() from 20261016001400.

-- ---------------------------------------------------------------------------
-- A. What Selcom reported, and the exchange rate used.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column provider_amount numeric(14, 2),
  add column usd_tzs_rate numeric(12, 4) check (usd_tzs_rate > 0),
  add column rate_source text check (length(rate_source) <= 60);

comment on column public.payments.provider_amount is 'Amount Selcom reported for the order (shillings), saved when the order settles.';
comment on column public.payments.usd_tzs_rate is 'Shillings per US dollar used to price amount_tzs.';
comment on column public.payments.rate_source is 'Where usd_tzs_rate came from, e.g. env:USD_TZS_RATE.';

-- ---------------------------------------------------------------------------
-- B. Payout tick only on paid deposits.
-- ---------------------------------------------------------------------------
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
  -- Money can only be paid out once it has arrived: ignore the tick on any other deposit.
  if old.status <> 'paid' or new.status <> 'paid' then
    new.payout_done := old.payout_done;
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

-- ---------------------------------------------------------------------------
-- C. Tell the admins when a deposit needs checking by hand. No phone numbers in the payload.
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
  end if;
  return new;
end;
$$;

revoke execute on function private.on_payment_review() from public, anon, authenticated;

create trigger payments_review after update of status on public.payments
  for each row execute function private.on_payment_review();

-- ---------------------------------------------------------------------------
-- D. Price per person saved on the member row.
-- Runs after group_trip_members_guard (triggers fire in name order), so it sees the final status.
-- Not security definer: the caller must be able to see the trip (organisers and admins can).
-- ---------------------------------------------------------------------------
create or replace function private.snapshot_member_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_api boolean := current_user in ('anon', 'authenticated');
  v_trip_status text;
  v_trip_price integer;
begin
  if new.status is distinct from 'accepted' then
    new.price_per_person_usd := null;
    return new;
  end if;

  if tg_op = 'INSERT' or old.status is distinct from 'accepted' then
    select t.status::text, t.price_per_person_usd into v_trip_status, v_trip_price
    from public.group_trips t where t.id = new.group_trip_id;
    -- A trip waiting for review may have a new price or deposit nobody has checked yet.
    if v_api and v_trip_status is distinct from 'approved' then
      raise exception 'This group trip is waiting for Rafrika''s review. You can accept people once it is approved.'
        using errcode = 'check_violation';
    end if;
    -- Take the price only once: a price already saved on the row stays.
    if tg_op = 'INSERT' or old.price_per_person_usd is null then
      new.price_per_person_usd := v_trip_price;
    else
      new.price_per_person_usd := old.price_per_person_usd;
    end if;
  elsif v_api then
    -- Signed-in users, admins included, cannot change the price an accepted member pays.
    new.price_per_person_usd := old.price_per_person_usd;
  elsif new.price_per_person_usd is distinct from old.price_per_person_usd then
    raise notice 'group_trip_members %: price per person changed from % to % by %',
      new.id, old.price_per_person_usd, new.price_per_person_usd, current_user;
  end if;
  return new;
end;
$$;
