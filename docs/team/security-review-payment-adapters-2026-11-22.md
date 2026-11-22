# Security review: payment provider adapters (cba9b61, a6a8553)

Reviewer: security-reviewer. Date: 2026-11-21 (file named for the 2026-11-22 review series).
Branch: `claude/paid-verification-1`. Range: `git diff 5475282..HEAD`.
Baseline: `docs/team/security-review-flutterwave-2026-11-22.md` (M1-M4, L1-L7 fixes).

**Verdict: OK to merge.** I found no High or Medium issues. For Flutterwave, behaviour matches the reviewed version line by line. The Low items below lower defence in depth, or only matter once a second processor is added. L1-L3 should be fixed before any second adapter is written and before live keys.

This review reads code only. Nothing was deployed, no database was touched and no processor was called. It does not show the system is secure.

## Findings

### High
None.

### Medium
None.

### Low

**L1. The adapter's own call guard checks only its own config, not the core's.**
`supabase/functions/payments/providers/flutterwave.ts:136` and `:141` (`if (!ready)`). The old `flw()` checked `enabled()`, which is the full core config: KWETULY_ENV=test, live refused, live project ref refused, SITE_URL, rate, sweep secret. Now the adapter only checks FLW_* values. Today every call goes through `gateway()` (`index.ts:91-94`, used at `:226`, `:592`, `:667`, `:701`), so nothing reaches Flutterwave unless every check passed. But one future core edit that calls `PROVIDER` directly would skip the test-only and live-project checks without anyone noticing.
Fix: give the factory the core gate, for example `flutterwaveProvider({ allowed: () => CONFIG_ERROR === '' })`, and in `flw()` use `if (!ready || !allowed())`. Better still, make `PROVIDER` private to `gateway()` (export only `isWebhook` and `configError` from a wrapper). Add a test that a provider call fails while KWETULY_ENV is not "test".

**L2. The core accepts transaction ids up to 80 characters; the database CHECK allows 64.**
`supabase/functions/payments/index.ts:236` (`/^[\w.:-]{1,80}$/`) against `supabase/migrations/20261122100000_flutterwave_provider.sql:113` and `:171` (`{1,64}`). If an adapter ever reports an id of 65-80 characters, the paid update fails with 23514 on every try. The webhook then answers 500, the sweeper logs an error, and a payment that was really made stays 'pending' with no review flag. Flutterwave cannot hit this (its ids are at most 20 digits).
Fix: use one shared pattern. Add `export const PROVIDER_TX_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/` to the payment-rules block, use it in `settledFields`, and keep the SQL regex equal to it (a test can compare the two strings).

**L3. The transaction id goes into the Flutterwave URL path with no shape check, now that the database no longer guarantees digits.**
`providers/flutterwave.ts:227` and `:238` (`/transactions/${transactionId}/verify`); `:171` (`details()` accepts negative integers, with no `> 0` check as there is in `:33` and `:81`). Before a6a8553 the stored value was forced to `^[0-9]{1,20}$` by the CHECK. Now the CHECK allows `.` and `:`, so a stored value such as `..` would be accepted. `refresh()` passes the stored `provider_transaction_id` (`index.ts:317`) into the path, together with the bearer secret key. Only the service role can write that column, so this cannot be abused today. It is the kind of guarantee that quietly disappears.
Fix: in `verify()`, use the id only if `/^\d{1,20}$/.test(transactionId)` (otherwise verify by reference), and wrap it with `encodeURIComponent`. In `details()`, require `id > 0`, matching `:33` and `:81`.

**L4. After a processor switch, checkout can open a second order while the old processor's page is still open.**
`index.ts:583-601`. The pending-order loop selects pending rows for the target from every provider. `refresh()` filters on `provider = PROVIDER_ID` (`:291`), so it returns `null` for an older processor's row and the loop moves on, creating a new order. A traveller could pay on both pages. The `payments_one_paid_*` indexes and `otherPaid` would still send the second payment to 'review', so no money is lost, but a refund is needed. This is described in `providers/index.ts:16-18` as an operating rule.
Fix: in the loop, `if (current === null) return json({ error: 'pending_order', order_id: earlier.order_id }, 409);`. A pending order made with another processor then blocks a new one until it is settled by hand or by the sweeper.

**L5. Migration edited in place (information).**
`20261122100000_flutterwave_provider.sql:112-113`, `:167`, `:171` use `add column if not exists` and `create table if not exists`. A test project that already ran the earlier version keeps the old, stricter CHECKs (`in ('selcom','flutterwave')`, `^[0-9]{1,20}$`), so the schema there no longer matches the repository. This fails safe (stricter), and the migration is not on `main` or production.
Fix: before applying anywhere it already ran, reset the test project or add an `alter table ... drop constraint / add constraint` step. Confirm with `supabase db diff`.

**L6. Adapter contract: the core cannot tell whether `tx.txRef` really came from the processor (information).**
`providers/types.ts:4-10`. The exact-amount, TZS, charged_amount and reference checks are all enforced in the core (`decideDeposit`, `core.ts:128-141`), which is right. But an adapter that filled `txRef` with the `orderId` it was given, instead of the processor's echo, would defeat the reference check.
Fix: add to the rules in `types.ts`: "`tx.txRef` must be the reference echoed in the processor's answer, never the argument". Also add a shared test helper that runs any adapter's `read()` against a canned answer with a different reference and expects `reference_mismatch`. Separately, `index.ts:344` lowercases without `trim()` while `decideDeposit` trims. This is unchanged from before, and the only effect is that settled fields are missing on such a row.

## Checked and found fine

- **Nothing reaches the processor unless every check passed.** `CONFIG_ERROR` (`index.ts:73-88`) keeps the same order and checks as before. The unknown provider check comes first, then live refused (`LIVE_ALLOWED = false`), KWETULY_ENV must be test, the project ref must exist and must not be the live project, then the adapter's `configError` (FLWSECK_TEST- only, one webhook mode, secret length 32 or more, v3 and v4 secrets different), the sweep secret, SITE_URL (https or localhost, not the live site), the rate and the rate source. `config` answers enabled false and every other action answers 503 before `admin()` is created (`:798`). Building the adapter (`pickProvider`) only reads env values, with no network call.
- **Registry.** `pickProvider` (`providers/index.ts:27-29`) uses `Object.prototype.hasOwnProperty.call`, so `__proto__`, `constructor`, `toString` and the empty string give `null` (payments off). `paymentConsoleName` uses the same check, and the test covers `constructor`. Admin text that shows an unknown provider id is rendered as escaped React text, and the id is limited by the DB CHECK.
- **Webhook verification.** It is still strict v3 or v4, with no fallback. `verifyWebhook` passes both headers, but `verifyFlutterwaveWebhook` reads only the configured scheme's header. An empty header is invalid. The v4 HMAC-SHA256 is computed over the raw body (`readCapped`, 16 KB cap, before any parsing). Comparison is timing-safe through SHA-256 digests (`sameSecret`). The only change is a local `TextEncoder`, with identical output. The signature is checked before any write except the M3-limited invalid log. Unsigned calls keep no body.
- **Verify-after-webhook.** The webhook body supplies only lookup keys (`readFlutterwaveWebhook`: order id pattern, digit-only id). Status and amounts come only from `gateway().verify()`, and `decideDeposit` in the core still requires successful status, the same reference, TZS, an exact `amount` and an exact `charged_amount` (above means `fee_charged_to_payer`, review). M4 (listing attempts, `attemptsUnclear`), L5 (unique-index handling) and L6 (fees admin-only) are carried over unchanged. Money fields from the adapter are typed `unknown` and parsed by the core (`parseWholeTzs`, `parseMoney2`, `parseCurrency`).
- **Payment URL allowlist.** Core: `isPaymentUrlOn(url, provider.paymentDomains)` on both new and reused links (`index.ts:592`, `:683`). Website: `actions.ts:30`. App: `api-requests.ts:251`. Both use `isAllowedPaymentUrl` with the active processor's domains. If the shared active provider and the Edge Function's PAYMENTS_PROVIDER ever disagree, the website and app refuse the link (fails closed). The regex and host-label check are unchanged.
- **Copied blocks.** `payment-rules` (shared to `core.ts`) and `flutterwave-rules` (shared to `providers/flutterwave.ts`) are identical. I ran `npm test --workspace packages/shared -- payment-rules`: 29 passed, including the two copy tests and the test that keeps processor names out of the neutral core.
- **Payload allow-list.** `pickFlutterwavePayload` is unchanged: top-level event, type, ids and timestamp; under `data` only ids, references, status, amounts, currency, fees, payment_type and created_at. Values are cleaned and at most 64 characters, nested objects are dropped. It keeps no name, e-mail, phone, card, account, IP or free text.
- **Widened DB checks.** The new `provider` and `provider_transaction_id` CHECKs (migration lines 112-113 and 167-171) are anchored and case-sensitive regexes. They allow only lower-case letters, digits and underscore (provider), or letters, digits, dot, underscore, colon and hyphen (transaction id): no quote, space, slash or percent sign. All writes go through supabase-js parameters, so there is no SQL injection. `payments_provider_tx_unique` stays on `(provider, provider_transaction_id) WHERE ... IS NOT NULL`, so a duplicate across orders of the same processor is still refused and handled (`duplicate_transaction`, review). Equal ids under different processors are allowed, which is correct. The `payment_events (provider, event_key)` conflict target is unchanged.
- **Error paths and logs.** The new messages hold the provider id, config reason text (never secret values), the HTTP status and the path without query. `config` now also returns the provider id when enabled, which is not sensitive. Processor answer bodies are still never logged.
- **Analytics.** `PRIVATE_HOST` and `PROVIDER_QUERY` are built from `ALL_PAYMENT_DOMAINS` with regex escaping, and query strings are still stripped for every known processor, not only the active one.
- **Privacy page and texts.** The processor name now comes from `PAYMENT_PROVIDER_NAME`. Every `payments.body` use (web and app Pay box) replaces the provider placeholder, and the booking tickets and return page do not use `body`.

## Not checked

- Runtime behaviour in Deno or the Flutterwave sandbox (field names, session_duration, the transactions-list filter, not-found wording). These are still marked "to verify in the sandbox".
- Supabase security advisors and the deployed schema. No database access, by instruction.
- npm audit: no dependency changed in this range. The existing moderate advisories (for example @expo/cli through glob) are out of scope here.
- tsc and expo lint (tech-lead's pre-merge checks).
