# Cards and "lipa kidogo kidogo": Selcom feasibility, change plan and instalment design (payments-engineer, 2026-11-21)

Task 1b from `docs/product/ideas-2026-11-08.md`. Walter approved on 2026-11-08:
- cards at launch, with the switch to Selcom's full `create-order` done inside the current Selcom work;
- "lipa kidogo kidogo" only toward one booked trip, with a fixed schedule and no wallet.

Paper only. Nothing was built, deployed, signed up for or sent. Nobody was contacted. No live data was read. **Nothing here goes live before the advocate answers and Walter says go.**

Sources read:
- `supabase/functions/payments/index.ts` on `claude/features-1` and `claude/features-2`, which share base a9c4084;
- the same file on `claude/charming-thompson-d68fb2` (commit 26a75bd, 2026-11-07, not merged);
- the payment migrations;
- `docs/business/payments-research-2026-10-30.md`;
- from 26a75bd: `docs/payments/selcom-sandbox-plan.md` and `docs/business/deposit-refund-rule-2026-11.md`;
- the sibling drafts `docs/business/pay-little-and-classes-2026-11.md` (task 1a) and `docs/legal/instalments-donations-classes-2026-11.md` (task 1c);
- Selcom's developer documentation, https://developers.selcommobile.com/, read in full on **2026-11-21**.

"To verify" means Selcom's public pages do not say it, and only Selcom can confirm it in writing.

## Summary for Walter

- **The card switch is already written, but it is not on the main line.** Commit 26a75bd on `claude/charming-thompson-d68fb2` sends card payments through `checkout/create-order` with the billing fields, behind a `SELCOM_CARDS=1` switch. Mobile money stays on `create-order-minimal`. `main`, `claude/features-1` and `claude/features-2` still have the old code, which uses only `create-order-minimal` and so cannot take cards. What is left for cards: review and merge, a record for card disputes (chargebacks), a daily reconciliation job, and the sandbox checks. **Size M.**
- **Selcom documents saved cards, but no schedules.** Two things are documented:
  - **Saved cards:** a stored-card payment that needs no new card page, which Selcom says suits "ondemand subscription type recurring payments". The merchant has to start each charge itself.
  - **Mobile-money push:** a "wallet pull" that sends a USSD prompt to the payer's phone. The payer still types their PIN.

  Selcom documents no scheduling, no instalment product and no refund API, and publishes no fees.
- **Recommended instalment design: the traveller starts each part.** Every part is its own Selcom order, opened from a reminder. There are no saved cards and no automatic charges. The money goes toward one booked trip only. There are 2 or 3 parts, and the last one is due early enough that its grace period ends by the 8-day cut-off. A missed part, once the grace period is over, counts as the traveller cancelling under "who causes it pays". **Size L.** It must not be built before deposits are live and the advocate has answered.
- **Section 4 lists the questions for Selcom.** Only Walter sends them.

---

## 1. What Selcom publishes (developers.selcommobile.com, read 2026-11-21)

### 1.1 Full create-order, needed for cards

| Item | What Selcom says | Status |
| --- | --- | --- |
| Endpoint | `POST /v1/checkout/create-order` | Documented |
| Mandatory fields | `vendor`, `order_id`, `buyer_email`, `buyer_name`, `buyer_phone`, `amount`, `currency`, `payment_methods`, `no_of_items`, and `billing.firstname`, `billing.lastname`, `billing.address_1`, `billing.city`, `billing.state_or_region`, `billing.postcode_or_pobox`, `billing.country`, `billing.phone` | Documented |
| Optional fields | `billing.address_2`, `shipping.*`, `buyer_userid`, `gateway_buyer_uuid`, `redirect_url`, `cancel_url`, `webhook`, `expiry` (minutes), `buyer_remarks`, `merchant_remarks`, colours | Documented |
| `payment_methods` | "comma separated list of ALL, MASTERPASS, CARD, MOBILEMONEYPULL" | Documented |
| Billing | "Card payments with no billing info will get rejected." | Documented |
| `create-order-minimal` | "This api cannot be used for card payments"; the card option is not shown on the payment page | Documented |
| URLs | "All urls in the request and response are base64 encoded". The response sample shows a plain `payment_gateway_url`. | Contradictory, so **to verify** (the code on 26a75bd accepts both) |
| Response | `gateway_buyer_uuid`, `payment_token`, `qr`, `payment_gateway_url` | Documented |
| Redirect | The payer is sent to Selcom's page, then to `redirect_url` or `cancel_url` | Documented. The real page host is **to verify** (samples use example.com). |
| Currency | `currency` accepts TZS or USD. Which currency Selcom settles to the merchant is not stated. | Settlement **to verify** |
| 3-D Secure | Not mentioned anywhere | **To verify** |
| Apple Pay, Google Pay | Not mentioned | **To verify** |
| Flat or nested billing keys | The samples use `billing.firstname` style keys. How they appear in `Signed-Fields` is not explained. | **To verify** in the sandbox |
| Webhook | Payload: `result`, `resultcode`, `order_id`, `transid`, `reference`, `channel`, `amount`, `phone`, `payment_status`. Headers: `Authorization`, `Digest-Method`, `Digest`, `Timestamp`, `Signed-Fields`. Sent "only on successful transcations" [sic]. | Documented. **How to verify the signature is not documented.** The table says `COMPLETE` while the sample says `COMPLETED` (we accept `COMPLETED`; **to verify**). |
| Order status | `GET /v1/checkout/order-status`: `PENDING`, `COMPLETED`, `CANCELLED`, `USERCANCELLED`, `REJECTED`, `INPROGRESS`. `transid`, `channel`, `reference` and `msisdn` are returned "on COMPLETED payments only". | Documented |
| Cancel | `DELETE /v1/checkout/cancel-order`. "An expired or completed order cannot be cancelled." | Documented |
| List orders | `GET /v1/checkout/list-orders?fromdate=&todate=` (YYYY-MM-DD). Returns `result`, `payment_status`, `order_id`, `creation_date`, and `amount` in the sample. No fees, no settlement data. | Documented. Useful for daily reconciliation. |
| Refunds | No checkout refund or reversal endpoint | Not documented, so refunds are manual (**to verify**) |
| Chargebacks | Not mentioned | **To verify** |
| Sandbox | No base URL, test cards or test wallet numbers published. "Email support@selcom.net for API Keys and credentials." | **To verify** |

### 1.2 Saved cards, scheduled payments and repeated mobile-money pushes

| Feature | What Selcom says | What it means for instalments |
| --- | --- | --- |
| Stored cards | A buyer is linked to stored cards through `buyer_userid` and `gateway_buyer_uuid` on create-order. Selcom says `gateway_buyer_uuid` is "Used to display stored card". `GET /v1/checkout/stored-cards` returns `masked_card`, `card_type`, `card_token`, `id`. `DELETE /v1/checkout/delete-card` removes a card. | Technically possible. Kwetuly would hold card tokens and buyer ids. |
| Charge a stored card | `POST /v1/checkout/card-payment` (`transid`, `vendor`, `order_id`, `card_token`, `buyer_userid`, `gateway_buyer_uuid`) processes an order "using stored cards directly without redirecting the user to payment gateway page", and can be used "for ondemand subscription type recurring payments". The answer comes back asynchronously (`111`, then a callback). | A **merchant-started** charge with no payer present. Selcom does not say how 3-D Secure, consent, limits or chargeback liability work for these charges. **To verify.** |
| Scheduling | No scheduled, recurring-plan, standing-order or instalment product is documented. Recurring is left to the merchant to trigger. | Kwetuly would have to run the schedule itself. |
| Mobile-money push | `POST /v1/checkout/wallet-payment` (`transid`, `order_id`, `msisdn`) triggers "a PUSH ussd from the mobile wallet". There is also `checkout/selcompesa-payment` for the Selcom Pesa app. | Each push is a prompt on the payer's phone, and the payer must approve it with their PIN. Kwetuly can never pull money without the payer. Whether a push can be repeated for the **same** order, how long it stays valid, and which wallets are supported (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa) are **to verify**. A new order per part avoids the question. |

### 1.3 Fees

- **Selcom publishes no fees** on developers.selcommobile.com or selcom.net (checked 2026-11-21).
- Secondary sources only, not to be used for decisions:
  - a comparison site says pricing is "custom" (https://paymentproviders.io/compare/selcom-vs-paypercut?focus=fees);
  - a 2026 blog estimates about 1.5–2% for wallets (https://kolonell.com/en/blog/accept-tigo-pesa-payment-dar-es-salaam-store-2026).
- For scale only: Flutterwave Tanzania publishes 4.8% per card payment and 2.5% per mobile-money payment, VAT not included (https://flutterwave.com/tz/pricing, read 2026-10-30, per the research doc).
- **Flag for legal:** the Bank of Tanzania has published 2024 guidelines on fees and charges for non-bank payment service providers (found on bot.go.tz in search results, not opened). Legal should check whether they limit what Selcom may charge, or what Kwetuly may pass on.
- **Fixed fees per payment are the key question for instalments.** A purely percentage fee costs the same in 1 part or in 3. A fixed fee per payment, a minimum fee, or a refund fee multiplies with the number of parts.

---

## 2. (a) Change plan: the card switch

### 2.1 Where things stand

| Branch | Cards |
| --- | --- |
| `main`, `claude/features-1`, `claude/features-2` | No. `checkout/create-order-minimal` only. The file header wrongly says cards work. `amount_usd: order.cents / 100` is still a float. |
| `claude/charming-thompson-d68fb2` (26a75bd, not merged, migrations not applied anywhere) | Built and switched off. `config` returns `methods`. Checkout takes `method` (`mobile_money` by default, or `card` with `billing`). Card orders go to `checkout/create-order` with `payment_methods=CARD` and flat `billing.*` keys in TZS. `buyer_userid` and `gateway_buyer_uuid` are never sent, so no cards are stored. Billing details are never stored or logged. `payments.pay_method` records the choice. The billing forms are `apps/web/src/components/pay-method-fields.tsx` and `apps/mobile/src/components/country-field.tsx`. The function also has the payment-page host allowlist, the sweeper and the 8-day cut-off. `amount_usd` is sent as a decimal string (`centsToUsd`). |

So most of the "switch" is done. What remains is to get it onto the main line and close the gaps that matter for cards specifically.

### 2.2 Steps

| # | Step | Files | Size | Checked by |
| --- | --- | --- | --- | --- |
| C1 | Review 26a75bd, merge it to `main`, then bring it into the feature branches. Resolve conflicts with the group-trip and dictionary changes made since. Migrations go to the **test project only** (sandbox plan, section 4.2.5). | the 44 files in 26a75bd | S (merge) | security-reviewer (money), qa-tester |
| C2 | Move the billing rules (`readBilling` in the function) into `packages/shared/src/payments.ts` as `validateBilling`, with tests. Use it in the web form, the app form and a copy in the function, with the same "copies are identical" check already used for `isSelcomPaymentUrl`. Today the web and app forms and the function can drift. | `packages/shared/src/payments.ts`, `payments.test.ts`, `pay-method-fields.tsx`, `country-field.tsx`, function | S | qa-tester |
| C3 | **Disputes (chargebacks), a card-only risk.** Add a `disputed` value to `payment_status`, in its own migration as was done for `review`. Add a table `private.payment_disputes`: `payment_id`, `provider_case_ref`, `amount_tzs` (integer), `reason`, `status` (`open`, `won`, `lost`, `withdrawn`), `opened_at`, and `recorded_by`/`recorded_at` and `closed_by`/`closed_at`. An append-only log records every change. An admin records a dispute through an RPC with two-step sign-in, because Selcom documents no dispute notice. `private.guard_payout` refuses payouts while a dispute is open, with no override, and admins are alerted. A lost dispute creates the matching refund record. | new migration, `guard_payout`, admin page | M | security-reviewer, accounting |
| C4 | **Daily reconciliation.** A pg_cron job (pattern as the sweeper) calls the function with `{action:"reconcile", date}`, protected by its own secret. The function calls `checkout/list-orders` for the previous Tanzania day and matches each order by `order_id` to `payments`. Rows go into `private.reconciliation_runs` and `private.reconciliation_items`. Admins are alerted on any of: an order at Selcom with no row; a row `paid` where Selcom is not `COMPLETED`; Selcom `COMPLETED` where the row is not `paid` or `review`; an amount that differs. A monthly step imports Selcom's settlement statement (format **to verify**) to record the fees and net settled per payment, with `fee_tzs` and `settled_tzs` as integers. | function, new migration, admin page | M | accounting, security-reviewer |
| C5 | Webhook signature check, once Selcom documents the method in writing. Keep re-querying `order-status` even then. | function | S | security-reviewer |
| C6 | Narrow the payment-page allowlist to the host seen on the first sandbox card order, and on the live one before switch-on. | `packages/shared/src/payments.ts`, function | S | security-reviewer |
| C7 | Card texts in all 7 languages: the amount is charged in TZS, "your bank may use its own exchange rate", and the card number is typed only on Selcom's page. No "guaranteed", "escrow" or "instant". | dictionaries | S | localization |
| C8 | Switch-on: set `SELCOM_CARDS=1` in the test project after Selcom confirms cards for the test merchant. In live, only after Walter's go, which needs the company registered, Selcom's written answers to section 4 and the advocate's answers. | secrets only | S | devops, Walter |

**Overall: M.** C1, C2 and C5 to C8 are small. C3 and C4 are the real build.

### 2.3 States for a card deposit

`pending` → `paid` | `review` | `failed`, as for mobile money. After that:

- `paid` → `disputed` → `paid` (dispute won) or `refunded` (dispute lost);
- `paid` → `refunded`, through a refund record that Walter approves.

Who can make each change:
- `pending`, `paid`, `review` and `failed` are set only by the function's service role, after Selcom's order-status answer (webhook, sweeper, payer check, checkout);
- `disputed` and its outcome are set by an admin RPC with two-step sign-in, recorded with who and when;
- `refunded` is set only through an approved refund record.

What happens on a repeat or a failure:
- conditional updates (`eq('status', from)`) make every repeat harmless;
- a second Selcom payment for the same deposit goes to `review`;
- a lost webhook is caught by the sweeper within about 3 minutes, and by reconciliation the next day.

### 2.4 Tests (test project, Selcom sandbox, test accounts only)

These cover section 5 (4b) of the sandbox plan, plus:
- card success; 3-D Secure challenge passed and failed (if the sandbox can do it); card declined; payer cancels on Selcom's page; order expires;
- `billing_required` (no billing, a bad country code, `&` or `=` in a field);
- a foreign billing address without a postcode, to see what Selcom accepts;
- `provider_amount` equals `amount_tzs`, and `provider_channel` shows a card channel;
- no billing data in any table or log;
- reconciliation: run it on a day with one paid, one failed and one hand-edited row; all three are reported correctly;
- dispute: record, payout refused, close as won and as lost.

Unit tests in `packages/shared`: `validateBilling`, `centsToUsd`, and the shilling calculation.

Card numbers are never typed by an agent except Selcom's published sandbox test cards, on a test project.

### 2.5 Reconciliation for cards

| When | Match | By |
| --- | --- | --- |
| Daily | `payments` against `checkout/list-orders` | `order_id`, amount in TZS, status |
| Monthly | Against Selcom's settlement statement | `reference`/`transid`: gross, fee, net, settlement date and currency |

Refunds and disputes are matched by Selcom's reference on the refund or dispute record. Accounting signs off each month.

---

## 3. (b) Design sketch: fixed-schedule instalments for one booking

This follows business-manager's shape S1 (the **deposit** paid in 2 or 3 fixed parts) and legal's shape (a): one trip, a fixed schedule, no wallet, no transfer, no credit. Money paid toward trip X can only go to trip X, or back to the traveller.

### 3.1 How it is paid: the traveller starts every part

- Each part is a **new Selcom order** for exactly that part's TZS amount, opened by the traveller from the booking page or from a reminder:
  - mobile money uses `create-order-minimal`;
  - card uses `create-order` with billing.
- For mobile money the server may also call `checkout/wallet-payment` right after creating the order, so the PIN prompt arrives without a second step. This happens only because the traveller pressed Pay.
- **Not used at the start: stored cards and charges Kwetuly starts on its own.** Reasons:
  - Selcom does not document 3-D Secure, the consent (mandate) or chargeback liability for stored-card charges;
  - a charge the traveller did not start is the most likely to be disputed;
  - storing `buyer_userid` and `gateway_buyer_uuid` adds personal data to look after;
  - it would look more like a recurring-payment product to the advocate.

  This can be revisited only after Selcom answers questions 9 to 12 in section 4 and the advocate agrees.
- Kwetuly can never take mobile money without the payer's PIN, so "repeated pushes" can only ever mean reminders plus a prompt the traveller approves.

### 3.2 Schedule rules (proposals for Walter; numbers in [ ] are placeholders)

- The organiser opts in per group trip or offer. It is offered only when the trip has a **fixed start date** (no undated or flexible offers) and starts at least [45] days after booking.
- There are 2 or 3 parts. Part 1 is paid at booking. The parts are at least [14] days apart.
- **Last part due date ≤ start − 15 days, and grace ≤ 7 days, so grace always ends by start − 8**, the last day a deposit may be paid. No part is ever taken inside the cut-off.
- Amounts are integers in TSh:
  1. the deposit TZS total is worked out once, at booking, with the existing integer rule (round up to the next TSh 100), and the rate and its source are recorded;
  2. it is split into parts in whole TSh 100;
  3. any remainder goes on part 1;
  4. the parts must add up exactly to the total (a database check).
- The rate is fixed at booking, so the schedule never changes. Exchange-rate drift is Kwetuly's cost (business-manager recommendation; accounting to confirm).
- A minimum part size of TSh [X] will be set once Selcom states any fixed fee per payment.
- The traveller sees the whole schedule, every amount, the grace rule and the refund rule before part 1, and ticks to accept. The schedule version and the acknowledgement time are stored.
- There is no fee for paying in parts, and no late fee or interest. The total is the same as paying at once.

### 3.3 Data (new; nothing built)

- **`public.payment_plans`**:
  - `id`, `kind` (`offer`/`group`), `trip_offer_id` or `group_member_id` (unique where the status is open), `user_id`, `payee_user_id`;
  - `deposit_cents_usd` (integer), `total_tzs` (integer), `usd_tzs_rate`, `rate_source`;
  - `start_date`, `parts_count`, `schedule_version`, `refund_rule_version`, `terms_ack_at`;
  - `status`, `status_source`, `created_at`, `updated_at`, `cancel_case`, `cancelled_by`, `cancelled_at`.
- **`public.payment_plan_parts`**:
  - `plan_id`, `seq`, `amount_tzs` (integer), `due_date` (Tanzania date), `grace_until`;
  - `status`, `payment_id` (the paid `payments` row), `status_source`, `updated_at`;
  - a check that `grace_until <= start_date - 8`.
- **`payments`** gets a nullable `plan_part_id`. Today's unique "one paid payment per offer or member" index becomes "one paid payment per plan part" for plan payments, and stays as it is for one-off deposits. `guard_new_payment` must accept an order only when:
  - the part is `due` or `overdue`;
  - the amount equals `amount_tzs` exactly;
  - no other part has a pending order;
  - the trip is still going ahead;
  - today is on or before `grace_until`.
- **`private.plan_events`** is append-only: every plan and part change, with who, which source and when. Reminders sent are logged here too.
- All writes go through the service role or admin RPCs. No insert or update policy is given to signed-in users.

### 3.4 States

**Part:**

| From | To | Trigger (who) |
| --- | --- | --- |
| `scheduled` | `due` | Scheduler, [7] days before `due_date` (pg_cron, daily at 00:05 Tanzania time) |
| `due`, `overdue` | (a pending `payments` row) | Traveller presses Pay; the function creates the order |
| pending payment | part `paid` | Function after Selcom `COMPLETED` with the exact amount (webhook, sweeper, payer check) |
| pending payment | part `review` | Wrong amount, plan no longer open, or a second payment for the same part |
| `due` | `overdue` | Scheduler, the day after `due_date` |
| `overdue` | `missed` | Scheduler, the day after `grace_until`, with no paid or pending payment |
| `overdue` | `due` (new date) | Admin RPC with a reason, only when the provider failed (Selcom or wallet outage shown in logs or reconciliation). The new grace still ends by start − 8. Logged. |
| any open state | `cancelled` | The plan is cancelled |

**Plan:**
- `offered` → `active` (part 1 paid) → `completed` (all parts paid);
- `active` → `lapsed` (a part `missed`; counted as the traveller cancelling on the lapse date);
- `active` or `completed` → `cancelled_traveller`, `cancelled_organiser`, `cancelled_min_not_reached`, `cancelled_force_majeure` or `cancelled_kwetuly`;
- any state → `review` (an admin must look).

Every cancellation or lapse opens a **refund request**, and nothing goes back automatically.

When a step fails or repeats:
- a second press of Pay within 10 seconds gets `pending_order` (the existing `claim_deposit_checkout`, keyed per part);
- a webhook repeat is harmless (conditional updates);
- an order that expires leaves the part `due` or `overdue`, and the traveller can try again until `grace_until`;
- a payment completed after the plan lapsed, or after the cut-off, goes to `review` and is refunded 100% (case `review_or_late`).

### 3.5 Reminders (email and push; WhatsApp only once the template is approved)

**To the traveller:**
- when the part becomes due;
- 1 day before the due date;
- on the due date;
- on day 3 of grace;
- on the last day of grace, saying plainly what happens next.

**To the organiser:**
- each part paid;
- a part overdue;
- a plan lapsed;
- the plan completed.

**Admins:** every `review` and every lapse.

Rules for reminders:
- links point to the booking page only, never with amounts, phone numbers or order ids in the address;
- amounts are shown with the currency (TSh, and about US$ as information);
- phone numbers are masked;
- traveller texts are in 7 languages, organiser texts in English and Kiswahili;
- the tone is polite, with no pressure wording.

### 3.6 Missed parts and refunds ("who causes it pays", 8-day cut-off)

The refund is worked out on the **total paid so far**. The tier is set by the cancellation or lapse date (Tanzania date) against the trip start, using `refundSplit` from the refund records plan, with integers, rounding Kwetuly's share down to TSh 100, and parts that always add up.

| Case | Traveller back | Organiser keeps | Kwetuly keeps |
| --- | --- | --- | --- |
| Traveller cancels, or a part is missed and grace ends, 30+ days before the start | 90% | 0% | 10% (one TSh cap per plan, not per part) |
| Same, 8–29 days before the start (the latest a lapse can fall) | 40% | 50% | 10% (cap) |
| Traveller cancels 7 days or less before the start, or does not turn up (plan completed) | 0% | 100% | 0% |
| Organiser cancels or changes the trip | 100% of every part | 0% | 0%. Kwetuly recovers its actual fees, summed over all parts and at most 10% of the amount paid, from the organiser, except in force majeure. |
| Minimum not reached, Kwetuly cancels, payment late or held for review, duplicate | 100% | 0% | 0% |
| Provider failure (Selcom or wallet outage) | No lapse. The due date moves; see 3.4 | | |

How a refund is paid out:
- **Each refund leg goes back to the method of the part it refunds**: a card part to that card, a mobile-money part to that wallet. This is never moved to another account.
- Proposed order of legs: card parts first (lowest chargeback risk), then mobile money, newest first. Each leg is at most its part's amount.
- Each leg is its own refund record (status requested, approved, sent, confirmed or failed), and **Walter approves the whole plan's refund once**.
- Refunds are manual, because Selcom documents no refund API.

**Payout:**
- the organiser is paid **once**, after the plan is `completed`, under the existing payout guard;
- on a lapse or cancellation, only `organiser_keeps_tzs` is paid out, after the refund is confirmed;
- until the planned `payouts` table exists, the guard refuses "paid out" on any part of a plan that is not completed.

Example (illustration only, not real prices): a deposit of TSh 600,000 in 3 parts of TSh 200,000. Part 3 is missed and grace ends 12 days before the start, so TSh 400,000 has been paid. The 8–29 day tier applies: traveller TSh 160,000, organiser TSh 200,000, Kwetuly TSh 40,000 (below any cap). Refund legs: TSh 160,000 out of the newest card part, or out of the mobile-money parts, as recorded.

### 3.7 Reconciliation

- Each part is a normal Selcom order, so it goes through the daily list-orders match (C4) and the monthly settlement match.
- Plan-level checks:
  - a `completed` plan has paid parts that add up to `total_tzs`;
  - no part is paid after its `grace_until`;
  - no plan has more than one pending order;
  - refund legs add up to the refund in the split.

### 3.8 Legal points (flag to legal; not decided here)

- Holding several parts for weeks before payout makes the open question about holding travellers' money **heavier**. Bank of Tanzania approval may be needed. This sits with the advocate (legal note questions 1 to 5). We must not call this "escrow", "savings" or "guaranteed".
- Legal's interim option, "a schedule on paper, paid directly to the guide", fits this design. The plan and its reminders would run with `kind = direct`: no Selcom orders, and Kwetuly holds nothing. That is a smaller first build (S to M) if Walter wants to learn about demand first.
- Whether a cancellation for a missed part is fair and what notice is needed (Fair Competition Act, Standard Form Consumer Contracts Regulations 2014): advocate.
- The 2024 Bank of Tanzania fee guidelines (section 1.3).

### 3.9 Size and order

**L.** It depends on these, in order:
1. deposits live (A1);
2. cards merged and tested (C1 to C4);
3. the refund records (sandbox plan, section 9);
4. the `payouts` table;
5. Selcom's answers;
6. the advocate.

Build order:
1. the shared `planSchedule` and `refundSplit` functions, with tests;
2. tables and guards;
3. function changes (checkout per part, refresh linking the part);
4. the scheduler;
5. reminders;
6. the admin view;
7. texts.

security-reviewer and qa-tester review it, and accounting reviews reconciliation.

---

## 4. (c) Questions for Walter to send Selcom (in writing)

Send these from Walter's own name. Give no company details that do not exist yet, and accept no agreement.

**Cards**
1. Are Visa and Mastercard (and Amex?) enabled for online checkout on our merchant account, in sandbox and live? What does it cost to switch them on, and what documents are needed (TIN, BRELA, business licence, a PCI self-assessment, a website review)?
2. Is 3-D Secure (Visa Secure, Mastercard Identity Check) always applied on `create-order` card payments? Who carries the loss on a chargeback, with and without 3-D Secure?
3. How does Selcom tell us about a chargeback (email, portal, webhook)? What is the dispute window, what evidence is needed, and what is the chargeback fee?
4. Can a foreign card be charged in TZS? Can orders be in USD? Which currency is settled to us, at whose exchange rate, with what cross-border fee, and how fast (T+1 for online checkout too)?
5. For `billing.*`: flat keys or a nested object? How do they appear in `Signed-Fields`? What should we send for countries without postcodes or regions?
6. Is `payment_gateway_url` in the create-order response base64 or plain? Which host will the payment page use?
7. Is Apple Pay or Google Pay available through checkout?
8. How do we verify the webhook `Digest`: which fields, which key, which algorithm? Are callbacks ever sent for failed or expired orders? Do callback URLs or our server addresses need whitelisting?

**Instalments, saved cards and pushes**

9. Is stored-card payment (`checkout/card-payment` with `card_token`) available to our merchant type? Does Selcom require a written mandate or consent from the cardholder?
10. Are stored-card charges treated as cardholder-initiated or merchant-initiated? Is 3-D Secure applied, and who carries chargeback liability?
11. Does Selcom offer any scheduled, recurring or instalment product, or is the merchant expected to trigger each charge?
12. Are there limits on stored-card charges (amount, frequency)? How does the cardholder see and delete stored cards?
13. `checkout/wallet-payment`: which wallets does it support (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa, Selcom Pesa)? How long is a push valid? Can it be sent again for the same order? What `transid` rules apply?
14. Is there a minimum order amount?

**Fees, refunds and reconciliation**

15. Fees for each method (local card, foreign card, each wallet): percentage, any fixed fee per payment, minimum fee, and VAT. Is the collection fee returned when a payment is refunded? (Any fixed or minimum fee decides whether instalments are worth it.)
16. How is a checkout payment refunded? In full only, or in part? More than once per payment? Only to the original card or wallet? How long does it take, and what does it cost? Is there an API?
17. What settlement statement do we get (format, per-transaction fee and net amount, reference fields)? Is `list-orders` the right source for daily reconciliation?
18. Can settlement be split directly to a guide's or business's wallet or bank account (so Kwetuly would not hold the money)? What would that need?
19. The sandbox base URL, test cards (success, decline, 3-D Secure challenge) and test wallet numbers. How do we make a test payment succeed, fail or expire? Does Selcom close an order exactly at the `expiry` we send?
20. The maximum `order_id` length (ours are 35 characters).

---

## The flow, the risks, the checks actually run and what needs Walter's approval

**Flow**
- **Card deposit:**
  1. The traveller picks card and fills in billing.
  2. The server checks the deposit rules and creates a `pending` row with the TZS amount, rate and source.
  3. `create-order` runs with `CARD`, and the traveller pays on Selcom's page (3-D Secure there, to verify).
  4. The webhook (success only), the sweeper or the payer check asks `order-status`.
  5. The row becomes `paid`, `review` or `failed`.
  6. It is reconciled daily against `list-orders` and monthly against the settlement statement.
  7. If a dispute comes: `disputed`, payout blocked.
  8. A refund or payout happens only with Walter's approval.
- **Instalment plan:**
  1. The organiser opts in, and the traveller accepts the schedule.
  2. Part 1 is paid as an order like the one above.
  3. The scheduler moves later parts to `due` and sends reminders. The traveller pays each part.
  4. A missed part, after grace ending by start − 8, lapses the plan and opens a refund request under "who causes it pays".
  5. A completed plan is paid out once.

**Risks**
- 26a75bd is not merged. Until it is, every branch except `claude/charming-thompson-d68fb2` cannot take cards.
- Selcom does not document 3-D Secure, chargebacks, refunds, the webhook signature, the sandbox or fees.
- Fixed fees per payment could make instalments cost more than the 10% covers.
- Refunds are manual: up to 3 refund legs per plan, each to a different method.
- Holding parts for weeks deepens the Bank of Tanzania question.
- Exchange-rate drift falls on Kwetuly.
- A missed part leaves the organiser with 50% of less money than a full deposit.
- Stored cards, if ever used, add personal data and dispute risk.

**Checks actually run**
- Read the function on `claude/features-1` and on `claude/charming-thompson-d68fb2` (26a75bd).
- Read the payment migrations (`payment_status` is `pending`, `paid`, `failed`, `refunded`, `review`), the sandbox plan, the refund rule, the payments research and the 1a and 1c drafts.
- Read developers.selcommobile.com in full (2026-11-21) and ran one web search for Selcom fees.
- No tests, type checks, Selcom calls or database queries were run. No code was changed. Nothing was committed.

**Needs Walter's approval**
- Sending the section 4 questions to Selcom.
- Merging 26a75bd and applying its migrations to a test project.
- Switching on `SELCOM_CARDS` in test, and later live.
- The dispute and reconciliation build (C3, C4).
- Whether instalments go ahead at all, the schedule numbers in [ ], the per-plan cap, who carries exchange-rate drift, and whether the "paid directly" interim comes first.
- Every refund, payout, due-date extension and payout override.
- Passing the section 3.8 points to legal and the advocate.
