-- Pending-order sweeper for Selcom deposits (payments-engineer, 2026-11-07, security-reviewer N1).
-- Selcom calls back only on success. Without this, cancelled, failed and expired orders would stay
-- 'pending' for ever, and a success whose webhook was lost or skipped would wait for the payer to
-- open the return page again. Every minute pg_cron asks the payments Edge Function to sweep:
--   * pending orders at least 2 minutes old that nobody asked Selcom about in the last 2 minutes
--     (oldest first, 25 per run);
--   * failed orders from the last 3 days not asked about in the last 6 hours (10 per run), in case
--     one was paid at Selcom after all (it then goes to 'review' and admins are alerted).
-- The function decides every status from Selcom's order-status answer, exactly as for the webhook.
-- This file changes no payment rows.
--
--   A  payments.status_source: which server path last changed the status ('checkout', 'payer_check',
--      'webhook', 'sweeper'). With updated_at this records who and when for every Selcom-driven change.
--      Written only by the Edge Function (service role); signed-in users still cannot change any
--      column but the admin payout tick (public.guard_payment).
--   B  Index for the sweep queries.
--   C  private.sweep_payments(): one POST to the function with the header x-kwetuly-sweep (a shared
--      secret). The URL and the secret are read from Vault, never stored in this file. Without both
--      Vault entries it does nothing. Not callable by anon or signed-in users.
--   D  pg_cron job 'sweep-payments', every minute (same pattern as flush-notifications).
--
-- The function refuses a sweep without the secret (403) and answers counts only, never order ids.
-- Deploy the function and this migration together: the function writes status_source.
-- Section 0 stops the migration with a clear message if pg_cron, pg_net or Vault is missing, or if
-- 20261107000000 has not been applied yet (security-reviewer L9).
--
-- Set-up, per project, test project first, only with Walter's approval (nothing here is applied
-- to any database until then):
--   1. Make a random secret of at least 32 characters (for example: openssl rand -hex 32).
--      Never put it in the repo, chat or email.
--   2. Edge Function secret PAYMENTS_SWEEP_SECRET = that value.
--   3. SQL editor of the same project:
--        select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/payments', 'payments_function_url');
--        select vault.create_secret('<the same secret>', 'payments_sweep_secret');
--   4. Check: select status_code, content from net._http_response order by id desc limit 5;
--      shows {"checked":..,"changed":..,"errors":..} (or 503 not_configured while payments are off).
--
-- Undo:
--   D  select cron.unschedule('sweep-payments');
--   C  drop function private.sweep_payments();
--   B  drop index public.payments_sweep_idx;
--   A  alter table public.payments drop column status_source;
--   and in Vault: delete from vault.secrets where name in ('payments_function_url', 'payments_sweep_secret');

-- ---------------------------------------------------------------------------
-- 0. Needed extensions (security-reviewer L9). Stops with a clear message, before any change, if
--    pg_cron, pg_net or Vault (supabase_vault) is missing. Apply order: 20261012000800 and
--    20261012001000 (pg_cron, pg_net) are already in the history; Vault is on by default in Supabase
--    projects (Database, Extensions, "supabase_vault"). Then 20261107000000, then this file, then
--    deploy the payments function, then the Vault entries and PAYMENTS_SWEEP_SECRET (set-up above).
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text := (
    select string_agg(e, ', ')
    from unnest(array['pg_cron', 'pg_net', 'supabase_vault']) as e
    where not exists (select 1 from pg_extension x where x.extname = e));
begin
  if v_missing is not null then
    raise exception 'payments sweeper: extension(s) % missing. Turn them on (Database, Extensions) and run this migration again; nothing was changed.', v_missing;
  end if;
  if not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'payments' and column_name = 'pay_method') then
    raise exception 'payments sweeper: apply 20261107000000_deposit_only_on_open_trips.sql first; nothing was changed.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A. Who changed the status.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column status_source text
  check (status_source in ('checkout', 'payer_check', 'webhook', 'sweeper'));

comment on column public.payments.status_source is
  'Which payments-function path last changed status (checkout, payer_check, webhook, sweeper). With updated_at: who and when.';

-- ---------------------------------------------------------------------------
-- B. Sweep queries: pending and failed rows by age.
-- ---------------------------------------------------------------------------
create index payments_sweep_idx on public.payments (status, created_at)
  where status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- C. Wake the payments function.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- D. Every minute.
-- ---------------------------------------------------------------------------
select cron.schedule('sweep-payments', '* * * * *', 'select private.sweep_payments()');
