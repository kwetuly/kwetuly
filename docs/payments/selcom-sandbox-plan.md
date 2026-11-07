# Selcom sandbox: plan for testing deposits (payments-engineer, 2026-11-07)

Answer to Walter's question "can't we use Selcom sandbox to test payments for now?".

**Short answer: yes, the code is already built for it, but we cannot get test keys ourselves.** Selcom's developer site says to email them for API keys. Only Walter can do that. Whether Selcom gives test keys to someone whose company is not registered yet is **to verify** (we found nothing either way). Once Walter has test keys, engineering needs about one day of setup and fixes before qa-tester can run a full test. No real money moves in the test environment, and live keys stay out of every environment until the company is registered, legal has answered, and Walter says go.

Nothing was signed up for, nobody was contacted, and nothing was deployed while writing this.

## 1. What the code already supports

| Item | State today |
| --- | --- |
| Selcom integration | Yes: `supabase/functions/payments/index.ts` (Supabase Edge Function). It handles config, check, checkout, status and the Selcom webhook. |
| Test or live switch | Yes, explicit (2026-11-07). `KWETULY_ENV` must be `test` or `live`. `live` uses `apigw.selcommobile.com`, `test` uses `apigwtest.selcommobile.com`. **To verify**: that test host name does not appear on Selcom's public docs, so Selcom must confirm the sandbox base URL. |
| Switched off by default | Yes. Without `KWETULY_ENV`, `SELCOM_VENDOR`, `SELCOM_API_KEY`, `SELCOM_API_SECRET` and `USD_TZS_RATE`, or with any mode mismatch (4.1), the function answers `enabled: false`, makes no Selcom call, and the website and app hide every Pay box. |
| Where the secrets live | In the **Supabase Edge Function secrets** (dashboard: Edge Functions, Secrets), not in the website. For a local function run they go in `supabase/functions/.env.local` (git-ignored, never committed). `apps/web/.env.example` has no `SELCOM_*` entries, which is correct: the website never sees Selcom keys. |
| Fake or test mode without Selcom | None. There is no mock gateway. |
| Request signing | Yes. HMAC-SHA256 over `timestamp=...&field=value...`, with `Authorization: SELCOM base64(key)`, `Digest-Method`, `Digest`, `Signed-Fields` and `Timestamp` headers. This matches the scheme on developers.selcommobile.com. |
| Webhook | Accepted. The function uses only the `order_id` from the body and then asks Selcom `checkout/order-status` for the real result. It never trusts the body, so a forged callback cannot mark anything paid. |
| Amount checks | A completed order is `paid` only if Selcom reports exactly the TZS amount we asked for. Otherwise the row goes to `review` and admins are alerted. |
| Exchange rate | `USD_TZS_RATE` is fixed. The rate and its source are saved on every payment row. The shilling maths uses integers. |
| Cards | **Built in code (2026-11-07), switched off until Selcom confirms.** Mobile money still uses `create-order-minimal`. Cards use `checkout/create-order` with `payment_methods=CARD` and the `billing.*` fields, behind the same mode guard plus `SELCOM_CARDS=1`. See section 8. |
| Deposit window | The last day to start a deposit is **8 days before the start date** (Tanzania date), for group trips and dated offer requests. So no deposit is taken inside the 7-day no-refund window. Enforced in the function (`DEPOSIT_LAST_DAY_BEFORE_START`) and in `private.guard_new_payment` (`c_last_day_before_start`). |
| Payout tick | Refused by the database (`private.guard_payout`) unless the deposit is `paid`, no refund is open, and its group trip (not the member) or offer is still going ahead. An admin can override the trip check only with a reason, through `admin_payout_with_override` (section 10). |
| One paid payment per deposit | Unique indexes on offer and on member where `status = 'paid'`; `guard_new_payment` refuses a new order when a `paid` or `review` payment exists. A second Selcom payment for the same deposit is held as `review` (refund). |
| Checkout throttle | One checkout per offer or member every 10 seconds (`public.claim_deposit_checkout`). |

## 2. What Selcom publishes (official sources only)

Sources: https://developers.selcommobile.com/ and https://www.selcom.net/ (read 2026-11-07).

- **Getting credentials:** the developer site says to email support@selcom.net for API keys and credentials, and to contact the business team for access. Other Selcom contacts are info@selcom.net, help@selcom.net and 0800 714 888.
- **Sandbox base URL:** not published. The docs use a placeholder host. **To verify** with Selcom: whether `https://apigwtest.selcommobile.com/v1/` is the sandbox.
- **Registered company for sandbox:** not stated. **To verify.** For live use, Selcom says its team handles application, verification, registration and activation. The document list is not published. A registered company, TIN and business licence are very likely needed for live (**to verify**).
- **Test phone numbers and test cards:** none are published. A webhook sample shows `255000000001`, but it is not described as a test number. **To verify**: ask Selcom for sandbox wallet numbers, and for how to approve or decline a push payment in the sandbox.
- **Webhook:** Selcom documents "Webhook only on successful transactions". The payload has `result`, `resultcode`, `order_id`, `transid`, `reference`, `channel`, `amount`, `phone` and `payment_status`. The headers include `Authorization`, `Digest-Method`, `Digest`, `Timestamp` and `Signed-Fields`. **How to verify the callback signature is not documented. To verify** with Selcom, in writing.
- **Order status values:** `PENDING`, `COMPLETED`, `CANCELLED`, `USERCANCELLED`, `REJECTED` and `INPROGRESS`. "An expired or completed order cannot be cancelled."
- **Refunds:** no checkout refund endpoint is documented. Refunds are manual. **To verify** how Selcom refunds a checkout payment.
- **Callback URL:** the webhook URL is sent with each order, base64-encoded. It must be reachable by Selcom from the internet, so a `localhost` address will not work. Whether Selcom must whitelist callback hosts or our server IPs is **to verify**.

## 3. What Walter does himself

Nobody else signs up or contacts Selcom.

1. **Email Selcom** (support@selcom.net, copying info@selcom.net) and ask for **sandbox (test) API access only**. Things to ask:
   - Can an unregistered business, or Walter as an individual developer, get sandbox keys? What is needed later for live?
   - The sandbox base URL. Is it `https://apigwtest.selcommobile.com/v1/`?
   - Sandbox test wallet numbers (M-Pesa, Mixx by Yas, Airtel, HaloPesa) and test cards, plus how to make a test payment succeed, fail or expire.
   - How to verify the webhook `Digest` (which fields, which key, HS256 or RS256), and whether callbacks are ever sent for failures.
   - Whether callback URLs or our IP addresses must be whitelisted.
   - How refunds work for checkout payments.
   - Whether settlement can be split straight to a guide's wallet (structure B in `docs/legal/deposit-and-refund-policy.md`).
2. **Give Selcom only Walter's own name and email for now.** Give no company details that do not exist yet, and accept no merchant agreement (that waits for the registered company and legal advice).
3. **Store the keys he receives** in the Supabase dashboard of a **separate test project** (see 4.1), as Edge Function secrets. Never send them in chat or email, and never put them in the repo.
4. **Approve the fixed test exchange rate** to use (for example the Bank of Tanzania rate on that day) and its source label.

## 4. What engineering does

### 4.1 Environments (devops with backend-engineer)
- **Use a separate Supabase project or a Supabase branch for sandbox testing, not the live project.** Test orders would otherwise create rows in the real `payments` table, and alert real admins.
- **The test project holds only test and sample data.** It is built from the migrations plus seed and sample rows. It is never a copy, dump or restore of the live database, and no real traveller, guide or business data is imported into it, not even "just to try something".
- **Test accounts for payees.** Deposits go only to an approved, non-sample guide or to the owner of an approved, non-sample business (the function and `guard_new_payment` both check this), so sample guides cannot be used. Create, in the test project only, one approved guide and one approved business whose names start with "TEST" and whose profile text says "Test account, not a real guide/business". Record them in `supabase/test-accounts.local.md` (git-ignored), never in the repo or in chat.
- **Edge Function secrets, test project:**

  | Secret | Value |
  | --- | --- |
  | `KWETULY_ENV` | `test` (required) |
  | `SELCOM_LIVE` | unset or `0` |
  | `KWETULY_LIVE_PROJECT_REF` | unset, or `zsymxfommlxqqfywekuy` (never the test project's ref) |
  | `SELCOM_VENDOR`, `SELCOM_API_KEY`, `SELCOM_API_SECRET` | sandbox values from Selcom |
  | `USD_TZS_RATE` | the test rate Walter approves |
  | `PAYMENTS_SWEEP_SECRET` | 32 or more random characters, also stored in Vault (4.2.2) |
  | `SITE_URL` | the preview site (4.3) |

- **Edge Function secrets, live project (only after Walter's go):** `KWETULY_ENV=live`, `SELCOM_LIVE=1`, `KWETULY_LIVE_PROJECT_REF=zsymxfommlxqqfywekuy`, live Selcom keys, `USD_TZS_RATE`, its own `PAYMENTS_SWEEP_SECRET` (different from the test one), `SITE_URL=https://kwetuly.com`.
- **Mode guard (built, 2026-11-07, security-reviewer N2).** The live project ref `zsymxfommlxqqfywekuy` is written in the function (taken from `.mcp.json`, the hosting plan and the board). Payments stay switched off, with the reason logged once at start-up (never keys), when any of these is true:
  - `KWETULY_ENV` is not exactly `test` or `live` (also when unset);
  - `SELCOM_LIVE` is anything other than unset, `0` or `1`;
  - `KWETULY_LIVE_PROJECT_REF` is set to something other than the ref in the code;
  - `live`, but `SELCOM_LIVE` is not `1`, `KWETULY_LIVE_PROJECT_REF` is missing, or this is not the live project;
  - `test`, but `SELCOM_LIVE=1`, or this is the live project.

  "Switched off" means `config` answers `enabled: false`, every other action answers 503, and no Selcom call can be made (also checked inside the Selcom request helper). So live keys cannot be used in the test project, and the live project cannot take payments through the test gateway. **To verify:** the ref is read from the first part of the `SUPABASE_URL` host name; if the live project ever uses a custom Supabase domain, live mode refuses to run until the code is updated (safe failure).
- **Cards setting (L7):** a wrong `SELCOM_CARDS` value (anything but unset, `0` or `1`) now switches **cards** off, not payments; the start-up log says `SELCOM_CARDS must be unset, "0" or "1"; cards off`. Every other configuration error still switches payments off.
- **Alert in live (L7):** devops sets a log alert on the live project for the payments start-up line containing `switched off` (and for `cards off` once cards are live), so a wrong secret is noticed at once instead of when travellers cannot pay.
- For a local run of the function: `supabase functions serve payments --env-file supabase/functions/.env.local`. The file is git-ignored; check that before creating it. The Supabase CLI is not installed on this machine yet.

### 4.2 Fixes needed before the first sandbox test
1. **Webhook reaches the function:** deploy `payments` with JWT verification off (`--no-verify-jwt`, or `[functions.payments] verify_jwt = false` in `supabase/config.toml`). Selcom sends `Authorization: SELCOM ...`, not a Supabase token, so with verification on the Supabase gateway rejects every callback. User actions still check the user token inside the function.
2. **Pending-order sweeper (built in code, 2026-11-07, security-reviewer N1; not applied anywhere).** Selcom only calls back on success.
   - **Schedule:** migration `20261107000100_payments_sweeper.sql` adds pg_cron job `sweep-payments`, every minute (same pattern as `flush-notifications`). It calls `private.sweep_payments()`, which POSTs `{ "action": "sweep" }` to the payments function with the header `x-kwetuly-sweep`. The function URL and the secret are read from Vault (`payments_function_url`, `payments_sweep_secret`); without both, the job does nothing.
   - **Protection:** the function compares the header with the Edge Function secret `PAYMENTS_SWEEP_SECRET` (at least 32 characters, constant-time comparison) and answers 403 otherwise. It answers counts only (`checked`, `changed`, `errors`), never order ids or amounts. With payments switched off it answers 503 before looking at anything.
   - **What it checks each run:** `pending` orders at least 2 minutes old that nobody asked Selcom about in the last 2 minutes (oldest first, 25 per run), and `failed` orders from the last 3 days not asked about in the last 6 hours (10 per run, in case one was paid after all; it then goes to `review`). Every check is claimed on `last_checked_at`, so the sweeper and webhooks never ask Selcom twice for the same order at once.
   - **Closing old orders:** the same rules apply whoever triggers the check. An order Selcom still reports as `PENDING` (or does not report) more than 65 minutes after creation (our 60-minute `expiry` plus 5 minutes' grace) becomes `failed`. Anything still unsettled after 24 hours (for example `INPROGRESS`, or no answer from Selcom at all) becomes `failed` too. Failed orders stay re-checkable for 3 days, so a late success still reaches `review`. **To verify with Selcom:** what order-status reports after the expiry (PENDING or EXPIRED) and how long INPROGRESS can last.
   - **A failed Selcom call backs off:** if the order-status call throws for a pending order, `last_checked_at` is set to one minute ago (only if nobody claimed it since), so the next sweep retries in about a minute, not at once. Failed orders keep the full claim, so an order that never reached Selcom is not asked about every minute. An order Selcom says it does not know (HTTP 404 or a "not found" result; the exact answer is **to verify**) is marked `failed` once our 65-minute expiry has passed, not after a day.
   - **Time limits:** every Selcom call gives up after 10 seconds. A sweep starts no new check after 45 seconds (pg_cron waits 60), and answers `left` with the number it did not reach.
   - **Who and when:** every status change now writes `payments.status_source` (`checkout`, `payer_check`, `webhook`, `sweeper`) next to `updated_at`. Status updates now raise an error instead of being ignored when the database refuses them.
   - **Lost races are checked (security-reviewer M-a):** every status change asks for the changed row back. If another path changed it first, the row is read again and its real status is returned. If Selcom has just said `COMPLETED` and the row is now `failed` (for example a parallel checkout gave up on it), it moves straight on to `review`.
   - **Earlier orders at checkout (M-b, then security-reviewer M1, 2026-11-07):**
     - (a) an earlier pending order is cancelled at Selcom only when Selcom's state is `PENDING` (or none). `INPROGRESS` or any other state: never cancelled; the traveller gets `pending_order` and waits.
     - (b) if Selcom refuses the cancel, Selcom is asked about the order again and the answer is recorded as for any check: `COMPLETED` becomes `paid` or `review`; `CANCELLED`, `EXPIRED` and the other failed states become `failed`; `PENDING` (or none) past our expiry becomes `failed`. Anything else stays `pending` and the traveller waits.
     - (c) before a new order, the 5 newest `failed` orders for the same offer or member from the last 3 days are checked with Selcom (without the sweeper's claim). One that is `COMPLETED` goes to `review` and the traveller gets `under_review`; no new order. An order Selcom does not know is skipped (it was never created there); no answer from Selcom gives `gateway_error` and no new order. Residual: a sixth or older failed order is covered only by the sweeper (6-hourly for 3 days) and reconciliation; that needs more than 5 failed attempts within 3 days, each at least 10 seconds apart.
     - The 24-hour rule still applies: an order unsettled for a day (for example `INPROGRESS`) is given up on, and (c) re-checks it before any new order.
   - **Checkout throttle (L2):** one checkout per offer or member every 10 seconds, claimed atomically in the database (`public.claim_deposit_checkout`, service role only). A second press within 10 seconds gets `pending_order`. Checkout's own Selcom checks are unclaimed (no per-order throttle); this limits them.
   - **Second payment for the same deposit (M2):** if Selcom took money on two orders, the second is held as `review` (refund), never `paid` twice; the database also has a unique index on paid rows per offer and per member.
   - **Logs on create-order errors (L4):** only the HTTP status and Selcom's `resultcode`, or one fixed reason (`timeout`, `network error`, `no payment page`, `payment page not allowed`, `payment page not base64`, `other error`).
   - **Payment page host allowlist (security-reviewer M-A, built 2026-11-07, not deployed):** the address Selcom returns is sent to the payer only if `isSelcomPaymentUrl` accepts it: `https://`, a host that is a subdomain of `selcommobile.com` or `selcom.net` (exact suffix match on whole labels, so `selcommobile.com.evil.com` and `evilselcommobile.com` are refused), no user name or password in the address, no port other than 443, no IP address, trailing dot, space, control or non-ASCII character or backslash, at most 2048 characters. Otherwise the payer gets `gateway_error`, nothing is redirected, the row becomes `failed` (the sweeper still re-checks it for 3 days) and the log says only `payment page not allowed`. The rule is in `packages/shared/src/payments.ts` (`SELCOM_PAYMENT_DOMAINS`, `isSelcomPaymentUrl`, with tests) for the website and the app to check again before redirecting, and copied into the function (Deno does not import the shared package; keep the two the same; on 2026-11-07 a script confirmed the two regular expressions are identical). **To verify in the sandbox:** Selcom's docs show the payment page only as `example.com`, so the real payment page host is not confirmed. Record the exact host from the first sandbox order (and the live one before switch-on) and narrow the allowlist to it.
   - **Signed text fields (L5):** `buyer_name` and `buyer_remarks` have `&`, `=` and control or invisible format characters replaced by spaces (the billing rule, but cleaned instead of refused). An account e-mail with such characters is not sent; Selcom gets `payments@kwetuly.com` instead.
   - **Webhook for an old failed order (L-a):** Selcom calls back only on success, so a webhook for a failed order older than 3 days is logged and checked once with Selcom (under the 45-second webhook claim). If it was paid, it goes to `review` and admins are alerted.
   - **Payer checks (L-d):** the return page and the app ask Selcom at most once every 5 seconds per order (`payments.payer_checked_at`, a column of its own, so a payer check never makes a webhook skip its call). Within 5 seconds they get the stored status.
   - **Webhook throttle (kept at one Selcom call per order per 45 seconds).** Decision: not raised to "a few per window". With the sweeper, a real webhook skipped because a forged one came first is picked up within about 3 minutes, and the payer's return page is never throttled. A counter would need another column and gives an attacker more Selcom calls per order, for no real gain.
   - **Residual:** an order whose status call keeps failing gets its claim back, so repeated forged webhooks for that one order can each trigger a Selcom call. This needs the order id, which is 122 random bits and is never shown to analytics (4.3); accepted as low.
3. **Webhook signature check:** add it once Selcom documents the method in writing. Until then the function keeps re-querying Selcom, which is safe. Already built (2026-11-07): order ids are `RAF` plus 32 random lower-case hex characters (unguessable; whether Selcom accepts 35 characters is **to verify**); the body is capped at 8 KB; the webhook, the payer status check and the web return page only accept an `order_id` matching `^RAF[0-9a-f]{32}$` (N4: payments were never switched on in any project, so no older-format ids can exist; each project is checked before switch-on, see section 6); a webhook asks Selcom about the same order at most once every 45 seconds (`payments.last_checked_at`); failed orders older than 3 days are not re-checked (reconciliation covers them); Selcom errors are logged as HTTP status, `resultcode` and `result` only; Selcom's amount is accepted only as a whole number of shillings, anything else holds a completed order for review.
4. **Cards (built, 2026-11-07):** `checkout/create-order` with billing fields and `payment_methods=CARD`, switched on by `SELCOM_CARDS=1` once Selcom confirms cards on the merchant account. See section 8.
5. **Deploy the new migrations `20261107000000_deposit_only_on_open_trips.sql` and `20261107000100_payments_sweeper.sql` to the test project only**, together with the function, with Walter's approval. **Apply order (L9):**
   1. check that pg_cron, pg_net and Vault (`supabase_vault`) are on (Database, Extensions); pg_cron and pg_net come from migrations `20261012000800` and `20261012001000`;
   2. `20261107000000` (columns, guards, `claim_deposit_checkout`, override function, unique paid indexes);
   3. `20261107000100` (it stops with a clear message, changing nothing, if an extension is missing or step 2 is not applied);
   4. deploy the payments function (it writes `pay_method`, `last_checked_at`, `payer_checked_at` and `status_source`, and calls `claim_deposit_checkout`; deployed earlier, every checkout fails);
   5. set the two Vault entries and `PAYMENTS_SWEEP_SECRET` (set-up steps are at the top of the sweeper migration).
6. **When a deposit can be started (decided by Walter 2026-11-07, built in the function and `private.guard_new_payment`):**
   - **Group trips:** only if the start date is at least 8 days after today (Tanzania date). The last day to pay is 8 days before the start, so no deposit is taken inside the 7-day no-refund window.
   - **Offers (option a):**
     - refused when the trip request is `closed` (an accepted offer makes it `booked`, which stays payable);
     - a request with a `start_date`: the same 8-day rule as group trips;
     - flexible or empty dates: allowed until the offer's `valid_until` (that day included), if the guide set one. A request with flexible dates and a start date must pass both checks.
   - The function answers `no_deposit` in every refused case, so older website and app builds hide the Pay box.
   - The 8 is one named constant in each place (`DEPOSIT_LAST_DAY_BEFORE_START`, `c_last_day_before_start`). Recommendation: keep it in code until the refund rule is final, then move it to `site_settings` so that function and guard read the same value.
   - **Residual:** an offer on an undated request with no `valid_until` can take a deposit at any time. It is still refused once the request is `closed`.
   - **Order expiry before the cut-off (L6):** the Selcom order's `expiry` is 60 minutes, or the whole minutes left until midnight Tanzania time at the end of the last day to pay (start date minus 8 days; for undated or flexible offers the end of `valid_until`), whichever is shorter. With less than 5 minutes left no order is made (`no_deposit`).
   - **Edge for legal (L6):** this relies on Selcom closing the order at the `expiry` we send (to verify in the sandbox). If Selcom completes a payment a few seconds after the expiry, that deposit lands just inside the 7-day window and is recorded as `paid` (the trip is still going ahead). Legal to say whether such a deposit must be refunded in full under the 7-day rule, or whether "order started before the cut-off" is enough. If it must be refunded, engineering can hold any payment Selcom reports after the cut-off as `review`. Travellers also lose the last 5 minutes of the last day.

### 4.3 Callbacks need a public URL
- The webhook goes to `${SUPABASE_URL}/functions/v1/payments`. A hosted Supabase test project is already public, so **no tunnel is needed** for the webhook.
- After paying, Selcom sends the payer's browser to `SITE_URL/{lang}/payments/return`. Use a **Vercel preview deployment** pointed at the test Supabase project. A `localhost` `SITE_URL` may work, because only the browser goes there, but Selcom may reject non-public redirect URLs (**to verify**).
- **Vercel preview environment variables point only at the test project.** The Supabase URL and anon key in Vercel's "Preview" environment are the test project's; the live project's values exist only in "Production". devops checks this before the first test, because by default a preview can inherit shared variables.
- **Previews are protected.** Turn on Vercel Deployment Protection for previews, so only Walter and the team can open them, and Selcom's redirect still lands for a signed-in tester. Whether the redirect works behind protection, or a protection-bypass link is needed for the tester's browser, is **to verify** during the first test.
- **No order id in analytics (N1e and M-c, 2026-11-07).** The return page address carries `?order=<order id>`. The website's PostHog set-up (`apps/web/src/lib/analytics.ts`) does four things:
  - **Nothing is sent from payment pages.** `before_send` drops every event whose page, `$current_url` or `$pathname` is under `/{lang}/payments/`.
  - **Everything else is cleaned.** On all other events, the query string and hash after any payment-page or Selcom address are cut, in values and keys and in nested objects and arrays too, such as web-vitals attribution (`redactUrlProps` and `redactText` in `packages/shared/src/analytics.ts`, with tests).
  - **PostHog's own masking is on:** `mask_personal_data_properties`, plus `order` as a custom personal-data parameter.
  - **No click capture:** heatmaps, dead clicks and rage clicks are off.

  The return page loads no other third-party script, and fonts are served by the site itself. The app has no return screen: it opens Selcom in the browser, then asks the function for the status, and its analytics records only screen paths without query strings.
- A local tunnel (for example `cloudflared` or `ngrok`) is only needed if the function itself runs locally. Installing one needs Walter's approval, because it opens a door to the laptop. Close it after each session.

## 5. How qa-tester tests end to end (test project, test accounts only)

Use only test accounts from `supabase/test-accounts.local.md`, sandbox keys and Selcom's sandbox numbers. Mask phone numbers in every report (`2557xx xxx 123`).

1. **Switched off:** with no secrets set, no Pay box appears anywhere (web and app).
2. **Offer deposit, happy path:** traveller accepts an offer with a 30% deposit from an approved, non-sample guide. The Pay box shows the USD amount. Pay with a sandbox wallet. The return page shows paid. Then check:
   - the row has status `paid`;
   - `amount_tzs` equals `provider_amount`;
   - `usd_tzs_rate` and `rate_source` are saved;
   - the receipt email and push arrive, and the guide and admins are alerted.
3. **Group deposit, happy path:** the same check for an accepted member of an approved group trip that starts exactly 8 days from today (Tanzania date), and one that starts later.
4. **Closed trips (deposit window rule):** no Pay box, and a forced checkout call answers `no_deposit`, for each of these:
   - a trip that starts 7 days from today (the boundary), tomorrow and today;
   - a trip that has started;
   - a cancelled trip;
   - a rejected trip;
   - a trip back in review (pending);
   - a declined or cancelled member;
   - a traveller-run group;
   - a sample guide's trip.
4a. **Offer deposits:** Pay box shown and payable for a `booked` request starting in 8 days or more, and for an undated request whose offer `valid_until` is today. `no_deposit` for: a `closed` request; a dated request starting in 7 days or less; an undated or flexible request whose `valid_until` was yesterday. Repeat each with a direct database insert as the service role: `guard_new_payment` refuses it with hint `kwetuly_deposit_guard`.
4b. **Cards (only once Selcom has switched cards on for the test merchant):** with `SELCOM_CARDS=1`, `config` lists `["mobile_money","card"]`. Pay by card with Selcom's sandbox card, after filling in the billing form. Check that the row has `pay_method = card` and `provider_channel` is a card channel, and that no billing address appears in the table or the function logs. Checkout with `method: "card"` and no or invalid billing data answers `billing_required`. With `SELCOM_CARDS` unset it answers `method_unavailable`. An old client that sends no `method` gets mobile money.
5. **Cancel at Selcom:** start a payment, then cancel on the Selcom page. Within about 3 minutes the sweeper marks the row `failed` (`status_source = sweeper`) and a new Pay attempt works.
5a. **Sweeper:**
   - start a payment and do nothing: after about 66 minutes the row is `failed`;
   - call the function with `{ "action": "sweep" }` and no header, a wrong header and a short secret: 403 each time, nothing changes;
   - with payments switched off: 503 and no Selcom call;
   - the answer has counts only, no order ids;
   - make the Selcom status call fail (for example a wrong test API key for one run): the row stays `pending`, `last_checked_at` is about one minute in the past, and a sweep about a minute later retries.
5c. **Checkout safety (M1, L2, L6):**
   - press Pay twice within 10 seconds: the second answers `pending_order`, and only one Selcom create-order call is made;
   - start a payment and approve it on the phone (`INPROGRESS`), then press Pay again: `pending_order`, the first order is not cancelled;
   - start a payment, let it expire, press Pay again: the old row is `failed`, a new order opens;
   - mark a paid sandbox order `failed` by hand in the test database, press Pay again: the old row moves to `review`, the answer is `under_review`, no new order;
   - a group trip starting 8 days from today, checkout at 23:30 Tanzania time: the order is sent with an expiry of about 30 minutes; at 23:57 the answer is `no_deposit`.
5b. **Mode guard:** for each wrong setting in 4.1 (no `KWETULY_ENV`, `KWETULY_ENV=Test`, `SELCOM_LIVE=true`, `SELCOM_LIVE=1` with `test`, `KWETULY_LIVE_PROJECT_REF` set to the test project's ref), `config` answers `enabled: false` and the start-up log names the reason. Never try `live` with real keys.
6. **Repeat and double click:** press Pay twice quickly. Only one pending order may exist, and the second gets `pending_order`. Resend the same webhook several times: still one `paid` row and one alert.
7. **Forged webhook:** POST `{ order_id }` for a pending order that was not paid. It must stay `pending`. POST an unknown order id, an id not starting with `RAF`, a non-string id and a body over 8 KB: nothing changes and no Selcom call is made (check the function logs). Send the same webhook 5 times within 45 seconds: one Selcom order-status call.
8. **Late payment:** start a payment, have the organiser cancel the trip, then pay. The row must end in `review`, not `paid`, admins are alerted, and the traveller gets the neutral "Your payment is being checked" email and push (no amount, no reason). Repeat with the guide's approval taken away between order and payment: also `review`.
9. **Amount mismatch:** if the sandbox allows paying a different amount, the row goes to `review`.
10. **Payout tick (section 10):** an admin can tick "paid out" on a `paid` row whose trip or offer is still going ahead, and `payout_by` and `payout_at` are filled in. Allowed: group trip approved, or back in review (`pending`) after an organiser's edit; a member who cancelled their own spot; an offer whose request the traveller closed. Refused with hint `kwetuly_payout_guard`:
    - a `pending`, `failed` or `review` row (also with an override);
    - a paid row whose group trip is cancelled or rejected (without an override);
    - try each once as an admin and once as the service role; both are refused.

    Override: `admin_payout_with_override` with an empty reason gives 22023; as a non-admin, or an admin without two-step sign-in, 42501; with a reason it ticks the row and fills `payout_override_reason`, `payout_override_by`, `payout_override_at` and a `private.payout_overrides` row. An admin writing the override columns directly changes nothing; the service role writing them directly is refused.
10a. **One paid row per deposit:** insert a second `pending` row as the service role for an offer that has a `paid` row: refused, hint `kwetuly_deposit_guard`. Pay two orders for the same deposit in the sandbox (if possible): one `paid`, one `review`.
11. **Reconciliation dry run:** export the day's sandbox transactions from Selcom (if the sandbox portal allows it) and match them one-to-one with `payments` rows by `order_id`, amount in TZS and reference.

## 6. What security-reviewer checks before any real money

- Live keys exist only in the live project's secrets. Test and live projects are separate, the test project holds no copy of live data, Vercel previews use only the test project and are protected.
- Mode guard from 4.1: the live project has exactly `KWETULY_ENV=live`, `SELCOM_LIVE=1` and `KWETULY_LIVE_PROJECT_REF=zsymxfommlxqqfywekuy`; the test project has `KWETULY_ENV=test` and `SELCOM_LIVE` unset or `0`. The start-up log of each shows the expected mode and gateway host and no "switched off" reason. The live ref in the code is still the live project.
- No old-format order ids: in every project, before payments are switched on there, `select count(*) from public.payments where order_id !~ '^RAF[0-9a-f]{32}$'` returns 0. If it does not, stop: the stricter check would hide those orders from the webhook and the return page.
- The sweeper runs: `cron.job` has `sweep-payments`, the Vault entries exist, each project has its own `PAYMENTS_SWEEP_SECRET`, `net._http_response` shows recent 200 answers, and the sweep entry answers 403 without the secret.
- PostHog receives no events at all from `/payments/` pages, and no event anywhere has `order=` or a Selcom query string in any property, nested ones included.
- Card orders: no billing address, card number or card token in any table or log; `buyer_userid` and `gateway_buyer_uuid` are never sent (no stored cards).
- The webhook signature is verified as Selcom documents it, and the re-query of order-status is kept.
- Money status changes only through the function's service role or the database guards. `guard_payment` and `guard_new_payment` are applied, and no insert policy exists for signed-in users.
- Nothing is processed twice (unique pending order, conditional updates), and every change records who and when.
- Logs contain no keys, phone numbers or full card data.
- CORS on the function is `*`. Confirm that is acceptable, since user actions need a token and the webhook trusts nothing.
- Alerts work, and someone is named to handle `review` rows.
- Legal sign-off on holding deposits (Bank of Tanzania question), the shilling rule, the surcharge ban, the deposit and refund policy, and travellers' terms. Do not use the words "escrow", "guaranteed" or "instant payout".
- Walter approves the live switch, the exchange-rate source and the refund process.

## 7. Decisions for Walter

1. May Walter email Selcom for sandbox access with the questions in section 3?
2. Separate Supabase test project or branch for sandbox testing (recommended), and who pays for it (a branch or second project may cost money; devops to quote).
3. The test exchange rate and its source.
4. Whether to install a local tunnel. It is not needed if we use a hosted test project with a Vercel preview.
5. Cards: decided (mobile money and cards at launch, 2026-11-07); built. Walter asks Selcom the questions in section 8.3.
6. Offer-deposit rule: decided (option a, with the 8-day rule for dated requests); built.
7. Applying the two new migrations and the function to the test project, and creating the sweeper secret there.
8. Whether the 8-day constant moves to `site_settings` (recommended once the refund rule is final).
9. The refund records plan in section 9 (build after Selcom's fee quote and the advocate's answer).
10. Payout guard (M3): decided as options 1 and 2 (trip-based guard plus admin override with a reason), as passed on by the coordinator on 2026-11-07; built (section 10). Declined member and payee still approved decided by Walter on 2026-11-07 and built (section 10.2); the closed-request choice is still for Walter to confirm.
11. The L6 edge in 4.2.6 (a payment completed just after the cut-off): for legal.

## 8. Cards (built 2026-11-07, switched off until Selcom confirms)

### 8.1 What Selcom documents (developers.selcommobile.com, read 2026-11-07)
- `create-order-minimal` "cannot be used for card payments"; the card option is not shown on Selcom's page.
- `POST /v1/checkout/create-order`:
  - **mandatory:** `vendor`, `order_id`, `buyer_email`, `buyer_name`, `buyer_phone`, `amount`, `currency` (TZS or USD), `payment_methods` (comma list of `ALL`, `MASTERPASS`, `CARD`, `MOBILEMONEYPULL`), `no_of_items`, and the billing fields `billing.firstname`, `billing.lastname`, `billing.address_1`, `billing.city`, `billing.state_or_region`, `billing.postcode_or_pobox`, `billing.country` (two-letter code) and `billing.phone`;
  - **optional:** `billing.address_2`, `shipping.*`, `buyer_userid`, `gateway_buyer_uuid` (stored cards), `redirect_url`, `cancel_url`, `webhook` (all base64), `expiry`, colours and remarks.
  - Selcom says card payments without billing information are rejected.
- Order status, cancel and webhook work as for mobile money. No webhook signature method, no 3-D Secure and no card currencies are documented.

### 8.2 What the code does
- `config` answers `methods`: `["mobile_money"]`, or `["mobile_money","card"]` when `SELCOM_CARDS=1`. Any other value of `SELCOM_CARDS` switches cards off (logged at start-up); mobile money keeps working.
- Checkout takes `method`. With no method it uses `mobile_money`, so older website and app builds keep working. `card` needs `billing`:
  - first name, last name, address line 1, city, region, postcode or PO box, and country (two letters); address line 2 is optional;
  - phone, name and email come from the account;
  - lengths and characters are checked, with no `&` or `=` (they would blur the signed string);
  - the billing details are sent to Selcom only, never stored or logged.
- Card orders are sent with `payment_methods=CARD`, as flat `billing.x` keys (as in Selcom's samples), in TZS. Not sent: `buyer_userid` and `gateway_buyer_uuid`, so Selcom does not store cards for us.
- The card number is typed only on Selcom's page. Kwetuly never sees, stores or logs card data.
- `payments.pay_method` records the choice (`mobile_money` or `card`). `provider_channel` records what Selcom actually used.
- Card and mobile money pay the same amount: no surcharge (Bank of Tanzania ban; for legal to confirm).
- **To verify in the sandbox:**
  - whether `billing.*` goes as flat keys or as a nested `billing` object, and how the keys appear in `Signed-Fields`;
  - whether `create-order` returns `payment_gateway_url` in base64 or as a plain address (the code accepts both, https only);
  - whether `CARD` alone shows Visa and Mastercard;
  - whether `payment_status` and `amount` for card orders match mobile money.

### 8.3 What Walter must ask Selcom (in writing)
1. Are cards (Visa, Mastercard) enabled on the merchant account, sandbox and live, and what does it cost to switch them on?
2. Is 3-D Secure (Visa Secure, Mastercard Identity Check) always on for checkout card payments? Who carries the loss on a chargeback?
3. Currencies: can a foreign card be charged in TZS, and can the merchant account also take USD? Who sets the exchange rate, and is there a cross-border fee?
4. Is a registered company (TIN, business licence, BRELA) required for card acceptance, and are there extra checks (for example a PCI self-assessment or a site review)?
5. Card fees: per payment, per refund or reversal, per chargeback. Is the collection fee returned when a payment is refunded?
6. How is a card payment refunded (to the same card only?), and how long does it take?
7. The exact format for `billing.*` in the request body and in `Signed-Fields`.
8. Which billing fields are really required for foreign cardholders (for example when a country has no postcode)?

## 9. Refund records: plan only, not built (Walter approved option A on 2026-11-07)

Source: `docs/business/deposit-refund-rule-2026-11.md`, section 5. The 7-day window is already handled: the 8-day deposit rule is built. Nothing below is built until Selcom's fee quote and the advocate's answer are in, and every refund still needs Walter's approval.

1. **Table `public.payment_refunds`** (one row per refund; more than one allowed per payment). Columns:
   - `payment_id`;
   - `case`: `traveller_cancel`, `organiser_cancel`, `force_majeure`, `min_not_reached`, `kwetuly_cancel`, `review_or_late`, `no_show`, `duplicate`;
   - `days_before_start` (Tanzania date), `tier`, `rule_version`;
   - the money parts, integer TSh: `refund_tzs`, `kwetuly_keeps_tzs`, `organiser_keeps_tzs`, with a check that they add up to the payment's `amount_tzs`;
   - recovery from the organiser: `fee_recoverable_tzs`, the actual Selcom fees, at most 10% of the deposit, and 0 for force majeure;
   - the refund itself: `method` (card reversal or wallet), `provider_reference`;
   - `status`: `requested`, `approved`, `sent`, `confirmed` or `failed`;
   - who and when: `requested_by`, `requested_at`, `approved_by`, `approved_at`, `sent_at`, `confirmed_at`, `reason`.

   Writes go through the service role or admin RPCs only, never from a page. Every state change is recorded with who and when.
2. **Saved on `payments` at checkout:** `refund_rule_version` and `refund_terms_ack_at` (the traveller ticked "I have read how refunds work"). The rule that applies is the one in force when the traveller paid.
3. **One split function** in `packages/shared` (`refundSplit`), using integers only, with a test for every table row, the cap in TSh, rounding down to TSh 100 in the traveller's favour, and parts that always add up. The tiers are 30 days or more: 90/0/10; 8 to 29 days: 40/50/10; 7 days or less, or no-show: 0/100/0; organiser, minimum, Kwetuly, review or duplicate: 100/0/0. Kwetuly's 10% never exceeds the refund. Undated requests count as 30 days or more.
4. **The same split in a database guard** on approval: an approved row whose amounts do not match the rule for its case and dates is refused.
5. **Cancellation reasons** for group trips and offers (organiser, minimum not reached, force majeure, Kwetuly), plus a traveller "cancel my spot" action with a timestamp. Before confirming, it shows the traveller what they will get back. These choose the case.
6. **Payout guard, extended:**
   - refuse "paid out" while a refund is `requested`, `approved` or `sent`;
   - refuse it while a card dispute is open (a new `disputed` state, which alerts admins);
   - after a split refund, allow paying out only `organiser_keeps_tzs`, minus any recovery owed. This needs a `payouts` record with an amount, instead of the current yes/no tick.
7. **Recovery ledger:** what an organiser owes Kwetuly in actual fees, deducted in the planned payouts flow with Walter's approval.
8. **Receipts:** the refund email and push show the three parts and the reason, in TSh, with phone and account numbers masked.
9. **Payout guard hook:** `private.payment_refund_open(payment_id)` returns false today (no refund records). Once `payment_refunds` exists it must return true while a refund is `requested`, `approved`, `sent` or `confirmed`; the guard already refuses a payout then, and the admin override cannot bypass it.
10. **Un-ticking "paid out" (security-reviewer L8):** today an admin can un-tick a paid-out deposit at any time (to fix a mistake), and only the last change is kept in `payout_by` / `payout_at`. With the refund records: refuse un-ticking once a payout record with a Selcom or bank reference exists, keep every tick and un-tick in an append-only log, and refuse a refund on a paid-out deposit unless the recovery from the organiser is recorded.
11. **Reconciliation:** each refund is matched with Selcom's refund or reversal record by `provider_reference` and amount.

## 10. Payout guard and admin override (M3, built 2026-11-07, not applied)

### 10.1 The rule (`private.guard_payout`, every role, service role included)
- **Never overridable:** the deposit must be `paid`; no refund may be recorded or open (`private.payment_refund_open`, a hook that returns false until the refund records exist).
- **Group deposits, trip:** the trip is not cancelled and its status is `approved` or `pending`. Why `pending` is accepted instead of storing "approved at payment": an organiser's edit sends an approved trip back to review (`pending`), and a deposit can only become `paid` while the trip was approved (the payments function checks this when Selcom reports the payment; otherwise it is held as `review`). So `paid` already records that the trip was approved when paid, and no extra column is needed. `rejected` (taken down by an admin) and cancelled trips are refused.
- **Group deposits, member (Walter, 2026-11-07):** refused when the member is `declined` (the organiser declined a traveller who had already paid; a refund case). A traveller's own `cancelled` does not block the payout; the refund rule and refund records decide what they get back.
- **Offer deposits:** the offer is `accepted` (accepted offers cannot change). The request's status is not checked: there is no "cancelled" request state, and `closed` is the traveller's own open/closed switch, which may just mean "found my guide".
- **Payee still approved, both kinds (Walter, 2026-11-07):** the person being paid (`payments.payee_user_id`) must still pass the same test as when the deposit was created (`guard_new_payment`): if the trip or offer has `guide_id`, that guide is `verification_status = 'approved'`, not `is_sample`, and `owner_id` = payee; if `guide_id` is null, the payee owns at least one provider that is `approved` and not `is_sample`.
- **Refusal:** `P0001`, hint `kwetuly_payout_guard`, message starting `payout_not_allowed:`. For these three checks the error's `details` lists every check that refused, comma-separated: `trip`, `member_declined`, `payee_not_approved`.
- **Admin override:** when the trip, member or payee check refuses, an admin can still tick "paid out" with a reason. Who, when and the reason are stored on the row and, append-only, in `private.payout_overrides`.
- **`payout_override_by` has no foreign key (security-reviewer L-A):** a bare uuid. An `on delete set null` would be an update that the guard refuses, so deleting an admin account would fail. The id stays as a record after the account is gone (as `overridden_by` in `private.payout_overrides`).
- **`private.payout_overrides` is append-only (L-B):** triggers refuse every update, delete and truncate, for every role including the owner (only a superuser switching triggers off could get round it). No role has any grant on it, the service role included; rows are added only by `public.admin_payout_with_override`. A wrong entry is corrected by a new override, never by changing the old one.

### 10.2 Decisions (security-reviewer L-D)
1. Offers: a request the traveller set to `closed` does not block the payout (as for a member who cancels their own spot). For Walter to confirm.
2. Members: **decided by Walter, 2026-11-07; built (not applied).** "Paid out" is refused when the organiser declined a member who had already paid (`declined`). A traveller's own `cancelled` does not block it. The admin override with a reason can get past it.
3. Payee still approved: **decided by Walter, 2026-11-07; built (not applied).** "Paid out" is refused when the guide or business being paid is no longer approved or is now a sample (same test as on deposit creation, section 10.1). The admin override with a reason can get past it.

`paid` status and "no refund open" stay non-overridable.

### 10.2a What the admin page must mirror (`stoppedDeposits`)
The page must show a deposit as stopped exactly when the database would refuse the tick. For a payment `p` with `payout_done = false`:
- Not payable at all (no tick, no override): `p.status <> 'paid'` (and, later, a refund open).
- Stopped (tick refused; override offered) when any of these:
  - `group_deposit`: `group_trips.cancelled` is true or `group_trips.status` not in (`approved`, `pending`), via `group_trip_members.group_trip_id`;
  - `group_deposit`: `group_trip_members.status = 'declined'`;
  - `offer_deposit`: `trip_offers.status <> 'accepted'`;
  - payee: let `gid` = `group_trips.guide_id` (group) or `trip_offers.guide_id` (offer). If `gid` is set: stopped unless `guides` row `gid` has `owner_id = p.payee_user_id`, `verification_status = 'approved'`, `is_sample = false`. If `gid` is null: stopped unless some `providers` row has `owner_id = p.payee_user_id`, `verification_status = 'approved'`, `is_sample = false`.
  - an unknown kind, or a missing member, trip or offer row.
- Reads: `payments` (`id, kind, status, payout_done, payee_user_id, group_member_id, trip_offer_id`), `group_trip_members` (`id, group_trip_id, status`), `group_trips` (`id, status, cancelled, guide_id`), `trip_offers` (`id, status, guide_id`), `guides` (`id, owner_id, verification_status, is_sample`), `providers` (`owner_id, verification_status, is_sample`). The admin's reads must not be filtered by row level security in a way that hides non-approved guides or providers, or the page would wrongly show them as stopped/approved.
- The database stays the authority: the page only decides what to show; the error `details` (`trip`, `member_declined`, `payee_not_approved`) says which check refused.

### 10.3 API for the admin page (frontend-engineer)
- Normal tick, unchanged: `update payments set payout_done = true|false where id = ...` (the existing call in the admin `actions.ts`). On refusal Supabase returns `error.code = 'P0001'`, `error.hint = 'kwetuly_payout_guard'` and a message starting `payout_not_allowed:`.
- Override, offered only after a tick refused with that hint: `supabase.rpc('admin_payout_with_override', { p_payment_id: <uuid>, p_reason: <text> })`, signed in as an admin with two-step sign-in. Returns nothing on success.
  - `p_reason`: 1 to 500 characters after trimming; control characters become spaces.
  - Errors: `42501` = not an admin, or no two-step sign-in; `22023` = reason empty or too long; `P0001` + `kwetuly_payout_guard` = not paid, refund open, unknown deposit or already paid out.
- New columns to show next to `payout_by` / `payout_at`: `payout_override_reason`, `payout_override_by`, `payout_override_at`.
- Admin texts in English and Kiswahili. Suggested (for localization to check): label "Reason for paying out anyway" / "Sababu ya kulipa hata hivyo"; button "Mark paid out with this reason" / "Weka kuwa imelipwa kwa sababu hii"; hint "The trip check refused this payout. Write why it is right to pay the organiser." / "Ukaguzi wa safari umekataa malipo haya. Andika kwa nini ni sahihi kumlipa mratibu."

## The flow, the risks, the checks run and what needs Walter's approval

- **Flow (sandbox deposit):**
  1. The traveller presses Pay.
  2. The function checks the rule (8-day window, offer rule) and creates a `pending` row with TZS, the rate and its source. The database guard re-checks the rule on insert.
  3. Selcom checkout runs and the traveller pays from a sandbox wallet, or by sandbox card once cards are on.
  4. The webhook fires (success only), or the return page or sweeper polls.
  5. The function queries order-status. The row becomes `paid` if the amount and trip match, `review` if not, or `failed`.
  6. Alerts go out.
  7. Later, an admin payout needs Walter's approval; the database refuses it on unpaid deposits, open refunds, and cancelled or taken-down trips, unless an admin records an override with a reason (never for unpaid deposits or open refunds).
- **Risks:**
  - test keys are not issued without a registered company;
  - the sandbox URL in the code is wrong;
  - the webhook is blocked by JWT verification;
  - the sweeper's expiry rules guess Selcom's order lifetime (to verify);
  - undated offers without `valid_until` stay payable until the request is closed;
  - the webhook signature method is unknown;
  - the card request format (flat or nested `billing`) and card enablement are to verify;
  - the fixed exchange rate;
  - test rows would land in the live database if the live project were used;
  - Selcom may not close an order exactly at the expiry we send (L6 edge, for legal);
  - the override is only as good as the reason an admin writes; a payee approved again after a suspension passes the payee check without anyone looking (section 10.2);
  - the payment page host allowlist uses Selcom's two domains until the sandbox shows the exact host; a Selcom page on another domain would make every checkout fail with `gateway_error` (safe, but payments would not work until the list is updated).
- **Checks run:**
  - read the function, the payment migrations, the web and app deposit code, `.env.example` and the docs;
  - read developers.selcommobile.com and selcom.net;
  - shared tests, the function type check with stubs, and web and app type checks (2026-11-07);
  - after M-A, L-A and L-B (2026-11-07): shared tests (119 passing, 7 for `isSelcomPaymentUrl`), shared type check, the function type check with stubs, and a check that the function's copy of the URL rule matches the shared one; the migration was not run against any database;
  - nothing was run against Selcom or any database.
- **Needs Walter's approval:** every item in section 7, any Selcom contact, any merchant agreement, the live switch, every refund or payout, every payout override, and the closed-request choice in section 10.2.
