# Hosts and new services: business view

Prepared by business-manager on 2026-10-31 for Walter. Draft only. Nobody has been contacted, nothing has been built, and no price has been set. Walter decides every price, rate and go/no-go.

Board item: "2026-10-31 Bike, village and concierge samples", step 1(e), in `docs/team/board.md`.

## Inputs and rules used

- `docs/business/soft-launch-business-plan.md`: free listings, one flat yearly badge fee at or above the cost floor, no monthly guide subscription, a 50/50 default referral split, no charging before company registration, running costs about US$46 to 76 a month.
- `docs/business/new-ideas-business-view-2026-10-30.md`: the proposed 15% disclosed commission for anything paid through Kwetuly (my proposal, not decided); Flutterwave Tanzania fees: cards 4.8%, mobile-money collection 2.5%, payout 1.5% from TZS 40,000, VAT not included ([flutterwave.com/tz/pricing](https://flutterwave.com/tz/pricing), checked 2026-10-30). Selcom fees are not published.
- `docs/business/paid-guide-check-and-team-seats.md`: a paid yearly "Checked by Kwetuly" for guides, shown as what was checked and when; retire the dormant "Pro" plan.
- `docs/legal/travel-agent-and-transfers.md`: MNRT tourism licence classes (travel agent, tour operator and car hire reported as limited to Tanzanian-owned companies); transfers stay off; airport pickup rules not researched.
- `docs/legal/traveller-terms.md` question 8: whether investment introductions need anything from TISEZA or the Capital Markets and Securities Authority. Not yet answered.
- Rejected on 2026-10-13 and not brought back: Regular/Premium/VIP tiers and escrow. **"VIP host" is a service name only.** It must not become a VIP tier of membership, a higher listing level or better placement.
- No market sizes are used anywhere below. Where a number would help, it is marked **to verify**. My own planning choices are marked **[Assumption]**.

---

## 1. One revenue model for all hosts

Both new host types (VIP personal trip host, investment visit host) are people selling their own time by the day, like guides. They should follow the guide rules rather than get a new model.

### 1a. Options

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| A. Free during soft launch | Host sets own day rate, traveller pays the host directly, Kwetuly takes nothing | Fast to start. No collection, no tax or BoT question. Tests whether anyone asks for these services | No revenue. Teaches pay-outside habits |
| B. Disclosed commission on the day rate | Host sets the day rate; Kwetuly keeps a % shown to the traveller before booking. Same rate as prep calls and lessons (proposal: 15%) | Grows with value. Automatic once payment runs through Kwetuly. One rule for guides, teachers and hosts | Only works with online payment (company registration, Selcom, advocate on holding funds). Invoicing hosts on trust does not work, for the same reason as guides (soft-launch plan 2C) |
| C. Yearly listing fee for hosts | A flat yearly fee to be listed as a host | Predictable cash. No payment system needed beyond one invoice | It is a subscription for guide-like people, which the soft-launch plan rules out for guides. Hosts pay before seeing any demand, so few will. If priced by "level", it becomes the rejected tier model |
| D. Free listing plus the optional paid yearly "Checked by Kwetuly" | Listing free; the host can buy the same yearly check as guides (identity, references, video interview, any licence seen, each with date) | Uses a model Walter already approved. Charges for real work Kwetuly does, not for visibility. Strongest trust signal for exactly these high-trust services | Small, slow revenue. Must not suggest the host is "recommended" or "safe" |

### 1b. Recommendation

- **Now (soft launch):** option A, but only as labelled samples and a "Become a host" recruitment page draft. Real hosts go live only after legal answers the licence questions in section 2.
- **After company registration:** option D (free listing, optional paid yearly check at the same flat fee as guides).
- **After online payment is live:** add option B, the same disclosed % as prep calls, written into host terms from day one.
- **Do not use option C.** If Walter prefers a fee over commission, use the paid yearly check (D) instead, which is a fee for work done.

### 1c. Unit economics (formula, no invented day rate)

I have no checkable source for VIP host or investment host day rates in Tanzania, so I use **D** = the host's own day rate.

Under option B at a 15% commission, with Kwetuly absorbing card fees (Flutterwave rates, foreign card, payout to mobile money):

**Kwetuly net per paid day = D × (15% − 4.8% − 1.5% × 85%) ≈ D × 8.9%** before VAT on fees, FX spread, VAT on our own commission and staff time. With 18% VAT on Flutterwave's fees it is about **D × 7.9%**.

Chargebacks are the main risk: one disputed day costs about D plus fees, which is the net of roughly 11 to 13 paid days. Pay hosts only after the day is marked done, subject to the advocate's answer on holding funds.

### 1d. What hosts cost Kwetuly

| Cost | Why it is higher than for a guide | Size |
| --- | --- | --- |
| Vetting (hr) | References and confidentiality checks, because VIP and investor clients are high-trust | **[Assumption]** 2 to 3 staff hours per host; Walter or accounting supplies the hourly cost |
| Admin approval of host packages | Each package text checked against the legal limits (no security work, no driving, no investment advice) | **[Assumption]** about 30 minutes per package, plus re-review on changes |
| Customer care | VIP and investor clients complain at a higher cost: one bad experience is a reputation event | To verify after the first 10 bookings |
| Advocate time | Two new legal questions (section 2) before any live host | Quote needed |
| Build | Host service on the guide profile, "Become a host" page, samples (board step 2) | Engineers' time, no running cost |
| Running cost | None extra: same hosting and database | US$0 extra |

**Break-even for the paid check (option D):** fee at or above (vetting hours × hourly cost + admin time + payment fee). Same floor formula as the badge.

---

## 2. The two host types: go/no-go

### 2a. VIP personal trip host

A trusted person who plans and accompanies a traveller's days: restaurants, private visits, guides, bookings with listed businesses.

| | |
| --- | --- |
| Who pays | Traveller, a day rate set by the host |
| Kwetuly revenue | Soft launch: none. Later: paid yearly check (D), then disclosed commission (B). Extra: per-agreement referral commission when the host books listed businesses, disclosed as usual |
| Licence | Legal step 1(d) to answer: does accompanying and organising for pay need guide registration or enlistment, or a travel agent or tour operator licence (reported as only for Tanzanian-owned companies)? |
| Excluded, and the page says so | Close protection and security work (regulated); driving (transfers stay off); handling the traveller's money; any wording like "VIP status" on Kwetuly itself |
| Main risks | Host makes promises Kwetuly cannot keep; confidentiality of the client's personal data (Personal Data Protection Act 2022); side deals off the platform; the name drifting into the rejected VIP tier |
| **Go/no-go** | **Go for labelled samples and the recruitment page draft. Conditional go for real hosts after the advocate answers the licence question. No charging before company registration.** |
| Timing | Samples: with the realistic-samples seed. Real hosts: month 3 to 6. Commission: after payments are live |

### 2b. Investment visit host

A person who organises a fact-finding visit: schedule, hotel, transport through licensed providers, meetings booked through official channels, site visits.

| | |
| --- | --- |
| Who pays | The visiting investor or their company, a day rate set by the host |
| Kwetuly revenue | Same as 2a. Possibly higher day rates, but I have no source, so I have not assumed any |
| Licence | Legal step 1(d): no investment or legal advice; who may act for an investor before TISEZA; whether introductions need anything from TISEZA or the Capital Markets and Securities Authority (traveller terms Q8, open) |
| Hard rules | Official links only (TISEZA). No promises of approvals, permits or speed. No payments to officials, ever, and the host code of conduct (hr) says so. No land or property deals arranged through Kwetuly |
| Main risks | Highest of all ideas here: corruption exposure, misleading claims, a failed investment blamed on Kwetuly, regulatory question still open |
| **Go/no-go** | **No-go for the soft launch with real hosts. Samples only if Walter wants them visible, and only with wording limited to logistics and official links.** Revisit after the advocate answers Q8 |
| Timing | Earliest month 6, after the advocate. Commission: after payments are live |

---

## 3. Walter's seven new ideas

All follow the existing model: guides and hosts sell packages (free now, disclosed fee later), businesses list free (optional yearly badge, per-agreement commission disclosed). None needs a new fee type.

| # | Idea | Who pays Kwetuly | Revenue model | Licence or approval | Main risk | Go/no-go | Timing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Airport arrival host / meet and greet** (meet at arrivals, SIM card, cash machine, escort to a licensed taxi or the hotel's driver; no driving) | Traveller, through a guide package | Guide package kind; free now, disclosed fee once paid online | Transfers stay off (legal). Airport access rules (Tanzania Airports Authority, KADCO at Kilimanjaro) **not researched, to verify** | Host not there at 2 a.m.: a missed pickup is a bad first hour in Tanzania. Pressure to "just drive them" | **Go**, as a package kind without driving, once the airport question is answered | Soft launch if legal answers in time; otherwise month 3 |
| 2 | **Diaspora homecoming trips** | Traveller (guide packages, group trips); businesses through referral commission | No new product: a marketing theme and landing page using existing guides, group trips and stays | None new | Promises about family tracing or land; drifting into the investment host problem | **Go**, as marketing only (marketing to draft) | Month 3 to 6. Diaspora market size **to verify** with a source before any target is set |
| 3 | **Zanzibar honeymoon and wedding help** | Hotels and planners (per-agreement commission), guides (packages) | Honeymoon: existing stays and guides, a curated page. Wedding: list wedding planners as businesses (free, optional badge, commission) | Kwetuly does no legal wedding paperwork. Secondary sources say Zanzibar needs a certificate of no impediment and a 21-day notice with no waiver; **to verify** with ZCSRA. Link official sources only | Couple's wedding fails on paperwork and blames Kwetuly | **Go for honeymoon content; go for listing wedding planners; no-go for Kwetuly doing wedding paperwork** | Month 3 to 6 (needs Zanzibar listings first) |
| 4 | **Photo/film fixers** | Production companies; travellers for simple photo walks | Professional fixers: business listings (free, badge with permits seen, commission). Holiday photographers: guide package kind | Tanzania Film Board permit; 2019 rules reportedly require submitting raw footage (current status **to verify**); TANAPA permit in parks; TCAA says every drone needs a permit, including for visitors. Fees in secondary sources conflict, **to verify** | Crew arrives without permits, drone confiscated, Kwetuly named. Drone or restricted-site photos posted | **Holiday photo walks (no drone): go. Professional film fixing: no-go until month 12**, and then only registered fixer companies with permit evidence; Kwetuly never applies for permits | Photo walks: month 3. Fixers: month 12 or later |
| 5 | **Conference and business-group add-on trips (Arusha)** | Delegates (packages, group trips); later organisers | Existing guide packages and group trips, a page per conference | Packaged trips with vehicles must run through licensed tour operators; Kwetuly is not the operator | Group sizes beat our guide supply; a bad day trip reflects on the organiser and us. Conference volumes: published figures conflict (AICC sources range from about 35 to 100 meetings a year), **to verify** | **Go as a pilot of one conference**, only after soft-launch guides are reliable. Any contact with organisers by Walter | Month 6 to 12 |
| 6 | **Specialist guides: birding, fishing, diving** | Travellers (packages); dive and fishing operators (commission, badge) | Birding: a specialism tag on guide profiles. Fishing and diving: list licensed operators as businesses with documents seen and dates | Diving: Zanzibar Maritime Authority form lists a diving-centre licence (details **to verify**); dive certifications seen. Fishing: secondary sources say non-residents must go through authorised operators and marine protected areas are closed to sport spearfishing; **to verify** with Fisheries | Diving accident linked to a listing. Never "safe" or "certified by Kwetuly"; only "dive-centre licence no. ... seen on [date]" | **Birding: go. Fishing and diving: go only as operator listings with documents**, never as an individual guide package | Birding: soft launch (small tag change, tech-lead to size). Fishing/diving: month 6 |
| 7 | **Remote-worker monthly stays in Zanzibar** | Monthly-stay rentals (per-agreement commission); optional badge | Existing stays with a "monthly" filter or page | Tanzania has no digital nomad visa as of 2026 (secondary sources); whether remote work on a tourist visa is allowed is unclear. **Kwetuly must never say it is allowed**; link official immigration only. Zanzibar rental licensing **to verify** | Immigration wording getting travellers in trouble; long-stay disputes (deposits) that Kwetuly cannot hold money for | **Go later, stays only, no visa or work claims** | Month 6 to 12 |

---

## 4. Targets this adds (for data-analyst's scorecard)

No forecasts. These are counts to learn from, not revenue promises **[Assumption]**:

| Period | Target |
| --- | --- |
| Soft launch | Host samples labelled and removed by delete-all; birding tag live; 0 real hosts until legal answers |
| Month 3 | 3 to 5 approved real VIP hosts (if legal allows); airport meet and greet package from at least 2 guides; enquiries per host package counted |
| Month 6 | First honeymoon and diaspora pages; 2 dive or fishing operators listed with documents; decision on investment hosts after the advocate |
| Month 12 | One conference pilot done; host commission live if payments are live; decision on professional film fixers |

---

## 5. Go/no-go summary

| Item | Verdict |
| --- | --- |
| VIP personal trip host | Go for samples; real hosts after legal; charge after registration |
| Investment visit host | No-go for real hosts at soft launch; revisit after advocate Q8 |
| Airport meet and greet | Go, no driving, after airport rules |
| Diaspora homecoming | Go, marketing theme only |
| Honeymoon / weddings | Go (content, planner listings); no Kwetuly paperwork |
| Photo/film fixers | Photo walks go; film fixing no-go until month 12 |
| Conference add-ons | Pilot one, month 6 to 12 |
| Specialist guides | Birding go now; fishing and diving as operator listings, month 6 |
| Remote-worker stays | Go later, no visa claims |

---

## Sources

- Flutterwave Tanzania pricing: [flutterwave.com/tz/pricing](https://flutterwave.com/tz/pricing) (checked 2026-10-30)
- TISEZA, tourism licences: [procedures.tiseza.go.tz/objective/247](https://procedures.tiseza.go.tz/objective/247?l=en) (official, via legal research)
- Filming: Tanzanian embassy media permit page [be.tzembassy.go.tz/services/media-permit](https://www.be.tzembassy.go.tz/services/media-permit) (official); [Euronews 2019 on raw-footage rule](https://www.euronews.com/2019/06/28/law-passed-to-restrict-foreign-film-production-in-tanzania) (news); [Altezza Travel](https://altezzatravel.com/articles/filming-in-tanzania) (commercial, fees conflict)
- Drones: [TCAA drones](https://www.tcaa.go.tz/pages/drones) and [TCAA FAQ](https://www.tcaa.go.tz/index.php/faqs) (official)
- Zanzibar marriage: [Tanzanian embassy: married in Tanzania](https://www.be.tzembassy.go.tz/services/married-in-tanzania-abroad) (official, undated); [Swiss embassy note](https://www.eda.admin.ch/content/dam/countries/countries-content/tanzania/en/2022-Marriage-performed-in-Tanzania_EN.pdf) (official foreign source, 2022)
- Remote work / visas: [Fragomen: remote work in East Africa](https://www.fragomen.com/insights/remote-work-visa-opportunities-in-east-africa.html); [wheretoemigrate.io 2026 guide](https://wheretoemigrate.io/blog/digital-nomad-tanzania-guide-2026) (secondary)
- Fishing and diving: [Zanzibar Maritime Authority form](https://www.zma.go.tz/TzrsForms/APPLICATION%20FORM%20for%20SHIP%20OPERATOR.pdf) (official, fee currency not stated); [spearfishing operator page](https://extremebluewaterspearfishing.com/?p=3137) (commercial)
- Conferences: [Wikipedia: AICC](https://en.wikipedia.org/wiki/Arusha_International_Conference_Centre); [Daily News on AICC/JNICC](https://dailynews.co.tz/how-royal-tour-lifted-conference-tourism-at-aicc-jnicc/); [The Citizen on AICC](https://thecitizen.co.tz/tanzania/news/national/-aicc-loses-sh1-8bn-annually-after-key-tenants-move-out-2647042) (figures conflict)

---

## Decisions for Walter

1. **Host revenue model.** Recommendation: free while soft-launching (samples and recruitment page only); after company registration, a free listing plus the optional paid yearly "Checked by Kwetuly" at the same flat fee as guides; once online payment is live, the same disclosed % as prep calls. No yearly listing fee for hosts.
2. **VIP personal trip host.** Recommendation: go for labelled samples now; real hosts only after the advocate answers the licence question; security work and driving excluded and stated on the page. Keep "VIP" as a service name only, never a membership level.
3. **Investment visit host.** Recommendation: no real hosts at soft launch; samples only if you want them, limited to logistics and official TISEZA links; revisit after advocate question 8.
4. **Airport meet and greet.** Recommendation: go as a guide package kind with no driving, once legal checks airport access rules.
5. **Diaspora, honeymoon and conference ideas.** Recommendation: diaspora and honeymoon as marketing pages from month 3 to 6; wedding planners listed as businesses, Kwetuly never does wedding paperwork; conference add-ons as one pilot in month 6 to 12, with you making any organiser contact.
6. **Photo and film.** Recommendation: holiday photo walks (no drones) as a guide package from month 3; professional film fixers not before month 12.
7. **Specialist guides.** Recommendation: a birding specialism tag now (if tech-lead confirms it is small); fishing and diving only as listings of licensed operators with documents and dates, from month 6.
8. **Remote-worker stays.** Recommendation: month 6 to 12, stays only, with no statements about visas or permission to work.
9. **Pricing numbers.** Recommendation: set no host day-rate guidance and no paid-check fee until accounting supplies the hourly cost for the fee floor and the Selcom quote is in.
