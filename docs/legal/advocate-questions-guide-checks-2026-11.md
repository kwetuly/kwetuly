# Guide document checks: questions for the advocate (2026-11)

**DRAFT – to be reviewed by a Tanzanian advocate.** Not legal advice.

- Prepared on 2026-11-08 by the Kwetuly legal research helper (an AI, not a lawyer). It is step 1d of docs/team/plan-guide-checks-2026-11.md, section 7.
- Section 8 (NIDA and TIN) was added the same day, after Walter's decision.
- Nothing here is published, sent to guides or sent to anyone else. Nobody has been contacted. Walter chooses the advocate and sends this himself.
- Kwetuly is **not yet registered as a company**. **Zanzibar has not been researched.**
- This builds on earlier notes in this folder. They are not repeated in full here:
  - travel-agent-and-transfers.md, sections 2.1-2.4: LATRA, driving licence class, guide registration under GN 270 of 2015;
  - paid-checks-operators-crews.md, section 1: Fair Competition Act ss. 15-16;
  - business-documents-and-ai.md, sections 1.2-1.4 and 2.3: TIN for businesses, retention, cross-border transfers;
  - lessons-payments-items-research.md, section 3.2: withholding on payouts.

**Labels** (the same as the other notes):
- **[Official]**: a government or regulator text, or an official copy.
- **[Secondary]**: a law firm, news report, commentary or unofficial copy.
- **[Unverified]**: my own reading, a search summary, or something I could not confirm. It must be checked.

## 1. What Kwetuly does today and plans to do

Facts from the plan and the code, as read on 2026-11-08. Nothing has been changed.

**Uploads**
- Guides upload images or PDFs to a private storage bucket (Supabase), in their own folder: ID, guide licence or registration card, and first aid certificate.
- Planned additions: a WFR certificate, a driving licence (only for guides who say "I drive guests") and other certificates.

**Who sees them**
- The documents are visible only to the guide and to Kwetuly admins.
- The public sees only the kind of check, the date it was done and the valid-until date. The public never sees the image, the document number or who checked it.

**What a check means**
- A check means an admin opened the file, compared the name with the profile, entered the valid-until date and ticked it.
- It is **never** confirmed with a government register. Kwetuly does not judge skill.

**The planned rule**
- A guide profile goes live only with a current guide licence check and a current first aid or WFR check.
- Guides who drive guests also need a current driving licence check.
- **Walter decided (2026-11-08):**
  - the ID check is made with a **NIDA card or NIDA number**;
  - Kwetuly also collects the guide's **TIN**.

  See section 8.
- The profile hides itself on the day a required check expires.

**Planned traveller wording**
- Badge: "Licence and first aid checked", or "ID, licence and first aid checked".
- Detail lines: "{document} seen {date}, valid until {date}".
- Never "verified", "confirmed with the register" or "recommended".

**Where the data is held**
- The Supabase project region is **not yet confirmed** (tech-lead's open item, also in privacy-policy.md). It is almost certainly outside Tanzania.

**Retention today**
- privacy-policy.md section 8 proposes keeping documents "while the profile is active, then [12 months], then deleted".
- business-documents-and-ai.md proposes deleting scans **30 days** after the check, for business documents.
- These two proposals **conflict**, and the advocate's answer decides which one applies.

**Existing draft terms that are now out of date**
- guide-terms.md clause 2.4 says a new upload clears the related check. The plan changes this: the old check stays valid until its own expiry date.
- Clause 2.4 must be redrafted after this review (section 7 below).

## 2. Data protection: storing the images

### 2.1 What the sources say

| Point | What the sources say | Status |
| --- | --- | --- |
| Name of the law | Personal Data Protection Act, 2022. It is cited as Act No. 11 of 2022 by most sources, and as "Cap. 44" by KPMG. It is reported to be in force from **1 May 2023**. Regulations were made in 2023. | [Secondary]: [Clyde & Co, Feb 2023](https://www.clydeco.com/en/insights/2023/02/tanzania-personal-data-protection-act-of-2022); [KPMG Tanzania, 2025](https://kpmg.com/ke/en/insights/2025/01/extension-of-deadline-of-registration-of-personal-data-controllers-and-data-processors.html). **The Act number, Cap. number and regulation names must be confirmed against the gazetted text.** |
| Regulator | Personal Data Protection Commission (PDPC). Reported to have been launched on 3 April 2024. | [Secondary] |
| Registration | Controllers and processors are reported to have to register with the PDPC **before** they collect or process personal data. Registration is through the PDPC online system (reported as RCMIS). The registration deadline for existing controllers was reported to be extended to a **final 30 April 2025**. | [Secondary]: [FB Attorneys, Jan 2025](https://fbattorneys.co.tz/?p=17601); [KPMG](https://kpmg.com/ke/en/insights/2025/01/extension-of-deadline-of-registration-of-personal-data-controllers-and-data-processors.html); [Daily News](https://dailynews.co.tz/?p=82061). I did not read the PDPC's own notice. |
| Sensitive personal data | The categories are reported to include genetic data, data about children, data about offences, financial transactions, security measures and **biometric data**. Sensitive data is reported to need prior written consent. | [Secondary]: KPMG; [DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=TZ); [Afriwise](https://www.afriwise.com/blog/what-does-consent-look-like-under-the-tanzania-personal-data-protection-laws). **The full statutory definition was not read.** |
| Is an ID or licence image "sensitive"? | An ID card or driving licence shows a face photo, a date of birth and an ID number. Some laws treat a face photo as biometric only when it is processed to recognise someone. **I do not know how the PDPA treats it.** | [Unverified] |
| Cross-border transfer | Commentary says a transfer outside Tanzania needs a PDPC permit, even to an "adequate" country (reported as s. 31). Other countries have extra conditions (s. 32). The application is reported to go under regulation 20 of the 2023 regulations, supported by a contract with the recipient. | [Secondary]: [Clyde & Co, Oct 2024](https://www.clydeco.com/en/insights/2024/10/cross-border-personal-data-transfers). The sources conflict on whether consent is also needed (see business-documents-and-ai.md 2.3). |
| Retention | I found no fixed period for identity or licence documents. The reported rule is "no longer than necessary for the purpose". | [Secondary]: [Afriwise, 2023 regulations](https://www.afriwise.com/blog/collection-and-processing-of-personal-data-regulations-published) |

### 2.2 Who is the controller before the company exists? [Unverified]

Uploads already happen on the live site. Until the company is registered, the controller may be Walter personally. The questions below ask how to handle that, and whether uploads should be paused until the company and the PDPC registration exist.

### 2.3 Data-minimising options (Walter and the advocate to choose)

| Option | What Kwetuly keeps | Pros | Cons |
| --- | --- | --- | --- |
| A. Keep the images while the profile is active | Image, dates, checker | Evidence if a check is disputed. A renewal can be compared with the earlier document. | Most data and most risk. Long retention to justify. |
| B. Delete the image [30] days after the check (recommended to discuss) | Kind, number (masked?), issuer, checked_at, checked_by, valid_until | Minimisation. The image is not needed once the check is recorded. | Weaker evidence in a dispute. The guide re-uploads at every renewal (already planned). |
| C. Never store: the guide shows the document on a video call | Dates and the checker's note only | Least data | Slower. Harder to prove. A recording would need consent. |

### 2.4 Draft consent and notice wording for guides (English; Kiswahili after review)

The advocate should first say whether the lawful basis is **consent**, **contract** (the documents are needed for the guide's own listing) or **legitimate interests**. The text below is written so that it works as a notice, with a consent tick if the advocate says one is needed. Section 8.4 adds the NIDA and TIN lines.

> **Your documents**
> To show your profile, Kwetuly must see your guide licence and a first aid or WFR certificate, and your driving licence if you drive guests. We also ask for your NIDA card or NIDA number, to make sure the documents belong to you.
> - **Why:** to check that the name and dates match your profile, and to show travellers what we checked and when. We do not confirm your documents with the government register. We do not judge your skills.
> - **Who sees them:** only you and [NUMBER] named Kwetuly admins. Travellers see only "{document} seen {date}, valid until {date}", never the document or its number.
> - **Where:** stored by our provider Supabase in [COUNTRY / REGION], outside Tanzania [under PDPC permit no. ...].
> - **How long:** we delete the image [30 days after we record the check], and keep only the type, the dates [and the last 4 digits of the number] while you are on Kwetuly, then for [N] years after.
> - **Your choice:** if you do not upload them, your profile stays hidden. You can ask to see, correct or delete your data at [contact]. If you delete a required document, your profile is paused.
>
> [ ] I agree that Kwetuly may store and check these documents as described. *(Only if the advocate says consent is needed.)*

## 3. Driving licence for guide-drivers

The earlier research (travel-agent-and-transfers.md 2.1-2.4) found:
- **Driving licence classes.** Classes C, C1, C2 and C3 are commonly treated as the passenger or commercial classes. The sources are only Uber's driver page, forums and job adverts [Secondary/Unverified]. **No official table of classes was found** (Road Traffic Act, Cap. 168). Refresher training at renewal for classes C-C3 and E is reported under the Road Traffic (Examination and Re-testing of Drivers) Regulations, 2015 [Secondary].
- **LATRA driver registration.** Drivers of commercial vehicles reportedly need a LATRA driver registration card (GN 81 of 2020, reg. 20) [Secondary].
- **Tour vehicles.** In 2025 LATRA reportedly began certifying tour-vehicle drivers after tourism-specific exams, and requiring "Tour Services" markings [Secondary, news reports]. **Whether this is gazetted and in force is unknown.**
- **The vehicle.** If the guide drives their own car for reward, the vehicle side (LATRA licence, TALA car-hire or tour-operator licence, passenger insurance) is unresolved. Transfers stay **off**.

**Kwetuly states nothing about the required class until the advocate answers.** Until then, the safe wording is "Driving licence seen {date}, valid until {date}". It records that a licence was seen. It does **not** say the licence is the right class for carrying guests.

## 4. Wording and liability of the "checked" badge

- **Fair Competition Act, 2003, ss. 15-16.** The unofficial copy bans misleading conduct and representing an "approval" or "performance characteristics" a service does not have [Secondary]. See paid-checks-operators-crews.md 1.1 for the wording and the remedies.
- **The plan's wording.** The plan uses "seen" in the detail lines and "checked" in the short badge. The question is whether a traveller reads "Licence and first aid checked" as "Kwetuly confirms this guide is licensed and can give first aid".
- **Duty of care [Unverified, my reading].** Kwetuly voluntarily checks documents and shows the result. If a traveller relies on that check and is hurt, a negligence claim could argue that Kwetuly owed a duty to check with care. Examples: a forged licence that was ticked, or an expired first aid certificate still shown. I have not researched Tanzanian negligence law, and I give no case names.
- **First aid is also a registration condition.** A valid first aid certificate is reported as a condition of registration as a tour guide (GN 270 of 2015, per [FB Attorneys](https://fbattorneys.co.tz/registration-of-tour-guides/) [Secondary]). So the first aid check doubles as a check of something the law already expects.
- **Travellers' home markets.** Most travellers come from abroad (7 site languages). Their home consumer laws may apply to how Kwetuly advertises to them. This has not been researched.

## 5. Confirming a guide licence at the source

- **Who keeps the register.** A search summary of the Tourism (Tour Guides) Regulations, 2015 (GN 270 of 2015) says that **the Director of Tourism keeps and maintains a register of all tour guides**. Registered guides reportedly receive a certificate and an identity card, which they must wear while guiding ([TanzLII, GN 270 of 2015](https://tanzlii.org/en/akn/tz/act/gn/2015/270/eng@2015-07-17)). That is an official source, but TanzLII refused my connection on 2026-11-08, so **I could not read the text myself [Unverified]**.
- **No public lookup found.** I found no public online lookup, and no rule that the register is open to inspection.
- **TTB.** I do not know whether the Tanzania Tourist Board (TTB) now has any role in guide registration. The plan mentions TTB, but **I found no source**.
- **Which Act.** The sources disagree on the parent Act: the Tourism Act No. 29 of 2008 is cited, and elsewhere No. 11 (travel-agent-and-transfers.md Q1).
- **Possible routes, each for the advocate to judge:**
  1. a written request to the Director of Tourism (MNRT) for each guide, with the guide's consent;
  2. a standing arrangement with MNRT;
  3. the guide supplies an official status letter or printout themselves;
  4. confirmation from the body the guide is enlisted with (TTGA, KGA or a licensed operator). That body is not the register, so the wording would have to say so.
- **Sharing data with a third party.** Any of these routes passes the guide's personal data to a third party, so it needs a lawful basis and must be covered in the notice.
- **Walter's rule applies.** No agent contacts the Ministry, TTB, TTGA or KGA. Walter decides whether to ask, and does it himself.

## 6. Proposed retention (for the advocate to set)

| Data | Proposal | Why |
| --- | --- | --- |
| Images of ID, guide licence, first aid, WFR, driving licence and other certificates | Delete [30] days after the check is recorded, or when the guide replaces it. Alternative: Option A in 2.3. | Minimisation |
| Rejected or abandoned uploads (never checked) | Delete after [6] months | Re-application or complaint window |
| Check records (kind, title, checked_at, checked_by, valid_until, masked number) | While the guide is on Kwetuly, then [N] years | Evidence of what was checked, if a claim is made. N to be set against the limitation period for claims (not researched). |
| After the guide deletes their account | Images deleted at once. Check records kept for [N] years, then deleted. | Same as above |
| Backups | Supabase backup retention for the current plan: [to be confirmed by tech-lead] | A deleted image can survive in backups |

NIDA and TIN retention is proposed in section 8.3.

## 7. Items for other agents (no action taken)

- **tech-lead:**
  - confirm the Supabase project region, the storage region and backup retention;
  - say whether images can be deleted automatically after the check while the check record is kept;
  - confirm whether admin access to the documents is logged.
- **backend-engineer:**
  - design `guide_document_checks` so that the image path can be removed without losing the check;
  - store at most a masked document number;
  - hold the NIDA number and TIN (section 8) in an admin-only table, never on `guides`, and show only the last 4 digits after saving;
  - nothing is built until the advocate answers section 8.
- **security-reviewer:** review the bucket, the signed URLs for admins, the public view (no paths, no checker, no number) and the storage of NIDA numbers and TINs.
- **accounting:** say when Kwetuly will first pay guides (deposits are off). That is the latest point at which a TIN may be needed (section 8.2).
- **legal (later):**
  - redraft guide-terms.md 2.3-2.6: the new documents, "upload does not clear", the driving licence, the definition of "seen", NIDA and TIN;
  - redraft privacy-policy.md sections 4 and 8;
  - both after the advocate answers.
- **localization:** produce the Kiswahili consent text only after the advocate approves the English.

## 8. NIDA card or number, and TIN (added 2026-11-08)

Walter decided that the identity check uses a **NIDA card or NIDA number** (National Identification Number, NIN), and that Kwetuly also collects the guide's **TIN**. **Nothing is built until the advocate answers the questions in group H.**

### 8.1 NIDA

| Point | What the sources say | Status |
| --- | --- | --- |
| The law | Registration and Identification of Persons Act. I recall it as Cap. 36, Act No. 11 of 1986, with regulations. The issuing body is the National Identification Authority (NIDA). | **[Unverified]**: I could not find or read the Act or its regulations. The citation and any rules on copying must be confirmed. |
| Rules on private firms copying or storing the NIN or the card | **I found none.** The search found no rule in the Act that allows or bans a private firm photocopying a NIDA card or storing the number. | [Unverified] |
| How the NIN is used | Commentary says use of the NIN is governed by the PDPA 2022. NIDA reports that private institutions are connected to its system: one 2023 conference paper counts 81 private and 66 public. NIDA announced it would charge entities that use its data. | [Secondary]: [ID4Africa, NIDA presentation 2023](https://id4africa.com/wp-content/uploads/2023/06/PS2-S3-1-Rumatila-Temba-Tanzania.pdf); [The Citizen, NIDA to charge entities](https://thecitizen.co.tz/tanzania/news/national/nida-to-start-charging-entities-using-its-data-2712730); [Youverify](https://youverify.co/blog/how-tanzanias-nin-powers-safer-digital-onboarding) (a vendor) |
| Regulator concern | The PDPC's head is reported to have warned about private companies collecting personal information and using it for commercial interests against people's rights. | [Secondary]: [Daily News](https://dailynews.co.tz/as-tanzania-goes-digital-who-protects-your-privacy/) |
| Sensitive data? | The NIDA card shows a photo, and NIDA holds fingerprints. Kwetuly would not collect fingerprints. Whether a card image or the NIN is "sensitive" (biometric) under the PDPA is unknown. | [Unverified]. See 2.1. |

**My reading [Unverified].**
- A NIN alone, without a NIDA lookup, proves little: anyone can type a number. A card image proves more, but holds more data.
- Possible minimal options for the advocate:
  - (a) see the card and keep only the last 4 digits and the date;
  - (b) keep the full NIN in an admin-only table, with no card image after the check;
  - (c) use NIDA's own verification service, if a small platform can lawfully join it and at what cost. Walter decides whether to ask; no agent contacts NIDA.
- Under option (c), the badge could only say "NIDA number confirmed with NIDA" if that were actually done. Otherwise it stays "ID seen".

### 8.2 TIN from guides

| Point | What the sources say | Status |
| --- | --- | --- |
| Law | TINs are issued by the Tanzania Revenue Authority (TRA) under the Tax Administration Act, Cap. 438. I did not confirm the section on registration. | [Official]: [MoF copy of Cap. 438](https://www.mof.go.tz/uploads/documents/en-1676548563-THE%20TAX%20ADMINISTRATION_ACT,%20CAP%20438.pdf), operative text not read |
| Withholding on service fees | s. 83(1) of the Income Tax Act is reported to require a resident who pays a service fee to withhold tax, with different rates for residents and non-residents. One guide lists 5% and 15%. Whether this applies when a platform passes on a traveller's deposit to a guide is unknown. | [Secondary]: [FB Attorneys](https://fbattorneys.co.tz/withholding-tax-for-non-resident-service-provider/); [PaySpace guide](https://www.payspace.com/wp-content/uploads/2021/08/TanzaniaPAYEGuide.pdf). Rates and scope [Unverified] |
| Other withholding | s. 83B (Finance Act 2024) is reported to require 5% on payments to resident digital content creators. It probably does not cover guiding, but this is unconfirmed. | [Official, summary]: [TRA](https://www.tra.go.tz/page/digital-service-tax). See lessons-payments-items-research.md 3.2. |
| Today | Kwetuly pays guides nothing (deposits are off). So a tax duty to hold a guide's TIN probably does not arise yet. | [Unverified], my reading |
| Businesses | The business checklist already asks for a TIN for every business type (business-documents-and-ai.md 1.2). That proposal is to collect payout details only when Kwetuly starts paying, but to see the TIN at listing. | Earlier note |

**Suggested approach until the advocate answers [Unverified].**
- Do not make the TIN a condition for going live.
- Ask for it only before the first payout to that guide, if the advocate confirms that payouts need it.
- If Walter wants it earlier as a check that the guide is a registered business, the advocate must confirm that this purpose is lawful and proportionate. Many guides may not hold a TIN.
- A TIN is not shown publicly.

### 8.3 Proposed retention for NIDA and TIN

| Data | Proposal |
| --- | --- |
| NIDA card image | Same as other images: delete [30] days after the check |
| Full NIN | Not stored, or only if the advocate says it is needed. Otherwise keep the last 4 digits and the check date. |
| TIN | While Kwetuly pays the guide, plus the tax record period. TRA guidance says 5 years from the end of the year of income; see business-documents-and-ai.md 1.4. If no payout ever happens, delete it [30] days after the guide leaves. |

### 8.4 Draft notice lines (English; Kiswahili after review)

> **NIDA.** We ask to see your NIDA card [or your NIDA number] once, to make sure the documents on your profile belong to you. We keep [only the last 4 digits and the date we checked]. We delete the image [30 days] after the check. We never show it to travellers [and we do not check it with NIDA].
>
> **TIN.** [We ask for your TIN only before we first send you money, because tax law requires us to [withhold tax / report payments] (the advocate to confirm).] We keep it for [5] years after the last payment, and never show it publicly.

## Sources

Official:
- [Tourism (Tour Guides) Regulations, 2015, GN 270 of 2015, TanzLII](https://tanzlii.org/en/akn/tz/act/gn/2015/270/eng@2015-07-17). The connection was refused on 2026-11-08, so the content is from a search summary.
- [Tax Administration Act, Cap. 438, Ministry of Finance copy](https://www.mof.go.tz/uploads/documents/en-1676548563-THE%20TAX%20ADMINISTRATION_ACT,%20CAP%20438.pdf). Not read.
- [TRA, digital service tax and s. 83B](https://www.tra.go.tz/page/digital-service-tax). Summary only.

Secondary:
- [FB Attorneys, registration of tour guides](https://fbattorneys.co.tz/registration-of-tour-guides/)
- [FB Attorneys, legal update 15 January 2025 (PDPC registration deadline)](https://fbattorneys.co.tz/?p=17601)
- [FB Attorneys, withholding tax for non-resident service providers](https://fbattorneys.co.tz/withholding-tax-for-non-resident-service-provider/)
- [KPMG, extension of the PDPC registration deadline](https://kpmg.com/ke/en/insights/2025/01/extension-of-deadline-of-registration-of-personal-data-controllers-and-data-processors.html)
- [Daily News, PDPC extends registration deadline](https://dailynews.co.tz/?p=82061)
- [Daily News, as Tanzania goes digital, who protects your privacy?](https://dailynews.co.tz/as-tanzania-goes-digital-who-protects-your-privacy/)
- [Clyde & Co, the Personal Data Protection Act of 2022](https://www.clydeco.com/en/insights/2023/02/tanzania-personal-data-protection-act-of-2022)
- [Clyde & Co, cross-border personal data transfers](https://www.clydeco.com/en/insights/2024/10/cross-border-personal-data-transfers)
- [DLA Piper, data protection in Tanzania](https://www.dlapiperdataprotection.com/index.html?t=law&c=TZ)
- [Afriwise, consent under the Tanzanian data protection laws](https://www.afriwise.com/blog/what-does-consent-look-like-under-the-tanzania-personal-data-protection-laws)
- [Afriwise, collection and processing regulations](https://www.afriwise.com/blog/collection-and-processing-of-personal-data-regulations-published)
- [ID4Africa, NIDA presentation (2023)](https://id4africa.com/wp-content/uploads/2023/06/PS2-S3-1-Rumatila-Temba-Tanzania.pdf)
- [The Citizen, NIDA to start charging entities using its data](https://thecitizen.co.tz/tanzania/news/national/nida-to-start-charging-entities-using-its-data-2712730)
- [Youverify, Tanzania's NIN in digital onboarding](https://youverify.co/blog/how-tanzanias-nin-powers-safer-digital-onboarding) (a vendor blog)
- [PaySpace, Tanzania PAYE guide (withholding rates)](https://www.payspace.com/wp-content/uploads/2021/08/TanzaniaPAYEGuide.pdf)
- Earlier notes in this folder, and the sources they list: travel-agent-and-transfers.md, paid-checks-operators-crews.md, business-documents-and-ai.md and lessons-payments-items-research.md.

---

## Questions for the advocate

**A. The PDPA, the PDPC and who the controller is**

1. Please confirm the correct citation of the Personal Data Protection Act, 2022 (Act No. 11 of 2022? "Cap. 44"?), its commencement date, and the names and GN numbers of the 2023 regulations.
2. Must Kwetuly register with the PDPC as a data controller before collecting guide documents? Is the reported final deadline of 30 April 2025 relevant to a new controller, or does registration simply have to come before processing starts? What does registration cost, and how long does it take?
3. The company is not yet registered, but uploads already happen on the live site. Is Walter personally the controller today? Should Kwetuly stop collecting document images until the company exists and is registered with the PDPC? What should happen to the images already held?
4. Is Supabase a "data processor" that must itself register with the PDPC, or is it enough that Kwetuly registers and has Supabase's data processing agreement?

**B. Storing ID, licence, first aid, WFR and driving licence images**

5. Is it lawful to store images of these documents at all? Is "necessary to check the guide's listing" (contract or legitimate interests) a sufficient lawful basis, or is consent required?
6. Is a photo of an ID card or driving licence, or the NIDA number on it, "sensitive personal data" (for example biometric data) under the PDPA? If so, what form must "prior written consent" take online? Is a tick box enough?
7. Is the draft notice and consent wording in section 2.4 enough? What must be added: the controller's details, rights, a complaint to the PDPC, the transfer abroad?
8. If consent is the basis, is it "freely given" when the profile stays hidden without the documents? Does that push the basis towards contract instead?
9. Is an ID check proportionate, given that the guide licence and identity card already carry the guide's name and photo? (See also group H.)
10. Is Option B in section 2.3 (delete the image [30] days after the check and keep only the type, the dates and a masked number) acceptable? Is it enough evidence if a check is later disputed by a traveller, a guide or an authority? Or should Kwetuly keep the images (Option A)? For how long?
11. What retention period N should apply to check records after a guide leaves? It depends on the limitation period for claims a traveller might bring. Please also confirm the proposals in section 6, including how backups are handled.
12. Who may see the images? Is "named admins, with access logged" enough? Must Kwetuly have written confidentiality terms with each admin?
13. How must the privacy-policy.md retention line for documents ("while active, then 12 months") be reconciled with Option B?

**C. Cross-border storage**

14. Supabase stores the images outside Tanzania (the region is to be confirmed). Does this need a PDPC permit under s. 31 or s. 32 and regulation 20? Can one application cover all of Kwetuly's providers and purposes (hosting, email, AI, analytics)?
15. Is consent of the guide needed for the transfer in addition to the permit, given that the sources conflict? Can Supabase's standard data processing agreement serve as the required contract with the recipient?
16. Would the answer change if Kwetuly chose a particular region (for example an EU region), or if it kept the images in Tanzania and only the check records abroad?
17. Until a permit is granted, may Kwetuly lawfully keep the images abroad, or must uploads stop?

**D. Driving licence for guide-drivers**

18. Which Tanzanian driving licence class must a guide hold to drive tourists for reward, in a saloon car, an SUV or safari Land Cruiser, and a minibus? Under which instrument (Road Traffic Act, Cap. 168, and which regulations)? Is it different when the guide drives a tour operator's vehicle as part of a tour, rather than doing a paid transfer?
19. Must a guide-driver also hold a LATRA driver registration card (GN 81 of 2020, reg. 20)? Are the 2025 LATRA tour-driver certification and the "Tour Services" marking gazetted and in force (GN number)? Did the July 2026 LATRA amendments change them?
20. Are there TALA or MNRT rules on who may drive tourists: for example, must a safari driver-guide be registered as a tour guide, or employed by a licensed operator? Do TANAPA or NCAA have their own driver-guide rules for park entry?
21. May Kwetuly lawfully record and display the class of a guide's driving licence? Would doing so ("Class C seen") imply that Kwetuly confirms the guide may legally carry guests? Is "Driving licence seen {date}, valid until {date}" safer?
22. May guides show "I drive guests" on their profile at all while Kwetuly's transfer packages are off? Should it read "drives guests for [operator name]" when the vehicle is a company car?
23. Is a foreign driving licence or international driving permit ever enough for a guide-driver? (Guides must be citizens, but some may hold licences from abroad.)

**E. Wording and liability of the badge**

24. Is "Licence and first aid checked" lawful and not misleading under ss. 15-16 of the Fair Competition Act, 2003, when it means an admin looked at an uploaded document and did not confirm it with the register? Would "Licence and first aid seen" or "Licence and first aid documents seen" be safer?
25. Does "checked" or "seen" create a duty of care towards travellers who rely on it? If a document Kwetuly ticked turns out to be forged, expired or withdrawn, could Kwetuly be liable in negligence or under the Fair Competition Act? What steps (training, a checklist, hiding the profile on the expiry date, a "report a problem" link) reduce that risk?
26. Can the traveller terms validly limit Kwetuly's liability for the checks, for example: "A check means a Kwetuly team member looked at the document on that date. It is not a guarantee of the guide's skills or of your safety"? Would that be an unfair term under the Standard Form (Consumer Contracts) Regulations, 2014?
27. Is "Kwetuly looks at their guide licence and a first aid or WFR certificate (and the driving licence of guides who drive) before a guide's profile goes live", for agencies on the partners page, acceptable? Do agencies count as consumers for this purpose?
28. Is first aid a legal condition of tour guide registration under GN 270 of 2015, as reported? If it is, may Kwetuly say so to travellers, and must the first aid certificate stay valid for the whole registration period?
29. Is the WFR (Wilderness First Responder) certificate a lawful substitute for "first aid" in any Tanzanian rule, or only Kwetuly's own policy? How should Kwetuly word the line so it does not suggest a legal equivalence?
30. Do consumer laws in travellers' home markets (for example the EU, UK, China, Poland) affect this wording, given that the site targets them in their languages? Is that a question for a foreign lawyer?

**F. Confirming a licence at the source**

31. Does the Director of Tourism (MNRT) keep the register of tour guides under GN 270 of 2015, as reported? Is that register open to the public or to inspection? Is there an online lookup? Does the Tanzania Tourist Board (TTB) have any role? Which Act is the parent Act (Tourism Act No. 29 of 2008?), and under which section?
32. What is the lawful route for a private platform to confirm that a guide is registered: a written request per guide, an agreement with MNRT, an official status letter the guide obtains, or none? What would the guide need to consent to?
33. Would confirmation by the body a guide is enlisted with (TTGA, KGA or a licensed operator) count for anything? How should Kwetuly word it ("membership confirmed by KGA") without suggesting a register check?
34. If Kwetuly could confirm at the source, may it then say "registration confirmed with MNRT on {date}"? How often must it re-confirm for the statement to stay true?
35. Is a guide's registration certificate or identity card dated, with an expiry? How long is registration valid, and is renewal yearly? Kwetuly needs this to set "valid until" correctly.

**G. Existing guides and the change of rule**

36. Kwetuly will pause approved guides who lack the new checks (Walter is deciding). Is pausing a guide's profile under the current draft guide terms lawful? Must the terms be updated and accepted first, and what notice is fair?
37. Is changing guide-terms.md clause 2.4 (so that a new upload no longer clears the current check) a material change that needs notice to guides?

**H. NIDA and TIN (section 8)**

38. Please confirm the citation of the Registration and Identification of Persons Act (Cap. 36? Act No. 11 of 1986?) and its regulations. Does that Act, its regulations or any NIDA rule allow, limit or ban a private platform collecting NIDA numbers, or copying and storing images of NIDA cards?
39. Is the NIN, or an image of the NIDA card (photo, signature, date of birth), "sensitive personal data" under the PDPA 2022 (for example as biometric data)? If so, what prior written consent is needed online?
40. Is it proportionate under the PDPA to collect a NIN or NIDA card image from a guide, when the guide licence and identity card already show the name and photo? Which is the least intrusive lawful option: (a) see the card and keep the last 4 digits and the date; (b) keep the full NIN with no image; or (c) use NIDA's own verification service?
41. May a small private platform use NIDA's verification service, and on what terms (agreement, fees, PDPC registration first)? If Kwetuly used it, could the badge say "NIDA number confirmed with NIDA on {date}"?
42. Are there special rules for holding national ID numbers abroad (Supabase, outside Tanzania), beyond the general cross-border permit in group C?
43. May Kwetuly ask guides for their TIN now, before it pays them anything? Is "to check that the guide runs a registered business" a lawful and proportionate purpose, given that many individual guides may not have a TIN?
44. When Kwetuly starts passing deposits to guides, must it collect their TIN? Must it withhold tax on the payouts (Income Tax Act s. 83 service fees, s. 83B, or any other provision), or report them to TRA? At what rate, and does it matter whether Kwetuly is the guide's payment agent or the seller of the service? What is the penalty for paying a person with no TIN?
45. How long must Kwetuly keep TINs and payout records: 5 years from the end of the year of income (Tax Administration Act, Cap. 438)? From when exactly? And how long should a NIN or its last 4 digits be kept after the guide leaves?
46. Is the draft notice text in section 8.4 enough, and should it rely on consent, contract or a legal obligation?
47. Must businesses also give their TIN at listing (as business-documents-and-ai.md proposes), or only before Kwetuly pays them commission shares or deposits? Does the answer differ for businesses that pay Kwetuly (badge fees, commission) and never receive money from it?
