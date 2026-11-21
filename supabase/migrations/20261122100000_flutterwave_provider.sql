-- Flutterwave as the deposit provider (payments-engineer, 2026-11-22; Walter chose Flutterwave on
-- 2026-11-21, Selcom is parked). Deposits stay switched off until the Edge Function has
-- PAYMENTS_PROVIDER=flutterwave and Flutterwave TEST keys; live is refused by the function itself.
-- Not applied to any database until Walter approves (test project first).
--
-- Kept as they are: payment states (pending, paid, failed, review), one pending order per deposit
-- (payments_one_pending_offer / _member), public.guard_payment (admins only tick "paid out", only on
-- paid deposits, payout_by / payout_at), alerts (on_payment_paid, on_payment_review), the saved member
-- price. Old migration files are not changed.
--
--   A  payments: provider ('selcom' | 'flutterwave'; existing rows are 'selcom', new rows 'flutterwave'),
--      provider_transaction_id, provider_fee + currency, provider_settled_amount + currency,
--      status_reason (why the function chose the status, e.g. fee_charged_to_payer),
--      status_source + last_checked_at + payer_checked_at (who and when, throttles). Ported from the
--      parked commit 26a75bd (status_source, last_checked_at, payer_checked_at).
--      One provider transaction can settle only one order (unique index).
--   B  payment_events: a log of every provider callback (webhook): provider, event key, type, tx_ref,
--      transaction id, signature valid yes/no, received time, the body with personal and card fields
--      masked, when it was processed and the status that followed. Unique on (provider, event_key), so a
--      repeated delivery is logged once. Admins read; only the Edge Function (service role) writes.
--   C  payment_checkout_links: the hosted payment link of an open order, so pressing Pay again reopens
--      the same page instead of opening a second payable order (links cannot be cancelled). Service role
--      only (RLS on, no policies). Rows older than a day are deleted by the sweeper.
--   D  public.claim_deposit_checkout: one checkout per offer or member every few seconds (ported, L2).
--   E  One 'paid' payment per offer and per member (ported, M2): a double payment is held as 'review'.
--   F  Pending-order sweeper (ported): private.sweep_payments() posts {"action":"sweep"} with the shared
--      secret header x-kwetuly-sweep to the payments function every 5 minutes. URL and secret come from
--      Vault, never this file. Without both Vault entries it does nothing.
--   G  Column comments no longer say "Selcom".
--
-- No payment row is changed except that existing rows get provider = 'selcom'.
--
-- Set-up for the sweeper (test project first, only with Walter's approval):
--   1. A random secret of at least 32 characters (openssl rand -hex 32). Never in the repo, chat or e-mail.
--   2. Edge Function secret PAYMENTS_SWEEP_SECRET = that value.
--   3. SQL editor of the same project:
--        select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/payments', 'payments_function_url');
--        select vault.create_secret('<the same secret>', 'payments_sweep_secret');
--   4. Check: select status_code, content from net._http_response order by id desc limit 5;
--
-- Undo (in this order):
--   F  select cron.unschedule('sweep-payments'); drop function private.sweep_payments(); drop index public.payments_sweep_idx;
--   E  drop index public.payments_one_paid_offer, public.payments_one_paid_member;
--      create index payments_offer_idx on public.payments (trip_offer_id) where status = 'paid';
--      create index payments_member_idx on public.payments (group_member_id) where status = 'paid';
--   D  drop function public.claim_deposit_checkout(text, uuid, integer); drop table private.deposit_checkout_claims;
--   C  drop table public.payment_checkout_links;
--   B  drop table public.payment_events;
--   A  drop index public.payments_provider_tx_unique;
--      alter table public.payments drop column provider, drop column provider_transaction_id,
--        drop column provider_fee, drop column provider_fee_currency, drop column provider_settled_amount,
--        drop column provider_settled_currency, drop column status_reason, drop column status_source,
--        drop column last_checked_at, drop column payer_checked_at;
--   and in Vault: delete from vault.secrets where name in ('payments_function_url', 'payments_sweep_secret');

-- ---------------------------------------------------------------------------
-- 0. Needed extensions: stop with a clear message before any change.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text := (
    select string_agg(e, ', ')
    from unnest(array['pg_cron', 'pg_net', 'supabase_vault']) as e
    where not exists (select 1 from pg_extension x where x.extname = e));
begin
  if v_missing is not null then
    raise exception 'flutterwave provider: extension(s) % missing. Turn them on (Database, Extensions) and run this migration again; nothing was changed.', v_missing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A. Provider columns.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column provider text not null default 'selcom' check (provider in ('selcom', 'flutterwave')),
  add column provider_transaction_id text check (provider_transaction_id ~ '^[0-9]{1,20}$'),
  add column provider_fee numeric(14, 2) check (provider_fee >= 0),
  add column provider_fee_currency text check (provider_fee_currency ~ '^[A-Z]{3}$'),
  add column provider_settled_amount numeric(14, 2) check (provider_settled_amount >= 0),
  add column provider_settled_currency text check (provider_settled_currency ~ '^[A-Z]{3}$'),
  add column status_reason text check (length(status_reason) <= 40),
  add column status_source text check (status_source in ('checkout', 'payer_check', 'webhook', 'sweeper')),
  add column last_checked_at timestamptz,
  add column payer_checked_at timestamptz;

-- Existing rows (Selcom tests, if any) stay 'selcom'; every new row is Flutterwave.
alter table public.payments alter column provider set default 'flutterwave';

create unique index payments_provider_tx_unique on public.payments (provider, provider_transaction_id)
  where provider_transaction_id is not null;

-- ---------------------------------------------------------------------------
-- G. Comments.
-- ---------------------------------------------------------------------------
comment on table public.payments is
  'Deposits for accepted trip offers and group-trip spots, paid on the provider''s hosted page (Flutterwave). Written only by the payments Edge Function; admins may only tick payout_done.';
comment on column public.payments.order_id is 'Kwetuly''s order id (RAF + 32 hex), sent to the provider as tx_ref.';
comment on column public.payments.provider is 'Which payment provider took this order: flutterwave (new rows) or selcom (parked, older rows).';
comment on column public.payments.provider_amount is 'Whole shillings the provider reported for the order, saved when it settles.';
comment on column public.payments.provider_reference is 'The provider''s own reference (Flutterwave flw_ref).';
comment on column public.payments.provider_channel is 'How it was paid, as the provider reports it (e.g. card, mobilemoneytz).';
comment on column public.payments.provider_transaction_id is 'The provider''s transaction id (Flutterwave data.id), used to verify and to reconcile.';
comment on column public.payments.provider_fee is 'Fee the provider reported (Flutterwave app_fee). Kwetuly pays it; it is not added to the traveller''s amount.';
comment on column public.payments.provider_settled_amount is 'Amount the provider says it settles to Kwetuly (Flutterwave amount_settled).';
comment on column public.payments.status_reason is 'Why the payments function chose the status (paid, amount_mismatch, fee_charged_to_payer, trip_closed, expired, ...).';
comment on column public.payments.status_source is 'Which payments-function path last changed status (checkout, payer_check, webhook, sweeper). With updated_at: who and when.';
comment on column public.payments.last_checked_at is 'When the sweeper last asked the provider about this order (throttle).';
comment on column public.payments.payer_checked_at is 'When the payer''s own status check last asked the provider (throttle, 5 s).';

-- ---------------------------------------------------------------------------
-- B. Callback log.
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('selcom', 'flutterwave')),
  event_key text not null check (length(event_key) <= 160),
  event_type text check (length(event_type) <= 60),
  tx_ref text check (tx_ref ~ '^RAF[0-9a-f]{32}$'),
  provider_transaction_id text check (provider_transaction_id ~ '^[0-9]{1,20}$'),
  signature_valid boolean not null,
  payload jsonb check (pg_column_size(payload) <= 32768),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result_status text check (length(result_status) <= 20),
  unique (provider, event_key)
);

create index payment_events_tx_ref_idx on public.payment_events (tx_ref, received_at desc);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;
create policy "Admins read payment events" on public.payment_events
  for select to authenticated using (private.is_admin());

comment on table public.payment_events is
  'Every provider callback, signature checked, body masked (no phone, e-mail, name, card or account numbers). Audit trail for reconciliation.';

-- ---------------------------------------------------------------------------
-- C. Open payment links (service role only).
-- ---------------------------------------------------------------------------
create table public.payment_checkout_links (
  payment_id uuid primary key references public.payments (id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 2048),
  created_at timestamptz not null default now()
);
alter table public.payment_checkout_links enable row level security;
revoke all on public.payment_checkout_links from anon, authenticated;

-- ---------------------------------------------------------------------------
-- D. Checkout throttle.
-- ---------------------------------------------------------------------------
create table if not exists private.deposit_checkout_claims (
  kind text not null check (kind in ('offer_deposit', 'group_deposit')),
  target_id uuid not null,
  claimed_at timestamptz not null,
  primary key (kind, target_id)
);
alter table private.deposit_checkout_claims enable row level security;
revoke all on private.deposit_checkout_claims from public, anon, authenticated;

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
-- E. One 'paid' payment per offer and per member.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.payments where status = 'paid' and trip_offer_id is not null
             group by trip_offer_id having count(*) > 1)
     or exists (select 1 from public.payments where status = 'paid' and group_member_id is not null
                group by group_member_id having count(*) > 1) then
    raise exception 'Several paid deposits exist for the same offer or member. Ask payments-engineer to check them with the provider (one is a double payment to refund; Walter approves), then run this migration again. Nothing was changed.';
  end if;
end;
$$;

drop index if exists public.payments_offer_idx;
drop index if exists public.payments_member_idx;
create unique index if not exists payments_one_paid_offer on public.payments (trip_offer_id)
  where status = 'paid' and trip_offer_id is not null;
create unique index if not exists payments_one_paid_member on public.payments (group_member_id)
  where status = 'paid' and group_member_id is not null;

-- ---------------------------------------------------------------------------
-- F. Sweeper.
-- ---------------------------------------------------------------------------
create index payments_sweep_idx on public.payments (status, created_at)
  where status in ('pending', 'failed');

create or replace function private.sweep_payments()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'payments_function_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'payments_sweep_secret');
begin
  if v_url is null or v_secret is null or length(v_secret) < 32 then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kwetuly-sweep', v_secret),
    body := '{"action":"sweep"}'::jsonb,
    timeout_milliseconds := 60000);
end;
$$;

revoke execute on function private.sweep_payments() from public, anon, authenticated;

select cron.schedule('sweep-payments', '*/5 * * * *', 'select private.sweep_payments()');
