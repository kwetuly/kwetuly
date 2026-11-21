# Security review: Flutterwave deposits (branch claude/flutterwave-1, commit 839686a)

Reviewer: security-reviewer, 2026-11-21 (file dated for the migration). Review only: no code changed, no
Supabase or Flutterwave calls, the migration was read, not run. `npm test --workspace packages/shared` passes
(130 tests, including the Edge Function copy check).

## Verdict

OK to apply to the TEST project and to test in the Flutterwave sandbox, after M3 and the deployment notes
(L4) are handled. Not OK for live until M1, M2 and M4 are closed and the sandbox questions are answered.
No Critical or High findings. This is not a statement that the payment system is secure; it is what I
checked in this commit.

## Critical

None found.

## High

None found.

## Medium

**M1. The 8-day cut-off (and other "can this trip still take a deposit" checks) were not ported.**
`supabase/functions/payments/index.ts` 674-717 (`loadOrder`) and the migration have no equivalent of
`private.guard_new_payment()` from 26a75bd (`20261107000000_deposit_only_on_open_trips.sql`, 161-273).
Today a traveller can start a deposit for a trip that starts tomorrow or has already started, for an offer on a
request that is `closed` (the offer path checks only `offer.status`; `depositTargetOpen` catches it later, at
"paid", and holds it as `review`), or on an expired offer. Effect: money is taken that must then be refunded by
hand, Kwetuly pays the provider fee on it, and it contradicts Walter's 8-day rule that the refund policy relies on.
Fix: port the BEFORE INSERT guard on `public.payments` (start date in Africa/Dar_es_Salaam at least today + 8
days, request not closed, offer not expired, offerer approved), and the same check in `loadOrder` so `check`
hides the Pay box. Keep it in the database so a later code path cannot skip it.

**M2. The payout guard with an override and a reason was not ported.**
Current `public.guard_payment()` (`20261016001600_payments_review_fixes.sql`, part B) lets any admin tick
`payout_done` on every `paid` deposit, including one whose trip or spot was cancelled after payment or that has a
refund open, and records no reason. 26a75bd had `private.guard_payout()`, `public.admin_payout_with_override()`
and an append-only `private.payout_overrides`. Abuse: a mistaken or hijacked admin session marks money as paid
out that should be refunded; the trail shows who and when, not why. The tick is a record (the transfer is
manual), so money does not move by itself; hence Medium. Fix: port that guard before live; it does not block the
test-project work.

**M3. Unsigned webhooks can fill `payment_events` without limit.**
`index.ts` 882-888: every unsigned call that names a known order inserts a new row
(`event_key = invalid:<random uuid>`). Order ids are unguessable, but they are known to the payer, to the payee
(the existing select policy on `payments` shows them `order_id`), and they reach analytics through the
return-page address (L3). One script can write millions of rows. Fix: make the key deterministic per order and
time bucket, e.g. `invalid:<tx_ref>:<yyyymmddhhmm>` with `ignoreDuplicates`, or keep a counter column; a console
log is enough for the rest.

**M4. `verify_by_reference` with several attempts on one order (sandbox question).**
`index.ts` 479: when no transaction id is known, the order is checked by `tx_ref`. If Flutterwave returns a
failed attempt while a later attempt on the same hosted page succeeded, the order can expire to `failed` and,
without a signed webhook carrying the successful transaction id, stay `failed` with the money taken (the 3-day
failed re-check asks the same question again). Fix: confirm in the sandbox which attempt the endpoint returns;
if it can be a failed one, list transactions by `tx_ref` and use any `successful` one; and build the daily
reconciliation against Flutterwave's export that the code comments rely on (not built yet).

## Low

**L1. Both webhook schemes are accepted with one secret.** `index.ts` 222-237. The v3 `verif-hash` is a static
header value; the same value is the HMAC key for `flutterwave-signature`, so anyone who sees one v3 delivery
header can also forge v4 signatures. An empty `flutterwave-signature` header falls back to `verif-hash` (the
comment at 220 says there is no fallback). Impact is small because the body is never trusted (only a re-verify is
triggered). Fix: choose one scheme by a setting (for example `FLW_WEBHOOK_MODE` set to v3 or v4) and refuse the
other; treat a present but empty signature header as invalid.

**L2. Masking is a deny-list.** `index.ts` 262-293. Covered: phone, e-mail, name, card, account, address, IP,
token, customer, fingerprint. Not covered: keys such as `mobile`, `momo`, `number`, `dob`, `passport`,
`id_number`, and free text under harmless keys (`narration`, `processor_response`, kept up to 200 characters).
`payment_events` has no retention or deletion rule (Tanzania PDPA 2022). Fix: keep an allow-list of fields
(event, id, tx_ref, flw_ref, status, amount, charged_amount, currency, app_fee, payment_type, created_at) and
drop the rest; set a retention period (delete payloads after the reconciliation window, keep the non-personal
columns).

**L3. Order ids go to analytics.** PostHog `capture_pageview` (`apps/web/src/lib/analytics.ts` 28) records
`/payments/return?order=...&tx_ref=...&transaction_id=...&status=...`. 26a75bd turned analytics off on payment
pages; not ported. Fix: skip pageviews on `/payments/` or strip the query string before sending.

**L4. Deployment and configuration.** There is no `supabase/config.toml`: the webhook and the sweeper send no
Supabase JWT, so `payments` must be deployed with `verify_jwt = false`, otherwise both get 401 at the gateway
and late payments are never caught. `SITE_URL` defaults to production, so a test checkout sends the traveller
back to kwetuly.com; `PAYMENTS_SWEEP_SECRET` is not part of `CONFIG_ERROR`. Fix: add a `[functions.payments]`
section with `verify_jwt = false`; require `SITE_URL` and the sweep secret in `CONFIG_ERROR`.

**L5. One 23505 handler for two unique indexes.** `index.ts` 587-594 treats any 23505 on "paid" as `paid_twice`;
if it came from `payments_provider_tx_unique` the retry hits it again and the webhook returns 500 on every retry.
Unlikely (the tx_ref check prevents it), but distinguish by constraint name and hold for review without the
transaction id.

**L6. Payer and payee can read the new columns** (`provider_fee`, `provider_settled_amount`, `status_reason`,
`provider_transaction_id`) through the existing select policy on `payments`. Not secret, but decide whether
guides should see Kwetuly's provider fee; if not, move them to an admin-only table or a column-limited view.

**L7. pg_net keeps the sweep header in `net.http_request_queue`** until the request is sent. Check on the test
project that the `net` schema is not readable by `anon` or `authenticated`.

## SQL that has never run: likely problems

No definite syntax error found. Points to watch on the first run:
- `payments_provider_tx_unique`, `payments_sweep_idx`, `payment_events` and `payment_checkout_links` have no
  `if not exists`: a second run fails (fine inside the migration transaction; do not hand-run parts).
- `create table if not exists private.deposit_checkout_claims`: if the 26a75bd migration was ever applied
  somewhere with a different shape, the old table is silently kept.
- `cron.schedule('sweep-payments', ...)` reuses the job name from 26a75bd: it replaces an every-minute job if one exists.
- `private.sweep_payments()` reads `vault.decrypted_secrets` as the function owner; that works only if the
  migration role can read Vault on that project.
- `amount_tzs` is `integer`: the largest allowed offer (USD 1,000,000 at 100%) overflows at rates above about
  2147 TZS per USD; the insert then fails with `save_failed`. Not a security issue.

## Checked and fine

- Webhook: HMAC-SHA256 over the raw body, base64, compared through SHA-256 digests and an XOR loop (constant
  time); `verif-hash` compared the same way; secrets shorter than 32 characters refused; body capped at 16 KB;
  unsigned calls get 401, no body kept, fixed log line.
- Re-verify: every status change goes through `refresh` and Flutterwave's verify call; body amounts and status
  are never used; a transaction id is only a lookup key and its `tx_ref` must match. `paid` needs `successful`,
  TZS, `amount` equal to the stored integer `amount_tzs`, and `charged_amount` equal to it (above:
  `fee_charged_to_payer`; below or missing: review). Amounts come from integer USD on the server and the saved rate.
- Races and repeats: every transition is conditional on the stored status; failed then successful becomes
  `review`; one pending (existing indexes) and one paid (new partial unique indexes) per deposit; checkout
  throttle is an atomic upsert; payer and sweeper throttles are conditional updates. Replayed old webhooks can
  only trigger a re-check; they cannot set `paid` without Flutterwave's answer.
- Authorisation: `check`, `checkout` and `status` need a valid user token and the payer's own offer, member or
  order. `payment_events`: RLS on, admins select only, no write grants. `payment_checkout_links`: RLS on, no
  policies, all grants revoked from anon and authenticated. `claim_deposit_checkout` and `sweep_payments`:
  SECURITY DEFINER, empty `search_path`, argument checks, execute revoked from public, anon, authenticated.
  `guard_payment` still rebuilds rows from OLD for signed-in users, so admins cannot change the new columns.
- Live refusal: `LIVE_ALLOWED = false` constant, `KWETULY_ENV` must be `test`, key must start `FLWSECK_TEST-`,
  live project ref refused; a bypass needs a code change.
- Redirects: payment page allow-list (https, subdomain of flutterwave.com, no userinfo, port 443 only, no
  backslash or spaces) applied in the function, the web action and the app; the web `back` value must start with
  the locale path; the return URL is built from a fixed `SITE_URL`; the return page trusts nothing in its address.
- Sweep: secret from Vault, header compared in constant time, at least 32 characters, answers counts only.
- Secrets and logs: keys only from env; logs carry order ids, HTTP status and error codes, never bodies or keys;
  the client gets only `enabled`, the rate, the hosted URL and the order id.

## Not checked

- Flutterwave's real webhook format, signature header and key, `verify_by_reference` behaviour, fee-bearer
  setting and `session_duration`: these need the sandbox (Walter's approval).
- The migration on a real database, Supabase security advisors, `net` schema grants, Vault permissions.
- `npm audit`, the full admin page queries, refunds and payouts (not built), chargebacks and reversals.
