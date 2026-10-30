# New ideas: business view (catalogue, online lessons, more ways to pay)

Prepared by business-manager on 2026-10-30 for Walter. Draft only. Nobody has been contacted. Walter decides every price and rate.

Inputs:
- `docs/tech/post-launch-catalogue-lessons-payments-plan.md` (tech-lead)
- `docs/legal/lessons-payments-items-research.md` (legal research, not yet seen by an advocate)
- `docs/business/soft-launch-business-plan.md` (badge, 50/50 referral split, no fee on guides during soft launch)
- `docs/business/payments-research-2026-10-30.md` was **not in the repo yet** when I wrote this. I used the payments facts in the brief and checked the Flutterwave figures myself (below).

Rules used: no invented prices, partners or results. Provider fees are cited. Everything else marked **[Assumption]** is mine, for planning only.

## Fee facts used

| Fact | Source |
| --- | --- |
| Flutterwave Tanzania: local and international cards 4.8%; mobile money collection 2.5%; payout to mobile money TZS 500 below TZS 40,000 and 1.5% from TZS 40,000; payout to bank TZS 3,000 | [flutterwave.com/tz/pricing](https://flutterwave.com/tz/pricing), checked 2026-10-30 |
| Flutterwave prices **exclude VAT** and other local taxes | same page |
| Flutterwave default: **the customer bears the transaction charge**, which can be changed in the dashboard | same page (FAQ) |
| Flutterwave does not list FX conversion, chargeback or settlement fees on that page | same page |
| Selcom (main provider): fees not published, quote needed | brief from payments research |
| Stripe not available; Wise cannot hold funds; BoT may ban card surcharges; holding funds may need BoT approval | brief from payments research and legal research section 2 |

---

## 1. How each idea makes or costs money

| Idea | Who pays Kwetuly | What it costs Kwetuly | Licence or approval |
| --- | --- | --- | --- |
| Item catalogue | Nobody directly. It strengthens the two streams we already have: the yearly badge and per-agreement referral commission. | Build (size M). **Admin review of every item**: this is the main running cost. Legal list of banned goods. Photo storage (small). | Seller's own licences (dealer licence for gems, etc.). Advocate on Kwetuly's liability for approved items (legal Q21). |
| Online lessons | Learner, through a disclosed Kwetuly commission, **only once payment goes through Kwetuly**. Before that: nothing. | Build (size M). Teacher approval and checks. Customer care for no-shows and disputes. Card fees and chargebacks once paid online. | Advocate on platform registration (Q11), withholding on teacher payouts (Q13), contractors (Q14). |
| More ways to pay | Nobody directly. It is the pipe that lets Kwetuly collect a fee on lessons, prep calls and later guide packages. | Card fee (4.8% at Flutterwave), payout fees, chargebacks, FX spread (unknown), reconciliation time, advocate time. | Company registration first. BoT question on holding funds (legal Q5 to Q8). Provider KYC. |

### 1a. Can the catalogue fit the existing badge or commission model?

Yes, without any new fee. My view:

- **Catalogue free for every approved business.** It is part of the free listing. Do not charge per item or for "more items": a paid catalogue size is the rejected tiered model coming back.
- **Badge unchanged.** The badge stays about the business ("what was checked and when"). It does not cover items and does not unlock more items or better placement.
- **Commission through the existing per-agreement model.** Order requests will now carry the item (`leads.listing_id`) and the listed price at that moment. That gives Kwetuly a record of referred orders to compare against what the shop reports each month. It does not prove a sale (the traveller still pays the shop), but it is a much better audit trail than today's free text.
- The commission note stays visible to travellers on every business page with an agreement.

Risk: shops under-report sales they made off our order requests. Mitigation: monthly report from the order-request log, sent to the shop with the invoice (draft by accounting).

### 1b. Should lessons carry a commission, and how much?

Yes, once payment goes through Kwetuly. A commission collected at checkout is the cleanest money Kwetuly can earn: automatic, disclosed, no invoicing on trust. It should use the **same rate as paid prep calls**, so guides learn one rule.

Options (all are a % of the lesson price the teacher sets; the teacher sees their payout before publishing):

| Option | Kwetuly commission | For | Against |
| --- | --- | --- | --- |
| 1 | 10% | Easy to accept for teachers | On a USD 20 lesson Kwetuly keeps about USD 0.55 to 0.77 after card and payout fees (section 2). One chargeback wipes out the margin of 25+ lessons. |
| 2 | **15%** (recommended) | Covers card and payout fees with a margin on both price points; still leaves the teacher 85% | Teachers may compare it with taking payment themselves |
| 3 | 20% | Best margin | Pushes teachers to take learners off the platform after the first lesson |

These rates are **my proposal [Assumption]**, not market data. I have no figures on what other lesson platforms charge in Tanzania and did not use any.

### 1c. Who absorbs the card fee?

| Option | How | For | Against |
| --- | --- | --- | --- |
| A. **Kwetuly absorbs it from its commission** (recommended) | Learner pays the listed price. Teacher gets price minus commission. Card and payout fees come out of Kwetuly's commission. | Simple and honest: the price shown is the price paid, the teacher's payout is fixed. No surcharge question. | Kwetuly's margin moves with the provider's fees. Needs a commission of about 15% to stay comfortably positive. |
| B. Fees taken off the top, then split | (price minus fees) × 85% to the teacher | Shares the cost | Teacher's payout changes per payment and is harder to explain. |
| C. Learner pays a surcharge | Fee added at checkout | Kwetuly keeps the full commission | **BoT may ban card surcharges**; checkout price jumps (drop-offs); GN 198 currency questions. Not recommended. |

Important: Flutterwave's **default is that the customer bears the charge**. If Flutterwave is used, that setting must be switched to "merchant bears" before the first live payment, unless the advocate confirms surcharges are allowed.

---

## 2. Unit economics: one lesson paid by foreign card through Flutterwave

**Model (option A above): Kwetuly net = commission − card fee − payout fee.** Teacher gets price × (1 − commission), paid by mobile money.

Assumptions:
- **[Assumption]** Card fee 4.8% of the price; payout fee 1.5% of the teacher's payout (the payout is TZS 40,000 or more). If the payout is under TZS 40,000 the fee is a flat TZS 500 instead. Which band applies depends on the exchange rate on the day; I did not assume a rate.
- **[Assumption]** Low case: fees as published, no VAT on fees. High case: VAT added to Flutterwave's fees at 18% (the Tanzanian standard rate; accounting to confirm whether it applies and can be reclaimed).
- **Not included** (unknown, ask in quotes): FX conversion spread, chargeback fee, refund fee, VAT on Kwetuly's own commission, any withholding tax on the teacher payout, Kwetuly staff time.

All figures in US$.

### USD 20 lesson

| Commission | Kwetuly commission | Card fee | Payout fee | Teacher gets | **Kwetuly net (no VAT on fees / with 18% VAT)** |
| --- | --- | --- | --- | --- | --- |
| 10% | 2.00 | 0.96 / 1.13 | 0.27 / 0.32 | 18.00 | **0.77 / 0.55** |
| 15% | 3.00 | 0.96 / 1.13 | 0.26 / 0.30 | 17.00 | **1.79 / 1.57** |
| 20% | 4.00 | 0.96 / 1.13 | 0.24 / 0.28 | 16.00 | **2.80 / 2.58** |

### USD 50 lesson

| Commission | Kwetuly commission | Card fee | Payout fee | Teacher gets | **Kwetuly net (no VAT on fees / with 18% VAT)** |
| --- | --- | --- | --- | --- | --- |
| 10% | 5.00 | 2.40 / 2.83 | 0.68 / 0.80 | 45.00 | **1.93 / 1.37** |
| 15% | 7.50 | 2.40 / 2.83 | 0.64 / 0.75 | 42.50 | **4.46 / 3.92** |
| 20% | 10.00 | 2.40 / 2.83 | 0.60 / 0.71 | 40.00 | **7.00 / 6.46** |

### Selcom (unknown)

Selcom's fees are not published, so I cannot put a number in. Once the quote arrives:

**Kwetuly net = price × (commission − Selcom card %) − Selcom payout fee − any fixed per-payment fee.**

Break-even check: Kwetuly loses money on a lesson whenever the card % plus the payout cost (as a % of the price) is higher than the commission. At Flutterwave's rates that is about 6.2% to 7.4% of the price, so a 10% commission is thin and 15% is safe. If Selcom's card fee is lower than 4.8%, Kwetuly keeps the difference under option A.

### What the numbers say

- At 15%, Kwetuly earns about **US$1.6 to 1.8 per USD 20 lesson** and **US$3.9 to 4.5 per USD 50 lesson** before FX spread, VAT on our own fee and staff time.
- **Chargebacks are the real risk.** If the teacher has already been paid, one disputed USD 20 lesson costs Kwetuly about USD 20 plus fees, roughly the net of 11 to 13 lessons at 15%. Pay the teacher only after the lesson is marked done, and ask providers who carries the chargeback (section 5). Whether even that short hold counts as "holding funds" is the advocate's question (legal Q5 to Q8); Option A (the provider holds the money) avoids it.
- **[Assumption]** Proposal: a minimum lesson price so fixed costs don't eat the margin. Walter to set it once the Selcom quote is in.
- Lesson revenue only matters at volume: 100 lessons a month at USD 20 and 15% would be about US$160 to 180 net a month **[illustration, not a forecast]**, enough to cover the soft-launch running costs (about US$46 to 76 a month, see the soft-launch plan).

---

## 3. Launch lessons with "pay the teacher directly" first?

| Pros | Cons |
| --- | --- |
| Can start right after the build (size M), long before company registration, Selcom and the advocate's answer on holding funds | **No revenue for Kwetuly.** Invoicing teachers a commission on trust is not workable (same reason as prep calls in the soft-launch plan). |
| Tests the real question first: will learners abroad book Kiswahili and cooking lessons with Tanzanian teachers? | Learners abroad must find their own way to send money to Tanzania. That is friction, and many will give up. |
| Gives guides a second income in the low season, which fits "guides first" | Pay-first scams and no-shows: Kwetuly cannot refund, so a bad experience lands on Kwetuly's name anyway. Customer care needs a script. |
| Nothing for BoT, card fees or chargebacks to worry about | It teaches learners and teachers to pay outside the platform. That habit is hard to undo when the 15% commission starts. |
| | Payment between a foreign learner and a teacher is invisible to us, so the payment-dispute data we would learn from does not exist. |

**Recommendation [my view]:** yes, but as a small **invite-only pilot**, free for teachers (no commission):
- 5 to 10 approved teachers, all living in Tanzania (legal 3.2 suggestion).
- Adults only (18+ tick).
- Clear copy: "You pay the teacher directly. Kwetuly does not take payment for lessons yet."
- Teacher terms state in writing, from day one, that a disclosed commission will apply to lessons paid through Kwetuly once online payment exists.
- Measure: lessons requested, accepted, held (teacher-reported), reviews, complaints. Data-analyst adds these to the scorecard.

If Walter prefers not to carry any off-platform payment risk, the alternative is to build lessons but keep them hidden until online payment is live.

---

## 4. Which business types get the catalogue first (item limit 50)

The tech-lead proposes curio, tanzanite and gear rental first, then restaurant, spa and salon. I would change the order on risk:

| Order | Types | Why |
| --- | --- | --- |
| 1 | **Curio shops, gear rental** | Order requests already work for them. Clear referral commission fit. Legal risk manageable with the banned list (no ivory, trophies, coral, shells, relics) and an export note on wood carvings (blackwood). |
| 2 | **Restaurant, spa, salon** as price lists (enquiry only) | Low legal risk (no export, no high-value goods). Useful for travellers. Little direct revenue unless a referral agreement exists. |
| 3 | **Tanzanite / gem shops**, after the advocate answers legal Q18 | Highest value, so the most commission per sale, but also the highest risk: mineral dealer licence, certificate of origin, export limits, AML "reporting person" status, fake stones. Only with the dealer licence seen and recorded, and never "genuine" or "certified" wording. |

**Item limit:** 50 per business is fine as a hard cap. The real limit is **admin review time**: every item is checked against the banned list. **[Assumption]** If one item takes about 5 minutes to review, a full 50-item catalogue is about 4 hours of admin time per business, plus re-reviews when prices or photos change. So control the review load by how many businesses get the catalogue each week, not by lowering the cap. Walter or operations should set that pace.

---

## 5. Questions for payment providers (Walter sends; drafts only)

Same questions to Selcom, Pesapal, DPO and Flutterwave, so the answers can be compared side by side. I have not stated any fee for Pesapal or DPO because I have no published source in front of me.

**Licence and structure**
1. What is your Bank of Tanzania licence number and category? Can you send the certificate?
2. Can you collect payments for a marketplace and pay out to many guides, teachers and shops on our instruction, with the money held in **your** licensed settlement or trust account, never ours? Do you need BoT approval for that partnership, and how long does it take?
3. Do you offer split payments or sub-accounts, so the payee's share and our commission are separated at payment time?
4. Can a company that is still being registered start onboarding? Which documents do you need from us (BRELA, TIN, business licence, directors' IDs) and from payees (KYC)?

**Card collection**
5. Fees for international Visa, Mastercard and Amex cards, and for local cards: percentage, fixed fee, and is VAT added?
6. Which currency is the cardholder charged in, which do we settle in, and what exchange rate and spread do you use?
7. Is 3-D Secure on every card payment? Apple Pay or Google Pay?
8. Can the fee be passed to the customer, and are card surcharges allowed under BoT and card-scheme rules? Can we set "merchant bears the fee" by default?
9. Settlement time to our account, and any minimum or rolling reserve?

**Mobile money and payouts**
10. Fees and limits for payouts to M-Pesa, Mixx by Yas (Tigo Pesa), Airtel Money, HaloPesa and to banks. Any fees on payouts to recipients outside Tanzania?
11. Can payouts be scheduled for after the service is delivered? Who holds the money in between?
12. Mobile-money collection fees for travellers paying inside Tanzania.

**Refunds and disputes**
13. Fee for a refund, and is the original card fee returned?
14. Chargeback fee, dispute window, evidence needed, and who carries the loss if the payee has already been paid?

**Costs and contract**
15. Setup, monthly, minimum-volume or account-closing fees?
16. Contract length, notice period, and can the published prices change without notice?
17. Name shown on the card statement (should say Kwetuly, to reduce chargebacks).

**Technical and data**
18. Test (sandbox) account, API and webhook docs, and daily settlement reports for reconciliation.
19. Where is card and personal data stored (Personal Data Protection Act 2022)? PCI DSS level?

---

## Decisions for Walter

1. **Catalogue money model.** Recommendation: free for every approved business, no per-item or "more items" fee; badge unchanged; revenue through existing per-agreement referral commission, with order requests linked to items as the audit trail.
2. **Lesson commission.** Recommendation: 15% of the lesson price, the same rate as paid prep calls, disclosed to learners, starting only when payment goes through Kwetuly.
3. **Who absorbs the card fee.** Recommendation: Kwetuly, from its commission (option A). No surcharge on learners. If Flutterwave is used, switch its "customer bears the fee" default off.
4. **Lessons before online payment.** Recommendation: an invite-only pilot with 5 to 10 Tanzania-resident teachers, "pay the teacher directly", no commission, with the future commission written into the teacher terms from day one. Alternative: keep lessons hidden until payment is live.
5. **Catalogue order.** Recommendation: curio and gear rental first; restaurant, spa and salon price lists second; tanzanite and gem shops only after the advocate answers legal Q18 and with the dealer licence recorded.
6. **Item limit.** Recommendation: hard cap of 50 per business; control admin review load by how many businesses are added each week.
7. **Minimum lesson price.** Recommendation: set it after the Selcom quote, so fees and chargeback risk don't eat the margin.
8. **Provider quotes.** Recommendation: send the section 5 questions to Selcom, Pesapal, DPO and Flutterwave yourself once the company registration is underway, and have payments-engineer and accounting compare the answers in one table.
