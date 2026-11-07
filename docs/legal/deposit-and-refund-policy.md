# Kwetuly Deposit and Refund Policy

> **DRAFT - not reviewed by an advocate.**
> DRAFT – to be reviewed by a Tanzanian advocate. Not legal advice. Do not publish or turn deposits on until Walter approves a version reviewed by a Tanzanian advocate.
> **Status: deposits are OFF for the soft launch.** This policy is written for when they are switched on. Until then, travellers pay guides and businesses directly and Kwetuly takes no trip payments.
> Prepared: 2026-10-16 by the Kwetuly legal research helper (AI). Version: 0.2 (2026-11-07).
> Square brackets `[...]` are placeholders. "Drafting note" boxes must be removed before publication.

> **Change note, v0.2 (2026-11-07). DRAFT for the advocate.**
> Walter chose option A, "who causes it pays", on 2026-11-07 (see `docs/business/deposit-refund-rule-2026-11.md`). Every changed or new clause is marked **[v0.2 DRAFT]**. Changes:
> - 1.2: Kwetuly's cancellation charge of 10% (at most TSh [CAP]) only when the traveller cancels; no traveller fee on a completed deposit.
> - 1.5 (new): deposits close 8 days before the start date (Tanzania date).
> - 2.4 (new): the same rules for card and mobile money; no extra charge for paying by card.
> - 4.1: placeholder table replaced by the default tiers (30+ days, 8 to 29 days, 7 days or less); organiser's own terms set only the organiser's share.
> - 4.2, 4.3: 100% back, Kwetuly keeps nothing.
> - 4.4: kept. New 4.7 (no-show), 4.8 (Kwetuly cancels), 4.9 (payment held for review or paid after the trip closed).
> - 4.5: force majeure means no fee recovered from the organiser.
> - 4.6: treated as an organiser cancellation.
> - 4.10 (new): how days, rounding and the rule version are worked out.
> - 5.3: refunds in TSh, to the original payment method only, with an exchange-rate note. New 5.4 (Walter approves every refund) and 5.5 (card disputes).
> - 7.3, 7.5, new 7.6: organiser cancellation means 100% back to the traveller and recovery of Kwetuly's actual fees (up to 10%) from the organiser's next payout, except for force majeure and a minimum not reached.
> - 8: payer fraud: refunds only to the original card or wallet.
> - Advocate questions moved to `docs/legal/advocate-questions-refunds-2026-11.md` (new); the v0.1 list stays below.
> Numbers still unknown: Selcom's fees (no written quote yet), the TSh cap, refund timings. 10% is a working number until Selcom's quote.

> Drafting note: the big regulatory question first. The current design has Kwetuly collect deposits through Selcom into Kwetuly's merchant account, show guides "Held by Kwetuly", and pay guides out by hand from the admin page. Holding customers' money for third parties and paying it on may need Bank of Tanzania approval under the National Payment Systems Act, 2015 and its regulations (Payment Systems (Licensing and Approval) Regulations, 2015, which may have been replaced by a later version [unverified]; Payment Systems (Electronic Money) Regulations, 2015). It may also make Kwetuly look like a travel agent under the Tourism Act, 2008. The advocate should advise on the safest structure before deposits go on, for example:
> - (A) Kwetuly as the guide's **commercial agent** that collects on their behalf (need for BoT approval to be checked);
> - (B) **direct split / settlement** by Selcom (or another licensed provider) straight to the guide's wallet, so Kwetuly never holds the money;
> - (C) keep deposits **off** and let guides take deposits directly.
> This draft is written for (A) with placeholders, because that is how the code works today. The wording "held by Kwetuly" must not be used until the advocate confirms the structure. Kwetuly must not offer any stored balance, wallet or credits (parked idea) without BoT approval. **[v0.2 DRAFT]** Under (B), Kwetuly's 10% charge and the fee recovery in 7.6 would have to be built into the provider's split settlement; under (C) they would not exist. The clauses below assume Kwetuly can keep its share before passing the rest on.

Effective date: [EFFECTIVE DATE]

## 1. What a deposit is

1.1 Some guides and companies ask for a deposit to confirm a trip. The deposit percentage is shown in the offer or group trip before you accept or join (for example "Deposit to confirm: 30%").

1.2 **[v0.2 DRAFT]** The deposit is part of the trip price, not an extra fee. Kwetuly charges you no fee for paying a deposit [Walter to confirm: decision 4, Kwetuly absorbs the payment provider's collection fee on completed deposits]. **If you cancel**, Kwetuly keeps a cancellation charge of 10% of the deposit, at most TSh [CAP], to cover payment and refund costs (see 4.1). This charge is Kwetuly's, separate from any share the guide or company keeps. Kwetuly keeps nothing when the refund is not caused by you (4.2 to 4.9).

> Drafting note [v0.2]: 10% is a working number until Selcom's written fee quote. The business page calls it cost recovery, not revenue; Walter should lower it if it runs well above actual costs. The advocate should check whether "to cover payment and refund costs" is accurate enough, or whether Kwetuly must show the real cost (option B on the business page).

1.3 Deposits are taken only for: (a) an accepted trip offer, and (b) an accepted spot on a group trip. [Prep calls and packages: not through Kwetuly at launch.]

1.4 The rest of the price is paid directly to the guide or company as you agree with them, unless the offer says otherwise.

1.5 **[v0.2 DRAFT] When you can pay a deposit.** You can pay a deposit up to 8 days before the trip's start date (Tanzania date). From 7 days before the start, deposits cannot be paid through Kwetuly; you pay the guide or company directly as you agree with them. This means no deposit is ever taken inside the "no refund" period in 4.1.

> Drafting note [v0.2]: the code today closes deposits on the start date (`private.guard_new_payment`, migration 20261107000000). payments-engineer must move it to "start date at least 8 days after today, Tanzania date" before this clause can be true.

## 2. How you pay

2.1 Payments are processed by Selcom [SELCOM LEGAL ENTITY], a [licensed payment service provider: confirm licence status from BoT's register], by mobile money or card. Kwetuly never sees your card number or mobile-money PIN.

2.2 Deposits are charged in Tanzanian shillings. Where the trip is priced in US dollars, the shilling amount is calculated with the exchange rate shown before you pay [source of rate and date: to confirm], rounded up to the next TSh 100. Your bank or wallet may charge its own fees.

2.3 You get a receipt by email and in the app when the payment succeeds.

2.4 **[v0.2 DRAFT] Same rules for every payment method.** Paying by card costs you the same as paying by mobile money. Kwetuly adds no card fee. The cancellation charge and refund percentages in section 4 are the same for card and mobile money.

2.5 **[v0.2 DRAFT] Before you pay**, Kwetuly shows you the deposit amount, the refund rules that apply to your trip (the organiser's own terms or the default terms), and Kwetuly's cancellation charge. You confirm that you have read them. The version of the rules shown to you is saved with your payment and is the one that applies (see 4.10).

## 3. Who holds the deposit, and when the guide gets it

3.1 Kwetuly receives the deposit [as the collecting agent of the guide or company / see drafting note].

3.2 Kwetuly passes the deposit to the guide or company [within [X] working days of payment / [X] days before the trip starts / after the trip starts: Walter and advocate to decide]. Until then, [the money is kept in [a separate account in Kwetuly's name, not used for Kwetuly's own expenses]: advocate to confirm what is allowed]. **[v0.2 DRAFT]** Kwetuly does not pass a deposit on while a refund request or card dispute is open on it, or when the trip has been cancelled or your spot declined. After a split refund (4.1), only the guide's or company's share is passed on.

> Drafting note: the timing in 3.2 decides how much protection travellers get and how long Kwetuly holds money. Paying out before the trip helps guides buy park permits; paying out later protects travellers but increases the regulatory risk of holding funds.

## 4. Cancellations and refunds

4.1 **[v0.2 DRAFT] You cancel.** Use "Cancel my spot" on the booking, or write to us (5.1). The date you cancel is the date we receive it (Tanzania date).

(a) **Default terms.** If the offer or group trip does not show the organiser's own cancellation terms, this applies:

| You cancel | You get back | Guide or company keeps | Kwetuly keeps |
| --- | --- | --- | --- |
| 30 days or more before the start date | 90% | 0% | 10% (at most TSh [CAP]) |
| 8 to 29 days before | 40% | 50% | 10% (at most TSh [CAP]) |
| 7 days or less before, or after the trip has started | 0% | 100% | 0% |

If the cap applies, the difference comes back to you.

(b) **The organiser's own terms.** If the offer or group trip shows the organiser's own cancellation terms, those terms decide how much the guide or company keeps. Kwetuly's charge is still 10% of the deposit, at most TSh [CAP]. Kwetuly's charge only ever comes out of money that would otherwise be refunded to you, so it is never more than that amount. If the organiser keeps everything, Kwetuly keeps nothing extra.

> Drafting note [v0.2]: the tiers are Walter's business proposal (2026-11-07), not market data. Kilimanjaro and park-permit costs are often paid in advance and may be non-refundable, which guides will want reflected through their own terms. The advocate should check that the non-refundable portions and Kwetuly's 10% are fair under the Fair Competition Act 2003 (see advocate questions file, Q1).
> Example for the advocate (default terms, deposit TSh 500,000, cancelled 40 days before, cap not reached): you get TSh 450,000, Kwetuly keeps TSh 50,000, the guide keeps nothing. Same deposit cancelled 15 days before: you get TSh 200,000, the guide keeps TSh 250,000, Kwetuly keeps TSh 50,000.

4.2 **[v0.2 DRAFT] The guide or company cancels** (or cannot provide the trip as agreed), or Kwetuly takes the trip down after approval because of something the guide or company did: you get **100%** of the deposit back and **Kwetuly keeps nothing**, [within [X] days of approval], and Kwetuly will try to help you find another guide. If the deposit was already passed to the guide, Kwetuly will [refund you first and recover it from the guide / ask the guide to refund it: advocate and Walter to decide].

4.3 **[v0.2 DRAFT] Group trip did not reach its minimum number**, or the organiser called it off for that reason: you get **100%** back and **Kwetuly keeps nothing**.

4.4 **Your join request was declined**, or a payment was taken by mistake or twice: 100% refund. **[v0.2 DRAFT]** Kwetuly keeps nothing.

4.5 **[v0.2 DRAFT] Events outside anyone's control** (for example park closures, natural disasters, government travel bans): [the guide and traveller agree a new date or a refund of [X]% of the deposit; costs already paid to third parties such as park fees may be deducted if shown with receipts]. Kwetuly keeps nothing, and does not recover its fees from the guide or company in this case (7.6).

> Drafting note [v0.2]: Walter's decision covers who bears Kwetuly's fees here (Kwetuly) but not the traveller's percentage. The [X]% and the third-party cost deduction are still open for Walter and the advocate.

4.6 **[v0.2 DRAFT] Changes.** If the guide or company changes the price, dates or main itinerary after you paid, and you do not accept the change, you may cancel and get 100% back. This counts as a cancellation by the guide or company (4.2 and 7.6).

4.7 **[v0.2 DRAFT, new] No-show.** If you do not turn up for the trip and did not cancel before it started, you get nothing back. The guide or company keeps the deposit. Kwetuly keeps nothing extra.

4.8 **[v0.2 DRAFT, new] Kwetuly cancels** (for example for safety, suspected fraud, or because the guide or company was suspended): you get **100%** back, only to the card or mobile-money account you paid with, and Kwetuly keeps nothing. If the cause was fraud or a serious breach by the guide or company, Kwetuly may recover its costs and any amount already passed on from them (7.6).

4.9 **[v0.2 DRAFT, new] Payment held for review, or paid after the trip closed.** If your payment was held for checking (for example the amount or currency did not match), or reached Kwetuly after the trip was cancelled, rejected, sent back for review, your spot was declined, or deposits had closed (1.5), you get **100%** back and Kwetuly keeps nothing. The only exception: if the trip is still going ahead and both you and the guide or company confirm in writing that you want the booking, the payment becomes a normal deposit under this policy.

4.10 **[v0.2 DRAFT, new] How we work out a refund.**
- Days are counted from the date we receive your cancellation to the trip's start date, both on the Tanzania calendar. A trip with flexible or no dates counts as "30 days or more" until a start date is agreed in writing.
- All amounts are whole Tanzanian shillings. Kwetuly's charge is rounded down to the nearest TSh 100, in your favour. Your refund, the guide's share and Kwetuly's charge always add up to what you paid.
- The rules in force, and shown to you, when you paid apply to your deposit, even if this policy changes later.

## 5. How to ask for a refund

5.1 Write to [SUPPORT EMAIL] or use [the help link on the booking], with the booking and the reason.

5.2 Kwetuly will tell the guide or company and ask for their side. We aim to decide within [X] working days.

5.3 **[v0.2 DRAFT]** Refunds are made in Tanzanian shillings, only to the card or mobile-money account you paid with, [through Selcom], usually within [X] working days after approval. The time to reach you depends on your provider. If you paid with a card in another currency, your bank converts the shillings at its own rate on the day of the refund, which may differ from the rate on the day you paid, and your bank may charge its own fees. Kwetuly does not control these and cannot make up the difference.

> Drafting note [v0.2]: Selcom documents no refund endpoint, so refunds are manual. The [X] days must come from Selcom's written terms. The advocate should confirm the exchange-rate wording (advocate questions file, Q5).

5.4 **[v0.2 DRAFT, new] Approval.** A Kwetuly manager approves every refund before it is sent. Your refund receipt shows what you get back, what the guide or company keeps, what Kwetuly keeps, and why.

5.5 **[v0.2 DRAFT, new] Card disputes.** You keep any right you have with your card issuer. Please contact us first: a refund through Kwetuly is usually faster. While a card dispute is open, Kwetuly does not pass the deposit on to the guide or company.

> Drafting note [v0.2]: the advocate should check that 5.5 does not read as discouraging a lawful chargeback (advocate questions file, Q8).

## 6. Disputes about the trip itself

If the trip took place but was not as described, contact the guide or company first. If you cannot agree, Kwetuly will look at the offer, messages and evidence from both sides and may [refund part of a deposit not yet passed on / remove the guide's checks or profile]. Kwetuly cannot decide claims about money paid directly to the guide. You keep your rights under Tanzanian consumer law and can complain to the Fair Competition Commission.

## 7. For guides and companies

7.1 You set the deposit percentage (0% means the traveller pays you directly).

7.2 You must state clear cancellation terms in every offer and group trip. **[v0.2 DRAFT]** If you do not, the default terms in 4.1(a) apply. Your terms decide your share only; Kwetuly's charge in 4.1 is the same in every case.

7.3 **[v0.2 DRAFT]** If you cancel, change the trip (4.6), or Kwetuly takes your trip down because of something you did, the traveller gets 100% of the deposit back. Kwetuly may recover any amount already passed to you [from your next payout / by invoice], and its actual fees under 7.6.

7.4 Your payout details must be in your own name. Kwetuly may ask for ID before the first payout.

7.5 **[v0.2 DRAFT]** Kwetuly takes no commission on deposits [Walter to confirm]. When a traveller cancels, Kwetuly keeps its cancellation charge (10%, at most TSh [CAP]) out of the traveller's refund, not out of your share. If Kwetuly ever takes a commission on deposits, it will be shown to you and to travellers before they pay.

7.6 **[v0.2 DRAFT, new] Recovery of Kwetuly's fees when you cancel.** When the traveller gets 100% back under 4.2, 4.6 or 4.8 (fraud or serious breach by you), Kwetuly may deduct from your next payout the payment and refund fees it actually paid on that deposit, up to 10% of the deposit. Kwetuly shows you the amount and how it was worked out before deducting it. Kwetuly does not recover fees when the cause was outside anyone's control (4.5), or when a group trip did not reach its minimum (4.3). [If there is no later payout: by invoice / not recovered: Walter and advocate to decide.]

> Drafting note [v0.2]: whether Kwetuly may deduct from payouts depends on the payment structure (A, B or C) and needs the same clause in the guide terms (7.6) and business terms (D5). Advocate questions file, Q4.

## 8. Fraud and safety

Kwetuly may delay a payout or refund if there are signs of fraud, and will tell you why unless the law forbids it. **[v0.2 DRAFT]** Refunds go only to the card or mobile-money account that paid, never to another account or person, even if asked. If the law requires Kwetuly or Selcom to hold or report a payment, Kwetuly will follow it. Never pay a "deposit" outside the payment button on Kwetuly if someone says it is for Kwetuly.

> Drafting note [v0.2]: what Kwetuly must do on payer fraud (hold, report, to whom) is advocate questions file, Q6.

---

## Open questions for the advocate

v0.2: the questions on the 2026-11 refund rule are in `docs/legal/advocate-questions-refunds-2026-11.md`. The v0.1 list stays:

1. Under the National Payment Systems Act, 2015 and the 2015 Licensing and Approval and Electronic Money Regulations, can Kwetuly collect deposits through Selcom into its own merchant account and later pay guides, without BoT approval? Which of structures A, B or C is safest?
2. Does collecting trip deposits make Kwetuly a tour operator or travel agent needing a licence under the Tourism Act, 2008?
3. If Kwetuly holds deposits, must they be kept in a separate (trust) account? What happens to them if Kwetuly becomes insolvent?
4. Are default cancellation percentages fair and enforceable under the Fair Competition Act 2003? Can guides set non-refundable deposits?
5. Currency: may Kwetuly quote in USD and charge in TZS, and what exchange-rate disclosure is needed? Any foreign-exchange rules on receiving foreign card payments for local services?
6. Tax: is the deposit Kwetuly's income (VAT, EFD receipts) or the guide's? How should receipts be issued?
7. Consumer complaints: should we name the Fair Competition Commission or another body as the escalation route?

## Open questions for Walter

v0.2: answered on 2026-11-07: rule (option A), default tiers, cut-off (8 days), both methods at launch, Walter approves every refund. Still open:

1. Which structure (A, B or C) do you prefer, subject to the advocate?
2. When should guides receive deposits: right away, a set time before the trip, or after the trip starts?
3. The TSh cap, and confirming 10%, after Selcom's written fee quote.
4. Confirm that Kwetuly absorbs the collection fee on completed deposits (no traveller fee) and takes no commission on deposits (1.2, 7.5).
5. Force majeure (4.5): the traveller's refund percentage and whether documented third-party costs may be deducted.
6. Fee recovery when an organiser has no later payout (7.6): invoice, or write off?
7. Refund and decision timings ([X] days in 4.2, 5.2, 5.3), once Selcom's terms are known.
8. Selcom contract: does it allow split settlement directly to guides?
9. The guide dashboard says "Held by Kwetuly": ask frontend-engineer to change this wording once the structure is decided.
