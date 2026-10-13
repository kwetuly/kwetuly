-- Deposits paid through Selcom (mobile money and cards), for accepted trip offers and
-- accepted group-trip spots. Rafrika collects the deposit; the guide or company is paid out by
-- the Rafrika team (see the admin page). Rows are written only by the `payments` Edge Functions.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,          -- who pays
  payee_user_id uuid references auth.users (id) on delete set null,            -- guide / company owner
  kind text not null check (kind in ('offer_deposit', 'group_deposit')),
  trip_offer_id uuid references public.trip_offers (id) on delete set null,
  group_member_id uuid references public.group_trip_members (id) on delete set null,
  description text not null check (length(description) <= 200),
  amount_usd numeric(10, 2) not null check (amount_usd > 0),
  amount_tzs integer not null check (amount_tzs > 0),
  status public.payment_status not null default 'pending',
  order_id text not null unique,
  provider_reference text,
  provider_channel text,
  payout_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((kind = 'offer_deposit') = (trip_offer_id is not null)),
  check ((kind = 'group_deposit') = (group_member_id is not null))
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_payee_idx on public.payments (payee_user_id);
create index payments_offer_idx on public.payments (trip_offer_id) where status = 'paid';
create index payments_member_idx on public.payments (group_member_id) where status = 'paid';

alter table public.payments enable row level security;

create policy "Payers, payees and admins see payments" on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or payee_user_id = (select auth.uid()) or private.is_admin());
-- Admins only mark payouts as done; everything else is written by the Edge Functions.
create policy "Admins record payouts" on public.payments
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- Admins may only tick "paid out": the row is rebuilt from OLD except payout_done.
create or replace function public.guard_payment()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_payout boolean := new.payout_done;
begin
  if current_user in ('anon', 'authenticated') then
    new := old;
    new.payout_done := v_payout;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger payments_guard before update on public.payments
  for each row execute function public.guard_payment();

-- Group trips can ask for a deposit too (default 30%).
alter table public.group_trips add column deposit_percent integer not null default 30
  check (deposit_percent between 0 and 100);

-- Alerts when a deposit arrives.
create or replace function private.on_payment_paid()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    v_payload := jsonb_build_object('what', new.description, 'amount', new.amount_tzs,
      'link', case when new.kind = 'offer_deposit'
                   then '/requests/' || (select request_id from public.trip_offers where id = new.trip_offer_id)
                   else '/group-trips/' || (select group_trip_id from public.group_trip_members where id = new.group_member_id) end);
    perform private.notify_user('payment_received', new.payee_user_id, v_payload);
    perform private.notify_user('payment_receipt', new.user_id, v_payload, null, '{email,push}');
    perform private.notify_admins('payment_received', v_payload);
  end if;
  return new;
end;
$$;

revoke execute on function private.on_payment_paid() from public, anon, authenticated;

create trigger payments_paid after update of status on public.payments
  for each row execute function private.on_payment_paid();
