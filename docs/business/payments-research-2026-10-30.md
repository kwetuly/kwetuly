# Card payments and payouts for Kwetuly: research report (2026-10-30)

This was research only. I signed up for nothing, contacted no one, and changed no code or database. "Unverified" means I could not confirm it on a public page. Most providers do not publish Tanzanian prices, so every fee below needs a written quote before Walter decides.

## Plain-language summary for Walter

- **The code we have today cannot take cards, even though it says it can.** Our Selcom code uses a Selcom request (`create-order-minimal`) whose documentation says it "cannot be used for card payments". It only works for mobile money. To take cards we must switch to Selcom's full `create-order` request, which also needs the payer's billing address. Source: https://developers.selcommobile.com/ (Checkout API section).
- **Stripe is not open to a Tanzanian company.** It does not support paying out to Tanzania either. Wise will not open an account for someone living in Tanzania. PayPal is unclear.
- **Selcom remains the best main provider.** It is already built in, local, takes cards and mobile money, and has an API for sending money to mobile wallets. Its prices are not published, so we need a quote.
- **Flutterwave is the best backup.** It is the only provider here that publishes its Tanzanian prices, and it can both take cards and pay out to mobile money and banks. It is expensive: 4.8% per card payment.
- **Legal must check three things:**
  1. The 2025 rule that local payments must be in shillings.
  2. The Bank of Tanzania ban on adding card surcharges.
  3. Whether holding travellers' money before paying guides needs Bank of Tanzania approval.

## 1. Card providers for a Tanzanian company

### Selcom (already built in)
- **Tanzania:** yes, it is a Tanzanian company. It accepts Visa, Mastercard and American Express through payment links and website checkout (https://www.selcom.net/).
- **Apple Pay / Google Pay:** I found no evidence of either. Unverified.
- **Fees:** not published. A comparison site lists them as "Custom" (https://paymentproviders.io/compare/selcom-vs-paymaya-business?focus=fees). Unverified.
- **Settlement currency:** the checkout accepts "TZS, USD" as the order currency (https://developers.selcommobile.com/). Which currency Kwetuly is actually paid in is unverified.
- **Time to payout:** automatic next-day (T+1) settlement to a bank or mobile account. This is stated for the Selcom Lipa product; that it also applies to online checkout is unverified (https://www.selcom.net/).
- **Onboarding:** contact Selcom (0800 714 888, help@selcom.net). They handle application, verification, registration and activation. The document list is not published (https://www.selcom.net/).
- **Refunds:** no refund endpoint is documented. The nearest is an "IMT send-money" call that mentions a refund request (https://developers.selcommobile.com/). Refunds are therefore manual. Unverified.
- **Chargebacks:** not documented. Unverified.
- **Payouts to mobile money:** yes, through the API.
  - `POST /v1/walletcashin/process` pays a mobile wallet.
  - `/v1/qwiksend/process` pays a bank account.
  - On an "AMBIGUOUS" or "INPROGRESS" result, the docs say to wait 3 minutes and then check the status, not retry.
  - Source: https://developers.selcommobile.com/. Fees are not published (unverified).

### Pesapal
- **Tanzania:** yes. Online payments accept Mixx by Yas, Vodacom, Airtel Money and bank cards (https://www.pesapal.com/tz).
- **Apple Pay / Google Pay:** not mentioned (unverified).
- **Fees:** not published. Comparison sites say 1.5%–3.5% (https://paymentproviders.io/compare/pesapal-vs-cm-com-payments?focus=fees). Unverified.
- **Settlement:** next-day to any bank for card terminals (https://www.pesapal.com/tz). Online settlement time and currency are unverified.
- **Onboarding:** "same day setup upon submission of all documents" for card terminals. The documents are not listed (https://www.pesapal.com/tz).
- **Refunds:** an API exists. The merchant must approve each refund. Card payments can be refunded in part or in full, mobile money only in full, always in the original currency (https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/refund-request).
- **Chargebacks:** unverified.
- **Payouts to mobile money:** not documented (unverified).

### DPO Pay
- **Tanzania:** yes. It is approved by the Bank of Tanzania as a payment service provider (https://thepaypers.com/payments/news/dpo-pay-receives-psp-approval-from-the-bank-of-tanzania).
  - It accepts Visa, Mastercard, American Express and Diners, plus M-Pesa, Airtel and Tigo.
  - It says "Get paid in TZS, USD, GBP and others".
  - Source: https://dpogroup.com/online-payments/tanzania/
- **Apple Pay / Google Pay:** unverified.
- **Fees:** not published. Comparison sites say 2–3%, with settlement times that disagree (3–7 business days versus instant to 2 days) (https://paymentproviders.io/country/tz). Unverified.
- **Onboarding:** "Sign up instantly"; requirements are not listed (https://dpogroup.com/online-payments/tanzania/).
- **Refunds:** a `refundToken` call exists according to a third-party code library (https://cdn.jsdelivr.net/npm/dpo-node-sdk@0.0.5/README.md). Not checked against DPO's own documentation (unverified).
- **Chargebacks:** unverified.
- **Payouts to mobile money:** unverified.

### Flutterwave
- **Tanzania:** yes. It takes cards and Tanzanian mobile money, priced in TZS (https://developer.flutterwave.com/v3.0/docs/payment-methods).
- **Fees** (https://flutterwave.com/tz/pricing, VAT not included):

| What | Fee |
| --- | --- |
| Local card payment | 4.8% |
| International card payment | 4.8% |
| Mobile money payment | 2.5% |
| Payout to a bank account | TZS 3,000 each |
| Payout to mobile money under TZS 40,000 | TZS 500 each |
| Payout to mobile money of TZS 40,000 or more | 1.5% |

- **Who pays the fee:** by default the customer pays it, but this can be changed. We would have to change it, because Kwetuly does not charge travellers fees (same page).
- **Settlement:** local payments next day. International cards are settled in local currency (TZS) by default. The international timing "varies" (same page).
- **Apple Pay / Google Pay:** not shown for Tanzania (unverified).
- **Onboarding:** KYC (identity checks) and account approval. Payouts must be requested from Flutterwave separately.
- **Payouts to mobile money:** yes. Requires KYC, asking Flutterwave to switch the feature on, and registering our server addresses. The payout balance funded from collections is capped at roughly USD 1,000 equivalent (https://developer.flutterwave.com/docs/tanzania-1).
- **Payouts to banks in Tanzania:** "only available to businesses registered in Tanzania" (https://developer.flutterwave.com/v3.0/docs/tanzanian-bank-account-transfers).
- **Refunds and chargebacks:** unverified.

### Others seen but not checked in depth
- **ClickPesa:** takes local payments and pays out to mobile money and banks, according to a third-party code library. No official prices found (https://cartdna.com/shopify-payment-methods/clickpesa). Unverified.
- **AzamPay:** has a payout API in an unofficial code library. No prices found (https://pub.dev/documentation/azampay/1.0.0/). Unverified.
- **dLocal:** pays out to Tanzanian banks and wallets. It is aimed at large companies (https://docs.dlocal.com/docs/tanzania-payouts-v3.md).

## 2. Stripe, PayPal and Wise

- **Stripe:** not available.
  - Tanzania is not on Stripe's country list. The only African countries listed are Côte d'Ivoire, Ghana, Kenya, Nigeria and South Africa, all through Paystack (https://stripe.com/global).
  - Stripe's self-serve payouts to other countries only go to the US, UK, EEA, Canada and Switzerland (https://docs.stripe.com/connect/cross-border-payouts).
  - Setting up a foreign company just to use Stripe is a legal and tax question, not something we should do quietly.
- **PayPal:** unclear for receiving money.
  - PayPal's country page for Tanzania did not show what Tanzanian accounts can do (unverified).
  - In May 2026 Vodacom announced that eligible M-Pesa customers can deposit to and withdraw from PayPal. Fees, limits and launch date were not given (https://africa.com/vodacom-m-pesa-and-paypal-partner-to-expand-access-to-global-digital-payments-for-tanzanians/).
  - This is aimed at individuals. It is not a way for a business to take card payments.
- **Wise:** cannot hold money for us.
  - Tanzania is not on the list of countries where people can hold money with Wise (https://wise.com/uk/help/articles/2813542/where-do-i-need-to-live-to-hold-money-with-wise).
  - Wise can send TZS to a bank or mobile money in Tanzania from supported countries (https://wise.com/au/send-money/send-money-to-tanzania). So it could pay a guide from abroad, but Kwetuly cannot use it to receive money.

## 3. Automatic payouts to guides and teachers

- **Yes, it is technically possible:**
  - Selcom: `walletcashin` to a mobile wallet, `qwiksend` to a bank (https://developers.selcommobile.com/).
  - Flutterwave: transfers in TZS to mobile wallets (https://developer.flutterwave.com/docs/tanzania-1).
- **Cost:**
  - Flutterwave publishes it: TZS 500 under TZS 40,000, 1.5% from TZS 40,000, TZS 3,000 to a bank (https://flutterwave.com/tz/pricing).
  - Selcom's payout fees are not published (unverified).
- **I found no proper "send to many people at once" product.** Both providers pay one person per request, so a payout run is a loop of single payments.
- **My advice:** keep payouts started by an admin for now. Use one "Pay" button per approved payout that calls the API, with Walter approving each one. Do not pay out automatically until reconciliation has run cleanly for a few weeks.
- **Wallet names:**
  - Selcom's Checkout documentation names M-Pesa, Tigo Pesa, Airtel Money and Halopesa (supabase/functions/payments/index.ts header).
  - Pesapal names "Mixx by Yas" (https://www.pesapal.com/tz).
  - Whether each provider's payout API supports Mixx by Yas under that name is unverified.

## 4. Taking payment for online lessons (existing call bookings)

What exists in `call_requests` today:
- A price in USD (`price_usd`), taken from the guide's offer.
- A `payment_status` field that only the server can change.
- A video link (`meeting_link`).
- No connection to Selcom.

What it would take:
1. **Database:** allow a third kind of payment in `payments` (a call payment), linked to the call request. Allow only one open payment per call, the same way we already do for trip deposits.
2. **Server checkout:** let the payments function create a checkout for a call. Only the traveller can do this, only after the guide has accepted, and only when the price is above 0. Convert the price to shillings with the existing exact integer calculation and record the rate used.
3. **When the payment is confirmed:** the server re-checks the order with Selcom, marks the call as paid and notifies the guide.
4. **Rules:**
   - The video link is shown to the traveller only after payment.
   - The guide cannot mark a paid lesson "completed" before it is paid.
5. **Payout and refunds:** the guide is paid through the same admin payout step. Cancellations or no-shows lead to a refund request that Walter approves. Selcom has no refund API, so refunds are manual.
6. **Texts:** in all 7 languages for travellers, and in English and Kiswahili for guides.

## 5. Recommendation

- **Main provider: Selcom.** It is already integrated, local, takes cards and mobile money, and can pay out to wallets and banks under one contract. Before we commit, Selcom must confirm in writing:
  - that it takes international cards online through `create-order`;
  - the fees for local and foreign cards, mobile money and payouts;
  - whether we are paid in USD or TZS, and how fast;
  - how chargebacks are handled;
  - how refunds work.
- **Backup: Flutterwave.** Its prices are public and it covers both taking payments and paying out. It costs more (4.8% per card payment), so it is a backup rather than the main provider.
- **Also get quotes from Pesapal and DPO Pay.** If either beats Selcom on foreign cards, it can take Flutterwave's place as the card backup.

### Order of work after the company is registered
1. Legal checks the three questions under "What needs Walter's approval" below.
2. Get written quotes from Selcom, Flutterwave, Pesapal and DPO. Walter picks one.
3. Sign the Selcom merchant agreement. Run everything in Selcom's test environment only.
4. Switch our checkout to Selcom's full `create-order` so cards work. Test with Selcom test cards.
5. Add a daily reconciliation job and a fee/settlement report.
6. Switch on deposits for trips and group trips.
7. Add payment for online lessons.
8. Add admin-started API payouts, one per approved payout.
9. Add the backup provider.

## Technical section for tech-lead

**Bug: cards cannot work today.**
- `supabase/functions/payments/index.ts` calls `checkout/create-order-minimal`. Selcom's documentation says it "cannot be used for card payments".
- Fix: move to `checkout/create-order` with the required `billing.*` fields (first name, address, country and so on) and `payment_methods` (e.g. `ALL` or `CARD,MOBILEMONEYPULL`). Selcom rejects card payments that have no billing information.
- The header comment in the file claiming cards work is wrong.

**Webhook handling.**
- Selcom only sends the callback on success ("Webhook only on successful transactions"). Failures and expiries need a timed job that polls `checkout/order-status` for orders still pending after their expiry time.
- Today a status update only happens when a user asks (`action: "status"`) or when a new checkout runs.
- The callback carries `Digest`, `Timestamp` and `Signed-Fields` headers. Our code ignores them and re-queries Selcom instead, which is safe. Selcom does not document how to verify the signature, so add verification only once Selcom confirms the method in writing.

**Small fix.** `amount_usd: order.cents / 100` sends a JS floating-point number to the database. Send a decimal string built from the integer cents instead (e.g. `${Math.trunc(c/100)}.${String(c%100).padStart(2,'0')}`). The shilling calculation already uses integers and is correct.

**Lesson payments, schema.**
- Add `'call_payment'` to the `payments.kind` check and add a `call_request_id` foreign key, plus the matching check pairing.
- Add `create unique index ... on payments(call_request_id) where status='pending'`.
- Mirror the paid state into `call_requests.payment_status`, in the trusted/service-role path only.
- In `guard_call_request_fields`, block `status='completed'` when `price_usd > 0` and the call is not paid.
- Expose `meeting_link` to the traveller only when the call is paid, through a view or RPC; the current read policy returns the whole row.

**Payouts.**
- Add a `payouts` table with: payee, method, a masked destination plus a reference to a stored token, `amount_tzs` (integer), provider, provider reference, status, requested_by/at, approved_by/at.
- Status flow: requested → approved → sent → confirmed or failed or ambiguous.
- On an ambiguous result, query the status after 3 minutes and never resend automatically.
- Use an idempotency key per payout (sending the same payout twice must never pay twice).

**Currency.**
- `USD_TZS_RATE` is fixed. Record the rate source per payment, which we already do.
- Before switching on, Walter should approve a rate source and how often it is updated.

## The flow, the risks, the checks run and what needs Walter's approval

**The flow (lesson or deposit):**
1. Pending: the traveller starts checkout and the server creates an order with the amount in TZS and the rate recorded.
2. Selcom sends a callback; the server re-queries Selcom.
3. The payment becomes paid, failed, or "review" (amount or currency does not match).
4. An admin creates a payout request. Walter approves it.
5. Payout sent, then confirmed or failed.
6. Reconciliation: daily, Selcom's settlement report is matched against payments that are paid and payouts that are confirmed.

**Risks:**
- Card checkout is broken until we move to `create-order`.
- Failures are only detected when someone polls; no scheduled job does this yet.
- Refunds through Selcom are manual.
- Chargebacks are unknown for every provider.
- The fixed exchange rate can drift from the real rate.
- Flutterwave charges the customer by default; this must be switched off.
- **Legal, flagged for legal to confirm:**
  - The Bank of Tanzania bans adding surcharges to card payments. Reports cover card terminals in shops; whether it applies online is unverified (https://launchbaseafrica.com/2024/12/27/with-card-charges-gone-in-tanzania-will-fintech-players-rethink-their-revenue-strategies/).
  - The 2025 Foreign Currency Regulations require shillings for local transactions, with an exemption reported for non-residents (https://www.afriwise.com/blog/finance-law-update-foreign-currency-ban-what-tanzanian-businesses-need-to-know).
  - Holding travellers' money until a trip and then paying guides may need Bank of Tanzania approval. We must not call it "escrow".

**Checks actually run:**
- Read `supabase/functions/payments/index.ts`, `supabase/migrations/20261014000200_payments.sql`, `20261016001600_payments_review_fixes.sql`, `20261012000500_calls_jobs_hub.sql` and `20261012000600_call_status_rules.sql`.
- Read Selcom's developer documentation and the provider, pricing and country pages linked above.
- Nothing was run against Selcom or any other provider. No code or database was changed.

**What needs Walter's approval:**
- Choice of main and backup provider, after quotes.
- Signing any merchant agreement.
- Exchange-rate source and update rule.
- Refund and cancellation policy for lessons and deposits.
- Every manual or API payout, and any change to a payee's payout account.
- Sending the three legal questions (surcharge ban, shilling rule, holding funds) to legal and a Tanzanian advocate.
