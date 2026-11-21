# Decisions for Walter, 2026-11-21

Task 4 of `docs/product/ideas-2026-11-08.md`: one list built from the six discovery reports. Paper only. Nothing has been built, sent or decided. Nobody has been contacted. Prices are **proposals**, and every figure marked "to verify" is unconfirmed.

How to answer: reply with the number and "yes", "no" or your change, for example "6 yes, 13: 30 days".

Reports (short names used below):
- **Business:** `docs/business/pay-little-and-classes-2026-11.md`
- **Payments:** `docs/business/payments-cards-instalments-2026-11.md`
- **Legal:** `docs/legal/instalments-donations-classes-2026-11.md`
- **Guides:** `docs/guides/crew-teams-design-2026-11.md`
- **HR:** `docs/team/crew-fairness-rules-2026-11.md`
- **Tech:** `docs/team/design-crew-and-trip-management-2026-11.md`

---

## 1. Now: card payments

**1. Merge the card switch (commit 26a75bd) into main.**
- We recommend: yes, after security-reviewer and qa-tester check it. Its database changes go to the test project only.
- Why: every branch except that one still cannot take cards.
- From: Payments.

**2. Build a record for card disputes (chargebacks) and a daily match with Selcom before cards go live.**
- We recommend: yes (1 to 3 weeks). Payouts stop while a dispute is open.
- Why: Selcom sends no dispute notice and no message on failed payments.
- From: Payments.

**3. Send Selcom the questions at the end of this file.**
- We recommend: yes, from your own name. Give no company details that don't exist yet, and accept no agreement.
- Why: fees, 3-D Secure, refunds and the webhook check are not published.
- From: Payments, Business, Legal.

**4. When cards switch on.**
- We recommend: on the test project once Selcom confirms cards for the test account. Live only after company registration, Selcom's written answers and the advocate.
- Why: the question about holding travellers' money is still open.
- From: Payments.

**5. Card texts in all 7 languages:** charged in TSh, "your bank may use its own rate", the card number typed only on Selcom's page.
- We recommend: yes, after the merge.
- Why: travellers see the real currency before paying.
- From: Payments.

## 2. Crew teams and checks

**6. Who pays for crew checks.** On 2026-10-30 you set porter US$5, cook US$7 and guide US$10, with crew paying. The same day's board decision 4 and all three crew reports say crew never pay.
- We recommend: crew never pay, not even by choice. Only the lead guide or operator may pay for his team. It is never taken from pay or tips, and nothing is charged before company registration.
- Why: US$5 is about a quarter of a porter's reported day pay (to verify), and a fee to job seekers may be unlawful (advocate).
- From: Guides, HR, Tech.

**7. The price of a crew check.** There are two proposals: yours (porter US$5, cook US$7), and business-manager's TZS 15,000 per member per year (about US$6 at the example rate of TZS 2,600, which is not a market rate).
- We recommend: one price in shillings per crew member, paid by the guide or operator. Business-manager lines it up once real check times are known, and you set it later.
- Why: one shilling figure is simpler and fits the shilling rule. The two proposals are close.
- From: Guides, HR, `docs/business/paid-guide-check-and-team-seats.md`.

**8. No check needed** to have a profile, join a team, be named in a review or apply for a job. Job posts may not ask for "checked only" crew.
- We recommend: yes.
- Why: otherwise an optional fee becomes a fee to work.
- From: Guides, HR, Tech.

**9. Which checks a crew member needs to be listed.** Tech proposes NIDA for everyone and a driving licence for drivers. Guides says no ID at sign-up.
- We recommend: no ID to be on a team or named in reviews. NIDA is seen on a call (nothing copied) only before a person shows as "looking for work" to operators. Drivers also need a driving licence.
- Why: this keeps sign-up easy and still protects operators. Chief-of-staff suggests it to settle the two reports.
- From: Tech, Guides.

**10. Make the guide checks tables "person" tables now, so crew reuse them.**
- We recommend: yes, before the guide checks database change is drafted.
- Why: it avoids building the same thing twice.
- From: Tech.

**11. How crew sign up.**
- We recommend: the guide invites, and the person confirms by a link or by a short call from Kwetuly. WhatsApp and SMS codes come after registration. No USSD or paper forms. You name one staff member for the calls.
- Why: many wapagazi have basic phones, and a guide's word is not consent.
- From: Guides, Tech.

**12. Who sees crew profiles.**
- We recommend: at first, only signed-in checked guides and approved businesses. The public sees crew only as thanks in reviews. Shown: first name and initial, role, own photo, and stated areas and languages in grey. The phone is never public. All three consent switches start off.
- Why: privacy first. The person decides.
- From: Tech, Guides, HR.

**13. Review window for guide notes on crew: 14 or 30 days.**
- We recommend: 14 days. The person then has 7 days to reply and 14 to appeal.
- Why: the facts are fresher, and a porter is not left waiting.
- From: HR and Tech (14), Guides (30).

**14. How guides review crew.**
- We recommend: up to 3 fixed positive tags and a short note (200 characters). No stars or averages. The person approves before anything shows. Problems go privately to Kwetuly. Operators don't review crew at launch.
- Why: the guide holds the power to hire.
- From: HR, Guides, Tech.

**15. Travellers thank crew.**
- We recommend: names picked only from the trip crew list, thanks only, and the person shows or hides each one.
- Why: no wrong names and no public scoring of people.
- From: Guides, HR, Tech.

**16. Pay floors on job posts.** Proposals, all to verify: porter TZS 25,000 a day, cook TZS 30,000, assistant guide TZS 30,000, lead guide TZS 40,000, driver set by you.
- We recommend: the wording "Kwetuly's minimum for posts on Kwetuly", never "legal minimum wage". Figures go live only after the advocate confirms them, they are reviewed every 6 months, and a higher legal figure always wins.
- Why: the legal minimum for mountain crew is unclear.
- From: HR, Tech, Guides.

**17. Operators paying to see crew contact details** (your 2026-10-30 decision).
- We recommend: hold until the advocate answers the employment-agency question. Even then, a number is shared only when the person says yes.
- Why: it may need a government approval.
- From: Guides, HR, Tech.

**18. Private feedback from crew** (late pay, heavy loads, fees asked). Operators see totals only, from 5 answers.
- We recommend: yes. Names are never passed on without consent.
- Why: it gives porters a safe voice.
- From: Guides, HR, Tech.

**19. Draft messages and the crew code** (Guides section 8, HR section 6).
- We recommend: send them to localization and a native Kiswahili speaker. Nothing is sent to anyone.
- Why: they must sound natural before use.
- From: Guides, HR.

## 3. Paying in parts (lipa kidogo kidogo)

**20. Shape.**
- We recommend: only the same deposit, in 2 or 3 fixed parts, for one booked trip. The organiser switches it on. Part of the balance only later, after the advocate. Never an open savings pot.
- Why: the amount held is the same as today's deposit.
- From: Business, Payments, Legal.

**21. Dates** (placeholders). Part 1 is at least a third, paid at booking. Parts are 14 days apart. The last part is due at least 15 days before the start. Offered only when the trip is 45 or more days away.
- Grace: business-manager proposed 3 days, payments and legal 7. We recommend 7.
- Why: 7 days is fairer, and it still ends before the 8-day cut-off.
- From: Business, Payments, Legal.

**22. A missed part.**
- We recommend: reminders, then grace, then a written notice. After that the organiser chooses: keep the spot (the rest paid to him directly), or release it as a traveller cancellation on the amount paid.
- Why: this follows "who causes it pays", and never keeps everything.
- From: Business, Payments, Legal.

**23. No plan fee, late fee or interest, and travel only after the last part.**
- We recommend: yes.
- Why: otherwise it could count as credit needing a licence, or as a surcharge.
- From: Business, Legal.

**24. The traveller starts each part.** No saved cards and no automatic charges.
- We recommend: yes.
- Why: Selcom doesn't document consent or dispute rules for saved cards.
- From: Payments, Business.

**25. Exchange rate fixed at booking.** Kwetuly carries the small drift.
- We recommend: yes, once accounting confirms.
- Why: the traveller sees one schedule that never changes.
- From: Business, Payments.

**26. Kwetuly's 10% stays the working number,** taken once per plan.
- We recommend: yes. Re-check it against Selcom's fees per payment.
- Why: a fixed fee per payment would multiply with each part.
- From: Business, Payments.

**27. Refunds go back to each part's own card or wallet.** You approve the whole plan's refund once.
- We recommend: yes.
- Why: money is never moved to another account.
- From: Payments.

**28. When.**
- We recommend: no build now. A pilot with 3 to 5 organisers only after deposits have run cleanly for 8 weeks and the advocate and Selcom have answered. There must also be real drop-off data and an operations checklist.
- A smaller option: "a schedule on paper, paid directly to the guide", where Kwetuly only sends reminders. Ask the advocate first (legal question 5).
- Why: it earns Kwetuly nothing extra, so it is only worth it if people really give up at the deposit.
- From: Business, Payments, Legal.

## 4. Classes

**29. Who teaches in the pilot.**
- We recommend: approved guides who teach or cook, and listed businesses such as restaurants. Local cooks come once crew profiles exist. hr adds an in-person section to the teacher code.
- Why: it uses what exists.
- From: Business.

**30. In person first, paid to the teacher directly, Kwetuly takes nothing,** invite only, 3 to 5 teachers.
- We recommend: Kiswahili lessons can pilot after launch. Cooking classes wait until the advocate answers the food permit question, and then start in licensed kitchens.
- Why: Business said go for both, but Legal said cooking stays hidden until the permit answer.
- From: Business, Legal.

**31. Online classes only when paid through Kwetuly.**
- We recommend: yes.
- Why: sending money abroad to a stranger has no protection.
- From: Business.

**32. Kwetuly's share once classes are paid through Kwetuly.** Proposal: 15% (range 10 to 20%), disclosed, with Kwetuly paying the payment fees.
- We recommend: 15%, the same as the proposed prep-call rate.
- Why: 10% is too thin, and 20% pushes teachers off Kwetuly.
- From: Business.

**33. Minimum price for card-paid classes.** Proposal: TZS 30,000 to 40,000 (to verify after Selcom's fees).
- We recommend: set it only after the Selcom quote. It covers Kwetuly's cost and is not a suggested teacher price.
- Why: below that, fees eat the share.
- From: Business.

**34. Small rules:**
- commission on the whole cooking price, ingredients included;
- Kwetuly pays for vetting the pilot teachers;
- a learner who cancels gets a free reschedule first, then a full refund;
- no allergy field on profiles, only an optional field per booking that only the cook sees, deleted 7 days later;
- no recording unless both tick yes;
- teachers who live in Tanzania only.
- We recommend: yes to all.
- Why: simple and fair, with sensitive data kept small.
- From: Business, Legal.

## 5. Trip management build order

**35. Build order.**
- Phase 0, now, on paper.
- Phase 1, month 1 after launch: crew profiles and teams.
- Phase 2, months 2 to 3: the trip file, crew check-in, day plan, included items and rentals, trip report, offline use in the app.
- Phase 3, month 3: reviews linked to trips and crew thanks.
- Phase 4, months 3 to 4: jobs with pay floors.
- Phase 5, month 4: diet, insurance and a family link, only after legal and security-reviewer.
- Later: paid crew checks, contact unlock, paid courses and transfers.
- We recommend: yes.
- Why: crew must exist before trips can list them.
- From: Tech.

**36. A trip file made from a package needs the traveller's "Yes, this is my trip".**
- We recommend: yes.
- Why: it stops made-up trips that would open reviews.
- From: Tech.

**37. No location in day updates in version 1.** Both times are shown (sent and received), and the word "safe" is never used.
- We recommend: yes.
- Why: families must not read an old update as live safety news.
- From: Tech.

**38. Offline use is an app feature only.** The website makes no offline promise.
- We recommend: yes.
- Why: the installable website cannot keep trip data safely.
- From: Tech.

---

## For the advocate (Walter sends; legal first merges it into one pack)

1. `docs/legal/instalments-donations-classes-2026-11.md`: questions 1 to 34.
2. `docs/team/crew-fairness-rules-2026-11.md`: "For a Tanzanian advocate", 10 questions.
3. Tech's 5 legal questions (section 7). Three repeat hr's (consent by call, crew NIDA, pay floor). Diet data joins classes question 29. Only "a crew trip record as a reference" is new.
4. New from Payments: do the Bank of Tanzania 2024 fee guidelines for payment providers limit fees or what Kwetuly may pass on?
5. Still open from earlier memos: `docs/legal/paid-checks-operators-crews.md`, `docs/legal/lessons-payments-items-research.md`, `docs/legal/deposit-and-refund-policy.md`, `docs/legal/advocate-questions-guide-checks-2026-11.md`.

Question count per topic, after merging duplicates:

| Topic | Questions |
| --- | --- |
| Paying in parts | 12 |
| Money donations | 7 (stay parked) |
| Porter hardship notices | 6 (stay parked) |
| Classes | 10 |
| Crew teams and checks | 11 |
| Trip management | 0 new (diet data is in classes) |
| Total | 46 |

## Questions for Selcom (Walter sends, in writing)

Cards:
1. Are Visa, Mastercard (and Amex) on for online checkout, in sandbox and live? What does it cost, and which documents are needed?
2. Is 3-D Secure always applied? Who carries a chargeback, with and without it?
3. How are we told of a chargeback? What are the time limit, the evidence needed and the fee?
4. Can foreign cards pay in TSh, or orders be in USD? Which currency is settled, at whose rate, with what fee, and how fast?
5. Billing fields: flat or nested? How do they appear in the signed fields? What do we send for countries without postcodes?
6. Is the payment page link base64 or plain? Which host does it use?
7. Apple Pay or Google Pay?
8. How do we verify the webhook signature? Are callbacks sent for failed or expired orders? Do our addresses need whitelisting?

Paying in parts:
9. Is stored-card payment open to us? Is a written mandate needed?
10. Are stored-card charges cardholder-started or merchant-started? Is 3-D Secure applied? Who carries chargebacks?
11. Any scheduled or instalment product, or does the merchant start each charge?
12. Limits on stored-card charges? How does a cardholder see and delete stored cards?
13. Mobile-money push: which wallets? How long is it valid? Can it be resent for the same order?
14. Is there a minimum order amount?

Fees, refunds, statements:
15. Fees per method (local card, foreign card, each wallet): percentage, fixed fee, minimum, VAT. Is the fee returned on a refund?
16. How are refunds made? Partial or more than once? Only to the original card or wallet? How long and how much? Is there an API?
17. What settlement statement do we get? Is the order list right for the daily match?
18. Can money be settled straight to a guide's or business's wallet or bank, so Kwetuly holds nothing?
19. Sandbox address, test cards and test wallet numbers. How do we make a test succeed, fail or expire?
20. The longest order number allowed (ours are 35 characters).

---

## From your blueprint

From `docs/product/blueprint-walter-2026-11-21.md`, sorted in `docs/product/blueprint-review-2026-11-21.md`. Nothing here is decided.

Where the blueprint goes against an earlier decision:

**39. "Escrow", and holding the balance until after the trip.** You rejected the escrow redesign on 2026-10-13. Kwetuly takes only the deposit.
- We recommend: keep today's rule. Ask Selcom whether it can settle straight to the guide (Selcom question 18).
- Why: holding money may need Bank of Tanzania approval.

**40. Badge tiers (Basic, Verified, Pro, Premium).** Tiers were rejected on 2026-10-13, and Pro was retired on 2026-11-07.
- We recommend: keep one check that says what was checked and when.
- Why: tiers read as "recommended".

**41. Porter "paid priority access", and a subscription and job acceptance fee for drivers.** Crew never pay (2026-10-30), and drivers are people only while transfers are off.
- We recommend: no.
- Why: these are fees to work.

**42. NIDA or passport from tourists.** Travellers sign in with email, Google or Apple and stay private.
- We recommend: no ID from travellers. An emergency contact may be added, optionally, inside a trip file later, after legal.
- Why: we hold less personal data, and sign-up stays simple.

**43. Star or category ratings of crew.** No star rating of a person without the advocate.
- We recommend: keep positive tags only.
- Why: the power imbalance, and defamation.

**44. "First 100 guides free for 3 months".** Basic approval and the listing are already free with no end date. On 2026-11-08 you said guides pay for the document check (price not set).
- We recommend: keep basic free for good. If you want a launch offer, make it "the first document check free for the first [100] guides", and business-manager costs it.
- Why: free membership is already the promise.

**45. Flutterwave and PesaPal.** Selcom is chosen, and the card switch is built.
- We recommend: stay with Selcom for launch. payments-engineer compares a backup provider later, only if you ask.
- Why: one provider keeps reconciliation simple.

**46. A "Fair Climb Verified" badge.** The badge rule is "what was checked and when, never recommended". The legal note says never use "fair" or "ethical" as a label, and never KPAP's name without their permission. The name may also clash with KPAP's partner programme.
- We recommend: no badge with that name. Show the operator's welfare points one by one, each marked "declared by the operator" or "seen by Kwetuly on [date]".
- Why: it is honest, and it avoids a clash with KPAP.

**47. Subscriptions and listing fees for operators, hotels and gear shops, and delivery fees through Kwetuly.** Businesses list free, with an optional paid badge and commission (2026-10-15), and shops set their own delivery charge (2026-10-30).
- We recommend: keep.
- Why: free listing brings businesses in.

**48. VIP security and medical escort, airport transfers, selling insurance.** No security service (2026-10-31). Transfers are off. Insurance is official links only.
- We recommend: keep.
- Why: these need licences.

New ideas from the blueprint:

**49. PDPC registration and a data retention policy, on paper now.**
- We recommend: yes. legal and security-reviewer prepare them, and you register once the company exists.
- Why: the privacy policy cannot be finished without them.

**50. KPIs from the blueprint added to the weekly scorecard.**
- We recommend: yes, data-analyst, on paper now.
- Why: we measure what matters from day one.

**51. Field onboarding agents in Moshi, Arusha and at the gates, with QR codes, plus a referral programme.**
- We recommend: paper design next, by guide-success, hr, operations-manager and marketing. A pilot only after crew sign-up is built. You ask parks for permission.
- Why: porters and small vendors need people, not only an app.

**52. Payout approval in two steps, a hold on payouts during complaints, and tips shown (never handled).**
- We recommend: yes, payments-engineer, with the payouts table, later.
- Why: fewer payout mistakes, and fairness in disputes.

**53. Trip file extras: weigh-in records, an expense log, official emergency numbers, an incident process.**
- We recommend: weigh-in records and emergency numbers next, with trip management phase 2. The expense log later.
- Why: these fit the trip file already designed.

**54. A three-step dispute process and strikes for all users.**
- We recommend: yes, operations-manager, customer-care and hr, next.
- Why: one fair process for everyone.

**55. SOS with location, helicopter rescue and flights, health data, OCR and selfie checks, crew sharing between companies, donations.**
- We recommend: legal first. Nothing is built or listed before the advocate answers.
- Why: licences, sensitive data and liability.

**56. Academic partners (MWEKA, SUA, IFM).**
- We recommend: partnerships writes a brief later, and you make contact after registration.
- Why: partners will expect a registered company.
