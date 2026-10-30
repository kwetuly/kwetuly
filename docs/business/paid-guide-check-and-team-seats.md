# Paid guide check (yearly) and team seats: business view

Prepared by business-manager on 2026-10-30 for Walter. Paper only. Nobody has been contacted and nothing has been built. Walter decides every price.

Board item: "To do, 2026-10-30 Profiles, step 1(c)" in `docs/team/board.md`. Building is step P-e, after company registration and payments.

## Inputs and rules used

- `docs/business/soft-launch-business-plan.md`: no monthly subscription for guides; badge = one flat fee at or above the cost floor; running costs about US$46 to 76 a month.
- `docs/business/new-ideas-business-view-2026-10-30.md` and `docs/business/payments-research-2026-10-30.md`: Flutterwave Tanzania mobile-money collection 2.5%, cards 4.8%, VAT excluded ([flutterwave.com/tz/pricing](https://flutterwave.com/tz/pricing), checked 2026-10-30). Selcom fees are not published.
- `docs/legal/travel-agent-and-transfers.md` section 2.4: guide registration under GN 270 of 2015 reportedly needs Tanzanian citizenship, age 21+, secondary education, a valid first-aid certificate, and enlistment with a licensed tour company, TTGA or a similar body. All of this is unverified until the advocate confirms it.
- `supabase/migrations/20261014000600_guide_checks.sql`: today's checks are identity, licence and first aid, each stored with a date.
- Walter's decisions (3) and (4) on the board, 2026-10-30: basic approval stays free, crew never pay, any seat fee is paid by the lead guide or operator, and no seat fee at the start.
- Rejected on 2026-10-13: Regular/Premium/VIP tiers and escrow.

**How the prices are built.**
- Prices come from **Kwetuly's own cost of doing the check**. Every input I chose is marked **[Assumption]**.
- The only market figures used are the crew pay figures in section 2, each with its source.
- I found **no source I could check** for guide day wages, and none for what other Tanzanian platforms charge, so I used neither.

**USD conversions** use TZS 2,600 = US$1. This is the example value for `USD_TZS_RATE` in the comment in `supabase/functions/payments/index.ts`. It is **not a market rate**; accounting should replace it with the rate on the day. **TZS is the price currency**, because the 2025 foreign-currency rules reportedly require shillings for local transactions (payments research, legal to confirm).

---

## 0. A conflict already in the code: the dormant "Pro" plan

The repo already contains a guide plan system:
- `packages/shared/src/guides.ts`: `PLANS = { msingi: priceUsdMonthly 0, pro: priceUsdMonthly null }`
- a gold "Pro" pill on guide cards and profiles (`apps/web/src/components/guide-card.tsx` line 62, `apps/mobile/src/components/cards.tsx` line 44, `apps/mobile/src/app/guide/[slug].tsx` line 101)
- `docs/legal/guide-terms.md` 7.1: "A paid 'Pro' plan: price and features to be set"
- home page copy (`en.ts` line 310): "Basic membership is free for verified guides"

A **monthly "Pro" plan with a status pill** is the kind of thing the soft-launch plan rules out (no monthly guide subscription, no tiers). If it stays, the paid check will look like "Pro" under another name.

**Recommendation:** retire "Pro" and replace it with the paid check described here. That means:
- removing the pill and the `pro` plan value (engineers, later, Walter approves the migration);
- rewording terms 7.1 and the home-page line (legal and localization).

Until then nobody can be set to `pro`, because only admins can change the plan, so this is not urgent before launch.

---

## 1. What the paid check is (and is not)

**Free basic approval (unchanged, required for any listing):**
- identity seen
- guide registration seen
- first aid seen, with its expiry

Each shows with its date. First aid stays in the free check: it is a safety fact and part of guide registration, so putting it behind a fee would hide safety information from travellers.

**Paid yearly "Checked by Kwetuly" for guides: extra work, each item shown with what was done and the date.** Proposed items (legal and operations-manager to finalise):

| Extra check | What travellers see (example) | Notes |
| --- | --- | --- |
| Video interview | "Video interview with Kwetuly, 12 Jan 2027: identity matched, spoke English and Kiswahili" | Only the languages actually tested are listed |
| Registration confirmed at the source | "Guide registration confirmed with [issuing body or association], 12 Jan 2027" | **Only if a lawful way to confirm it exists**; legal to say whether there is a public register or an official confirmation route, and its fee (unknown) |
| Enlistment letter seen | "Enlistment with [company or TTGA] seen, 12 Jan 2027" | Ties to GN 270 (unverified) |
| Two references contacted | "2 references contacted (past employer or client), Jan 2027" | Kwetuly records who was contacted. Reference names are never shown |
| Extra certificates seen | "Wilderness first-aid certificate seen, valid until ..." | Only certificates actually seen |
| In-person meeting (option 3 only) | "Met in person in Arusha, 12 Jan 2027" | Costs a visit |

**Rules (same as the business badge):**
- It never says "recommended", "trusted", "top", "Pro" or "best".
- No ranking boost, no sort by it, and no "checked only" filter at the start. A filter has the same effect as a ranking boost for guides who did not pay.
- Same features for every approved guide, paid or not. **The fee pays for work, not for status or tools.**
- One standard for everyone. A guide who fails an item does not get that item. The fee is for the work done, whatever the outcome (refund rule: legal). Kwetuly records its pass and fail rates, so it can show that paying does not buy a pass.
- **The check belongs to the guide.** If an operator pays for it and the guide later leaves, the guide keeps it until it expires. This matches the home-page promise that "your reviews follow you".
- It is yearly and shows its date. Items with an expiry (certificates) disappear when they expire, as first aid does today.
- **Main risk: conflict of interest.** Kwetuly is paid by the people it checks. Legal is reviewing the consumer-law side (board step 1(d)).

---

## 2. Cost of doing one check (the floor)

### Time per check [Assumption]

These are my estimates. A timed pilot (section 7) should replace them with measured times.

| Step | Minutes, first year (video route) | Minutes, renewal |
| --- | --- | --- |
| Scheduling and reminders | 15 | 10 |
| Video interview | 45 | 20 (short update call) |
| Registration or enlistment confirmation | 30 | 15 |
| Two references (calls or WhatsApp) | 30 | 15 (one reference) |
| Extra certificates | 15 | 10 |
| Writing the "what was checked" record; Walter approves | 15 | 10 |
| Invoice, receipt, payment match | 15 | 10 |
| **Total** | **165 min, about 2.75 h** | **90 min, 1.5 h** |

In-person route: add **2 h of travel time** plus a **transport cost T** that Walter supplies (unknown).

Other inputs:
- **Licence lookups:** fee unknown. If an official confirmation has a fee, add it to the floor. Legal is to find out.
- **Phone and data:** TZS 2,000 per check **[Assumption]**.
- **Allowance for no-shows and redoing checks:** 10% of staff time **[Assumption]**.
- **Payment fee:** 2.5% (Flutterwave mobile-money rate, published). Selcom is unknown. VAT is not included.

### Staff cost per hour

**I have no figure for this.** The three columns are **placeholder inputs, not wage data**. accounting replaces them with Kwetuly's real cost (including Walter's own time, if he does the checks).

**Floor = (hours × hourly cost × 1.10 + TZS 2,000) ÷ 0.975**

| Check (per guide) | at TZS 5,000/h | at TZS 10,000/h | at TZS 15,000/h |
| --- | --- | --- | --- |
| First year, video route (2.75 h) | about TZS 19,000 (US$7) | about TZS 36,000 (US$14) | about TZS 53,000 (US$20) |
| Renewal (1.5 h) | about TZS 10,500 (US$4) | about TZS 19,000 (US$7) | about TZS 27,500 (US$11) |
| First year, in person (about 4.75 h incl. travel) | about TZS 30,000 + T | about TZS 58,500 + T | about TZS 87,000 + T |

**Not included:**
- the advocate's and company setup costs (one-off, recovered separately);
- VAT on Kwetuly's own fee, if Kwetuly is VAT-registered;
- any withholding tax.

### Affordability (what guides and crew earn)

What I could source (checked 2026-10-30). All of it is about Kilimanjaro only:

| Figure | Source | Reliability |
| --- | --- | --- |
| Porter minimum TZS 20,000 a day for companies in KPAP (Kilimanjaro Porter Assistance Project), "as of 2024" | [Wikipedia: Kilimanjaro Porter Assistance Project](https://en.wikipedia.org/wiki/Kilimanjaro_Porter_Assistance_Project) | Secondary; no citation for that line |
| Average porter pay in 2022: TZS 36,074 a day at KPAP-affiliated companies and TZS 25,860 at other companies | Same article, citing Stedman, *Kilimanjaro: The Trekking Guide* (6th ed., 2024), p. 61 | Secondary (published guidebook) |
| "KINAPA mandates a minimum porter wage of 20,000 TZS per day" | [Duma Explorer, 2026](https://www.dumaexplorer.com/blog/kilimanjaro-porters-glossary-wages-tipping-guide) | Operator blog; whether the rule comes from KINAPA or from KPAP differs between sources |
| KPAP says the minimum wage "is not enforced", so pay varies | [KPAP tipping guidelines](https://kiliporters.org/get-involved/tipping-recommendations/) | Primary (KPAP); gives no figures |
| Recommended tips per climber per day: lead guide US$20 to 25, assistant guide US$12 to 20 | Duma Explorer (above) | Operator blog; tips, not wages |
| **Guide day wage** | **No source I could check.** Search summaries mention a TZS 40,000 KPAP guide standard and a 2008 government notice (GN 228). I could not open either source, so I have not used them | Unverified |

What this means:
- **Crew:** a TZS 15,000 crew check (section 4) is about **three quarters of a porter's TZS 20,000 minimum day**. That is a strong reason why crew must never pay, and why the fee must never be taken out of crew pay.
- **Guides:** the recommended TZS 60,000 is about three porter minimum days. For a lead guide it is probably less: on tips alone (US$20 to 25 per climber per day, secondary source), it is roughly one to two days' tips from one climber at the example rate. **This is an indication only, not a wage figure.** Guides outside Kilimanjaro (safari, culture, Zanzibar) are not covered by any figure above.

**Main test (internal data, can be measured):** the yearly fee should be **no more than one day's guiding, or one prep call, at the guide's own prices on Kwetuly**.
- Once 10 or more real guides are approved, data-analyst takes the median of `call_price_usd` and the per-day price of approved packages.
- If the chosen fee is above that median, use option 1.

---

## 3. Price options for the paid guide check (yearly)

| Option | First year | Renewal | Covers the floor at | For | Against |
| --- | --- | --- | --- | --- | --- |
| 1. Cost recovery | **TZS 40,000** (about US$15) | **TZS 25,000** (about US$10) | TZS 5,000/h and 10,000/h; **below cost at 15,000/h** | Easiest for guides to afford. Hardest to call a "pay to be trusted" scheme | Almost no margin. Loses money if checks take longer than estimated or the hourly cost is high |
| 2. Cost plus margin **(recommended)** | **TZS 60,000** (about US$23) | **TZS 40,000** (about US$15) | All three placeholder rates, video route | Covers cost with room for slower checks and payment fees. One price for every guide | May fail the affordability test for lower-earning guides. Check against real data first |
| 3. In person included | **TZS 100,000** (about US$38) every year | same | TZS 5,000 to 10,000/h if transport T stays under about TZS 40,000 | Strongest check: someone met the guide | Needs staff who travel. Price is highest. Only works near Arusha or Moshi at first. **Do not sell it next to option 2 as "better"**: that would be the rejected tier model |

Common to all options:
- **one price for every guide**, set in admin like the badge fee (a new `guide_check_fee` setting later);
- TZS is the price currency;
- VAT included or not is Walter's decision with accounting;
- payment by invoice and mobile money or bank to the **company** account, as for the business badge. Selcom is not needed, but company registration and receipts are.

**Paying in two instalments** within the year is acceptable: it is only a split invoice and Kwetuly holds no money.

**Taking the fee out of a guide's referral-commission share** is a different matter. Netting it off could look like holding the guide's money, so ask the advocate first. Until then, use invoices only.

---

## 4. Team seats

**Starting point (Walter, 2026-10-30):**
- crew (porters, cooks, assistant guides) never pay;
- any seat fee is paid by the lead guide or operator;
- no seat fee at the start;
- crew building is step P-d, after launch.

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| A. **No fee for teams (recommended at the start)** | Lead guides and operators add crew for free. Each crew member has their own free profile, approved by Walter | Grows the jobs hub and brings crew in. No risk of the fee being passed to porters | No direct revenue. Money comes indirectly: lead guides buy their own paid check, and operators buy the business badge |
| B. **Per-person crew check, paid by the lead guide or operator (recommended later)** | Not a "seat" for access. A paid piece of **work**: Kwetuly checks one crew member (identity seen, short phone or video call, role confirmed) and shows "Identity seen, [date]" on that crew member's profile | Fee follows real cost. Same honesty rule as the badge. Crew pay nothing | Admin time for every member. Risk that operators take the fee out of crew pay. The fee is close to a porter's day's pay (section 2), so the risk is real |
| C. Team packs (for example "up to 10" or "up to 25" members) | Flat yearly fee per pack | Simple to sell to operators | Packs by size look like the rejected tiers. Unused seats feel unfair. **Not recommended** |

**Cost of a crew check [Assumption]:**
- about 40 minutes (identity 10, call 15, record 10, batch invoice 5) plus TZS 500 phone;
- floor about TZS 4,300 / 8,000 / 11,800 at the three placeholder hourly rates.

**Price options for B:**
- **TZS 10,000** (about US$4) per member per year: cost recovery at the middle rate;
- **TZS 15,000** (about US$6), recommended: covers all three rates.

Always charged to the operator or lead guide on one invoice.

**Protections needed with option B (hr and legal):**
- The operator's terms must say the fee **may not be deducted from or recovered from crew pay**. A breach removes the operator's crew checks.
- Crew can join and keep a profile without any check being paid. The paid check only adds a dated line.
- The crew member owns the check and keeps it if they change employer.

**Are seats access fees?** **No.** A fee to "have a team" or to "add members" would be a platform subscription, which conflicts with the "free listing" and "no monthly subscription" rules. The only charge is for the check work.

---

## 5. How this fits with the business badge

| | Business badge | Paid guide check | Crew check (later) |
| --- | --- | --- | --- |
| Name family | "Checked by Kwetuly" | "Checked by Kwetuly" | "Identity seen by Kwetuly" |
| Who pays | Business | Guide, or an operator for the guide | Lead guide or operator; **never crew** |
| Period | Yearly | Yearly | Yearly |
| Shows | What was checked and when | What was checked and when | What was checked and when |
| Ranking or filter | None | None | None |
| Price set in | Admin (`badge_fee`, not yet set) | Admin (new setting) | Admin (new setting) |
| Earliest start | Company registered, receipts | Same | Same, plus crew build (P-d) |

- **Operators and travel agents** are businesses (board decision 7). They buy the **business badge**, which covers the company (MNRT licence, TIN, and so on). They may also pay for **guide checks** for their guides and **crew checks** for their crew. These are three separate pieces of work with three separate prices, which keeps it from becoming a bundle tier.
- **Keep the prices consistent.** The badge fee is not yet set. When Walter sets it, apply the same cost-floor method (soft-launch plan 2A) so the badge and the guide check do not look arbitrary next to each other.

---

## 6. Expected uptake and money [Assumption]

This is not a forecast. There is no data yet: no real guides are approved, and nobody has been asked to pay.

| | Low | Middle | High |
| --- | --- | --- | --- |
| Approved guides who buy the paid check, first year of charging | 5% | 10 to 15% | 25% |
| Per 100 approved guides | 5 | 10 to 15 | 25 |
| Revenue per 100 guides at option 2 (TZS 60,000) | TZS 300,000 (about US$115) | TZS 600,000 to 900,000 (about US$230 to 345) | TZS 1,500,000 (about US$575) |
| Margin after staff cost (TZS 10,000/h placeholder, about TZS 24,000 per check) | TZS 120,000 | TZS 240,000 to 360,000 | TZS 600,000 |

Why I expect low uptake:
- the check is optional;
- it gives no ranking benefit;
- its only value to a guide is whether travellers notice and trust it, which is unproven until real enquiries arrive.

**Break-even against running costs** (US$46 to 76 a month from the soft-launch plan, about TZS 1.44 to 2.37 million a year at the example rate): about **60 to 100 paid checks a year** at option 2, at the middle placeholder rate.

**Honest conclusion:**
- The paid guide check is a **trust product that pays for its own work**, not a main revenue stream.
- The main guide-side money is still the disclosed fee on prep calls and packages once payments go through Kwetuly (soft-launch plan 2C).
- Crew checks: about **0 to 3 operators** paying in the first 6 months after crew is built, each checking **5 to 20 crew** **[Assumption]**. That is about TZS 0 to 900,000 a year at TZS 15,000 per member.

### Planning targets (set with data-analyst; not forecasts)

| When | Target |
| --- | --- |
| Soft launch | 0 paid (cannot charge). Timed pilot on 3 to 5 guides (section 7) |
| 3 months after charging starts | At least 5 paid guide checks; average check time measured |
| 6 months | At least 10 paid; no complaint that paying bought a pass; pass and fail rates recorded |
| 12 months | At least half of paid guides renew; enquiries per guide compared for guides with and without the check (to test whether travellers value it) |

---

## 7. Go/no-go before charging anyone

**Go only when all of these are true:**
1. The company is registered, with a TIN, and can issue EFD receipts.
2. The advocate has approved the wording and the consumer-law position (legal, step 1(d)).
3. operations-manager has written the checklist, and legal has confirmed how registration can be confirmed at the source.
4. A **timed pilot** has been done on 3 to 5 real approved guides, free and clearly labelled "pilot". Each guide is told in writing that the check will be charged at renewal. The pilot replaces my time estimates with measured ones, so the fee is set from real cost.
5. The "Pro" plan and pill are retired, and the terms (7.1) and home-page line have been reworded.
6. The fee is set in admin, and the affordability test (section 2) has been run on real guide prices.

**No-go:** charging anything before item 1 is done, or any wording that says or suggests "recommended", "trusted" or "better".

---

## Decisions for Walter

1. **Retire the dormant "Pro" plan** (monthly price field, gold "Pro" pill, terms 7.1, "Basic membership" line) and replace it with the paid yearly check. Recommendation: yes; engineers do it later, and you approve the migration.
2. **What the paid check contains.** Recommendation: video interview, registration confirmed at the source (if legal finds a lawful route), enlistment letter, two references and extra certificates, each shown with its date. First aid stays in the free basic approval.
3. **Price.** Recommendation: option 2, **TZS 60,000 first year (about US$23) and TZS 40,000 renewal (about US$15)**, one price for every guide, set in admin. Confirm it only after the timed pilot and the affordability test; fall back to option 1 (TZS 40,000 / 25,000) if guides' own prices show it is too high. Also decide whether VAT is included (with accounting).
4. **No ranking, sort or "checked only" filter** for paid checks. Recommendation: yes, the same as the business badge.
5. **Who owns the check.** Recommendation: the guide keeps it, even if an operator paid for it.
6. **Team seats.** Recommendation: option A (no fee) at the start, then option B: a per-person crew check paid by the lead guide or operator at **TZS 15,000 (about US$6) per member per year**, never charged to crew and never recovered from crew pay. No team packs or access seats.
7. **Timed pilot.** Recommendation: once real guides are approved, run the extra checks free on 3 to 5 guides, labelled "pilot" and with written notice that renewal is paid, to measure the real cost.
8. **Timing.** Recommendation: nothing is charged until the company is registered with receipts and the advocate has approved the wording. Payment is by invoice to the company's mobile-money or bank account, so it does not need to wait for Selcom.
9. **Taking the fee from commission shares.** Recommendation: not without the advocate's answer; invoices only until then.
