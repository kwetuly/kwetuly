# "Lipa kidogo kidogo" and classes: business view

Prepared by business-manager on 2026-11-08 for Walter. Paper only. Nobody has been contacted, nothing has been built, priced or announced. Walter decides every price, rate and go/no-go.

Tasks 1a and 3a of `docs/product/ideas-2026-11-08.md` (rows A1 to A3, B1 and B2), approved by Walter on 2026-11-08 as paper discovery.

## Muhtasari kwa Kiswahili

(Rasimu. localization ikague, na Walter aikague mwenyewe.)

- **Lipa kidogo kidogo:** tunapendekeza kuanza na njia ndogo na salama zaidi: mgeni analipa **amana ile ile** kwa sehemu 2 au 3 zenye tarehe zilizopangwa, na sehemu ya mwisho inalipwa kabla ya siku 8 za mwisho. Mwongozaji au mratibu ndiye anayeamua kama safari yake inaruhusu hili. Hakuna ada ya ziada kwa mgeni. Sehemu ikikosa kulipwa, kuna siku chache za neema; baada ya hapo ni kama mgeni amefuta safari, kwa kanuni ile ile ya "anayesababisha ndiye anayelipa". Hakuna kitakachowashwa kabla ya amana kufanya kazi na wakili kujibu.
- **Masomo:** masomo ya mapishi ana kwa ana kwanza, kama majaribio madogo kwa mwaliko, mgeni akimlipa mpishi moja kwa moja, Kwetuly bila kuchukua chochote. Masomo ya Kiswahili mtandaoni baadaye, malipo yakipita Kwetuly, na ada ya Kwetuly iliyowekwa wazi (pendekezo: 15%, sawa na simu za maandalizi).

## Inputs and rules used

- `docs/product/ideas-2026-11-08.md`: A1 to A3, B1, B2, and Walter's 2026-11-08 voice rule.
- Walter's 2026-11-07 deposit decisions (team memory note): deposits close **8 days** before the start date (Tanzania date); refunds follow "who causes it pays": traveller cancels 30+ days before, 90% back; 8 to 29 days, 40% back and the organiser keeps 50%; 7 days or less or no-show, nothing back. Kwetuly keeps 10% on traveller cancellations (**working number** until Selcom quotes fees). When the organiser or guide cancels, the traveller gets 100% back and Kwetuly recovers its actual fees, up to 10%, from the organiser, except in force majeure. Walter approves every refund. Mobile money and cards both at launch. Note: the detailed file `docs/business/deposit-refund-rule-2026-11.md` named in that note is not in this worktree; I used the memory note.
- `docs/business/payments-research-2026-10-30.md`: Selcom fees are **not published**; Selcom has **no documented refund API** (refunds manual); webhook only on success; our code uses `create-order-minimal`, which cannot take cards. Flutterwave Tanzania (published, VAT not included, [flutterwave.com/tz/pricing](https://flutterwave.com/tz/pricing), checked 2026-10-30): cards 4.8%, mobile money 2.5%, payout to mobile money TZS 500 under TZS 40,000 and 1.5% from TZS 40,000, payout to bank TZS 3,000.
- `docs/legal/deposit-and-refund-policy.md` (draft, not reviewed): the Bank of Tanzania question on holding money (National Payment Systems Act, 2015), Fair Competition Act 2003, "never call it escrow".
- `docs/business/new-ideas-business-view-2026-10-30.md`: my earlier proposal of a 15% disclosed commission on lessons and prep calls, with Kwetuly absorbing card fees (not yet decided by Walter).
- `docs/business/paid-guide-check-and-team-seats.md`: hourly staff cost placeholders TZS 5,000 / 10,000 / 15,000 (placeholders, **not wage data**); TZS 2,600 = US$1 as the example value from the code comment (**not a market rate**).
- `docs/team/teacher-code-of-conduct.md` (draft v0.1): teachers are approved guides; adults only; video only; learner pays the teacher directly for now; vetting with trial lesson and references.
- `docs/brand/voice.md`: polite, plain, no hype, no claims about switched-off services; porters "wapagazi", deposit "amana".
- Rejected 2026-10-13 and not brought back: tiered plans and escrow.

Every number I chose myself is marked **[Assumption]**. Amounts such as "a TZS 600,000 deposit" are **illustrations for the arithmetic, not prices or market figures**. "To verify" means nobody has confirmed it from an official source.

---

# Part 1. Lipa kidogo kidogo (pay little by little)

## 1.1 What Walter approved, and what that rules out

Approved: only **toward one booked trip**, with a **fixed payment schedule**, **no savings wallet**, **nothing live before the advocate answers**.

Ruled out: an open savings balance, top-ups, cash-out, money that can move between trips, a "save now, pick a trip later" pot, auto-debits nobody asked for each time. Shape (c) from the ideas file (a savings product run by a licensed bank or mobile-money partner) is outside Kwetuly and stays for Walter to explore later; I do not analyse it here.

## 1.2 The shapes still allowed

| Shape | What the traveller pays through Kwetuly | Money Kwetuly collects compared with today's plan | Who it helps | For | Against |
| --- | --- | --- | --- | --- | --- |
| **S0. Today's plan (baseline)** | One deposit (amana) at booking; the rest to the guide directly | Same | Everyone who can pay the deposit at once | Simplest; the advocate question is already being asked (A1) | Budget and Tanzanian travellers may not manage one larger payment |
| **S1. The deposit in 2 or 3 fixed parts (recommended first)** | The **same deposit amount**, split into 2 or 3 parts with fixed dates; last part due before the cut-off; the rest still to the guide directly | **The same total**; held a little longer per part | Tanzanian and diaspora travellers, groups where each member pays their own share | No new money question beyond A1 (same amount, same trip); easy to explain; guide still has the full deposit before the cut-off | The guide gets the full deposit later than with S0; a missed part leaves the guide with less (see 1.4) |
| **S2. Deposit now, plus one or two fixed parts of the balance through Kwetuly** | Deposit at booking, then part or all of the balance in fixed parts before the cut-off | **More** money and for longer | Travellers who want to pay the whole trip before arriving | Real "pay for the whole trip little by little" | Bigger holding question for the Bank of Tanzania and the Tourism Act (is Kwetuly selling the trip?); bigger refunds and chargebacks; needs the advocate first |
| **S3. Several equal parts from booking, no separate deposit** | 3 to 6 equal parts of the full price | Most | Same as S2 | Simple to read | Same as S2, and the guide has little commitment early on; long schedules need bookings far ahead |

**Recommendation:** S1 first (deposit in parts), organiser opt-in per trip or offer. Consider S2 only after S1 has run cleanly and the advocate has answered the larger question. S3: no.

### Proposed schedule rules for S1 [Assumption, proposals for Walter]

- **Up to 3 parts.** More parts add work and failure points without much help.
- **First part at booking, at least one third of the deposit** (or half for 2 parts), so the guide has real commitment from day one.
- **Parts at least 14 days apart.**
- **Last part due at least 14 days before the start date**, so a grace period (below) still ends before the 8-day cut-off. No part is ever taken inside the cut-off.
- So the option appears only when the start date is far enough away: about **28 days** for 2 parts and **42 days** for 3 parts. Otherwise the traveller pays the deposit at once, as today.
- **The schedule and every amount are shown before the first payment**, and the traveller ticks that they accept them.
- **The organiser or guide switches it on** per offer or group trip. Some guides need the whole deposit early (for example for park bookings); they keep S0.
- **Each part is started by the traveller** from a polite reminder (checkout link). No saved cards and no automatic pulls at the start. This avoids the unknown of whether Selcom supports saved cards or scheduled payments (payments-engineer, task 1b, to verify) and keeps consent clear for every payment.
- **Currency:** the shilling amount of every part is fixed at booking, using the rate recorded then, so the traveller's schedule never changes. Exchange-rate drift between parts is carried by [Kwetuly / the guide: Walter to decide]. My recommendation: fix it at booking and accept the small drift as Kwetuly's cost; it is small over a few weeks, and the traveller sees one clear schedule. Accounting to confirm.

## 1.3 Fees on each small payment

**Key point: if a provider charges only a percentage, splitting a payment into parts costs no more in fees.** What costs more is anything fixed per payment, and the extra work.

Illustration only: a TZS 600,000 deposit, paid at once or in 3 parts of TZS 200,000. Flutterwave published rates; Selcom unknown.

| Cost | Paid at once | 3 parts | Source / status |
| --- | --- | --- | --- |
| Mobile-money collection, 2.5% | TZS 15,000 | 3 × 5,000 = TZS 15,000 | Flutterwave published. **Selcom: to verify** |
| Same, with 18% VAT on the fee | TZS 17,700 | TZS 17,700 | VAT on provider fees: **to verify** with accounting |
| Card collection, 4.8% | TZS 28,800 | 3 × 9,600 = TZS 28,800 | Flutterwave published. **Selcom: to verify** |
| Same, with 18% VAT on the fee | TZS 33,984 | TZS 33,984 | To verify |
| Fixed fee per payment, if Selcom has one (F) | F | 3F | **To verify** (Selcom quote) |
| Payout to the guide's mobile money, one payout | 1.5% = TZS 9,000 | One payout after the last part: TZS 9,000. One payout per part: 3 × 3,000 = TZS 9,000 | Flutterwave published. Selcom: to verify |
| Payout to the guide's bank | TZS 3,000 | One payout: TZS 3,000. Per part: TZS 9,000 | Flutterwave published |
| Fees the payer's own wallet or bank charges | Unknown | Unknown, possibly per payment | **To verify** (mobile-money operator charges and card issuer foreign-transaction fees fall on the traveller) |
| Failed or expired attempts | Few | More: each part is a chance to fail | Selcom sends callbacks only on success, so a timed status check is needed (payments research) |
| Reminders (email free on Resend's free plan; SMS or WhatsApp later) | 0 | Up to 2 reminders per part | SMS/WhatsApp cost to verify when switched on |
| Staff time: reconciliation and support [Assumption] | about 5 min | about 5 min per part, so 15 min | Placeholder hourly cost TZS 5,000 to 15,000: about TZS 400 to 1,250 at once, TZS 1,250 to 3,750 for 3 parts |
| Manual refunds, if needed (Selcom has no refund API) | 1 refund | Up to 3 refunds, one per payment | Refund fee and whether the original card fee comes back: **to verify** |

**Rules this gives:**
- **Pay the guide once,** after the last part (under the existing payout rule), not once per part. That keeps bank payouts at one fee.
- **Set a minimum size per part** once Selcom quotes any fixed fee: for example, a part must be at least [X] so that a fixed fee stays under about 1% of the part. X is set after the quote.
- **No plan fee for the traveller.** Reasons: (1) the Bank of Tanzania reportedly bans card surcharges (legal to confirm whether online); (2) a fee for paying in parts could look like a charge for credit (advocate to confirm; there is no lending, because the trip happens only after the last part); (3) it would undercut the reason for the feature. Kwetuly absorbs the extra cost from the 10% and the per-agreement commission.

### Effect on the 10% Kwetuly keeps on traveller cancellations

The 10% is a share of **what was paid**. With S1:
- **Traveller cancels 30+ days out after paying all three parts** (illustration TZS 600,000): Kwetuly keeps TZS 60,000. Card fees already spent TZS 28,800 to 33,984 (if not returned on refund, to verify), plus up to 3 manual refunds. Net about **TZS 26,000 to 31,000** before refund fees and staff time. Mobile money: net about TZS 42,000 to 45,000.
- **Cancels after part 1 only** (TZS 200,000): Kwetuly keeps TZS 20,000; card fees TZS 9,600 to 11,328; net about **TZS 8,700 to 10,400**, before one refund's handling.
- **So the 10% still covers the percentage fees** at Flutterwave's card rate (4.8%, or about 5.7% with VAT). It does **not** leave much room if Selcom adds a fixed fee per payment, if refund fees exist, or for staff time on three small refunds. This supports keeping 10% as the working number and re-checking it when the Selcom quote arrives, rather than raising it.
- **Organiser cancels:** the traveller gets 100% of every part back; Kwetuly recovers its actual fees, up to 10%, from the organiser. With parts, "actual fees" are the sum over all parts, still capped at 10%.

## 1.4 What happens on a missed part

Under "who causes it pays", a missed part is caused by the traveller, unless the failure was on the provider's side.

**Proposed rule [Assumption, Walter and the advocate decide]:**

1. **Reminders:** 3 days before the due date and on the due date. Polite wording (section 1.6).
2. **Grace: 3 days** after the due date. Because the last part is due at least 14 days before the start, grace always ends before the 8-day cut-off.
3. **If the provider failed** (for example a Selcom or mobile-money outage, confirmed by the status check), the due date moves with no penalty. The traveller did not cause it.
4. **After grace, the organiser chooses**, and the traveller is told in advance that this is how it works:
   - (a) **Keep the spot, rest paid directly:** only if the organiser agrees and the amount already paid is at least the deposit the organiser would normally accept. The schedule closes; the traveller pays the remainder to the guide directly, as for any trip.
   - (b) **Release the spot:** treated as a **traveller cancellation on the date grace ended**, under the normal tiers, applied to the amount actually paid.
5. **Never:** keeping everything paid regardless of the date, adding late fees or interest, or taking a part after the cut-off.

**Example (illustration):** TZS 600,000 deposit in 3 parts; part 3 is missed and grace ends 12 days before the start. Paid so far TZS 400,000. Option (b) falls in the 8 to 29 day tier: traveller gets 40% (TZS 160,000), organiser keeps 50% (TZS 200,000), Kwetuly keeps 10% (TZS 40,000), out of which Kwetuly has already paid about TZS 19,200 to 22,700 in card fees.

**What this shows:** the organiser keeps 50% of **TZS 400,000**, not of the full deposit, so a missed part leaves him worse off than S0. That is why:
- the organiser chooses whether to allow parts at all;
- the first part is at least one third of the deposit;
- the schedule ends early enough that a missed part is known while the guide can still fill the spot.

**Other cases:**
| Case | Outcome |
| --- | --- |
| Guide or organiser cancels mid-schedule | Stop further parts at once; 100% of all parts back; Kwetuly recovers actual fees up to 10% from the organiser, except force majeure |
| Price, dates or main itinerary changed after the first part | Traveller may cancel with 100% back (draft policy 4.6) |
| Group trip does not reach its minimum | 100% back |
| Organiser declines a member who has paid a part | 100% back; payout stays blocked (existing payout rule) |
| Force majeure | As the draft policy 4.5, pending the advocate |
| Traveller wants to pay the remaining parts early | Allowed at any time; no penalty |

Walter approves every refund, as today. Three small refunds are three manual actions, so customer-care and operations-manager need a checklist before any pilot.

## 1.5 Licences and risks

| Risk | Why | Who checks |
| --- | --- | --- |
| **Holding money (Bank of Tanzania)** | S1 holds the same amount as S0, for a little longer per part. If the advocate says S0 needs approval, S1 does too. S2 and S3 hold more for longer | legal, advocate (task 1c) |
| **Consumer law** | Fixed schedule, clear consequences of a missed part, fair cancellation tiers (Fair Competition Act 2003) | advocate |
| **Is this credit?** | No lending: the trip happens only after the last part. Advocate to confirm that a pay-before-you-travel schedule is not regulated credit | advocate |
| **Tourism Act** | Collecting more of the trip price (S2, S3) makes Kwetuly look more like the seller of the trip | advocate |
| **Selcom features** | Saved cards, scheduled payments, repeated mobile-money pushes: to verify. S1 as proposed needs none of them | payments-engineer (task 1b) |
| **Chargebacks** | Each card part is a separate dispute chance. Prefer paying the guide after the last part, under the existing payout rule | payments-engineer, accounting |
| **Demand is unknown** | No data on how many travellers would use it | data-analyst, after A1 is live (see go/no-go) |
| **Wording** | Must never say "save", "wallet", "account balance", "escrow" or "held by Kwetuly" | legal, localization |

## 1.6 Draft wording (for later, not for the site now)

Drafts only. Nothing goes on the website or app until it is built and Walter approves. Walter checks every Kiswahili line.

- EN: "Karibu. You are welcome to pay this deposit in 3 parts. Here are the dates and amounts. Please pay each part by its date. Thank you."
- EN reminder: "Hello. Your second part for [trip] is due on [date]. Please pay when you can. If you need help, please write to us."
- SW: "Karibu. Unakaribishwa kulipa amana hii kwa sehemu 3. Hizi ndizo tarehe na kiasi. Tafadhali lipa kila sehemu kufikia tarehe yake. Asante."
- SW reminder: "Habari. Sehemu yako ya pili ya [safari] inatakiwa kulipwa tarehe [tarehe]. Tafadhali lipa utakapoweza. Ukihitaji msaada, tafadhali tuandikie."

## 1.7 Go / no-go (business view)

**Now: no-go for any build or announcement.** Deposits themselves (A1) are not live, cards are not working yet (`create-order-minimal`), the advocate has not answered, and there is no Selcom fee quote.

**Go for an S1 pilot only when all of these are true:**
1. A1 deposits are live and have run cleanly for at least [8] weeks, with daily reconciliation matching **[Assumption]**.
2. The advocate has answered the holding-money, consumer-law and "is this credit" questions for S1 in writing.
3. Selcom (or the chosen provider) has quoted fees in writing, including any fixed fee per payment and refund fees; the 10% working number has been re-checked against them.
4. Deposit data shows a real need: for example, a meaningful share of travellers who start a deposit checkout give up, especially mobile-money payers; data-analyst defines the measure once A1 is live.
5. Operations has a missed-part and multi-refund checklist, and customer-care has reply drafts.
6. Pilot scope: [3 to 5] organisers who opt in, mobile money and cards, up to 3 parts, no S2.

**Business honesty:** S1 earns Kwetuly nothing extra. Its value is more completed bookings (and so more 10% shares and commissions) and goodwill with Tanzanian and diaspora travellers. It costs reminders, reconciliation and support time. It is worth piloting only if deposit drop-off is real.

---

# Part 2. Classes: B1 Kiswahili lessons, B2 cooking classes by local cooks

Walter's order: **in person first, online later.**

## 2.1 Two points to settle first

1. **Who may teach.** The teacher code (draft, 2026-10-30) says teachers are **approved guides** teaching **by video**. B2 says **local cooks** (wapishi), which needs cook profiles (C1), and in-person classes, which the code does not cover yet. Options:
   - (i) Pilot with approved guides who can teach Kiswahili or cook, until cook profiles exist (fastest).
   - (ii) Also allow **listed businesses** (for example a restaurant or a cooking school) to offer an in-person class as part of their free listing, under the normal business model (free listing, optional badge, per-agreement referral commission). This needs no new money model.
   - (iii) Wait for C1 cook profiles, then let approved cooks teach.
   My recommendation: (i) and (ii) for the pilot, (iii) when C1 is built. hr adds an in-person section to the teacher code (home visits, meeting place, kitchen safety).
2. **Where an in-person cooking class happens.** A class in a licensed restaurant kitchen is simpler than a class in a family home: food hygiene permits for a home class are **to verify** (legal, task 3b), and a home visit adds safety and address-privacy questions. Recommendation: start with licensed premises or the cook's place with Walter's approval case by case, and add home classes once legal answers.

## 2.2 Price model options

The teacher or cook **sets the price**. Kwetuly never sets class prices. Kwetuly proposes only its own share and, later, a minimum price for paid-online classes so the fees do not eat the margin.

| Option | How it works | Kwetuly's share | Teacher gets | For | Against |
| --- | --- | --- | --- | --- | --- |
| **C0. Pay the teacher directly (pilot)** | Traveller pays the cook or teacher on the day (in person) or as agreed in Kwetuly messages | 0 | 100% | Can start soon after launch; no Bank of Tanzania, card fee or chargeback question; tests demand | No revenue; Kwetuly cannot refund money it never received; teaches paying outside Kwetuly |
| **C1. Disclosed % commission, paid through Kwetuly (recommended later)** | Traveller pays the listed price through Kwetuly; Kwetuly pays the teacher after the class; fees come out of Kwetuly's share | Proposal **15%** (range 10 to 20%), same as the proposed prep-call rate | 85% (at 15%), shown to the teacher before publishing | One rule for prep calls, lessons and host days; automatic; disclosed | Waits on company registration, live payments and the advocate; card fees and chargebacks |
| **C2. Flat fee per booking** | A fixed TZS amount per booking instead of a % | Fixed [proposal for Walter] | Price minus the fee | Protects against fixed costs on small classes | Unfair on cheap classes, too little on expensive ones; harder to explain across currencies |
| **C3. % with a minimum fee** | 15% or a minimum amount, whichever is higher | Proposal | Shown before publishing | Protects the margin on small prices | Two numbers to explain; a minimum class price (below) does the same job more simply |
| **C4. Business-run class** | A listed restaurant or school offers the class; traveller pays the business directly | Per-agreement referral commission, disclosed | Business keeps the rest | Uses the existing business model; no new build beyond a listing item | Depends on referral agreements, which wait for the advocate |

**Not offered:** any monthly or yearly teacher subscription, or levels of teacher membership (the rejected tier model).

**Per person or per class.** The teacher chooses one, with a maximum group size. For in-person cooking, per person with a maximum is clearer; for Kiswahili, per session. The listing shows exactly which.

**Ingredients.** For in-person cooking, the cook's price includes ingredients and the listing says so. Under C1, the % applies to the whole price. Risk: cooks may feel the commission takes a share of their shopping. Option for Walter: keep one rule (simple), or let the cook state an ingredients amount that carries no commission (fairer, more work to check). My recommendation: one rule; the cook sees the payout before publishing and prices accordingly.

## 2.3 Unit economics once paid through Kwetuly (C1)

Kwetuly absorbs the fees (no surcharge). Flutterwave published rates; Selcom unknown. Prices are **illustrations, not market prices** or proposals for what teachers should charge.

| Illustration price | Payment | Kwetuly 15% | Collection fee (no VAT / with 18% VAT) | Payout fee to teacher | Teacher gets | **Kwetuly net, before staff time** |
| --- | --- | --- | --- | --- | --- | --- |
| TZS 40,000 | Foreign card | 6,000 | 1,920 / 2,266 | 500 / 590 (payout under TZS 40,000) | 34,000 | **3,580 / 3,144** |
| TZS 40,000 | Mobile money | 6,000 | 1,000 / 1,180 | 500 / 590 | 34,000 | **4,500 / 4,230** |
| TZS 100,000 | Foreign card | 15,000 | 4,800 / 5,664 | 1,275 / 1,505 (1.5%) | 85,000 | **8,925 / 7,831** |
| TZS 100,000 | Mobile money | 15,000 | 2,500 / 2,950 | 1,275 / 1,505 | 85,000 | **11,225 / 10,545** |

At TZS 2,600 = US$1 (example rate, not a market rate): TZS 40,000 is about US$15; TZS 100,000 is about US$38.

At 10% on TZS 40,000 by card, Kwetuly nets about TZS 1,580 before staff time; at 20%, about TZS 5,580. As in the 2026-10-30 view: 10% is thin, 20% pushes teachers to take learners off Kwetuly.

**Minimum price for classes paid through Kwetuly (proposal range):**
- Handling per booking (payout approval, reconciliation, a share of support) **[Assumption]** 10 to 15 minutes, about **TZS 1,700 to 2,500** at the middle placeholder rate.
- Allowance for refunds and chargebacks **[Assumption]** 1% of the price.
- Kwetuly breaks even on a foreign-card booking at about **TZS 32,000 to 38,000** (about US$12 to 15 at the example rate).
- **Proposal: a minimum of TZS 30,000 to 40,000 for classes paid by card through Kwetuly**, recalculated once Selcom quotes. This floor covers **Kwetuly's own cost**. It is **not** a suggested price for teachers. Below it, the class could still run under C0 (pay directly).

## 2.4 What classes cost Kwetuly

| Cost | Estimate | Notes |
| --- | --- | --- |
| Teacher vetting (code part C: interview 30 to 40 min, trial lesson, two references, package review, record) | **[Assumption]** about 2.5 hours per teacher: **TZS 12,500 / 25,000 / 37,500** at the three placeholder rates | One-off per teacher; renewal later |
| In-person cooking: looking at the place once | **[Assumption]** +2 hours + transport T (Walter supplies) | Only for home or non-licensed places |
| Package review | **[Assumption]** 20 to 30 minutes per class package, plus re-reviews on changes | Ingredient and allergen list for cooking |
| Customer care | No-shows, time zones, refunds (manual through Selcom) | To measure in the pilot |
| Build | In person as a package kind: S. Online paid lessons: M (call payments, payments research section 4) | Engineers' time; no extra running cost |
| Running cost | US$0 extra | Same hosting and database |
| Advocate | Questions in 2.6 | Inside the existing advocate quote request |

**Paying back the vetting:** after handling time, Kwetuly nets roughly TZS 1,900 (TZS 40,000 card class) to TZS 7,200 (TZS 100,000) per paid class at the middle placeholder rate. So vetting one teacher (about TZS 25,000) is paid back after about **4 to 13 paid classes**. The monthly running cost (US$46 to 76, about TZS 120,000 to 198,000 at the example rate) would need roughly **20 to 100 paid classes a month**. **This is an illustration, not a forecast.**

**Who pays for vetting:** recommendation: Kwetuly absorbs it in the pilot (5 to 10 teachers, about 12 to 25 staff hours). A teacher who wants the yearly paid "Checked by Kwetuly" can still buy it as a guide; it is never needed to teach.

**Payout to teachers (C1):** price minus Kwetuly's share, by mobile money, **after the class is marked done**, through the admin "Pay" step Walter approves (payments research section 3). Whether this short wait counts as holding money is the advocate's question. Kwetuly pays the payout fee.

**Cancellations (C1):** use the teacher code 8.2 defaults (Walter still sets the brackets). One open point: when a learner cancels early and gets a full refund, Kwetuly loses the card fee (if not returned, to verify). Options: (a) offer a free reschedule first, which costs nothing; (b) full refund and Kwetuly absorbs the fee; (c) keep a fee-sized amount, as the 10% does for trips. Recommendation: (a), then (b); not (c) for small classes, where it looks petty and invites chargebacks.

## 2.5 Go / no-go (business view)

| Product | Verdict | Conditions |
| --- | --- | --- |
| **B2 in-person cooking class, pay the cook directly (C0)** | **Go for an invite-only pilot**, months 1 to 3 after launch | Legal answers on food hygiene permits for the chosen places (licensed premises first); allergen list and "no health claims" in every package; in-person section added to the teacher code; adults only; 3 to 5 cooks or guides who cook; listing says plainly "You pay the cook on the day. Kwetuly does not take payment for this class yet." |
| **B1 in-person Kiswahili (short lessons for travellers already in Tanzania), C0** | **Go, same pilot** | Same conditions without food; a meeting place that is public or the teacher's work place |
| **B1 and B2 online, pay the teacher directly** | **No-go** | Foreign learners would have to send money abroad with no protection; scam and no-show risk lands on Kwetuly's name |
| **Online classes paid through Kwetuly (C1, 15%)** | **Go later** | Company registered with receipts; call payments built and checked; Selcom quote; advocate's answers; minimum price set |
| **Commission on in-person classes (C1)** | **Go later**, same as online | Same conditions |

**Business honesty:** classes will be a small stream. Their value is a second income for guides and cooks in the low season, and a reason for travellers to come back to Kwetuly before and during a trip. Revenue only matters at volume.

**Pilot measures (data-analyst to add to the scorecard):** class requests, accepted, held (teacher-reported), reviews, complaints, no-shows, and the price each teacher chose. These replace my assumptions with real numbers before any commission starts.

## 2.6 Licences and questions (for legal, task 3b)

- Home cooking classes: food hygiene or health permit from the local authority, TMDA or TBS (**to verify**, not researched).
- Registration of a lesson platform or teachers with the Ministry of Education, NACTVET or BAKITA (legal research Q11, open).
- Withholding tax on teacher payouts; teachers living outside Tanzania (start with Tanzania-resident teachers).
- Teacher status: contractor or employee (teacher code 1.2).
- Allergy duties versus learner terms; home-visit safety and address privacy (Personal Data Protection Act 2022).
- Recording consent (online).

---

## Decisions for Walter

1. **Shape of lipa kidogo kidogo.** Recommendation: S1 only, the **same deposit** in up to 3 fixed parts, last part due at least 14 days before the start, first part at least one third, parts 14 days apart; the organiser switches it on per trip or offer. S2 (part of the balance) only after S1 runs cleanly and the advocate answers; S3 never.
2. **No fee for paying in parts.** Recommendation: yes, no plan fee and no late fees; Kwetuly absorbs the extra cost.
3. **Missed part.** Recommendation: reminders, 3 days of grace (longer if the provider failed), then the organiser chooses: keep the spot with the rest paid directly, or release it as a traveller cancellation under the normal tiers on the amount paid. Never keep everything paid regardless of date.
4. **Each part started by the traveller, no saved cards.** Recommendation: yes for the pilot; revisit only if Selcom documents saved cards and the advocate agrees.
5. **Exchange-rate drift between parts.** Recommendation: fix the shilling amounts at booking; Kwetuly carries the small drift. Accounting to confirm.
6. **The 10% working number.** Recommendation: keep it; re-check against the Selcom quote, including any fixed fee per payment and refund fees, before any S1 pilot.
7. **Go/no-go for S1.** Recommendation: no-go now; pilot only when the six conditions in 1.7 are met.
8. **Who teaches classes in the pilot.** Recommendation: approved guides who teach Kiswahili or cook, plus listed businesses offering a class; local cooks once C1 cook profiles exist. hr adds an in-person section to the teacher code.
9. **In-person classes first, paid directly (C0), no commission.** Recommendation: yes, invite-only, 3 to 5 teachers, licensed premises first for cooking, months 1 to 3 after launch.
10. **Online classes.** Recommendation: only when paid through Kwetuly (C1); no "pay the teacher directly" online classes.
11. **Kwetuly's share once paid through Kwetuly.** Recommendation: 15% of the teacher-set price, disclosed, the same as the proposed prep-call rate, Kwetuly absorbing payment fees; written into the teacher terms from day one.
12. **Minimum price for classes paid by card through Kwetuly.** Recommendation: set a floor in the range TZS 30,000 to 40,000 (about US$12 to 15 at the example rate) once the Selcom quote is in. It covers Kwetuly's cost only and is not a suggested teacher price.
13. **Ingredients inside the cooking price.** Recommendation: one rule, commission on the whole price, payout shown to the cook before publishing.
14. **Vetting cost.** Recommendation: Kwetuly absorbs it for pilot teachers; the paid yearly check is never needed to teach.
15. **Early learner cancellations on paid classes.** Recommendation: offer a free reschedule first, otherwise a full refund with Kwetuly absorbing the fee.
