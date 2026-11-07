# Deposit refund rule: recommendation (business-manager, 2026-11-07)

Draft for Walter. Nothing has been sent to anyone. Deposits stay off until the company is registered, the advocate has answered, and Walter says go. This page does not decide law. Every legal point is flagged for `legal` and the Tanzanian advocate.

Sources used: `docs/payments/selcom-sandbox-plan.md`, `docs/business/payments-research-2026-10-30.md`, `docs/business/soft-launch-business-plan.md`, `docs/legal/deposit-and-refund-policy.md` (v0.1), `supabase/migrations/20261014000200_payments.sql`, `20261107000000_deposit_only_on_open_trips.sql`.

## 0. Starting point

- **What Walter decided (2026-11-07):**
  - Kwetuly keeps a share of some refunds, "maybe 10%", to cover transaction costs.
  - New deposits close 7 days before the trip starts.
  - Mobile money and cards are both available at launch.
  - A deposit on a cancelled or rejected trip cannot be marked "paid out".
- **What the draft policy says today:** 4.2 (organiser cancels) and 4.3 (minimum not reached, or organiser cancels) give 100% back. The 4.1 table holds only placeholders.
- **What we know about Selcom's fees: nothing published.** Collection fees (card or mobile money), refund cost, payout fee and chargeback fee are all **to verify** with a written Selcom quote. Selcom documents no refund endpoint, so refunds are manual (research doc, sandbox plan section 2).
- **For scale only, not Selcom's prices:** Flutterwave, our backup provider, publishes 4.8% per card payment, 2.5% per mobile-money payment and 1.5% per mobile-money payout of TSh 40,000 or more, VAT not included (https://flutterwave.com/tz/pricing, read 2026-10-30).

### What a refund costs Kwetuly (formula; every input is to verify)

For a deposit D in TSh:

`refund cost = collection fee on D (if Selcom keeps it after a refund) + refund or reversal fee + payout fee (if the refund goes out as a wallet payment) + VAT on those fees + staff time`

`share needed to break even = refund cost / D`

Example of the formula only, using Flutterwave's public prices as a stand-in. A card deposit, where the provider keeps its 4.8% and the refund goes out at 1.5%, comes to about 6.3% before VAT and staff time. On that example, 10% covers the cost but would not hold much spare. **Walter should only fix the percentage after Selcom's quote.**

## 1. Recommendation (option A): "whoever causes the cancellation pays for it"

Kwetuly keeps 10% of the deposit only when the **traveller** causes the refund. In every other case the traveller gets 100% back.

| # | Case | Traveller gets back | Organiser keeps | Kwetuly keeps | Who bears Selcom fees |
| --- | --- | --- | --- | --- | --- |
| 1a | Traveller cancels **30 days or more** before the start | 90% | 0% | 10% (at most a cap, see below) | Covered by Kwetuly's 10% |
| 1b | Traveller cancels **8 to 29 days** before | 40% | 50% | 10% (cap) | Covered by Kwetuly's 10% |
| 1c | Traveller cancels **7 days or less** before, or after the start | 0% | 100% | 0% | Kwetuly, as on any completed deposit (decision 4) |
| 2 | **Organiser or guide cancels**, changes the price, dates or main itinerary, or the trip is taken down after approval because of the organiser | 100% | 0% | 0% | Kwetuly pays first. It may recover its **actual** fees from the organiser's next payout, up to 10% of the deposit. Not recovered when the cause is outside anyone's control (park closure, government ban). |
| 3 | **Minimum group size not reached** (organiser calls it off) | 100% | 0% | 0% | Kwetuly absorbs. Nobody is at fault, and guides are our core customers. Review an organiser who keeps setting minimums too high. |
| 4 | **Kwetuly cancels** (safety, fraud, suspension) | 100% to the original payment method | 0% | 0% | Kwetuly. If the organiser committed fraud or a serious breach, recover the fees and any amount already paid out from the organiser. If the payer committed fraud (for example a stolen card), refund only to the original card or wallet, never to another account, and hold it if the advocate says we must. |
| 5 | **Payment held for review**, or paid after the trip closed (cancelled, rejected, back in review, member declined, or past the 7-day cut-off) | 100%, unless the trip is still going ahead and the traveller and organiser both confirm in writing that they want the booking | 0% (or a normal deposit, if confirmed) | 0% | Kwetuly. Our system accepted the money, so the traveller must not lose any of it. |
| 6 | **No-show** | 0% | 100% | 0% | Kwetuly, as on any completed deposit |
| also | Paid twice or by mistake, or join request declined (policy 4.4) | 100% | 0% | 0% | Kwetuly |

### Rules that apply to all cases

- **The organiser's own terms.** If the offer or group trip shows the organiser's own cancellation terms, those decide the organiser's share in 1a to 1c. Kwetuly's 10% stays the same in every case.
- **Kwetuly's 10% comes only out of money that is being refunded.** It is never more than the refund, so when the organiser keeps everything (1c, 6), Kwetuly takes nothing extra.
- **A cap on Kwetuly's share, in TSh.** Walter sets it after the Selcom quote. Without a cap, 10% of a large Kilimanjaro deposit would be far more than the real cost, and would look like a penalty.
- **How days are counted.** Days before the start use the trip's start date and today's date in Tanzania. Requests with flexible or no dates count as "30 days or more" until a start date is agreed.
- **Currency and rounding.** All amounts are in whole TSh. Kwetuly's share is rounded down to the nearest TSh 100, in the traveller's favour. The three parts always add up to the amount paid.
- **One rule for every payment method.** Card and mobile money get the same percentages. A different charge by payment method could count as a card surcharge (see section 3).
- **Which rule applies.** The rule in force when the traveller paid applies, and its version is stored with the payment.
- **Who approves.** Walter approves every refund, as today.

### Why A

- **Fairness.** The traveller pays the cancellation cost only when they chose to cancel. Cases 2 to 5 are 100% back, so 4.2 and 4.3 in the draft policy stay as they are.
- **Chargebacks.** A traveller abroad who loses 10% because the organiser cancelled will often dispute the card payment, and card issuers usually side with the cardholder when the service was not provided. Kwetuly would then lose the full amount, plus a chargeback fee (to verify), plus staff time. That is worse than refunding 100% in the first place. When the traveller cancels and saw and accepted the rule before paying, Kwetuly has a defensible record.
- **Business model.** Kwetuly earns from badges, per-agreement commission and, later, guide packages and prep calls. The 10% is **cost recovery, not a revenue stream**. We should not budget it as revenue, and Kwetuly must never look as if it profits from cancellations. Track what is kept against the actual Selcom costs, and lower the percentage if it runs well above cost.
- **Guides.** Recovering fees from an organiser who cancels discourages late cancellations, the thing that hurts traveller trust most. Recovery covers actual costs only, and never applies to force majeure or a minimum not reached.

## 2. Alternative (option B): "actual cost only"

The table is the same, but in 1a and 1b Kwetuly keeps only the **actual Selcom costs of that payment and its refund** (the formula in section 0), at most 10%, shown on the refund receipt. Kwetuly also absorbs organiser cancellations (no recovery from guides).

- **For:** the easiest to defend under consumer law and in a chargeback, because Kwetuly keeps exactly its costs. It is also the friendliest option for guides.
- **Against:** the traveller cannot see the exact amount before paying (only "up to 10%"). Every refund has to be worked out by hand until Selcom's fees are known. Kwetuly carries all the cost of organiser cancellations.

**Not recommended: 10% kept on every refund**, including when the organiser cancels. It breaks the 100% promise in 4.2 and 4.3, invites chargebacks from travellers abroad, is the weakest position under consumer protection (for legal), and makes a traveller pay for a cancellation they did not cause.

## 3. Points for legal and the advocate (flagged, not decided)

1. Is a 10% cancellation charge, kept by Kwetuly and disclosed before payment, fair and enforceable under the Fair Competition Act 2003 and Tanzanian consumer protection? Do we need a cap, or a cooling-off period?
2. Could Kwetuly's charge count as a **card surcharge** under the Bank of Tanzania ban? The proposed answer is no, because it is the same for every payment method and is only taken on a cancellation, but the advocate must confirm. It must also apply to payments from non-residents.
3. **Tax.** The amount Kwetuly keeps is Kwetuly's income (VAT, EFD receipts). Which receipt does the traveller get for a partial refund?
4. Can Kwetuly deduct fees it recovers from organisers from their future payouts? This needs a clause in the guide and business terms (7.3), and depends on structure A, B or C (whether Kwetuly holds the money at all).
5. Refunds are made in TSh. What do we have to say about exchange-rate differences for travellers paying by foreign card?
6. **Payer fraud (case 4).** Must a refund be held, or reported, and to whom?

## 4. What the traveller sees before paying (English, plain)

The box is filled in from the real numbers. If the organiser has their own terms, their percentages replace the middle line. `localization` translates it into all 7 languages, and the organiser's version goes into English and Kiswahili.

> **Before you pay**
>
> You are paying a deposit of TSh [amount] (about US$ [amount]) to [organiser name] through Kwetuly. It is part of the trip price, not an extra fee.
>
> **If you cancel:**
> - 30 days or more before the trip: you get 90% back. Kwetuly keeps 10% (at most TSh [cap]) to cover payment and refund costs.
> - 8 to 29 days before the trip: you get 40% back. [Organiser name] keeps 50% and Kwetuly keeps 10% (at most TSh [cap]).
> - 7 days or less before the trip, or if you don't turn up: no refund. [Organiser name] keeps the deposit.
>
> **If [organiser name] cancels, the trip doesn't get enough people, or Kwetuly stops the trip:** you get 100% back.
>
> Refunds go back to the card or mobile-money account you paid with, in Tanzanian shillings. Your bank may use a different exchange rate. Full rules: [Deposit and Refund Policy link].
>
> [ ] I have read how refunds work.

Wording rules: no "guaranteed", no "escrow", no "held by Kwetuly" (see the drafting note in the policy), and no arrows on the button.

## 5. What must change

### Code (for payments-engineer; checked by qa-tester and security-reviewer, because it touches money)

1. **A refunds record.** Add a `refunds` table, or columns on `payments`, holding:
   - the case: `traveller_cancel`, `organiser_cancel`, `force_majeure`, `min_not_reached`, `kwetuly_cancel`, `review_or_late`, `no_show`, `duplicate`;
   - days before the start (Tanzania date), the rule version, and the tier;
   - `refund_tzs`, `kwetuly_keeps_tzs` and `organiser_keeps_tzs`, as integers, with a check that they add up to `amount_tzs`;
   - requested by and when, approved by and when (Walter), sent at, method (card reversal or wallet), provider reference, and status (requested, approved, sent, confirmed or failed).

   Today `payment_status` has only `refunded` and no amounts.
2. **One function for the split.** Put the split calculation in `packages/shared`, with tests for every row of the table, the cap and the rounding. Mirror it in a database guard so the database refuses an approval that does not match the rule.
3. **The 7-day cut-off.** In `private.guard_new_payment` and the payments function, change "start date after today" to "start date at least 8 days after today" (Tanzania date), for both group and offer deposits. This also settles part of sandbox-plan decision 6. Check the exact boundary with Walter: does "7 days before" mean day 7 is still open, or already closed?
4. **Payout guard (Walter's decision).** Block the "paid out" tick when:
   - the trip is cancelled or rejected, or the member is declined or cancelled;
   - a refund is open on the payment;
   - the payment is in `review` or under a card dispute.

   After a split refund, only `organiser_keeps_tzs` may be paid out.
5. **Why a trip was cancelled.** Group trips and offers need a cancellation reason (organiser, minimum not reached, force majeure, Kwetuly) so the right case is chosen. Travellers also need their own "cancel my spot" action, with a timestamp. Before confirming, it shows the traveller exactly what they will get back.
6. **Before paying.** Show the box from section 4 with the tick box. Store the rule version and the acknowledgement on the payment row.
7. **Recovery from organisers (option A only).** Record what an organiser owes Kwetuly in actual fees, and deduct it in the planned `payouts` flow, with Walter approving.
8. **Disputes.** Add a "disputed" state for card chargebacks, which blocks payouts and alerts admins.
9. **Receipts.** The refund email and push show the three parts (refund, organiser, Kwetuly) and the reason.
10. **Cards.** This rule assumes cards work, which still needs the move to `checkout/create-order` (research doc).

### Refund policy (for legal; `docs/legal/deposit-and-refund-policy.md`)

- **1.2:** state that Kwetuly keeps 10% (with the cap) of a refund the traveller causes, and that this is Kwetuly's charge, separate from the organiser's share. Remove the "no fee / [X]" placeholder.
- **4.1:** replace the placeholder table with the 1a to 1c tiers. Add that the organiser's own terms set the organiser's share, while Kwetuly's charge stays the same.
- **4.2 and 4.3:** keep 100%, and add "Kwetuly keeps nothing".
- **4.4:** keep it. Add the new clauses: no-show (6), Kwetuly cancels (4), and payments held for review or paid after the trip closed (5), each with 100% or 0% as in the table.
- **4.5:** link force majeure to "no fee recovered from the organiser".
- **4.6:** treat it as an organiser cancellation.
- **5.3:** refunds are made in TSh to the original method. Add the exchange-rate note.
- **7.3 and 7.5, and the guide and business terms:** organiser cancellation means a 100% refund to the traveller, and recovery of Kwetuly's actual fees, up to 10%, from the next payout.
- Add the section 3 questions to the advocate list.

## 6. Tracking (for data-analyst, once deposits are live)

Track monthly:
- the refund rate by case;
- what Kwetuly kept against the actual Selcom costs;
- the chargeback count and rate;
- organiser cancellations per organiser.

Review the 10% after 3 months of real data.

## Decisions for Walter

1. **The rule.** Recommendation: option A. Kwetuly keeps 10% only when the traveller cancels, and the traveller gets 100% back when the organiser cancels, the minimum is not reached, Kwetuly cancels, or the payment was late or held for review.
2. **The percentage and a cap.** Recommendation: use 10% as a working number. Confirm it, and set a TSh cap, only after Selcom's written fee quote.
3. **The default tiers when an organiser sets no terms.** Recommendation: 30 days or more, 90% back; 8 to 29 days, 40% back; 7 days or less, or a no-show, nothing back. These are business proposals, not market data.
4. **Who pays the Selcom collection fee on a normal, completed deposit.** Recommendation: Kwetuly absorbs it for now (no traveller fee, which also stays clear of the surcharge question). Decide whether to pass it to organisers once the fee is known.
5. **Recovering actual fees from organisers who cancel (except force majeure).** Recommendation: yes, up to 10%, deducted from the next payout, and only after legal adds the clause to the guide and business terms.
6. **The exact 7-day cut-off.** Recommendation: the last day to pay is 8 days before the start date (Tanzania date), so no deposit is ever taken within the 7-day "no refund" window.
7. **Send section 3 to legal** to prepare the questions for the advocate. Recommendation: yes. Nobody contacts the advocate without you.
8. **Ask payments-engineer to plan the section 5 code changes** (plan only, nothing applied). Recommendation: yes, after decisions 1 to 3.
