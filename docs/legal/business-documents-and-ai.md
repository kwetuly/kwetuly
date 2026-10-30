# Business documents, payout details, AI pre-checks and admin access to orders

> **DRAFT – to be reviewed by a Tanzanian advocate.** Not legal advice.
> Prepared 2026-10-30 by the Kwetuly legal research helper (an AI, not a lawyer) for Walter and the advocate. Version 0.1.
> Answers board item R4 (Walter's list of 2026-10-30) and drafts the privacy-notice line in A4. Not published, not sent, nobody contacted. The live pages (`apps/web/src/app/[lang]/privacy`, `/data-deletion`) were **not** edited.
> Kwetuly is **not yet registered as a company**. Everything below assumes a future Tanzanian (mainland) company.

**Labels used**
- **[Official]**: a government, regulator or official-copy source.
- **[Secondary]**: law firm, news or commentary. Check against the gazetted text.
- **[Unverified]**: reported but not confirmed, or my own reading.

No section number below has been checked against the gazetted text. I have not used any case names.

---

## 0. What the code does today (read 2026-10-30)

| Point | What I found | Where |
| --- | --- | --- |
| Business private data | `provider_private` holds only `whatsapp_number`, `licence_document_path` (a scan in private storage) and the admin's `badge_note`. Only the owner and admins can read it. **No TIN, licence number or payout field exists yet.** | `supabase/migrations/20261016000300_provider_private.sql` |
| Badge checks | Admin ticks: business licence, "Tourism licence (TTB)", owner identity, photos match, visited in person | `packages/shared/src/businesses.ts` (`BADGE_CHECKS`) |
| Business types | 15 an owner can pick: hotel, lodge, homestay, hostel, rental, curio_shop, gem_shop, gear_rental, transport, car_hire, restaurant, spa, salon, nightlife, other. `merch` (Kwetuly Shop) is admin-only. | `packages/shared/src/businesses.ts` |
| Admins read enquiries and orders | Yes. The `leads` table (enquiries, and shop order requests built by `orderMessage`) and `trip_requests` both allow `is_admin()` to read. | `supabase/migrations/20261012000000_initial_schema.sql`, `20261012000300_guide_role_and_leads.sql` |
| AI pre-check | **Not built.** Anthropic is used only by the travel concierge today. The pre-check is planned as P6 (after launch). | `apps/web/src/app/api/concierge/route.ts`; `docs/team/board.md` |
| Payouts | `payments.payout_done` is a tick only. Kwetuly stores no bank or mobile-money payout numbers. | `supabase/migrations/20261014000200_payments.sql` |

**A possible wrong promise.** The badge check is labelled "Tourism licence (TTB)". As far as I know, the Tanzania Tourist Board (TTB) promotes tourism and does not issue licences. Tourism licences come from the Ministry of Natural Resources and Tourism (MNRT) ([TISEZA: Tourism licences](https://procedures.tiseza.go.tz/objective/247?l=en) [Official]). If that is right, the label names the wrong body. Proposed fix, for frontend-engineer and localization after Walter agrees: "Tourism licence (Ministry of Natural Resources and Tourism)". [Unverified; question 3 for the advocate]

---

## 1. Business licence and TIN at business approval

### 1.1 What applies to almost every business (the general layer)

| Document | What it is | Who issues it | Source |
| --- | --- | --- | --- |
| **TIN** (Taxpayer Identification Number) | Needed by any person who starts a business. A firm's summary says it must be obtained **within 15 days of starting business** (Tax Administration Act, s. 22(1), as reported). Individuals with a NIDA number can apply online. A business TIN is reported to need an office visit with a lease or title deed and a local-authority introduction letter. | Tanzania Revenue Authority (TRA) | [TRA: starting a business](https://tra.go.tz/index.php/starting-business) [Official]; [RSM Tanzania](https://www.rsm.global/tanzania/node/88) [Secondary, for the 15 days and s. 22(1)] |
| **Business licence** | A general trading licence. Sources describe two issuers: BRELA (or the Ministry of Industry and Trade) for "Class/Category A" licences, and the local government authority (city, municipal, town or district council) for "Class/Category B". They do **not** agree on which activities go where. A business-portal guide lists the order as BRELA registration, then TIN, then the licence application (form TFN 211). Some councils are reported to ask for a tax clearance certificate first. | BRELA or the local council, depending on the activity | Business Licensing Act, 1972 ([TanzLII](https://tanzlii.org/akn/tz/act/1972/25)) [Official]. The chapter number is unclear: older sources say Cap. 208, while GN 487A of 2025 cites "Cap. 101" ([Clyde & Co](https://www.clydeco.com/en/insights/2025/07/practical-implications-of-the-business-licensing) [Secondary]). Also [Clyde & Co, Business 101](https://clydeco.com/en/insights/2025/01/tanzania-business-101-what-you-need-to-know) [Secondary]; [business.go.tz](https://business.go.tz/obtain-a-business-license) [Official, page returned an error on 2026-10-30, content from a search summary] |
| **Registration** | A company (certificate of incorporation) or a business name (sole trader or partnership) | BRELA | [BRELA](https://www.brela.go.tz/) [Official] |
| **EFD/VFD receipts** | Electronic receipts for VAT-registered and many other businesses | TRA | For accounting; [Unverified] which of our types must issue them |

**Non-citizens.** GN 487A of 2025 (Business Licensing (Prohibition of Business Activities for Non-Citizens) Order, 2025) is reported to stop non-citizens from holding licences for 15 activities, including tour guiding, **salons**, mobile-money transfers and most small-scale retail. It is also reported to penalise **citizens who help** non-citizens to do so ([Clyde & Co](https://www.clydeco.com/en/insights/2025/07/practical-implications-of-the-business-licensing); [The Citizen](https://www.thecitizen.co.tz/tanzania/business/foreigners-barred-from-key-small-businesses-as-tanzania-enforces-strict-new-rules-5135534)) [Secondary; I have not seen the full list of 15]. This matters for salons and small shops, because a licence issued in a citizen's name may front for a foreign owner.

### 1.2 Sector licences by business type (proposal for the approval checklist)

"Collect at approval" is my **proposal** for what Kwetuly should ask for, not a statement of what the law requires Kwetuly to collect. **I found no law that requires a listing platform to collect a listed business's TIN or licence.** [Unverified] The reasons for collecting them are risk-based:
- Kwetuly should not list, and so in effect vouch for, an unlicensed business. On "aiding" risk, see travel-agent-and-transfers.md section 3.
- The badge must say what was checked.
- If Kwetuly ever pays a business, it may need the payee's TIN for withholding tax (see lessons-payments-items-research.md section 3.2).

| Type | General layer | Sector licence or permit (reported) | Collect at approval (proposal) | Source / status |
| --- | --- | --- | --- | --- |
| hotel, lodge, hostel | TIN, business licence | **MNRT tourism licence, Class C (hotels and accommodation)**. Must be renewed and paid every year. Possibly star grading. Fire and health certificates from the council or the fire service. | TIN; MNRT Class C licence number and expiry; business licence number | Class C: [TISEZA](https://procedures.tiseza.go.tz/objective/247?l=en) [Official]. Grading, fire and health: [Unverified] |
| homestay, rental (Airbnb-style) | TIN (individual or business), possibly a business licence | Class C reportedly includes "unclassified establishments with limited basic requirements". **Whether a family homestay or one apartment needs it is unclear.** Rental income tax may apply. | TIN; tourism licence if the advocate says one is needed. Until then, "Business licence/tourism licence: not checked" | TISEZA [Official, wording]; whether it applies to individuals [Unverified] |
| curio_shop | TIN, business licence | None for the shop itself, as far as I found. Item rules (wildlife, antiquities, forest products) are in lessons-payments-items-research.md section 4. Small retail may be reserved for citizens (GN 487A). | TIN; business licence number | [Unverified] |
| gem_shop | TIN, business licence | **Mineral dealer (or broker) licence** from the Mining Commission. Gem dealers are reported to be "reporting persons" under the Anti-Money Laundering Act. | TIN; dealer licence number and expiry. **Required, not optional** | lessons-payments-items-research.md section 4.2 [Official sources listed there] |
| gear_rental | TIN, business licence | None found | TIN; business licence number | [Unverified] |
| transport | TIN, business licence | LATRA licence for the vehicle or service. Possibly an MNRT tour-operator licence (Class A) if it runs tours. | TIN; LATRA licence number and expiry; MNRT licence if any | travel-agent-and-transfers.md section 2 [Secondary] |
| car_hire | TIN, business licence | **MNRT car hire licence (Class A), reported as issued only to Tanzanian-owned companies.** LATRA private-hire licence. | TIN; MNRT car hire licence; LATRA licence; expiry dates | Car hire, Tanzanians only: [TISEZA](https://procedures.tiseza.go.tz/objective/247?l=en) [Official]. LATRA [Secondary] |
| restaurant | TIN, business licence | Food hygiene or health permit (council); liquor licence if it sells alcohol | TIN; business licence; liquor licence if it serves alcohol | [Unverified, not researched] |
| spa | TIN, business licence | Unknown. Possibly a health-premises or council permit. | TIN; business licence | [Unverified] |
| salon | TIN, business licence | Reported as **reserved for citizens** (GN 487A) | TIN; business licence | [Secondary] |
| nightlife | TIN, business licence | Liquor licence; possibly music or entertainment permits | TIN; business licence; liquor licence | [Unverified] |
| other | TIN, business licence | Case by case. Walter decides. | TIN; business licence | – |
| merch (Kwetuly Shop) | Kwetuly's own | Kwetuly's own licences | Not applicable | – |

**Checking a TIN.** I could not find a current public TRA service that confirms a TIN belongs to a given name. TRA ran a TIN verification drive in 2016–2017 ([The Citizen](https://www.thecitizen.co.tz/tanzania/business/tra-blocks-unverified-tin-numbers-2579464) [Secondary, historical]). Until the advocate or accounting confirms a lawful check, the badge and the approval record must say **"TIN certificate seen on [date]"**, never "TIN verified with TRA".

**Data minimisation (proposal).** Record the number, the issuer, the expiry date and the "seen on" date. Keep the scan only as long as needed to make the check (see 1.4). For a sole trader, the TIN and licence identify a person, so they are personal data. For a company they are mostly company data, but the owner's name and ID are still personal data.

### 1.3 When may Kwetuly collect payout details?

**Short answer: I agree with the chief of staff. Collect them only when Kwetuly actually starts paying businesses, and only from the businesses it will pay.** [My reading; advocate to confirm]

Why:
1. **Purpose and minimisation.** The PDPA 2022 and the 2023 regulations are reported to require personal data to be collected for a specific, lawful purpose, to be adequate and not excessive, and to be used only for that purpose ([Afriwise, 2023 regulations](https://www.afriwise.com/blog/collection-and-processing-of-personal-data-regulations-published); [DLA Piper, Tanzania](https://www.dlapiperdataprotection.com/?c=TZ&t=law)) [Secondary]. Today Kwetuly pays businesses nothing: travellers pay shops directly, and businesses pay Kwetuly for the badge and commission. Payout details collected now would have no purpose.
2. **Risk.** A bank account or mobile-money number, together with the owner's name, is attractive to fraudsters. If it is not held, it cannot leak.
3. **The payment structure is not decided.** Under Option A in lessons-payments-items-research.md section 2.3 (a licensed provider holds the funds), the **provider** may collect and verify payout details itself (its own KYC). Kwetuly might then store only a provider reference, or nothing. Collecting them now could mean collecting them twice.
4. **Exceptions to watch.**
   - The referral agreement has a `guide_pct` share. If Kwetuly pays **guides** a share of a business's commission, that is a payout to guides, and the same rule applies: collect when the first payout is due.
   - A refund of a badge fee needs the business's details at that time only, and they should be deleted after the refund.

**Lawful basis (to confirm).** The draft privacy policy uses "contract" for payment data. Commentary on the PDPA lists exceptions to the consent rule, but the lists I found differ ([Afriwise/Clyde & Co, consent, 2025](https://www.afriwise.com/blog/what-does-consent-look-like-under-the-tanzania-personal-data-protection-laws)) [Secondary]. Question 6 asks the advocate.

**When it is built (P5, with payments Phase 4).**
- Show a notice at the point of entry.
- The account name must match the business or owner.
- Changes need two-step sign-in, plus an alert to the old contact.
- Show only the last 4 digits after saving.
- Admin access is logged.
- security-reviewer reviews it before it goes live.

### 1.4 How long to keep each item (proposal for the advocate)

I found **no specific retention periods in the PDPA commentary**. The rule reported is "no longer than necessary for the purpose" ([Afriwise, 2023 regulations](https://www.afriwise.com/blog/collection-and-processing-of-personal-data-regulations-published) [Secondary]). Tax records: TRA guidance says **5 years from the end of the year of income**, unless the Commissioner says otherwise ([TRA: what records should be maintained](https://tra.go.tz/index.php/income-tax-for-individual/118-what-records-should-be-maintained-by-a-taxpayer) [Official, older income-tax page]). PwC counts the 5 years from the filing due date instead ([PwC](https://taxsummaries.pwc.com/Tanzania/Corporate/Tax-administration) [Secondary]). The Tax Administration Act, Cap. 438, s. 35 "Maintenance of documents" is the likely source ([MoF copy](https://www.mof.go.tz/uploads/documents/en-1676548563-THE%20TAX%20ADMINISTRATION_ACT,%20CAP%20438.pdf) [Official, operative text not read]).

| Data | Proposed period | Why |
| --- | --- | --- |
| Rejected application (text, TIN, licence numbers, scans) | Delete **[6] months** after rejection | Long enough to answer a complaint or a re-application |
| TIN, licence numbers, issuer, expiry, "seen on" dates (approved business) | While listed, then **[N] years** after the listing ends | Evidence of what Kwetuly checked if a claim is made. The advocate should set N against the limitation period for claims (not researched) |
| Scans of licence and TIN certificates | Delete **[30] days** after the admin records the check, or when replaced. Alternative: keep while listed. | Minimisation. The number and dates are enough evidence if the advocate agrees (same question as travel-agent-and-transfers.md Q20) |
| Live payout details (account or wallet number, account name) | Only while Kwetuly pays this business. Delete within **[30] days** after the business leaves or changes them. | Purpose ends |
| Where each payout was sent (in the payment record) | **5 years** (tax), counted as the advocate confirms | Kwetuly's own tax and accounting records |
| AI pre-check notes (section 2) | Kept with the application until the decision, then **[90] days** | Lets Walter and the applicant see why something was flagged |

### 1.5 What the privacy notice must say

The full list of notice contents required by the PDPA was **not confirmed** from a source. Commentary says data subjects must understand who receives their data and that it is used only for the stated purposes [Secondary]. I propose the notice covers, for business documents and payout details:
- what is collected;
- why;
- the lawful basis;
- whether it is required, and what happens if it is not given ("we cannot approve the listing" or "we cannot pay you");
- who sees it (the owner, Kwetuly admins, and later the payment provider);
- that it is never shown publicly, except the badge line saying what was checked and when;
- where it is stored (provider and country);
- how long it is kept;
- the rights the person has.

Proposed text, **to publish only when the fields exist** (TIN at P5, payout details only with payments Phase 4). Guide and owner texts are needed in English and Kiswahili.

> **Business documents.** When you apply to list a business, we ask for your TIN and your business licence, and for some types of business a sector licence (for example a tourism, mineral dealer or LATRA licence). We use them to decide whether to approve your listing and, if you buy the "Checked by Kwetuly" badge, to say on your listing what we checked and when. We never show the numbers or documents publicly. Only you and Kwetuly admins can see them. We keep the numbers while your business is listed and for [N] years after it is removed, and we delete copies of the documents [30 days after we record the check]. If you do not give them, we cannot approve the listing.
>
> **Payout details.** We ask for a bank account or mobile-money number only when Kwetuly starts paying you money. We use it only to pay you, and we share it only with our payment provider [NAME]. We keep the record of each payment for [5] years for tax and accounting. We delete the account details [30 days] after you stop receiving payments from Kwetuly or change them.

---

## 2. AI pre-check of guide and business applications

**What Walter decided (board, 2026-10-30, item 6).**
- An AI reads only the **text** of guide and business submissions: never IDs, licence scans or payout details.
- It prepares a pre-check, and Walter decides every approval.
- The AI is the Anthropic API, a processor outside Tanzania (reported to be in the United States; tech-lead to confirm the region).

### 2.1 What must be disclosed

At minimum, in the privacy notice and in a short line at the point of submission:
1. That an AI service reads the application text, and **which provider** it is (Anthropic).
2. **What it reads and what it does not** (text only; no documents, ID, or payment details).
3. **The purpose**: a first check for missing or contradictory information and for rule breaks, which helps the reviewer.
4. **That a person decides every application**, and that the applicant can ask for an explanation and for the decision to be looked at again.
5. **That the data goes outside Tanzania** (country), and the safeguard used (see 2.3).
6. **Retention**:
   - Kwetuly's own copy of the AI notes (proposal in 1.4).
   - Anthropic's own retention. Anthropic's privacy centre says API inputs and outputs are deleted within 30 days, apart from services with longer retention, and its commercial terms are reported to forbid training on customer content ([Anthropic privacy centre](https://privacy.claude.com/en/articles/7996866-is-my-data-used-for-model-training) [Official, provider's own page; the 30-day figure is from a search summary]). One blog reports a shorter 7-day window from September 2025 [Unverified]. **tech-lead must confirm both against the Anthropic Commercial Terms and Data Processing Addendum that Kwetuly actually accepts** before the notice states them.
7. **That it is not used to train AI models**, only if 6 confirms it.

### 2.2 Is consent needed?

**For the AI review itself, probably not, if a person really decides. But this is my reading, and the advocate must confirm it.**
- **Decisions made only by a computer.** The PDPA is reported to give a right not to be subject to decisions based solely on automated processing that significantly affect a person (reported as s. 33(c); [Clyde & Co, May 2026](https://www.clydeco.com/en/insights/2026/05/understanding-data-subject-rights-in-tanzania-acce) [Secondary]). Walter deciding each case keeps this outside "solely automated", **provided the human review is real**. Walter must see the original application, not only the AI summary, and must be able to approve against the AI's flag. A rejection must never be sent on the AI's word alone.
- **Lawful basis for the review.** Likely "steps the applicant asked for before a contract" or legitimate interests (safety and fraud checks), not consent. The bases the PDPA allows need confirming (question 9).
- **Sensitive data in free text.** This is the main risk. Guide bios and business stories often mention **ethnicity or tribe** (for example "Maasai guide"), **religion** (for example halal or church tours) or **health**. Sensitive data is reported to need **prior written consent** ([Afriwise/Clyde & Co](https://www.afriwise.com/blog/what-does-consent-look-like-under-the-tanzania-personal-data-protection-laws) [Secondary]). Proposals:
  - Do not ask for these things.
  - Before sending, strip contact details (phone, email, WhatsApp links) and the person's name, replacing them with placeholders.
  - Tell applicants in the notice not to include sensitive details they do not want reviewed.
  - Ask the advocate whether a consent tick is needed anyway.
- **Recommended practical step (cheap, and avoids the question):** at the submit step, offer "Review my application without the AI helper". The application then goes straight to the human queue. This keeps any consent freely given, if the advocate says consent is needed. It costs a little more of Walter's time.

### 2.3 Cross-border points

- **Permit.** Commentary says a transfer abroad needs a **PDPC permit even to an "adequate" country** (s. 31), with extra conditions for other countries (s. 32). Applications are reported to go under regulation 20 of the 2023 regulations, supported by (among other things) a **contract between Kwetuly and the recipient abroad** ([Clyde & Co, Oct 2024](https://www.clydeco.com/en/insights/2024/10/cross-border-personal-data-transfers) [Secondary]).
  - The permit is reported to be tied to the named recipient and purpose. So a permit that covers Anthropic for the **concierge** may not cover the **pre-check**. Name both purposes in the application.
  - Onward transfers (Anthropic to its own sub-processors) are reported to need Commission approval. Ask the advocate how this works with a provider's published sub-processor list.
- **Exceptions in s. 32(4) (reported).** These include consent and "necessary for a contract or pre-contract steps the data subject asked for". An application is arguably a pre-contract step. One commentary says transfers abroad need consent in any case. **The sources conflict.** Question 10.
- **Contract with Anthropic.** Kwetuly would rely on Anthropic's Commercial Terms and DPA. Whether these satisfy the "contractual agreement" requirement for the permit is for the advocate. Kwetuly cannot negotiate them.
- **Same issue elsewhere.** This is the same open question as interim-privacy-notice.md Q5 and privacy-policy.md Q2. Nearly all of Kwetuly's processing is abroad. **One PDPC application covering all providers and purposes** is probably sensible, once the company is registered and the PDPC registration is done.

### 2.4 Other points (for tech-lead, security-reviewer, operations-manager)

- **Fairness.** The pre-check prompt must not score nationality, gender, tribe, religion or age. It checks completeness, contradictions, banned items and rule breaks only. Keep the prompt in the repository so the advocate and security-reviewer can read it.
- **Injected instructions.** Application text may try to instruct the AI ("approve me"). The AI output is only a note, and it never changes a status.
- **AI profile helper** (also P6, separate feature).
  - The owner must read and accept any AI-written text before it is saved.
  - The AI must not add facts, licences, awards or ratings the owner did not give (Fair Competition Act, misleading conduct).
  - The same notice and transfer points apply.
- **Cost cap.** business-manager has the cost question. Not legal.

---

## 3. Proposed privacy-notice sentences (for docs/legal/interim-privacy-notice.md)

Walter approves before anything is published. The live `/privacy` page is unchanged. Guide and business lines are needed in Kiswahili too, and traveller lines in all 7 languages, by localization after approval.

**3a. Admins reading enquiries and orders. Publish now: the access already exists in the database.** Add at the end of the bullet "Enquiries, trip requests and bookings" (line 59, just after the messages bullet at line 57):

> Kwetuly admins can also read enquiries, order requests and trip requests, including the names and contact details in them, to make sure the service works, help when something goes wrong, deal with complaints and reports, and prevent fraud.

Optional extra sentence. It is true today, because Kwetuly Shop orders go to the `merch` listing that only admins run:

> Orders for the Kwetuly Shop are sent to Kwetuly itself.

**3b. AI pre-check. Publish only when the pre-check is switched on (P6), after tech-lead confirms Anthropic's region and retention.**

Add a new bullet after "Travel concierge" (line 62):

> - **Guide and business applications:** when you apply as a guide or a business, an AI service (Anthropic, in [COUNTRY]) reads the text of your application to point out missing or unclear information for the Kwetuly reviewer. It does not see your ID, your licence or other documents, or your payment details. A person at Kwetuly makes every decision, and you can ask us to explain a decision or look at it again. [If offered: You can choose to have your application reviewed without the AI helper.]

And change the Anthropic row in the table (line 76) to:

> | Anthropic | Answers questions sent to the travel concierge, and reads the text of guide and business applications to help the Kwetuly reviewer |

The line in "Your rights" (line 93) can stay as it is: "Kwetuly does not make such decisions" remains true while a person decides every application.

**3c. Same changes for the full draft policy (docs/legal/privacy-policy.md).** Add 3a to section 4 (who sees data, line 83). Add 3b to the data table and to the provider table (line 105). Add the business-document and payout paragraphs from section 1.5 when those fields are built.

---

## 4. Items for other agents (no action taken)

- **frontend-engineer and localization:** badge label "Tourism licence (TTB)", see section 0. Change only after Walter agrees and the advocate confirms.
- **backend-engineer (P5):** fields for TIN, licence number, issuer, class, expiry and `seen_at`; automatic flag on expiry; scan deletion job; no payout fields until payments Phase 4.
- **tech-lead (P6):** Anthropic region, retention and DPA for the API key used; stripping contact details and names before sending; the prompt kept in the repository; the AI output never changes a status.
- **operations-manager:** add the section 1.2 checklist to the approval centre. Rejections need a human-written reason.
- **accounting:** whether TRA offers a lawful TIN check; when Kwetuly needs payees' TINs for withholding.

---

## Sources

- [TISEZA: Tourism licences (MNRT classes A and C, car hire for Tanzanian-owned companies only)](https://procedures.tiseza.go.tz/objective/247?l=en) [Official]
- [Business Licensing Act, 1972, TanzLII](https://tanzlii.org/akn/tz/act/1972/25) [Official]; [Business Licensing Regulations, 1972](https://tanzlii.org/en/akn/tz/act/gn/1972/187/eng@2002-07-31) [Official]
- [business.go.tz: Obtain a business licence](https://business.go.tz/obtain-a-business-license) [Official, error on 2026-10-30]
- [Clyde & Co: Tanzania Business 101 (Jan 2025)](https://clydeco.com/en/insights/2025/01/tanzania-business-101-what-you-need-to-know) [Secondary]
- [Clyde & Co: GN 487A of 2025](https://www.clydeco.com/en/insights/2025/07/practical-implications-of-the-business-licensing) [Secondary]; [The Citizen on GN 487A](https://www.thecitizen.co.tz/tanzania/business/foreigners-barred-from-key-small-businesses-as-tanzania-enforces-strict-new-rules-5135534) [Secondary]
- [TRA: starting a business](https://tra.go.tz/index.php/starting-business) [Official]; [TRA: records to keep](https://tra.go.tz/index.php/income-tax-for-individual/118-what-records-should-be-maintained-by-a-taxpayer) [Official]; [RSM Tanzania](https://www.rsm.global/tanzania/node/88) [Secondary]; [PwC: Tax administration](https://taxsummaries.pwc.com/Tanzania/Corporate/Tax-administration) [Secondary]; [Tax Administration Act, Cap. 438, MoF copy](https://www.mof.go.tz/uploads/documents/en-1676548563-THE%20TAX%20ADMINISTRATION_ACT,%20CAP%20438.pdf) [Official]; [The Citizen: TRA blocks unverified TINs](https://www.thecitizen.co.tz/tanzania/business/tra-blocks-unverified-tin-numbers-2579464) [Secondary, historical]
- [Clyde & Co: cross-border transfers (Oct 2024)](https://www.clydeco.com/en/insights/2024/10/cross-border-personal-data-transfers) [Secondary]; [Afriwise/Clyde & Co: consent (2025)](https://www.afriwise.com/blog/what-does-consent-look-like-under-the-tanzania-personal-data-protection-laws) [Secondary]; [Afriwise: 2023 regulations](https://www.afriwise.com/blog/collection-and-processing-of-personal-data-regulations-published) [Secondary]; [DLA Piper: Tanzania](https://www.dlapiperdataprotection.com/?c=TZ&t=law) [Secondary]; [Clyde & Co: data subject rights (May 2026)](https://www.clydeco.com/en/insights/2026/05/understanding-data-subject-rights-in-tanzania-acce) [Secondary]; [PDPC](https://pdpc.go.tz/) [Official]
- [Anthropic privacy centre: model training](https://privacy.claude.com/en/articles/7996866-is-my-data-used-for-model-training) [Provider's own page]

---

## Questions for the advocate

**Business documents**
1. Is Kwetuly, as a listing platform, legally required to collect or check a listed business's TIN or business licence? Or is it only good practice? Does listing an unlicensed business expose Kwetuly to an "aiding" offence (Business Licensing Act, Tourism Act s. 46, GN 487A)?
2. Please correct the table in section 1.2. Which sector licences apply to each of the 15 types, especially homestays and single Airbnb-style apartments (Class C or not?), restaurants, spas, nightlife (liquor) and gear rental? Which body issues each general business licence: BRELA or the council?
3. Is the badge label "Tourism licence (TTB)" wrong? Which body issues tourism licences today, and what is the correct name of the licence?
4. Is there a lawful way for Kwetuly to confirm that a TIN or a licence is genuine and current (a public register or online check)? If not, is "seen on [date]" the right wording?
5. GN 487A of 2025: please give the full list of the 15 activities. What must Kwetuly check so that it does not list a business a non-citizen runs through a citizen's licence (for example salons and small shops)?

**Payout details and retention**
6. Under the PDPA 2022 and the 2023 regulations, what is the lawful basis for collecting payout details: contract, or consent? Do you agree that they should be collected only when Kwetuly starts paying a business or guide? Does that change if a licensed payment provider collects them instead?
7. How long may Kwetuly keep (a) TIN and licence numbers after a listing ends, (b) document scans, (c) rejected applications, (d) payout details, and (e) payment records? Is TRA's 5 years (Tax Administration Act, s. 35, as reported) counted from the end of the year of income or from the filing date? What is the limitation period for claims that should guide (a)?
8. What exactly must a privacy notice contain under the PDPA and the 2023 regulations? Does the proposed text in section 1.5 meet that?

**AI pre-check**
9. If a person decides every application, is the AI pre-check outside the reported right not to be subject to solely automated decisions (s. 33(c))? What lawful basis applies to the AI review: pre-contract steps, legitimate interests or consent?
10. Does sending application text to Anthropic (a processor outside Tanzania) need the applicant's consent under s. 32(4), or is "necessary for pre-contract steps" enough? Does it need a PDPC permit under regulation 20 even though the processor is bound by its own DPA? Can one permit cover several providers and purposes (concierge, pre-check, hosting, email)?
11. Application text may contain sensitive data (tribe or ethnicity, religion, health). Is a written consent tick needed before AI review? Is stripping names and contact details before sending enough to reduce the risk?
12. Is Anthropic's standard Commercial Terms and DPA a sufficient "contractual agreement" for the transfer permit, given that Kwetuly cannot negotiate them?

**Admin access**
13. Is it lawful and proportionate for admins to read all enquiries, order requests and trip requests, including contact details, if the notice discloses it as in section 3a? Should access be limited (for example to reported cases), and should it be logged?
