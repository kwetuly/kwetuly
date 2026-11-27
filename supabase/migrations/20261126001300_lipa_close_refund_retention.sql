-- NOT APPLIED. Manual Lipa payments, part 4 of 4 (payments-engineer, 2026-11-27): the fixes from the
-- security review of the Lipa build that need new functions. Needs 20261126001000, 001100 and 001200
-- first. Apply only with Walter's yes, after security-reviewer and qa-tester, on a test project first
-- (supabase/checks/manual_lipa_payments_tests.sql).
--
-- What it does:
--   1. public.admin_close_order(reference, outcome, received_tzs, note) (M2): closes a submitted or
--      wrong-amount order that cannot go ahead. outcome 'refund_due' records the money Walter found on the
--      statement and flags a refund; 'nothing_received' closes it with nothing owed. A waiting claim is
--      rejected ('other'). A deposit's pending payments row becomes failed.
--   2. public.payment_refund_records + public.admin_record_refund(reference, amount, channel, sent_ref,
--      note) (M2): RECORDING ONLY. Kwetuly or Walter sends the refund outside Kwetuly (refunds need
--      Walter's approval); this writes what was sent. Never more than was received. Append-only.
--      public.admin_refunds_due() lists orders with a refund still due.
--   3. public.admin_close_open_deposit_orders() (H2): while feature.deposits_via_kwetuly_lipa is OFF,
--      closes every deposit order still waiting for payment with no claim; orders with a claim or money
--      received stay for the queue. The payer is told.
--   4. Phone retention (M4): private.purge_claim_phones() removes payer_phone from claims decided more
--      than 12 months ago, daily (pg_cron 'kwetuly-lipa-phone-purge'). TODO(legal): confirm period under
--      PDPA 2022. Account deletion removes the person's claim phones at once (trigger on auth.users).
--      Audit rows keep only masked phones and stay.
--
-- Undo (in this order):
--   select cron.unschedule('kwetuly-lipa-phone-purge');
--   drop trigger auth_users_scrub_payment_claims on auth.users;
--   drop function private.scrub_payment_claims_on_delete(), private.purge_claim_phones(),
--     public.admin_close_open_deposit_orders(), public.admin_refunds_due(),
--     public.admin_record_refund(text, bigint, text, text, text), public.admin_close_order(text, text, bigint, text),
--     private.refund_records_append_only();
--   drop table public.payment_refund_records;

-- ---------------------------------------------------------------------------
-- 1. Close an order that cannot go ahead
-- ---------------------------------------------------------------------------
create or replace function public.admin_close_order(p_reference text, p_outcome text, p_received_tzs bigint, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  o public.payment_orders;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g')), '');
  v_received bigint := coalesce(p_received_tzs, 0);
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_outcome is null or p_outcome not in ('refund_due', 'nothing_received') then
    raise exception 'unknown outcome' using errcode = 'P0001';
  end if;
  select * into o from public.payment_orders where reference = upper(btrim(coalesce(p_reference, ''))) for update;
  if o.id is null then
    raise exception 'order not found' using errcode = 'P0001';
  end if;
  if o.user_id = v_admin or (o.payment_id is not null and exists (
        select 1 from public.payments p where p.id = o.payment_id and p.payee_user_id = v_admin)) then
    raise exception 'own payment' using errcode = 'P0001';
  end if;
  if o.status not in ('submitted', 'wrong_amount') then
    raise exception 'order_closed' using errcode = 'P0001';
  end if;
  if (p_outcome = 'refund_due') <> (v_received > 0) or v_received < 0 or v_received > 100000000000 then
    raise exception 'received amount needed' using errcode = 'P0001',
      hint = 'refund_due needs the amount found on the statement; nothing_received needs 0.';
  end if;

  update public.payment_claims
  set status = 'rejected', reason_code = 'other', admin_note = left(coalesce(v_note, 'Closed by Kwetuly'), 200),
      decided_by = v_admin, decided_at = now()
  where order_id = o.id and status = 'waiting';
  update public.payment_orders
  set status = 'cancelled', status_reason = case when v_received > 0 then 'closed_refund_needed' else 'closed_by_kwetuly' end,
      received_tzs = v_received, refund_due = v_received > 0
  where id = o.id;
  if o.payment_id is not null then
    update public.payments set status = 'failed', status_reason = 'manual_closed', status_source = 'admin_manual'
    where id = o.payment_id and status = 'pending';
  end if;
  perform private.payment_audit('order', o.id, 'order_closed', 'admin', o.reference,
    jsonb_build_object('outcome', p_outcome, 'received_tzs', v_received, 'currency', 'TZS', 'note', v_note));
  if v_received > 0 then
    perform private.payment_audit('order', o.id, 'refund_needs_walter', 'admin', o.reference,
      jsonb_build_object('received_tzs', v_received, 'currency', 'TZS'));
    perform private.payment_notify('manual_payment_held', o.user_id,
      jsonb_build_object('reference', o.reference, 'amount', v_received::text, 'link', '/payments/orders/' || o.reference));
  else
    perform private.payment_notify('manual_payment_closed', o.user_id,
      jsonb_build_object('reference', o.reference, 'link', '/payments/orders/' || o.reference));
  end if;
end;
$$;
revoke execute on function public.admin_close_order(text, text, bigint, text) from public, anon;
grant execute on function public.admin_close_order(text, text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Refunds: recorded, never sent from here
-- ---------------------------------------------------------------------------
create table if not exists public.payment_refund_records (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.payment_orders (id) on delete restrict,
  amount_tzs bigint not null check (amount_tzs between 1 and 100000000000),
  channel text not null check (channel in ('mpesa', 'mixx', 'airtel', 'halopesa', 'bank', 'cash', 'other')),
  -- The refund's own reference (the SMS or bank reference Walter sent it with).
  sent_reference text not null check (sent_reference ~ '^[A-Za-z0-9._-]{4,64}$'),
  note text check (char_length(note) <= 200),
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);
create index if not exists payment_refund_records_order_idx on public.payment_refund_records (order_id);
alter table public.payment_refund_records enable row level security;
revoke all on public.payment_refund_records from public, anon, authenticated;

create or replace function private.refund_records_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Refund records cannot be changed or removed' using errcode = 'P0001';
end;
$$;
revoke execute on function private.refund_records_append_only() from public;
drop trigger if exists payment_refund_records_no_change on public.payment_refund_records;
create trigger payment_refund_records_no_change before update or delete on public.payment_refund_records
  for each row execute function private.refund_records_append_only();
drop trigger if exists payment_refund_records_no_truncate on public.payment_refund_records;
create trigger payment_refund_records_no_truncate before truncate on public.payment_refund_records
  for each statement execute function private.refund_records_append_only();

create or replace function public.admin_record_refund(p_reference text, p_amount_tzs bigint, p_channel text, p_sent_reference text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  o public.payment_orders;
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g')), '');
begin
  if v_admin is null or not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into o from public.payment_orders where reference = upper(btrim(coalesce(p_reference, ''))) for update;
  if o.id is null then
    raise exception 'order not found' using errcode = 'P0001';
  end if;
  if o.user_id = v_admin then
    raise exception 'own payment' using errcode = 'P0001';
  end if;
  if not o.refund_due then
    raise exception 'no refund due' using errcode = 'P0001';
  end if;
  if p_amount_tzs is null or p_amount_tzs <= 0 or o.refunded_tzs + p_amount_tzs > coalesce(o.received_tzs, 0) then
    raise exception 'refund more than received' using errcode = 'P0001';
  end if;
  insert into public.payment_refund_records (order_id, amount_tzs, channel, sent_reference, note, recorded_by)
  values (o.id, p_amount_tzs, p_channel, btrim(coalesce(p_sent_reference, '')), left(v_note, 200), v_admin);
  update public.payment_orders
  set refunded_tzs = refunded_tzs + p_amount_tzs,
      refund_due = refunded_tzs + p_amount_tzs < coalesce(received_tzs, 0)
  where id = o.id;
  perform private.payment_audit('order', o.id, 'refund_recorded', 'admin', o.reference,
    jsonb_build_object('amount_tzs', p_amount_tzs, 'currency', 'TZS', 'channel', p_channel,
                       'sent_reference', btrim(coalesce(p_sent_reference, '')), 'note', v_note,
                       'refunded_total_tzs', o.refunded_tzs + p_amount_tzs, 'received_tzs', o.received_tzs));
end;
$$;
revoke execute on function public.admin_record_refund(text, bigint, text, text, text) from public, anon;
grant execute on function public.admin_record_refund(text, bigint, text, text, text) to authenticated;

create or replace function public.admin_refunds_due()
returns table (reference text, purpose text, payer_name text, amount_tzs bigint, received_tzs bigint,
               refunded_tzs bigint, status text, status_reason text, updated_at timestamptz)
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
    select o.reference, o.purpose, coalesce(pf.full_name, 'Account'), o.amount_tzs, o.received_tzs, o.refunded_tzs,
           o.status, o.status_reason, o.updated_at
    from public.payment_orders o
    left join public.profiles pf on pf.id = o.user_id
    where o.refund_due
    order by o.updated_at
    limit 200;
end;
$$;
revoke execute on function public.admin_refunds_due() from public, anon;
grant execute on function public.admin_refunds_due() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Close waiting deposit orders when deposits by Lipa are switched off (H2)
-- ---------------------------------------------------------------------------
create or replace function public.admin_close_open_deposit_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payment_orders;
  v_count integer := 0;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if private.feature_on('deposits_via_kwetuly_lipa') then
    raise exception 'deposits are on' using errcode = 'P0001', hint = 'Switch feature.deposits_via_kwetuly_lipa off first.';
  end if;
  for o in
    select * from public.payment_orders x
    where x.purpose in ('offer_deposit', 'group_deposit') and x.status = 'awaiting_payment'
      and not exists (select 1 from public.payment_claims c where c.order_id = x.id)
    for update
  loop
    update public.payment_orders set status = 'cancelled', status_reason = 'deposits_switched_off' where id = o.id;
    update public.payments set status = 'failed', status_reason = 'manual_closed', status_source = 'admin_manual'
    where id = o.payment_id and status = 'pending';
    perform private.payment_audit('order', o.id, 'order_closed', 'admin', o.reference, '{"outcome": "deposits_switched_off"}'::jsonb);
    perform private.payment_notify('manual_payment_closed', o.user_id,
      jsonb_build_object('reference', o.reference, 'link', '/payments/orders/' || o.reference));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.admin_close_open_deposit_orders() from public, anon;
grant execute on function public.admin_close_open_deposit_orders() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Phone retention (M4)
-- ---------------------------------------------------------------------------
-- TODO(legal): confirm period under PDPA 2022 (12 months after the decision is a proposal).
create or replace function private.purge_claim_phones()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payment_claims
  set payer_phone = null, phone_purged_at = now()
  where payer_phone is not null and decided_at is not null and decided_at < now() - interval '12 months';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function private.purge_claim_phones() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kwetuly-lipa-phone-purge') then
    perform cron.unschedule('kwetuly-lipa-phone-purge');
  end if;
end;
$$;
select cron.schedule('kwetuly-lipa-phone-purge', '50 3 * * *', 'select private.purge_claim_phones()');

-- Account deletion: the person's claim phones go at once; orders, claims (transaction IDs, for the
-- duplicate check and the accounts) and the audit rows (masked phones only) stay.
create or replace function private.scrub_payment_claims_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_claims
  set payer_phone = null, phone_purged_at = now()
  where user_id = old.id and payer_phone is not null;
  return old;
end;
$$;
revoke execute on function private.scrub_payment_claims_on_delete() from public, anon, authenticated;
drop trigger if exists auth_users_scrub_payment_claims on auth.users;
create trigger auth_users_scrub_payment_claims before delete on auth.users
  for each row execute function private.scrub_payment_claims_on_delete();
