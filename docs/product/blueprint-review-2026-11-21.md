# Review of Walter's blueprint (2026-11-21)

Prepared by chief-of-staff on 2026-11-21. Source: `docs/product/blueprint-walter-2026-11-21.md` (Walter's Kiswahili and English master plan). Paper only. Nothing is decided, built or sent here. Walter decides every point. The decisions are at the end of `docs/team/decisions-2026-11-21.md`, under "From your blueprint".

Each item from the blueprint is sorted into one of four groups:
- (a) already built or planned;
- (b) a real improvement we don't have yet;
- (c) conflicts with a decision Walter already made;
- (d) needs legal or the advocate first.

Where the blueprint gives facts (laws, park rules, gateway prices), the team has not checked them. They stay "to verify".

## Muhtasari kwa Kiswahili

(Rasimu. localization ikague, na Walter aikague mwenyewe.)

Mpango wako una mambo mengi mazuri. Mengi yameshajengwa au yamepangwa tayari: faili la safari, kazi za wapagazi, uhakiki wa nyaraka za waongozaji, sheria za amana na marejesho. Mambo mapya tunayopendekeza: kusajili Kwetuly kwa PDPC na sera ya muda wa kutunza taarifa (sasa, kwenye karatasi), vipimo vya kila wiki (KPI), mawakala wa kusajili watu kwenye geti na QR, idhini ya malipo kwa hatua, na kumbukumbu za uzito wa mizigo. Baadhi ya mambo yanagongana na maamuzi yako ya zamani: neno "escrow", beji za Pro na Premium, ada kwa wapagazi na madereva, NIDA kwa watalii, nyota kwa wapagazi, Flutterwave na PesaPal badala ya Selcom, na beji ya "Fair Climb Verified". Uokoaji wa helikopta, SOS yenye mahali ulipo, taarifa za afya na michango vinahitaji wakili kwanza. Wewe ndiye unaamua kila jambo.

---

## (a) Already built, or already planned

| Blueprint item | Where it is |
| --- | --- |
| A marketplace that only connects travellers to licensed operators; "Kwetuly introduces, the operator sells" | Board 2026-10-30 decision 7; `docs/legal/paid-checks-operators-crews.md` |
| Partner operator agreement | Board To do: partnerships draft agreement for the first businesses |
| Advocate before taking trip payments | Board; `docs/legal/deposit-and-refund-policy.md` |
| Deposit, then the rest paid to the guide directly; refund rules for each kind of cancellation | Walter 2026-11-07 ("who causes it pays", 8-day cut-off); `docs/legal/deposit-and-refund-policy.md` |
| No wallet balance without a licensed partner | Board: credits idea parked; `docs/legal/instalments-donations-classes-2026-11.md` |
| "Don't promise zero fees" | 10% working number until Selcom quotes; `docs/business/pay-little-and-classes-2026-11.md` |
| Guide checks: NIDA, licence, first aid or WFR, expiry reminders | `docs/team/plan-guide-checks-2026-11.md`; Walter 2026-11-08 |
| Operator TIN, tourism licence with expiry; business licence and TIN for hotels and shops | Board 2026-10-30 (P-c, TIN at business approval) |
| Porter sign-up, teams with the porter's consent, porter association membership as a stated item | `docs/guides/crew-teams-design-2026-11.md` |
| Load limit, food, tent, gear, pay timing in job posts; the operator's welfare declaration | `docs/team/crew-fairness-rules-2026-11.md` sections 2 and 5 |
| Digital trip file with roles and permissions, crew list and check-in, day plan, included items, end-of-trip report | `docs/team/design-crew-and-trip-management-2026-11.md` section 3 |
| Offline mode on the mountain | Same, section 4 (app only; the website makes no offline promise) |
| Reviews only after a real trip; masking phone numbers in chat; message reports | Existing rules and code; design doc sections 2.5 and 3.8 |
| Steps when rules are broken (warning, hide, suspend, remove) | `docs/team/crew-fairness-rules-2026-11.md` section 7; `docs/team/teacher-code-of-conduct.md` |
| Audit trails | Admin action log (board 2026-10-31, phase 2); payment audit table |
| Phone codes (OTP) | Phone sign-in after company registration (board 2026-10-30) |
| VIP host (meet and greet, lodge coordination) | Board 2026-10-31: VIP host as a guide package kind |
| Laundry, photographers, musicians, cultural cooking | `docs/product/ideas-2026-11-08.md` E1, E5, E3, B2 |
| Talent pipeline, courses from porter to guide | Ideas file C7; crew design section 7 |
| Associations and TTB | Board 2026-11-06 decision 13 (briefs now, Walter contacts after registration) |
| Guide QR or personal code for referrals | Business model 2026-10-15 (referral codes) |
| "Sponsored" labelled, never mixed with normal order | Board 2026-11-06 decision 5; badge honesty 2026-11-07 |
| Privacy policy, terms, cookieless analytics | `docs/legal/privacy-policy.md` (draft); PostHog cookieless (board) |
| Zanzibar and more parks | Ideas file E6 |
| AI trip matching | The AI concierge chat exists today |
| Kiswahili for providers, English for travellers | Rule in CLAUDE.md |

## (b) Real improvements we don't have yet

| Improvement | Owner | When |
| --- | --- | --- |
| PDPC registration: what is needed and when. The privacy policy draft still has a blank for it | legal (advocate questions); Walter registers once the company exists | Now (paper) |
| A data retention policy: how long each kind of data is kept, then deleted or anonymised | legal with security-reviewer and tech-lead | Now (paper) |
| KPIs: response time, completion rate, refund and dispute rate, payment success, payout time, safety incidents, repeat bookings | data-analyst (adds them to the soft-launch scorecard) | Now (paper); tracked after launch |
| Field onboarding agents in Moshi and Arusha and at the gates, with QR codes | guide-success, operations-manager, hr (vetting and code for agents), security-reviewer (agents handle personal data) | Next (after crew sign-up is built). Walter asks any park or gate for permission |
| QR codes at hotels, shops and restaurants to sign up or find a guide | marketing, designer | Next |
| Referral programme (guide brings guide, operator brings operator) | marketing with business-manager | Next |
| Payout approval in steps (one person prepares, another approves) and batch payouts for a company's crew | payments-engineer, accounting; security-reviewer | Later (with the payouts table and live payments) |
| A dispute hold: payout paused while a complaint, accident or damage is looked at | payments-engineer, operations-manager | Next (card disputes already block payouts in the payments plan; this widens it) |
| Tips shown on the trip file and receipt as a stated procedure. Kwetuly still never handles tip money | payments-engineer, hr | Later |
| Tax-ready records for payees (statements, receipts) | accounting | Later (after registration) |
| Weigh-in records for porter loads on the trip file | tech-lead, guide-success; legal checks the wording | Next (trip management phase 2) |
| Expense log on the trip file (fuel, food, repairs), for the guide's own use | tech-lead | Later |
| Incident report process (injury, evacuation, lost gear), kept private | operations-manager | Next |
| Emergency numbers on the trip file, official sources only, no safety promise | operations-manager, marketing (facts from official sources) | Next |
| Travellers answer private questions about how crew were treated | hr, tech-lead | Next (with crew reviews, phase 3) |
| A three-step dispute process (chat, Kwetuly mediation, refund decision) for every booking | operations-manager, customer-care | Next |
| Strikes for all users (fake identity, harassment, no-show, off-platform payment) | hr, operations-manager | Next |
| Operators reply to reviews | frontend-engineer, conversion | Later |
| Availability calendar for guides and crew | tech-lead | Later |
| Academic partners (MWEKA, SUA, IFM) for internships and courses | partnerships (brief only); Walter makes contact | Later (after registration) |
| Capacity marketplace: hotels request guides, companies share crew or run "white-label" trips | tech-lead, partnerships, business-manager; legal first (see d) | Later |
| Gym, wellness and equipment repair as business types | partnerships | Later |
| A cap or flat fee on commission for very small services | business-manager | Next |

## (c) Conflicts with a decision Walter already made

Walter makes the final call on each. The past decision is shown so he can keep it or change it.

| Blueprint says | What was decided before |
| --- | --- |
| "Escrow" and split payments, the balance released after the trip, money held through the platform | Walter rejected the escrow redesign on 2026-10-13. The team never says "escrow". Kwetuly takes only the deposit, and the rest is paid to the guide directly. Holding travellers' money may need Bank of Tanzania approval, which is with the advocate. The safe form of the idea: Selcom question 18 asks whether Selcom can settle straight to the guide |
| Gear rental guarantee deposits and "pay after delivery" through Kwetuly | Shops are paid directly, and Kwetuly holds no money (2026-10-15 and 2026-10-30) |
| Badge tiers: Basic, Verified, Pro, Premium | Tiers were rejected on 2026-10-13. Pro was retired on 2026-11-07. The badge says what was checked and when, never "recommended" |
| Porters: "paid priority access" | Crew never pay (board 2026-10-30, decision 4). No ranking by payment. Paid placement only ever with a clear paid label (2026-11-07) |
| Drivers: subscription and a job acceptance fee | Crew never pay. Drivers are listed as people only, and transfers are off until the advocate answers (2026-10-30) |
| NIDA or passport required from tourists | Travellers sign in with email, Google or Apple and stay private (2026-10-30). Insurance details are optional (ideas file D4). No ID is asked from travellers |
| Star or category ratings of crew | No star rating of a person without the advocate (ideas file C5). Crew get fixed positive tags only, and the person approves them first |
| "First 100 guides free for 3 months" | Basic approval and the listing are free with no end date (board 2026-10-30, decision 3). On 2026-11-08 Walter said guides pay for the document check (price not set yet). A time-limited offer would be about that check, not about membership |
| Flutterwave and PesaPal as gateways | Selcom is the chosen provider. The sandbox was requested on 2026-11-07, and the card switch is built (26a75bd). Flutterwave is used only as a price comparison; a second provider only if Walter approves (board 2026-10-29) |
| A "Fair Climb Verified" badge | The badge rule: what was checked and when, never "recommended". The legal note says never "fair", "ethical" or "porter-friendly" as a label, and never KPAP's name or logo without KPAP's written permission (only Walter may ask). The name may also be confused with KPAP's own partner programme |
| Subscriptions and listing fees for operators, hotels and gear shops | Businesses list for free, with an optional paid yearly badge and a per-agreement commission (2026-10-15) |
| Gear shop delivery fee through Kwetuly | The shop delivers and sets its own charge, and the traveller pays the shop (2026-10-30) |
| VIP security and medical escort | No security or bodyguard service at all (2026-10-31, decision 4) |
| Airport and private transfers | Transfers stay off until the advocate answers (2026-10-30) |
| Insurance integration (selling or arranging policies) | Kwetuly links only to the official NIC and ZIC portals. Selling insurance needs NIC agency and TIRA approval (2026-10-15) |
| Donations hub with recurring giving | Money donations are parked until registration and the advocate (2026-11-06, decision 6) |

## (d) Needs legal or the advocate first

| Item | Why |
| --- | --- |
| Helicopter rescue, domestic and private flights, a rescue network with pre-authorisation | Aviation and medical services, licences, liability, and payment for rescues |
| An SOS button with location sharing; location, altitude and weather in daily check-ins | Live location is sensitive data. It must never become a safety promise. Version 1 has no location (tech-lead) |
| Health data: allergies, medical conditions, client condition, porter health declarations | Sensitive data under the PDPA 2022: prior written consent, who may see it, how long it is kept |
| OCR, liveness selfies and NIDA name matching | A new outside processor of ID and face data. Walter decided on 2026-11-08 that the NIDA number is required and the card photo optional |
| Device fingerprinting | Personal data and consent |
| Digital work contracts for porters and guides | May make Kwetuly look like the employer (Labour Institutions Act s. 61, hr advocate question 3) |
| Lending crew between companies, white-label trips | Employment law, and who holds the licence for the trip sold (ideas file E8) |
| A "Porter welfare" rating category for operators | Defamation, and the "never fair or ethical" label rule |
| Permits, park fees and ranger contacts handled for travellers | Kwetuly never applies for permits (ideas file E7) |
| Donations, recurring giving and hardship appeals | Ideas file I1 and I3; questions 12 to 24 in the legal memo |
| Booking fee for travellers at checkout | The reported ban on card surcharges, and consumer law |
| QR codes and agents at park gates | Park rules and permission (to verify); Walter asks |
