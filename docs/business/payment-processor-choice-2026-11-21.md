# Payment processor choice: PesaPal, Flutterwave or AzamPay (2026-11-21)

Prepared by payments-engineer for Walter. Research only: no sign-ups, no accounts, no contact with any provider, no code or database changes, nothing committed.

Background: on 2026-11-21 Walter parked Selcom and left commit `26a75bd` (branch `claude/charming-thompson-d68fb2`) unmerged. He wants card and mobile money payments that actually work, from PesaPal, Flutterwave or AzamPay, judged on:

1. No setup fee, no upfront deposit, no minimum prepayment.
2. The best East African mobile money: M-Pesa, Airtel Money, Mixx by Yas (Tigo), HaloPesa in Tanzania. Kenya and Uganda are a plus.
3. Trusted by international travellers: Visa and Mastercard from abroad with 3-D Secure. Apple Pay and Google Pay are a plus.

## How to read the sources

- **[Official]**: read today on the provider's own page, or on a Bank of Tanzania (BoT) document.
- **[Official, excerpt]**: an official page that search engines show, but that would not open for me today. Flutterwave's developer site is being moved to new addresses and most of its pages returned "not found". Check these in the sandbox.
- **[Secondary]**: a news, review or comparison site. Not proof.
- **[Unverified]**: I found no source. Ask the provider in writing.

None of the three publishes a setup fee, a reserve or contract terms that I could read. "Not stated" does not mean "free". Every money term below needs written confirmation before anyone signs.

## 1. Side-by-side comparison

| Criterion | Flutterwave | PesaPal | AzamPay |
| --- | --- | --- | --- |
| **Setup or monthly fee** | Not on the Tanzania pricing page [Official]. "No setup fee" is unverified. | Not stated [Official]. One review site says signup and monthly are free [Secondary]. | Not stated [Unverified]. |
| **Advance, reserve or minimum** | Not stated. A reserve clause would be in the merchant agreement, which I could not read [Unverified]. | Not stated [Unverified]. | Not stated [Unverified]. |
| **Local mobile money fee** | 2.5% per payment, VAT not included [Official]. | Not published. Review sites say 1.5% to 3.5% [Secondary]. | Not published [Unverified]. |
| **Local card fee** | 4.8% per payment, VAT not included [Official]. | Not published (see above) [Secondary]. | Not published [Unverified]. |
| **International card fee** | 4.8% per payment, VAT not included. Charged and settled in TZS by default [Official]. | Not published [Unverified]. | Not published. Card support is a group-website claim only [Official, corporate page]. |
| **Who pays the fee** | The customer by default; the merchant can change this in the dashboard [Official]. Kwetuly must switch it to merchant-pays (see risk R3). | [Unverified] | [Unverified] |
| **Settlement timing** | Local payments the next day. International payments "vary by region" [Official]. | Card terminals settle to any bank the next day. Online invoices "within minutes". Online checkout settlement is not stated [Official]. | [Unverified] |
| **TZS / USD settlement** | International cards settle in TZS by default [Official]. USD settlement is not stated for Tanzania [Unverified]. | Orders can be in any ISO currency [Official]. Settlement currency is not stated [Unverified]. | TZS only (WordPress plugin readme) [Official, plugin]. |
| **Refund API** | Yes. Full or partial; a partial refund comes out of the available balance. Cards take about 3 to 15 days, mobile money about 3 to 5 [Official, excerpt]. | Yes, after the merchant approves. Cards full or partial; **mobile money full only**; **one refund per payment**; same currency, back to the same card or wallet [Official]. | No refund endpoint found [Unverified]. |
| **Chargebacks** | API to list, accept or decline, with proof upload. Flutterwave's own pages give different reply times (10/30 working hours, or 48 hours). With no reply, the money is taken [Official, excerpt]. Fee not stated. | Not documented [Unverified]. | Not documented [Unverified]. |
| **Webhook signing** | Yes. Current docs: `flutterwave-signature` header, HMAC-SHA256 of the raw body with the secret hash, base64 [Official]. Older v3 docs: `verif-hash` header equal to the secret hash [Official]. Both say: re-check the transaction before giving value; make processing safe to repeat; retries 3 times, 30 minutes apart, if switched on [Official]. | **No signature.** The IPN (payment notice) only carries the tracking ID; you must then call GetTransactionStatus [Official]. | Not documented. One third-party billing guide says callbacks carry a password in the body [Secondary]. |
| **Sandbox without a registered company** | Test mode is in the dashboard and needs a free Flutterwave sign-up. The docs do not say registration is needed for test mode [Official]. Walter would do the sign-up. | **Yes, no sign-up.** Public demo merchant keys for Tanzania, Kenya, Uganda and 4 more countries; sandbox host `cybqa.pesapal.com` [Official]. | Self-registration on the sandbox developer portal [Official, plugin readme]. |
| **Live KYC (account checks)** | Tanzania list not published [Unverified]. Payouts to Tanzania only for businesses registered in Tanzania with the account country set to Tanzania [Official, excerpt]. | Published (February 2025). **A sole trader can open one**: ID or passport, business permit or certificate, business registration, TRA TIN, bank letter or statement. Limited company: certificate of incorporation, memorandum and articles, company TIN, board resolution, directors' IDs and TINs, ownership form [Official, blog]. | "Submit KYCs to get live credentials"; no list [Official, plugin readme]. |
| **Payouts to guides by mobile money** | Yes, by API. Tanzania published fees: **TZS 500** per mobile money transfer under TZS 40,000; **1.5%** at TZS 40,000 and above; **TZS 3,000** per bank transfer [Official]. TZ-registered business only [Official, excerpt]. | Not in the API 3.0 docs [Unverified]. | Yes: "Collect & Disburse" API [Official, corporate page]. Fees not published. |
| **Recurring billing** | Payment plans (daily to yearly), **cards only** [Official, excerpt]. | Visa and Mastercard only. The customer must opt in on PesaPal's page; daily, weekly, monthly or yearly [Official]. | "Recurring payment model" for cards (group website) [Official, corporate page]; no API docs. |
| **Tanzania mobile money networks** | Airtel, Tigo (Mixx), HaloPesa, Vodacom M-Pesa ("Vodafone"); USSD push in TZS [Official, excerpt]. | Mixx by Yas, Vodacom, Airtel Money [Official]. HaloPesa not listed [Unverified]. | Airtel, Tigo, HaloPesa, AzamPesa, M-Pesa [Official, plugin readme; Secondary SDK]. |
| **Kenya and Uganda** | Kenya M-Pesa (KES); Uganda MTN and Airtel (UGX) [Official, excerpt]. | Demo merchants for Kenya, Uganda, Tanzania, Malawi, Rwanda, Zambia, Zimbabwe [Official]. | Tanzania only [Official, plugin readme]. |
| **3-D Secure** | Card 3DS flow documented [Official, excerpt]. | On by default since API 3 [Official, blog]. | [Unverified] |
| **Apple Pay / Google Pay** | Apple Pay documented: live account, switched on in the dashboard, Safari only. Google Pay announced in 2022. Tanzania availability is unconfirmed [Official, excerpt; Secondary]. | Online: none found. Only 2019 tap-to-pay terminals [Secondary]. | None found. |
| **Website (Next.js)** | Hosted checkout ("Standard"): the server creates a payment link, then we redirect. Same shape as our Selcom code. | Hosted page by redirect or iframe; same shape. | Mobile money push by direct API; a hosted payment link exists in community SDKs [Secondary]. Card page not documented. |
| **App (Expo)** | The same hosted link in `expo-web-browser`, as today. A React Native SDK exists; its maintenance status is unverified. | The same hosted link in `expo-web-browser`. | Direct API from our server; nothing needed on the phone. |
| **Bank of Tanzania status** | "Flutter Technology Limited" is on the BoT list of licensed non-bank payment system providers [Official, BoT NPS Annual Report 2022, annex 6.5]. Matching that name to Flutterwave is my reading [Unverified]. A March 2022 approval was reported [Secondary]. | "Pesapal Tanzania Limited" is on the same BoT list [Official]. PesaPal says it holds a Digital Payment Systems Provider licence (2022) [Official, blog]. "Regulated by the Bank of Tanzania" [Official]. | "Azampay Tanzania Limited" is on the same BoT list [Official]. |
| **Reputation in Tanzania** | In Tanzania since 2022; a pan-African brand that foreign card issuers know. It had regulatory and press trouble in Kenya and Nigeria in 2022 and 2023 [Secondary; not re-checked today]. | Long-standing East African gateway, widely used by Tanzanian hotels and schools [Secondary]. | Bakhresa Group (Azam). Strong locally, but little known abroad [Secondary]. |

The BoT list is from the 2022 report (published 2024). The 2025 report says 72 non-bank providers are licensed [Secondary, search excerpt]; I could not open its annex. Licences last 5 years [Secondary]. Ask each provider for its current licence number and expiry date.

### What the fees mean in money (Flutterwave, published rates)

These are the published percentages plus 18% VAT on the fee. Whether VAT applies to the fee is my assumption; accounting must confirm it.

| Deposit | Card at 4.8% + VAT (5.664%) | Mobile money at 2.5% + VAT (2.95%) |
| --- | --- | --- |
| TZS 260,000 (about USD 100) | TZS 14,726.40 | TZS 7,670 |
| TZS 780,000 (about USD 300) | TZS 44,179.20 | TZS 23,010 |

Payout to a guide of TZS 780,000 by mobile money: 1.5% = TZS 11,700 (plus VAT if it applies).

PesaPal and AzamPay rates are unknown until they quote.

## 2. Recommendation

**Choose Flutterwave, with conditions.** Of the three, it is the only one that meets all three of Walter's criteria on paper, and the only one with published Tanzanian prices.

Reasons:

1. **It covers all four Tanzanian networks**, including HaloPesa, plus Kenya M-Pesa and Uganda MTN and Airtel. That meets the East Africa criterion.
2. **It is the most trusted for international cards**: Visa, Mastercard and AmEx with 3DS, Apple Pay documented, and a brand foreign banks know.
3. **Its prices are published**: 2.5% mobile money, 4.8% cards, fixed payout fees. Walter can see the cost before anyone signs, and the published page lists no setup or monthly fee.
4. **It has the safest notifications.** They are signed (HMAC), retried, and the docs tell us to re-check every payment. Our code already never trusts the message body.
5. **It has everything for later in one place**: partial refunds (including mobile money), a chargeback API, and payouts to guides by mobile money (TZS 500 under TZS 40,000).
6. **The code change is small.** Its hosted checkout has the same shape as the Selcom code: create a link on the server, redirect, re-check on return and on the webhook.

Conditions before going live (Walter asks in writing):

- No setup fee, no reserve or rolling reserve, no minimum volume.
- The card rate for Tanzania. 4.8% is high, so ask for a lower rate.
- The merchant pays the fees, not the traveller.
- Whether Apple Pay and Google Pay work on a Tanzanian account.
- Settlement in TZS to a Tanzanian bank, and when.
- The current BoT licence number of its Tanzanian company.
- What a company that is not yet registered can do: sandbox only, or more.

**Runner-up: PesaPal.**

- It is BoT-licensed, East African, and uses 3DS by default.
- Its public sandbox needs no sign-up, so we can build and test against it today.
- Its document list is published and allows a sole trader.

It loses on these points:

- No published prices.
- Unsigned notifications. These are safe only because we re-query.
- Mobile money refunds in full only, and only one refund per payment. Our "who causes it pays" rule needs partial refunds.
- No payout API.
- HaloPesa is not listed.
- No online Apple Pay or Google Pay.

If PesaPal quotes cards clearly below Flutterwave with no setup fee or reserve, look at it again.

**AzamPay is not recommended for now.** It is excellent for local mobile money and is BoT-listed, but its card payments and refunds are not documented and it is Tanzania-only. It fails the international criterion. It could be a later second provider for local mobile money.

**Monthly or yearly paid verification for porters, guides and chefs.** None of the three offers recurring mobile money billing; all recurring products are cards only. Most crew will pay by mobile money. Build it as a **new one-off payment each period**, with reminders and a grace period, not as a stored card or a stored credit balance. This also avoids holding customer money for later. Legal must still check that.

## 3. What changes to swap Selcom for Flutterwave

### Keep as it is (provider-agnostic)

- **The `payments` table and its states** `pending`, `paid`, `failed`, `review`.
- **The one-pending-order-per-deposit indexes:** `payments_one_pending_offer` and `payments_one_pending_member`.
- **`guard_payment()`:** admins may only tick "paid out", only on a paid deposit, with `payout_by` and `payout_at` recorded.
- **The alert triggers:** `on_payment_paid` and `on_payment_review`, with no phone numbers in the payload.
- **The price saved on the member row:** `snapshot_member_price`.
- **In `supabase/functions/payments/index.ts`:**
  - `loadOrder`, `offererApproved`, `settledError`, `check`;
  - the integer USD-cents to TZS maths, with `usd_tzs_rate` and `rate_source`;
  - the rule "paid only when the provider reports exactly our TZS amount, otherwise `review`";
  - the rule "a failed order that turns out paid goes to `review`".
- **On the website:** the return page asks the server for the result and never trusts the URL; the Pay box hides itself (`depositPayable`, `PayDeposit`); `startPayment` only follows `https://` links.
- **In the app:** `pay-deposit.tsx` opens the hosted page in `expo-web-browser`, then asks for the status.

### Change

1. **`supabase/functions/payments/index.ts`**
   - Replace `selcom()` request signing with a Flutterwave client using a bearer secret key. The current docs are moving to "v4" with client-credential tokens; confirm which version the sandbox account gets.
   - `checkout`: replace `checkout/create-order-minimal` with a hosted-checkout payment.
     - Our `order_id` becomes `tx_ref`.
     - Amount in TZS, `currency: 'TZS'`.
     - `payment_options` set to card and Tanzanian mobile money.
     - Redirect URL: the existing return page.
     - Send the link host through an allowlist (`checkout.flutterwave.com`, to confirm).
   - `refresh`: replace `checkout/order-status` with "verify by reference" (`tx_ref`). Map `successful` to the paid check, and `failed` or `cancelled` to `failed`. Keep the exact-amount and currency check against `amount_tzs`.
     - Save the Flutterwave transaction ID, the fee and the settled amount in their own columns.
   - Webhook:
     - Detect it by its signature header, not by "no action plus an order_id".
     - Check `flutterwave-signature` with a constant-time compare. Reject with 401 if it is missing or wrong.
     - Then call `refresh` as today, so repeats are harmless.
     - The webhook URL is set once in the dashboard; Flutterwave has no per-order URL as Selcom had.
   - Cancelling an earlier open order: Flutterwave's hosted link may have no cancel call [Unverified].
     - Instead, reuse the open link while it is fresh, or let it lapse.
     - Rely on the existing rule that a late payment on a `failed` row goes to `review`.
     - Add a scheduled sweep that re-checks `pending` rows every hour, as Flutterwave advises. Commit `26a75bd` already has a sweeper design worth reusing.
   - `selcomPhone` and `phone_required`: a phone number is needed only for direct mobile money, not for hosted card checkout. Keep it optional and format it as `255…`.
   - Secrets: `FLW_SECRET_KEY` and `FLW_WEBHOOK_SECRET_HASH` replace the `SELCOM_*` secrets. Test keys only until Walter approves live.
2. **A new migration**. The old files stay unchanged.
   - New columns:
     - `payments.provider` (`'selcom'|'flutterwave'`, default `'flutterwave'` for new rows);
     - `provider_transaction_id`;
     - `provider_fee` numeric(14,2) and `provider_fee_currency`;
     - `provider_settled_amount` with its currency.
   - A `payment_events` table: provider, event ID, `tx_ref`, received time, signature valid yes/no, and the raw body with phone and card fields masked. Unique on (provider, event ID). This gives an audit trail of every callback.
   - Update the column comments that say "Selcom".
3. **Website**
   - `apps/web/src/lib/payments.ts`, `apps/web/src/app/[lang]/payments/actions.ts`, `apps/web/src/app/[lang]/payments/return/page.tsx`: comments; keep the `RAF…` order format or widen the regex.
   - `apps/web/src/app/[lang]/admin/all/page.tsx` and `apps/web/src/app/[lang]/admin/page.tsx`: "check with Selcom" becomes "check in the Flutterwave dashboard".
   - `apps/web/src/lib/requests.ts`, `apps/web/src/app/[lang]/hub/page.tsx`, `apps/web/src/lib/concierge-prompt.ts`: wording.
   - `apps/web/src/app/[lang]/privacy/page.tsx`: the processor list. Legal to update `docs/legal/privacy-policy.md` too.
4. **App**: comments in `apps/mobile/src/lib/api-requests.ts` and `apps/mobile/src/components/pay-deposit.tsx`. The flow itself does not change.
5. **`supabase/functions/notify/index.ts`**: the English and Kiswahili deposit and review texts name Selcom. Make them provider-neutral.
6. **`packages/shared/src/dictionaries/*.ts`** (all 7 languages): `payments.body`, `reviewNote` and `pendingOrder` name Selcom and the networks. Localization to redo them, with "charged in TSh, your bank may use its own rate".
7. **Docs**: `docs/legal/deposit-and-refund-policy.md` and the board. Decision 45 in `docs/team/decisions-2026-11-21.md` ("stay with Selcom") is now overtaken.

Commit `26a75bd` stays unmerged. These provider-agnostic parts of it could be ported later, if Walter agrees:

- the 8-day cut-off;
- double-charge and late-payment protection;
- the pending-order sweeper;
- the payout guard with reasons;
- analytics switched off on payment pages.

Its Selcom billing form and Selcom page allowlist would be replaced.

## 4. Plain-English summary for Walter

1. Pick Flutterwave. It takes Visa and Mastercard from abroad and all four Tanzanian mobile money networks, plus Kenya and Uganda.
2. It is the only one of the three that publishes its prices: 2.5% for mobile money and 4.8% for cards, plus VAT. Cards are expensive, so ask for a lower rate.
3. Its price page shows no setup or monthly fee, but get "no setup fee, no reserve, no minimum" in writing before you sign.
4. It can later pay guides by mobile money: TZS 500 per transfer under TZS 40,000.
5. PesaPal is the backup. It is local and trusted, but its prices are hidden, its refunds are weaker, and it cannot pay guides by API.
6. AzamPay is good for local mobile money, but its card payments for foreign travellers are not documented.
7. All three appear on the Bank of Tanzania's list of licensed payment companies (2022 list). Ask each for its current licence.
8. Paid monthly or yearly checks for crew: send a new payment request each period; no provider bills mobile money automatically.
9. Our safety rules stay as they are; only the part that talks to the provider changes.
10. Nothing is signed or created. You open the account yourself (steps below).

## 5. Steps Walter takes himself

These are for Flutterwave. If you also want a PesaPal quote, ask them the same questions at the same time.

1. **Sandbox first (no company needed, as far as the docs say):**
   - Sign up yourself at flutterwave.com with country set to **Tanzania**.
   - Stay in test mode.
   - Do not enter bank details yet.
   - Tell payments-engineer when it is done. The test keys go only into the Supabase test project's secrets, which you or devops enter. Never send them by chat or email.
2. **Ask Flutterwave in writing** (email from the company address):
   - Setup fee, monthly fee, reserve or rolling reserve, minimum volume.
   - The card rate for a Tanzanian travel platform, and any discount.
   - Chargeback fee and reply time.
   - Refund fees.
   - Whether Apple Pay and Google Pay work on a Tanzanian account.
   - Settlement currency (TZS and USD), bank and timing.
   - Mobile money payouts for a Tanzanian account.
   - The BoT licence number and expiry for its Tanzanian company.
   - The full go-live document list.
   - Whether a sole trader or a company still being registered can go live.
3. **Prepare these documents** for live use. Flutterwave does not publish a Tanzania list, so this list follows PesaPal's published Tanzanian one and is what Tanzanian gateways normally ask for:
   - certificate of incorporation (BRELA) and memorandum and articles;
   - company TIN certificate (TRA) and, if registered, a VAT certificate;
   - business licence covering online travel or tourism services;
   - a board resolution allowing the company to open the account;
   - IDs or passports and TINs of each director, and a beneficial ownership declaration;
   - a bank letter or statement for a **company** bank account in Tanzania;
   - proof of address;
   - website terms, privacy policy, and the deposit and refund policy (live on kwetuly.com);
   - a contact email and phone on the company's own domain.
4. **Before going live**, the advocate confirms:
   - that collecting deposits and paying guides later does not count as holding customer money needing BoT approval;
   - the TZS pricing rule;
   - the ban on card surcharges.
5. **Then you approve:** the live switch, the payout account, and who may refund. Nothing goes live without your yes.

## Flow, risks, checks, approvals

**Flow (deposit, after the swap):**

1. The traveller presses Pay.
2. The server checks the offer or the member row.
3. The server creates one `pending` row: exact TZS amount, rate and rate source.
4. The server creates a Flutterwave hosted link and redirects the traveller.
5. The traveller pays by card with 3DS, or by mobile money push.
6. The signed webhook or the return page triggers a server re-check by `tx_ref`. The row becomes `paid` only if the amount and currency are exactly ours; otherwise it becomes `review`; a cancelled or failed payment becomes `failed`.
7. A paid row alerts the guide, the traveller and the admins.
8. An admin pays out and ticks the row (who and when are recorded).
9. Reconciliation: match each day's `paid` rows against Flutterwave's transaction and settlement export, by `tx_ref` and amount.

**Risks:**

- R1: setup fee or reserve terms are unknown until written.
- R2: the 4.8% card cost.
- R3: Flutterwave defaults to "customer pays the fee". That may clash with the BoT surcharge ban, so switch it to merchant-pays.
- R4: whether an unregistered company can go live.
- R5: Flutterwave's docs disagree on chargeback deadlines.
- R6: there may be no cancel call for open links, so late payments are possible. These are handled by `review` and the sweeper.
- R7: holding deposits before payout may need BoT approval (legal).
- R8: the "Flutter Technology Limited" licence match is unconfirmed.
- R9: Flutterwave's API is moving from v3 to v4.

**Checks actually run:**

- Read the current payment code: the Edge Function, 4 payment migrations, the web lib, action, return page and Pay box, the mobile checkout, and the notify texts.
- Read official pages: Flutterwave TZ pricing, Flutterwave webhooks, PesaPal TZ page, PesaPal refund, recurring, order, status, IPN and demo-keys pages, PesaPal KYC blog, PesaPal licence blog, the AzamPay group page and plugin readme.
- Extracted the BoT NPS 2022 annex.
- Several Flutterwave doc pages and the AzamPay developer portal would not open; those items are marked.
- No code, typecheck or tests run: no code changed.

**Needs Walter's approval:**

- the choice of provider;
- signing up and any account;
- live keys and the live switch;
- the payout (settlement) account;
- the fee bearer setting;
- who may issue refunds;
- porting any part of `26a75bd`;
- sending the legal questions to the advocate.

## Sources (read 2026-11-21)

- Flutterwave Tanzania pricing: https://flutterwave.com/tz/pricing [Official]
- Flutterwave webhooks (v4): https://developer.flutterwave.com/v4/docs/webhooks and https://developer.flutterwave.com/docs/webhooks [Official]
- Flutterwave refunds, chargebacks, payment plans, Tanzania mobile money, Tanzanian transfers, Apple Pay: developer.flutterwave.com pages shown in search excerpts; pages returned "not found" today [Official, excerpt]
- PesaPal Tanzania: https://www.pesapal.com/tz [Official]
- PesaPal refund: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/refund-request [Official]
- PesaPal recurring: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/recurringpayments [Official]
- PesaPal IPN: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl [Official]
- PesaPal status: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus [Official]
- PesaPal order and sandbox: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest and https://developer.pesapal.com/api3-demo-keys.txt [Official]
- PesaPal documents: https://www.pesapal.com/blog/what-documents-are-required-for-setting-up-a-pesapal-account [Official, blog]
- PesaPal licence: https://www.pesapal.com/blog/pesapal-tanzania-limited-licensed-as-a-payment-systems-provider-by-bank-of-tanzania [Official, blog]
- PesaPal 3DS: https://www.pesapal.com/blog/what-is-3d-secure-payment-and-how-does-it-work [Official, blog]
- AzamPay: https://bakhresa.com/azampay-tanzania-limited/ [Official, group site]; https://cdn.jsdelivr.net/wp/azampay/trunk/README.txt [Official plugin]; https://github.com/flexcodelabs/azampay [Secondary]
- BoT National Payment Systems Annual Report 2022, annex 6.5: https://www.bot.go.tz/Publications/Regular/Annual%20Report/en/2024020511594863.pdf [Official]
- Flutterwave Tanzania approval 2022: https://thepaypers.com/payments/news/flutterwave-launches-in-tanzania [Secondary]
- PesaPal fees: https://paymentproviders.io/country/tz and https://tekpon.com/software/pesapal/reviews/ [Secondary]
