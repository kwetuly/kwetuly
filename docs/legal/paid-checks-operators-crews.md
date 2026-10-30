# Draft for advocate review – not legal advice

**DRAFT – to be reviewed by a Tanzanian advocate.** Background research, draft wording and questions on:
1. a paid yearly "Checked by Kwetuly" check for guides;
2. partnerships with tour operators and travel agents;
3. listing crews (porters, cooks, assistant guides);
4. operators hiring guides through Kwetuly.

- Prepared 2026-10-30 by the Kwetuly legal research helper (an AI, not a lawyer) for Walter and the advocate.
- Not published or sent to anyone. Nobody has been contacted.
- Kwetuly is **not yet registered as a company**. Everything below assumes a future company on the Tanzania mainland. **Zanzibar has not been researched.**
- This builds on travel-agent-and-transfers.md (licences, GN 487A, transfers) and business-listing-terms.md Part B (the business badge). Those notes are not repeated in full here.

**Labels** (same as the other notes in this folder):
- **[Official]**: a government, regulator or court text, or an official copy of it.
- **[Secondary]**: law firm, news, NGO or commentary, or an unofficial copy of a law (for example tanzanialaws.com). Check against the gazetted text.
- **[Unverified]**: reported but not confirmed, or my own reading or recollection. Must be checked.

**Limits of this research.**
- I read the wording of ss. 15, 16 and 60 of the Fair Competition Act, 2003, Part V of the National Employment Promotion Service Act, and s. 61 of the Labour Institutions Act. All of these came **only from unofficial copies or a law firm's quotation**, not the gazetted text, and those copies may not include later amendments.
- I could **not** read:
  - the Employment and Labour Relations Act, 2004;
  - any official KINAPA or TANAPA porter rule;
  - GN 605A of 2025 itself;
  - GN 228 of 2009.
- No case names are used.

---

## 1. A paid yearly "Checked by Kwetuly" for guides

### 1.1 The law

| Item | What the sources say | Status |
| --- | --- | --- |
| Fair Competition Act, 2003 (Act No. 8 of 2003, Cap. 285), **s. 15** | "No person shall, in trade, engage in conduct that is misleading or deceptive or is likely to mislead or deceive." | [Secondary]: unofficial copy on [tanzanialaws.com](https://www.tanzanialaws.com/?p=132). Official copy on [TanzLII](https://tanzlii.org/akn/tz/act/2003/8/eng@2003-12-31/source.pdf), not read. |
| **s. 16** | No person shall, in connection with the supply or possible supply of goods or services: (e) "represent that goods or services have sponsorship, approval, performance characteristics, accessories, uses or benefits they do not have"; (f) "represent that he has a sponsorship, approval or affiliation he does not have". | [Secondary]: same copy. Paragraph letters as given there. |
| **Consequences (s. 60)** | Under s. 60(5) and (6) of that copy, breaches of ss. 15 and 16 **do not attract fines** under s. 60. They may instead lead to **compliance orders (s. 58)** and **compensatory orders (s. 59)**. Directors, managers and officers can be deemed guilty of offences by a company (s. 60(3)). It is unclear whether that applies to ss. 15 and 16. | [Secondary]: same copy. **Whether later amendments added fines: [Unverified].** Other parts of Part III (for example product safety and information) may carry criminal penalties: not checked. |
| What this means for a paid badge [Unverified, my reading] | A badge that suggests a check, approval or quality that did not happen (s. 16(e)), or that suggests Kwetuly endorses the guide when it does not (s. 16(f), and s. 15 generally), is the main risk. The guide who displays it could also be in breach. Compensatory orders could mean paying travellers who relied on it. | [Unverified] |
| Who enforces | Fair Competition Commission (FCC). Standard Form (Consumer Contracts) Regulations, 2014, for click-to-accept terms. | [Secondary], see the README table and [Clyde & Co on standard-form contract registration](https://www.clydeco.com/en/insights/2025/10/tanzania-s-requirement-to-register-standard-form-c) |
| Tour guide registration is already a legal duty | Tour guides must be registered (Tourism Act s. 42; Tourism (Tour Guides) Regulations, 2015, GN 270 of 2015). Only Tanzanian citizens may register. | [Secondary], see travel-agent-and-transfers.md section 2.4 |

### 1.2 Risks in a **paid** check for guides

| Risk | Why it matters | Suggested answer (Walter and the advocate to decide) |
| --- | --- | --- |
| **Charging guides for a check the site already says is done for everyone** | The site says "We check every guide's tourism registration before they appear" (README, texts table). If the registration check becomes part of a paid badge, the free claim is false for everyone who does not pay. It would also look like paying to be shown as legal. | **Keep the registration check free and required for every guide** (no guide profile goes public without a recorded registration check). The paid badge covers only **extra** items. |
| **"Checked" read as "safe" or "good"** | Travellers may read a badge as a quality or safety promise: "approval ... they do not have" (s. 16(e)). | Always show the list of items checked and the date. Never use "recommended", "trusted", "verified guide", "safe" or "top". |
| **Hidden payment** | A paid badge that looks independent may mislead (s. 15) if travellers are not told the guide paid for it. | Say in the badge details: "The guide pays Kwetuly a yearly fee for this check." |
| **Ranking boost** | If badge holders appear higher, or are the only ones shown by default, the badge works as a paid ad. Hiding that could be misleading conduct. | **No ranking boost** (Walter's instruction for this note). Search order must not use the badge. A filter "Show only guides with extra checks", chosen by the traveller, is probably fine. Advocate to confirm. |
| **Out-of-date badges** | A badge still showing after its end date, or after a registration lapses, is a false statement. | The system hides the badge on `valid_until`, and hides it at once when the registration expires or is withdrawn. |
| **Sample data** | Sample guides must never show a badge. | The badge cannot be set when `is_sample` is true (database rule). |
| **Badge counts in marketing** | A count such as "120 checked guides" must not include samples or expired badges. | Count only live, unexpired, non-sample badges. |
| **Failed checks and refunds** | If the guide pays and fails, keeping the whole fee may be an unfair term. | Same open question as business-listing-terms.md B5. |
| **Personal data** | ID copies, first-aid certificates, references and call recordings are personal data under the PDPA 2022. | Store numbers, dates and the result, not images, unless the advocate says copies are needed. No recordings of video calls without consent. |

### 1.3 What a paid guide check could contain (Walter to choose)

Each item is shown separately, with how it was checked:

1. Identity: a NIDA or passport check against the person on a video call. **The NIDA number is not shown publicly.**
2. Tour guide registration: number, class or area if any, and expiry. Re-checked, but **this is also done free for everyone** (see 1.2).
3. First-aid certificate: issuer and expiry date.
4. Specialist certificates the guide claims, for example mountain or bird guiding, or a language. Each one is shown only if a document was seen.
5. Two references from licensed operators or past travellers, contacted by Kwetuly. The badge says "2 references contacted", not what they said.
6. An interview by video call or in person (the badge says which).

**Not offered as checks**: a criminal record check (the process and the legal basis are unknown; advocate question), health, driving (see the transfers note), "safety".

### 1.4 Draft badge wording (English; Kiswahili and the 7 traveller languages after review)

Short label on cards: **"Extra checks by Kwetuly"**. Avoid the bare "Checked by Kwetuly", which suggests more than the list (advocate question 1).

Details panel:

> **What Kwetuly checked, and when**
> - Identity: seen on a video call, 12 Nov 2026
> - Tour guide registration no. TG-…: seen 12 Nov 2026, valid until 31 Dec 2026
> - First-aid certificate: seen 12 Nov 2026, valid until Mar 2027
> - 2 references from operators: contacted 14 Nov 2026
>
> These checks end on 12 Nov 2027. The guide pays Kwetuly a yearly fee for them. They are not a recommendation, and they do not change the order in which guides are shown. Report a problem: [link]

### 1.5 Draft clauses for the guide terms (to add to guide-terms.md after review)

G-B1. **What it is.** A yearly, paid check of items you choose from the list Kwetuly offers. Your profile shows each item that passed and the date it was checked.
G-B2. **What it is not.** It is not a recommendation, a rating, a guarantee of your work or of travellers' safety, or an endorsement. Kwetuly will not describe it that way, and you must not either.
G-B3. **No effect on ranking.** Having the check does not move your profile up in search results or lists.
G-B4. **Registration check is free.** Kwetuly checks every guide's tour guide registration free of charge before the profile goes public. You do not need to pay for that.
G-B5. **Fee and refund.** [Amount, VAT status and refund rule if an item fails: Walter and the advocate to decide.] No automatic renewal or charge.
G-B6. **Changes.** Tell Kwetuly within [14] days if your registration or a checked certificate lapses or is withdrawn. Kwetuly removes items that are no longer true, and tells you why.
G-B7. **False documents.** If a document turns out to be false, Kwetuly removes the badge and may suspend the profile [without refund: advocate to confirm fairness].
G-B8. **Your data.** Kwetuly keeps [the number, issuer, dates and result] of each document, not copies, for [period], as set out in the privacy policy.

---

## 2. Tour operator and travel agent partnerships

### 2.1 The model as described

- Kwetuly **introduces**. The **operator sells** the trip under its own name and licence. The traveller books with the operator **through Kwetuly**, by enquiry, and Kwetuly records the booking for commission.
- **[Unverified], my reading:** this keeps Kwetuly out of the tour operator or travel agent role only if:
  - the contract and the price are clearly the operator's;
  - Kwetuly does not package trips itself;
  - Kwetuly does not take the traveller's money for the trip (deposits are off; see lessons-payments-items-research.md section 2).
  If Kwetuly collects payment, sells "Signature trips" under its own name, or sets the itinerary and price, it may itself need an MNRT licence. A **travel agent** licence is reported to be open only to 100% Tanzanian-owned companies (travel-agent-and-transfers.md section 1.2, [Official: TISEZA] with [Secondary] support).

### 2.2 Legal points to build on

| Point | Summary | Status |
| --- | --- | --- |
| Licence issuer | Ministry of Natural Resources and Tourism. Class A covers tour operators (citizen-majority and non-citizen-majority procedures), travel agents, car hire, and mountain climbing/trekking. Licences are renewed yearly. | [Official]: [TISEZA, Tourism licences](https://procedures.tiseza.go.tz/objective/247?l=en) |
| Travel agents: Tanzanian-owned only | TISEZA says travel agent, car hire and mountain-climbing licences are issued only to companies fully owned by Tanzanians. A law firm adds a rule that two staff must hold IATA qualifications. | Ownership: [Official] TISEZA. IATA staff rule: [Unverified]. Legal basis (s. 58(2) Tourism Act?): [Secondary, Unverified] |
| **Mountain climbing is also Tanzanian-owned only** | As reported, a foreign-owned tour operator may hold a tour operator licence but **not** a mountain climbing/trekking licence. This matters for Kilimanjaro crews (section 3). | [Official] TISEZA, as summarised in travel-agent-and-transfers.md; the advocate should confirm |
| Foreign-owned tour operators | Allowed, with conditions reported: fleet size, vehicle age, TISEZA registration, minimum investment. | [Secondary]; figures [Unverified] |
| **GN 487A of 2025** | Business Licensing (Prohibition of Business Activities for Non-Citizens) Order, 2025, reported to bar non-citizens from "tour guiding within Tanzania", with penalties also for **a citizen who assists** them. | [Secondary]: [DLA Piper / IMMMA](https://www.dlapiperafrica.com/en/tanzania/insights/2025/A29574-legal-alert-flyer-opt1-v1); [The Citizen](https://www.thecitizen.co.tz/tanzania/business/foreigners-barred-from-key-small-businesses-as-tanzania-enforces-strict-new-rules-5135534) |
| What GN 487A means for operators | A foreign-owned operator may still run tours, but the **guides** it uses must be Tanzanian citizens. Kwetuly should not list a foreign individual as a guide, assistant guide or "tour leader" who guides in Tanzania. Whether a foreign "tour leader" travelling with their own group counts as "tour guiding" is unclear. | [Unverified], my reading |
| Guides "enlisted" with an operator | Guide registration is reported to require enlistment under a licensed tour company, the Tanzania Tour Guides Association or a similar body. | [Secondary], see travel-agent-and-transfers.md section 2.4 |

### 2.3 What Kwetuly should check before listing an operator or agent (draft checklist)

For partnerships and operations-manager. Record **what** was seen and **when**. Store numbers and dates, not copies, unless the advocate says otherwise.

**A. Company**
1. BRELA certificate of incorporation or business name. The name must match the profile ([BRELA](https://www.brela.go.tz/)).
2. TIN certificate. Local government business licence, if the advocate says one is also needed.
3. For foreign-owned operators: TISEZA certificate, if the advocate says it is required.

**B. Tourism licence**

4. MNRT licence of the **right class for each service listed**:
   - tour operator for safaris or day tours;
   - mountain climbing/trekking for Kilimanjaro, Meru and similar climbs;
   - travel agent for agency services;
   - car hire for vehicles without a guide.

   Record the licence number, holder name (must match BRELA), class and expiry.
5. **A service is not listed under a class the operator does not hold.** For example, no Kilimanjaro climbs from an operator with only a tour operator licence.
6. Re-check every year. The profile is suspended automatically on the expiry date.

**C. People**

7. A written statement that every guide used in Tanzania is a **registered Tanzanian tour guide**. Where the guide also has a Kwetuly profile, link the profile instead (its registration check is already recorded).
8. For climbs: a statement of the crew pay and conditions the operator commits to (section 3.4). If it claims KPAP partner status, proof of that status.

**D. Vehicles and parks** (only if the services need them)

9. LATRA tour-service licences, and the "Tour Services" marking if in force. See travel-agent-and-transfers.md section 2.6.
10. Any park registration or permit the operator needs to bring clients into TANAPA, NCAA or TAWA areas. **[Unverified]: whether park authorities keep a register of permitted operators** (advocate question).

**E. Insurance**

11. The operator's own public liability cover, and evacuation or rescue arrangements for climbs. Kwetuly only **sees** these. It does not sell, suggest or arrange insurance, and travellers are pointed only to official sites (NIC/ZIC) for their own cover.

**F. Contact and complaints**

12. A named contact with authority to act, a complaints address, and the operator's booking and cancellation terms (the traveller contracts on these).

**G. Agreement with Kwetuly**

13. A signed referral commission agreement (business-listing-terms.md Schedule 1, adapted), signed by Walter, not by any agent.
14. The commission is shown to travellers. Price parity or exclusivity clauses only if the advocate says they are fine under the Fair Competition Act.

**H. Travel agents only**

15. Tanzania-based agents need a travel agent licence. Since only 100% Tanzanian-owned companies are reported to receive one, Kwetuly relies on the licence and does not check shareholders itself.
16. Agents based abroad are handled as in travel-agent-and-transfers.md section 1.5, item 3.
17. **No profiles for individuals.**

### 2.4 How bookings through Kwetuly should look (to keep Kwetuly an introducer)

- The booking page says: "You are booking with [Operator name], tourism licence no. … . [Operator] provides the trip and its terms apply. Kwetuly introduced you and receives a commission of [x]% from [Operator]."
- The price is the operator's. Kwetuly adds no hidden margin.
- No deposit or payment goes through Kwetuly until the payments questions are answered. Payment goes straight to the operator.
- Complaints go to the operator first, with Kwetuly's own complaints route for the listing itself.

### 2.5 Operator profile wording

> Tour operator licence no. … (class A, tour operator) and mountain climbing licence no. … seen by Kwetuly on [date], valid until [date]. Kwetuly receives a commission on bookings from this operator.

Never use "licensed and trusted", "recommended", "ethical" or "porter-friendly" unless a specific named check supports it (section 3.4).

---

## 3. Crews and porters

### 3.1 Minimum wages (mainland)

| Item | What the sources say | Status |
| --- | --- | --- |
| Current order | **Labour Institutions (Minimum Wage for Private Sector) Order, GN 605A of 2025**, in force **1 January 2026**. It revokes the 2022 order (GN 687 of 2022). Employers already paying more must keep doing so. | [Secondary]: [Clyde & Co, Feb 2026](https://www.clydeco.com/en/insights/2026/02/introduction-of-a-new-wage-order-in-tanzania); [PKF, 2025](https://pkfea.com/publications/2025/new-minimum-wage-order-2025-key-highlights-for-tanzania-s-private-sector/). Gazette text not read. |
| Tourism categories (under "Hotel and hospitality services"), per month | Tourist luggage porter: **TZS 225,000**. Tour guide: **TZS 320,000**. Hunting and related activities: TZS 200,000. Hotels and restaurants: TZS 195,000-375,000 by grade. | [Secondary]: Clyde & Co; [WageIndicator](https://wageindicator.org/work/minimum-wage/countries/tanzania/53461-mainland-hotel-and-hospitality-services) |
| Daily rates | Tourist luggage porter: TZS 8,654 a day (TZS 1,154 an hour). Tour guide: TZS 12,308 a day (TZS 1,641 an hour). | [Secondary]: Clyde & Co; WageIndicator |
| Cooks | **No separate category found.** A mountain or camp cook might fall under "bars and restaurants" (TZS 195,000) or the general rate for sectors without their own board (reported as TZS 175,000). | [Unverified] |
| Does "tourist luggage porter" cover **mountain porters**? | Unclear. It sits in the hotel and hospitality list and may mean hotel or airport porters. | [Unverified]. Advocate question |
| "Regulation of Wages" orders | Older orders were made under the Regulation of Wages and Terms of Employment Act (for example GN 311 of 2002 on TanzLII). Current orders appear to be made under the Labour Institutions Act, 2004. **Whether any older order still applies to porters or tourism: unknown.** | [Official] older GN listed at [TanzLII](https://tanzlii.org/en/akn/tz/act/gn/2002/311), not read; current position [Unverified] |
| Who the minimum wage protects | Minimum wage orders protect **employees**. Porters and cooks hired per climb may be casual employees of the operator or, as some operators treat them, contractors. The presumption in s. 61 of the Labour Institutions Act (section 4.1) makes employee status likely where the operator directs their work and hours. | [Secondary] for s. 61; its application to porters is [Unverified] |

### 3.2 Park and porter rules (Kilimanjaro National Park, KINAPA / TANAPA)

| Item | What the sources say | Status |
| --- | --- | --- |
| Load limit | **20 kg** of client load per porter, excluding the porter's own kit. Widely described as a TANAPA/KINAPA rule, with bags weighed at the gate. | [Secondary]: [KPAP guidelines](https://kiliporters.org/get-involved/tipping-recommendations/) (NGO); [Responsible Travel](https://www.responsibletravel.com/holidays/high-altitude-trekking/travel-guide/porters-rights-high-altitude-trekking); operator blogs. **No official TANAPA text found.** |
| Pay timing | KPAP: "Salaries must be paid within 2 days of the descent of a climb as per KINAPA's regulations." | [Secondary]: KPAP page; the KINAPA regulation itself was not found |
| Park wage reference | A KPAP-linked page and a news report say TANAPA's reference rate is **USD 10 a day**, traced to **Government Notice No. 228 of 29 June 2009**. | [Secondary]: [Anadolu Agency](https://www.aa.com.tr/en/environment/low-paid-porters-of-africas-mount-kilimanjaro-demand-better-wages/2447910); GN 228 of 2009 itself **[Unverified]**, not seen |
| Industry agreement | KPAP's impact page, as quoted by an operator, says a **December 2024 revised wage agreement** set at least **TZS 25,000 a day** for KPAP partner companies (2024 average TZS 25,140, excluding tips). It said a further rise was expected in January 2026, subject to an official government and stakeholder notice. Older sources cite TZS 20,000 a day for porters, TZS 30,000 for cooks and assistant guides, and TZS 40,000 for lead guides. A Daily News report says porters welcomed higher wages under new agreements, without figures. One source links fair wages to KIATO (Kilimanjaro Association of Tour Operators). | [Secondary]: [Duma Explorer blog](https://www.dumaexplorer.com/blog/kilimanjaro-porters-glossary-wages-tipping-guide); [Daily News](https://dailynews.co.tz/porters-celebrate-increased-wages/). **Whether any of these figures is legally binding, or only an industry or KPAP standard: [Unverified].** |
| Enforcement | KPAP is reported to say that the minimum wage and the weight limit are often treated as recommendations and ignored. Pay as low as TZS 10,000 a day is reported. | [Secondary]: Responsible Travel; operator blogs |
| Women porters, 15 kg | One operator says 15 kg for women. Probably a company policy, not a park rule. | [Unverified] |

### 3.3 KPAP and porter welfare standards

- **KPAP (Kilimanjaro Porters Assistance Project)** is a non-profit (an initiative of International Mountain Explorers Connection). It runs a "Partner for Responsible Travel" programme for climbing companies. **It is a voluntary standard, not a law.** [Secondary: [Wikipedia](https://en.wikipedia.org/wiki/Kilimanjaro_Porter_Assistance_Project); [KPAP](https://kiliporters.org/get-involved/tipping-recommendations/)]
- **KPAP's published standards** [Secondary: KPAP's own page, undated]:
  - pay of at least the Tanzanian minimum wage, paid within 2 days of descent;
  - a transparent tipping procedure, so porters receive the full tip meant for them;
  - loads of no more than 20 kg, excluding the porter's own kit;
  - three adequate meals a day;
  - proper shelter and sleeping equipment;
  - proper gear;
  - care for sick or injured porters.
- KPAP warns about *kirunje*: people who did not work on the climb appear at the tipping ceremony to take tips.
- **For Kwetuly:**
  - Do **not** say an operator is a "KPAP partner" without proof from KPAP's own published list, recorded with the date.
  - Do **not** use the KPAP name or logo as a Kwetuly badge without KPAP's written permission. Walter would ask for it; no agent contacts KPAP.
  - KPAP-style standards can be the **checklist** for what an operator declares (section 3.4), with each item marked "declared by the operator" or "seen by Kwetuly".

### 3.4 Draft crew-welfare declaration (for operators listing climbs)

The operator states, and the profile shows as **"declared by the operator"** unless Kwetuly saw evidence:
1. Porter pay per day (TZS) and cook and assistant-guide pay per day: at least the legal minimum.
2. Pay within [2] days after descent, by mobile money or bank (traceable).
3. A client load of no more than 20 kg per porter, plus their own kit.
4. Three meals a day, a tent and a sleeping mat for each crew member, and proper cold-weather gear.
5. A plan for sick or injured crew, including evacuation.
6. Tips: how they are shared, and that the full amount reaches the crew.
7. **No fees charged to crew** for being hired (section 3.5).
8. KPAP partner: yes or no (with proof if yes).

### 3.5 No fees charged to porters (Kwetuly rule)

- **Kwetuly policy (proposed):**
  - Kwetuly never charges porters, cooks or assistant guides anything: no sign-up fee, badge fee, job fee or share of wages or tips.
  - Crew profiles and badges, if any, are free.
  - Operators listing climbs declare that they charge crew no hiring fee, "registration" fee or kickback (item 3.4.7). Breach means delisting.
- **Legal angle:** In the unofficial copy of the National Employment Promotion Service Act I read, s. 19 lets a private agency charge fees "as may be prescribed by the Minister for the service rendered". It does **not** say who pays, and I found **no express ban on charging job seekers** [Secondary]. The 2014 regulations may say more; I did not find their text. So the "no fees to crew" rule rests on Kwetuly's policy unless the advocate finds a legal basis.
- **Tips:** Kwetuly takes no cut of tips. Tips are paid by the traveller directly to the crew or through the operator's own procedure, never through Kwetuly while payments are off.

### 3.6 Risks of listing crews

| Risk | Why | Suggested answer |
| --- | --- | --- |
| **Kwetuly seen as the employer or labour supplier** | If travellers book porters through Kwetuly, or Kwetuly sets their pay, Kwetuly may be presumed the employer under s. 61 of the Labour Institutions Act ("control or direction" of work or hours), or treated as an employment agency, with wage, workers' compensation and NSSF duties. | Crew are **not bookable on their own**. They appear only as an operator's or guide's team. Kwetuly sets no pay, gives no directions and pays no wages. |
| **Unlicensed climbs** | A traveller hiring a porter or "guide" directly for Kilimanjaro bypasses the licensed operator. Park entry is reported to need a licensed operator. | Only operators with a mountain climbing licence may list climbs. Crew listings link to that operator. |
| **Low pay hidden behind Kwetuly's name** | Listing an operator that underpays crew harms Kwetuly's honesty promise, and a "porter-friendly" label could be misleading (Fair Competition Act s. 15). | The declaration in 3.4, shown as declared. Complaints route for crew in Kiswahili. Delisting on credible reports. |
| **Personal data of low-income workers** | Names, photos, NIDA numbers and phone numbers of porters can expose them to pressure or exploitation. | Crew profiles optional and with consent. First name and photo only. No public phone numbers. No NIDA stored unless needed. |
| **Ratings hurting livelihoods** | Public star ratings of individual porters could cost them work over things outside their control, and raise defamation concerns. | No individual crew ratings at launch. Feedback goes to the operator and to Kwetuly privately. |
| **Injury on the mountain** | Claims after injury or death may name Kwetuly. Workers' compensation duties fall on employers (Workers Compensation Act and WCF: [Unverified], not researched). | Operator responsible. Kwetuly records only what it saw. Advocate to review the terms. |
| **Age** | Minors working as porters. | Crew must be 18 or over. Operator declares it. |
| **Non-citizens** | Assistant guides are guides. GN 487A reportedly bars non-citizens from tour guiding. | Assistant guides must be registered Tanzanian guides. |
| **Kirunje and tip fraud** | Third parties claiming tips. | Operator's tipping procedure shown to travellers. Kwetuly does not handle tips. |

---

## 4. Operators hiring guides through Kwetuly

### 4.1 Employee or independent contractor

| Item | What the sources say | Status |
| --- | --- | --- |
| Main laws | **Employment and Labour Relations Act, 2004** (Act No. 6 of 2004, Cap. 366) and **Labour Institutions Act, 2004** (Act No. 7 of 2004, Cap. 300 R.E. 2019). | Labour Institutions Act: [Secondary] ([FB Attorneys](https://fbattorneys.co.tz/?p=15622); [ILO NATLEX entry](https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=68356)). ELRA Act and Cap. numbers: [Unverified] |
| **Presumption of employment (Labour Institutions Act s. 61)** | "For the purposes of a labour law, a person who works for, or renders services to, any other person is presumed, until the contrary is proved, to be an employee, regardless of the form of the contract", if **any one** of these is present: (a) the manner of work is subject to another's control or direction; (b) the hours of work are subject to another's control or direction; (c) the person is part of the organisation; (d) an average of at least **45 hours per month over the last three months** for that other person; (e) economic dependence on that person; (f) tools of trade or work equipment provided by that person; (g) working for or rendering services to only one person. | [Secondary]: quoted by [FB Attorneys](https://fbattorneys.co.tz/?p=15622) from Cap. 300 R.E. 2019 |
| What s. 61 means for guides [Unverified, my reading] | A guide who works most trips for one operator, uses the operator's vehicle and follows its itinerary meets several factors: (a), (b), (d), (f) and possibly (g). So the guide is **presumed an employee of the operator** unless the operator proves otherwise, whatever the contract calls them. | [Unverified] |
| Contract types | The Employment and Labour Relations Act is recalled as allowing contracts for an unspecified period, a specified period (limited to professionals and managers) and a specific task. A per-safari or per-climb engagement may be a specific-task contract. | **[Unverified]**, not read |
| The guide registration rule | Guides are reported to need enlistment under a licensed tour company, the TTGA or a similar body. | [Secondary] |
| Minimum wage | If the guide is an employee, the tour guide minimum of TZS 320,000 a month or TZS 12,308 a day applies (section 3.1). | [Secondary] |
| Non-citizens | Tour guiding is reported as reserved to citizens (GN 487A), so a foreign guide cannot be hired through Kwetuly. Work permits for other foreign staff come under the Non-Citizens (Employment Regulation) Act, 2015. | GN 487A: [Secondary]. Act name: [Unverified] |
| **Kwetuly's position** | Whether a guide is an employee is a matter **between the operator and the guide**. Kwetuly must not label guides as "freelancers" or "contractors" for the operator, must not set terms that decide the question, and must avoid any s. 61 factor pointing at Kwetuly itself. That means no control of the guide's hours or methods, and no exclusivity. | Suggested approach |

### 4.2 Does Kwetuly need a recruitment or employment agency licence?

| Item | What the sources say | Status |
| --- | --- | --- |
| Law | **National Employment Promotion Service Act (Cap. 243)**, Part V "Private Employment Promotion Agency" (ss. 18-23). | [Secondary]: unofficial copy on [tanzanialaws.com](https://www.tanzanialaws.com/?p=240). [TanzLII PDF, 1999](https://media.tanzlii.org/media/legislation/311082/source_file/2a40fc4f7e9877e0/1999-9.pdf) not read. **The copy may predate later amendments.** |
| What Part V says (that copy) | s. 2 defines a "Private Employment Promotion Agency (PEPA)" as "the employment promotion agency as approved by the Commissioner under section 21". s. 18: agencies or agents must be recognised and registered as private employment promotion agencies or agents. s. 19: fees "as may be prescribed by the Minister". s. 20: application to the Commissioner on the prescribed form, with fee, memorandum and articles, and details. s. 21: an agency "shall officially start operation upon receiving approval from the Commissioner", who issues a certificate. s. 22: cancellation. s. 23: appeal to the Minister, then the High Court. | [Secondary] |
| What the copy does **not** contain | No detailed definition of what activity counts as "employment promotion". No penalty in ss. 18-23 for operating without approval. No express rule on fees charged to job seekers. | [Secondary]; the 2014 regulations or amendments may fill these gaps [Unverified] |
| Regulations | National Employment Service Promotion (Private Employment Promotion Agency) Regulations, 2014, cited in academic commentary. | [Secondary]; text not found |
| Regulator | The **Tanzania Employment Services Agency (TaESA)** is described as monitoring and regulating employment services on the mainland. A University of Dar es Salaam article says TaESA was dissolved and merged into the Prime Minister's Office, and that the legal effect of this is unclear. An ILO policy brief (2026) reviews registration and inspection of private employment agencies, and an ILO workshop mentions one-year licence validity. | [Official]: [TaESA](https://taesa.go.tz/about). [Secondary]: [UDSM article](https://journals.udsm.ac.tz/index.php/ealr/article/view/6542/5174); [ILO](https://www.ilo.org/resource/article/assessing-effectiveness-regulatory-and-inspection-systems-private); [ILO fair recruitment](https://www.ilo.org/resource/article/tanzania-strengthens-fair-recruitment-standards-private-recruitment) |
| **When Kwetuly might be an agency [Unverified]** | Likely if it actively matches guides to operators' vacancies, shortlists candidates, or charges a placement fee. Possibly not if it is only a noticeboard where operators post and guides reply themselves. Because the copy lacks a clear definition, this is a key advocate question. | [Unverified] |
| **Labour hire (temporary staff)** | If Kwetuly supplied guides to operators and paid them, s. 61 factors (control, hours, economic dependence) would likely make Kwetuly their employer. That brings PAYE, NSSF, WCF and minimum-wage duties, and possibly the BoT payment questions. | [Unverified]. **Suggestion: do not do this.** |

### 4.3 Suggested product rules until the advocate answers

1. **No hiring feature yet.** At most, an operator can contact a guide through the normal "Ask" enquiry, as any traveller can.
2. If a jobs feature is built later:
   - operators post vacancies under their own name and licence;
   - each post states pay, whether the job is employment or per-trip, and the duration;
   - pay must be at least the legal minimum;
   - guides apply directly;
   - Kwetuly does not shortlist, place or pay anyone.
3. **No fees to guides** for applying or being hired. Any fee is charged to operators, and only after the advocate confirms whether a PEPA registration is needed.
4. Kwetuly is never the employer of record, never pays wages and never holds guides' pay.
5. Job posts are reviewed for illegal conditions, for example: unpaid "trial" climbs, fees to apply, or non-citizen guides.

---

## 5. Items for other agents (no action taken)

- **Walter:**
  - decide whether the guide registration check stays free for everyone (recommended);
  - decide which extra items the paid guide check contains;
  - confirm there is no ranking boost;
  - any KPAP contact or permission request is for Walter alone.
- **business-manager:** the price of the paid guide check, and whether a free registration check plus a paid extra check still works commercially.
- **backend-engineer / frontend-engineer:**
  - the guide badge needs per-item `checked_at`, `method` and `valid_until` fields;
  - automatic hiding on expiry or registration lapse;
  - no badge on `is_sample`;
  - search order must not read badge fields;
  - operator profiles need a licence class per service, with automatic suspension on expiry;
  - no crew booking and no hiring feature until the advocate answers.
- **partnerships / operations-manager:** use the checklist in 2.3 and the declaration in 3.4 in draft form only.
- **localization:** guide, crew and operator texts in English and Kiswahili; traveller-facing badge text in all 7 languages, after review.
- **security-reviewer:** review data handling for ID documents, references and crew data when built.

---

## Sources used

Official:
- [TISEZA, Tourism licences](https://procedures.tiseza.go.tz/objective/247?l=en)
- [Fair Competition Act 2003, TanzLII](https://tanzlii.org/akn/tz/act/2003/8/eng@2003-12-31/source.pdf) (not read; wording taken from the unofficial copy below)
- [Regulation of Wages and Terms of Employment Order, 2002, TanzLII](https://tanzlii.org/en/akn/tz/act/gn/2002/311) (not read)
- [TaESA, about](https://taesa.go.tz/about)
- [BRELA](https://www.brela.go.tz/)

Secondary:
- [tanzanialaws.com, Fair Competition Act (unofficial copy)](https://www.tanzanialaws.com/?p=132)
- [tanzanialaws.com, National Employment Promotion Service Act (unofficial copy)](https://www.tanzanialaws.com/?p=240)
- [FB Attorneys, employer and employee relationship (s. 61)](https://fbattorneys.co.tz/?p=15622)
- [ILO NATLEX, Labour Institutions Act](https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=68356)
- [Clyde & Co, new wage order (Feb 2026)](https://www.clydeco.com/en/insights/2026/02/introduction-of-a-new-wage-order-in-tanzania)
- [PKF, minimum wage order 2025](https://pkfea.com/publications/2025/new-minimum-wage-order-2025-key-highlights-for-tanzania-s-private-sector/)
- [WageIndicator, hotel and hospitality minimum wages](https://wageindicator.org/work/minimum-wage/countries/tanzania/53461-mainland-hotel-and-hospitality-services)
- [KPAP, porter treatment and tipping guidelines](https://kiliporters.org/get-involved/tipping-recommendations/)
- [Wikipedia, KPAP](https://en.wikipedia.org/wiki/Kilimanjaro_Porter_Assistance_Project)
- [Responsible Travel, porters' rights](https://www.responsibletravel.com/holidays/high-altitude-trekking/travel-guide/porters-rights-high-altitude-trekking)
- [Anadolu Agency, porters' wages](https://www.aa.com.tr/en/environment/low-paid-porters-of-africas-mount-kilimanjaro-demand-better-wages/2447910)
- [Duma Explorer, porters' wages blog](https://www.dumaexplorer.com/blog/kilimanjaro-porters-glossary-wages-tipping-guide)
- [Daily News, porters celebrate increased wages](https://dailynews.co.tz/porters-celebrate-increased-wages/)
- [DLA Piper / IMMMA, GN 487A](https://www.dlapiperafrica.com/en/tanzania/insights/2025/A29574-legal-alert-flyer-opt1-v1)
- [The Citizen, GN 487A](https://www.thecitizen.co.tz/tanzania/business/foreigners-barred-from-key-small-businesses-as-tanzania-enforces-strict-new-rules-5135534)
- [UDSM East African Law Review article on TaESA](https://journals.udsm.ac.tz/index.php/ealr/article/view/6542/5174)
- [ILO, private employment agencies in Tanzania](https://www.ilo.org/resource/article/assessing-effectiveness-regulatory-and-inspection-systems-private)
- [ILO, fair recruitment standards](https://www.ilo.org/resource/article/tanzania-strengthens-fair-recruitment-standards-private-recruitment)
- [Clyde & Co, standard-form consumer contracts](https://www.clydeco.com/en/insights/2025/10/tanzania-s-requirement-to-register-standard-form-c)

---

## Questions for the advocate

**Paid guide check (Fair Competition Act)**

1. Is "Checked by Kwetuly" a safe name for a paid check under ss. 15 and 16(e)-(f) of the Fair Competition Act, 2003? Or should it be narrower, such as "Extra checks by Kwetuly" or "Documents checked by Kwetuly"?
2. Please confirm the current wording of ss. 15, 16 and 60. Is it still true that breaches of ss. 15 and 16 lead only to compliance and compensatory orders (ss. 58-59), not fines, or have amendments changed this? Can the guide displaying the badge also be liable?
3. Must the badge say that the guide paid for it? Is the wording in section 1.4 enough?
4. Is it misleading, or otherwise unlawful, to charge guides for a check of their tour guide registration, given that registration is a legal duty and the site says every guide is checked? Do you agree the registration check should stay free for everyone?
5. Is a traveller-chosen filter "Show only guides with extra checks" acceptable without counting as a ranking boost? What disclosure would a ranking boost need if Walter ever wanted one?
6. Can the fee be kept if an item fails, or if the badge is removed early for a lapsed registration or a false document? Is clause G-B7 fair under the Standard Form (Consumer Contracts) Regulations, 2014, given that guides are businesses, not consumers?
7. May Kwetuly lawfully run a criminal record check on guides? Through which body, and on what PDPA 2022 basis?
8. Under the PDPA 2022, may Kwetuly keep only document numbers, dates and results instead of copies? Is that enough evidence if a check is later disputed?

**Operators and travel agents**

9. Does the introducer model in sections 2.1 and 2.4 keep Kwetuly outside the Tourism Act's licensing of tour operators and travel agents? Which of these would change that: collecting payment, setting prices, or selling under the Kwetuly name?
10. Please confirm that **mountain climbing/trekking** licences, as well as travel agent and car hire licences, are open only to 100% Tanzanian-owned companies. What is the legal source?
11. Must an operator hold a separate licence class for each service it lists (safari, climb, car hire, agency)? Is the rule in 2.3 item 5 correct?
12. Does GN 487A of 2025 bar a foreign "tour leader" who travels with their own group from leading it in Tanzania? Could Kwetuly be liable as a "citizen who assists" if it lists one?
13. Do TANAPA, NCAA or TAWA keep a register of operators allowed to bring clients into parks, which Kwetuly could check? Is there a public MNRT licence register?
14. Are exclusivity or price-parity clauses in a referral agreement with operators acceptable under the Fair Competition Act?
15. Is the operator checklist in section 2.3 enough? What should be added or removed?

**Crews and porters**

16. Is GN 605A of 2025 (Labour Institutions (Minimum Wage for Private Sector) Order) in force from 1 January 2026, and are the figures correct: tourist luggage porter TZS 225,000 a month or TZS 8,654 a day; tour guide TZS 320,000 a month or TZS 12,308 a day?
17. Does "tourist luggage porter" cover **mountain porters**? Which category covers mountain or camp **cooks** and assistant guides?
18. Does any Regulation of Wages order, or any park-specific instrument, still set porter pay? Is **GN 228 of 2009** (reported USD 10 a day) real and still in force? Is the December 2024 industry figure of TZS 25,000 a day binding on anyone, or only on KPAP partners? Was the expected January 2026 notice issued?
19. What are the official KINAPA/TANAPA rules on porters: the 20 kg load, pay within 2 days of descent, registration of porters, food and shelter? Where is the gazetted text?
20. Under s. 61 of the Labour Institutions Act, are porters and cooks hired per climb presumed employees of the operator (with minimum wage, NSSF and WCF duties)? What would rebut the presumption?
21. Does Tanzanian law ban or limit fees charged to workers by employers or agencies (for example in the 2014 PEPA regulations), so that Kwetuly's "no fees to crew" rule rests on law as well as policy?
22. If Kwetuly shows an operator's crew-welfare declaration (section 3.4), could Kwetuly be liable for misleading conduct if the declaration is false? Is the label "declared by the operator" enough?
23. May Kwetuly mention an operator's KPAP partner status, or KPAP's standards, without KPAP's permission?
24. Is a minimum age of 18 for crew correct? What is the legal minimum age for porter work?
25. Would public ratings of individual crew members raise defamation or data protection issues?

**Hiring guides through Kwetuly**

26. Please confirm the current wording of s. 61 of the Labour Institutions Act (Cap. 300 R.E. 2019). How does it apply to a registered guide who works most trips for one operator? Could any factor point at Kwetuly itself (for example, if Kwetuly set rules on response times, or required exclusivity)?
27. Is a per-safari or per-climb engagement a "specific task" contract under the Employment and Labour Relations Act, 2004? What written particulars must the operator give?
28. Would Kwetuly need approval as a Private Employment Promotion Agency under Cap. 243, ss. 18-21, if it: (a) only hosted operators' job posts; (b) matched or shortlisted guides; or (c) charged operators a placement fee? What activity triggers registration? Who is the "Commissioner" today, and what is TaESA's legal status? What is the penalty for operating without approval?
29. If Kwetuly later supplied guides on a temporary basis (labour hire), what duties would it take on (PAYE, NSSF, WCF, minimum wage), and is labour hire regulated separately?
30. Does any of the above differ in Zanzibar? Which bodies regulate tourism licences, wages and employment agencies there?
