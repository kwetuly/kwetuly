# Advocate questions: the deposit refund rule (2026-11)

> **DRAFT – to be reviewed by a Tanzanian advocate.** Not legal advice. Prepared 2026-11-07 by the Kwetuly legal research helper (an AI, not a lawyer) for Walter and the advocate.
> Not sent to anyone. Nobody has been contacted. Only Walter decides whether and when this goes to an advocate.
> Kwetuly is **not yet registered as a company**. Deposits are **off**. Everything below assumes a future Tanzanian (mainland) company.

**Labels used** (same as `lessons-payments-items-research.md`):
- **[Official]**: a government, regulator or court text, or an official copy of it.
- **[Secondary]**: law firm, news or commentary. To be checked against the gazetted text.
- **[Unverified]**: reported but not confirmed, or my own reading.

No section numbers are given unless a source gave them, and none have been checked against the gazetted text. No case names are used.

---

## Background the advocate needs (applies to every question)

**The rule Walter chose on 2026-11-07 (option A, "who causes it pays").** Source: `docs/business/deposit-refund-rule-2026-11.md`; draft clauses: `docs/legal/deposit-and-refund-policy.md` v0.2, guide terms 7.3, 7.6, 7.7, business listing terms Part D.

| Case | Traveller gets back | Organiser keeps | Kwetuly keeps |
| --- | --- | --- | --- |
| Traveller cancels 30+ days before start | 90% | 0% | 10% (at most TSh [CAP]) |
| Traveller cancels 8 to 29 days before | 40% | 50% | 10% (at most TSh [CAP]) |
| Traveller cancels 7 days or less, after the start, or no-show | 0% | 100% | 0% |
| Organiser or guide cancels, changes the trip, or trip taken down because of them | 100% | 0% | 0% (Kwetuly may recover its actual fees, up to 10%, from the organiser's next payout; not for force majeure) |
| Minimum group not reached | 100% | 0% | 0% (no recovery) |
| Kwetuly cancels (safety, fraud, suspension) | 100%, to the original method only | 0% | 0% |
| Payment held for review, or arrived after the trip closed | 100% (unless both sides confirm in writing) | 0% | 0% |

Other facts:
- These are the default tiers when the organiser shows no terms. An organiser's own terms replace the organiser's share; Kwetuly's 10% stays the same and is only taken out of money that would otherwise be refunded.
- The 10% is described internally as **cost recovery, not revenue**. It is a working number until Selcom sends a written fee quote. A TSh cap will be set then. No Selcom fees are published (collection, refund, payout, chargeback: all unknown).
- Deposits close 8 days before the start date (Tanzania date), so no deposit is taken inside the 0% window.
- Card and mobile money both at launch, through Selcom. Same percentages for both. No traveller fee on a completed deposit (Kwetuly absorbs the collection fee; Walter to confirm).
- All amounts are charged and refunded in TSh. Trips are often priced in USD and converted at a stored rate, rounded up to the next TSh 100.
- Selcom documents no refund endpoint, so refunds are manual. Walter approves every refund and every payout.
- The traveller sees the rule in a "Before you pay" box and ticks "I have read how refunds work". The rule version is stored with the payment.
- The payment structure is **not decided** (A: Kwetuly collects as the organiser's agent; B: the provider splits and settles directly; C: deposits stay off). The code today works as A: money reaches Kwetuly's Selcom merchant account and Kwetuly pays out by hand.

---

## Q1. Are the tiers and Kwetuly's 10% fair and enforceable?

**Question.** Under the Fair Competition Act, 2003 (Cap. 285) and the Fair Competition (Standard Form Consumer Contracts) Regulations, 2014, is it fair and enforceable for (a) the organiser to keep 50% (8 to 29 days) or 100% (7 days or less, no-show) of a deposit, and (b) Kwetuly to keep 10%, capped in TSh, when the traveller cancels? Do we need a cap, a cooling-off period, or a different structure? Must the Deposit and Refund Policy (as part of the traveller terms) be registered with the Fair Competition Commission as a standard form consumer contract?

**Why it matters.** If a term is found unfair or a penalty, Kwetuly may have to refund the 10%, face FCC action, and lose its defence in card chargebacks. A secondary source says standard form consumer contracts must be registered with the FCC; if so, the policy cannot go live unregistered.

**Facts the advocate needs.** The table above; the "Before you pay" box text (business page section 4); that 10% is meant to cover payment and refund costs whose real size is unknown until Selcom's quote; that Kilimanjaro and park costs are often prepaid and non-refundable for the organiser; that many travellers are foreign consumers paying from abroad.

**Options.**
- (a) Keep 10% with a TSh cap and full disclosure before payment (Walter's choice).
- (b) "Actual cost only, at most 10%", shown on the refund receipt (option B on the business page). Easier to defend, but the traveller cannot see the exact figure before paying.
- (c) Add a short cooling-off window after payment (for example [X] hours) with 100% back, if the advocate thinks it is needed.
- (d) Whether the Law of Contract Act (Cap. 345) rules on penalties and agreed damages affect the organiser's 50% and 100% shares. [Unverified: I have not read the relevant provisions.]

**Sources.**
- Fair Competition Act, 2003: [TanzLII](https://tanzlii.org/akn/tz/act/2003/8/eng@2003-12-31/source.pdf) [Official copy].
- Standard form consumer contract registration: [Clyde & Co, October 2025](https://www.clydeco.com/en/insights/2025/10/tanzania-s-requirement-to-register-standard-form-c) [Secondary].
- Fair Competition Commission: https://www.fcc.go.tz [Official site; specific guidance on cancellation charges not found] [Unverified].

---

## Q2. Could Kwetuly's 10% count as a card surcharge?

**Question.** The Bank of Tanzania issued a public notice on 23 December 2024 that is reported to prohibit merchants from adding fees or surcharges to card payments. Does the notice (or any BoT rule behind it) apply to online card payments, not only POS terminals? Could a 10% cancellation charge, the same for card and mobile money and taken only on a traveller cancellation, be treated as a card surcharge? Does it matter that most card payers are non-residents?

**Why it matters.** If the charge counts as a surcharge, Kwetuly could not keep it on card payments. Charging only mobile-money payers would then be unequal treatment, and the whole 10% design would need to change.

**Facts the advocate needs.** Same percentage for every payment method; no fee on a completed deposit; the charge is taken only out of a refund the traveller asked for; card payments go through Selcom's hosted checkout (Kwetuly never sees card numbers); Flutterwave (the backup provider) charges the customer by default, which would be switched to "merchant bears" before any live payment.

**Options.**
- (a) Keep the charge, same for all methods (the proposed answer is that it is not a surcharge, but this is my reading only) [Unverified].
- (b) If the advocate sees a risk: apply option B (actual cost only), or absorb all costs on card refunds and accept the loss.

**Sources.**
- BoT notice to the public, 23 December 2024: [bot.go.tz PDF](https://www.bot.go.tz/Adverts/PressRelease/en/2024122312504378.pdf) [Official. I could not read the text of the PDF; its content here comes from news reports].
- [The Citizen, "Bank of Tanzania reaffirms zero charges on digital card payments"](https://thecitizen.co.tz/tanzania/news/national/bank-of-tanzania-reaffirms-zero-charges-on-digital-card-payments-4867166) [Secondary: reports that merchants are prohibited from adding fees or surcharges on card transactions at POS terminals].
- [The Guardian (IPP Media), "Paying by card has no surcharges - BoT"](https://ippmedia.com/the-guardian/news/local-news/read/paying-by-card-has-no-surcharges-bot-2024-12-24-092858) [Secondary].
- [LaunchBase Africa, 27 December 2024](https://launchbaseafrica.com/2024/12/27/with-card-charges-gone-in-tanzania-will-fintech-players-rethink-their-revenue-strategies/) [Secondary; already cited in `docs/business/payments-research-2026-10-30.md`].

---

## Q3. VAT and receipts on what Kwetuly keeps

**Question.** When Kwetuly keeps 10% of a cancelled deposit, is that Kwetuly's taxable supply (VAT, once Kwetuly is registered) and must Kwetuly issue an EFD/VFD receipt for it? What receipt does the traveller get for a partial refund? Who issues a receipt for the organiser's 50% or 100% share: the organiser, or Kwetuly as their agent? Is any of it an exported service when the traveller is abroad? Does the deposit itself need a receipt from Kwetuly when it is paid, or only from the organiser?

**Why it matters.** Wrong receipts or missed VAT are TRA penalties, and the answer also depends on whether Kwetuly is the organiser's agent (structure A) or merchant of record.

**Facts the advocate needs.** Kwetuly not yet registered for VAT or with TRA [Walter to confirm]; three amounts are stored for each refund (traveller, organiser, Kwetuly); the refund email will show all three; payments structure not decided.

**Options.** (a) Kwetuly issues a fiscal receipt for its 10% only, and the organiser issues receipts for the trip price and their kept share; (b) Kwetuly issues one receipt as agent; (c) the advocate's or accountant's alternative. This also needs `accounting`.

**Sources.**
- Value Added Tax Act, 2014 and the requirement for fiscal receipts: [Bowmans, TRA public notice on EFDs](https://www.bowmanslaw.com/insights/tax/tanzania-tra-public-notice-on-electronic-fiscal-devices-with-protocol-2-1-software/) [Secondary].
- TRA resource centre (VAT (General) Regulations, 2015 and other regulations): https://tra.go.tz/resource-center/12 [Official]. I could not find the EFD regulations on TRA's site; sources disagree on which regulations are current [Unverified].

---

## Q4. Deducting Kwetuly's fees and refunded amounts from organisers' payouts

**Question.** When an organiser cancels (or Kwetuly cancels because of the organiser's fraud or serious breach), can Kwetuly (a) recover a deposit it already passed on, and (b) deduct its actual payment and refund fees, up to 10% of the deposit, from the organiser's next payout? Is this set-off enforceable and fair for individual guides and small businesses? Does the answer change under structure A, B or C? What if there is no later payout (invoice, or write off)? Could the deduction affect how guides are classified (employment risk, guide terms drafting note 1)?

**Why it matters.** It is the only way Kwetuly can recover costs from organisers who cancel late. Without a valid clause the deduction could be challenged, and under structure B Kwetuly may not hold any money to deduct from.

**Facts the advocate needs.** Guide terms 7.6 and 7.7, business listing terms D5 and D6 (v0.2); Kwetuly shows the amount and calculation before deducting, and Walter approves every deduction; no recovery for force majeure or a minimum not reached; payouts are manual today.

**Options.** (a) Set-off against the next payout (draft); (b) invoice only, no set-off; (c) only recover under structure A and absorb under B.

**Sources.** No specific Tanzanian source found on marketplace set-off. Earlier question 25 in `lessons-payments-items-research.md` asks the same for chargebacks. [Unverified]

---

## Q5. Exchange-rate note for foreign cards

**Question.** Refunds are made in TSh to the original card. A foreign card holder's bank converts at its own rate, so they may get back a different amount in their currency. What must Kwetuly say before payment and on the refund to meet consumer-protection and BoT rules? Does the Foreign Currency Usage Regulations, 2025 (GN 198 of 2025) allow showing a USD price as the trip price for travellers from abroad, or only as a labelled estimate? Is the "about US$ [amount]" in the "Before you pay" box acceptable?

**Why it matters.** Showing foreign-currency prices for domestic services may be an offence under GN 198; an unclear refund amount invites complaints and chargebacks.

**Facts the advocate needs.** Prices are often set in USD by organisers; Kwetuly converts at a stored rate (source and update rule still open) and charges TSh; refund policy 2.2 and 5.3 (v0.2) wording.

**Options.** (a) TSh price only, with "about US$" as a labelled estimate (current draft); (b) organisers price in TSh only; (c) whatever the advocate says the regulations' exceptions allow for cross-border tourism.

**Sources.**
- Foreign Currency Usage Regulations, 2025 (GN 198 of 2025): [FB Attorneys](https://fbattorneys.co.tz/foreign-exchange-regulations-issued/) [Secondary]; [Afriwise](https://www.afriwise.com/blog/finance-law-update-foreign-currency-ban-what-tanzanian-businesses-need-to-know) [Secondary]; tourism clarification reported by [TATO](https://tatotz.org/foreign-currency-usage-regulations-in-tourism-sector/) [Secondary]. The gazetted text has not been read [Unverified].

---

## Q6. What to do when the payer committed fraud

**Question.** If a deposit was paid with a stolen card or someone else's mobile-money account, may Kwetuly refund it, must it hold it, and must it report it, and to whom (Selcom, the card issuer, the police, the Financial Intelligence Unit)? Is Kwetuly a "reporting person" under the Anti-Money Laundering Act (Cap. 423), or is that only Selcom's duty? Is there a rule against telling the payer about a report ("tipping off")?

**Why it matters.** Refunding to the wrong person helps the fraudster; holding money without a legal basis could harm an innocent traveller; failing to report, if Kwetuly must, is an offence.

**Facts the advocate needs.** Draft policy 4.8 and 8 (v0.2): refunds only to the original card or wallet, never to another account; hold "if the law requires". Kwetuly does not see card numbers. Payments can already land in "review" (amount or currency mismatch).

**Options.** (a) Refund only to the original method (draft) and tell Selcom; (b) hold and report as the advocate directs; (c) agree a fraud procedure with Selcom in the merchant contract.

**Sources.**
- Anti-Money Laundering Act, Cap. 423 R.E. 2019: [FIU copy](https://www.fiu.go.tz/uploads/documents/en-1754379316-The%20Anti-money%20Laundering%20Act.pdf) [Official]; [Ministry of Finance copy](https://www.mof.go.tz/uploads/documents/en-1676544717-THE%20ANTI-MONEY%20LAUNDERING%20ACT,%20CAP%20423%20R.E.%202019.pdf) [Official]. Search summaries report section 17 as the duty of reporting persons to report suspicious transactions; I have not read the text or the list of reporting persons [Unverified].
- Anti-Money Laundering Regulations, 2007: [FIU copy](https://www.fiu.go.tz/uploads/documents/en-1748525321-AMLR%202007.pdf) [Official, not read].

---

## Q7. Does holding deposits, and keeping a share, need Bank of Tanzania approval?

**Question.** Under the National Payment Systems Act, 2015 (Cap. 437) and its regulations, can Kwetuly receive deposits into its Selcom merchant account, keep its 10% on cancellation, refund the traveller and pay the organiser's share, without a BoT licence or approval? Which of structures A, B and C is safest? Must deposits be kept in a separate or trust account? (Same as v0.1 policy question 1 and 3; repeated because the split refund adds a new flow of money.)

**Why it matters.** The split refund means Kwetuly decides how one payment is divided between three parties, which looks more like operating a payment service than a single payout does.

**Facts the advocate needs.** The flows in the table above; manual payouts; no stored balance, wallet or credit (and none planned without BoT approval); the guide dashboard text "Held by Kwetuly" is on hold.

**Options.** A, B or C, as in the refund policy's drafting note.

**Sources.**
- National Payment Systems Act, 2015: [BoT copy](https://www.bot.go.tz/Publications/Acts,%20Regulations,%20Circulars,%20Guidelines/Acts/en/2020030902433783.pdf) [Official]; [Act Supplement No. 4 of 2015](https://commons.laws.africa/akn/tz/act/2015/4/media/publication/tz-act-2015-4-publication-document.pdf) [Official copy].
- Payment Systems (Electronic Money) Regulations, 2015 (GN 447): [TanzLII](https://tanzlii.org/akn/tz/act/gn/2015/447/eng@2015-10-16) [Official].
- Which Licensing and Approval Regulations are in force (2015, 2021 or 2022) is unclear [Unverified]; see `lessons-payments-items-research.md` section 2.1.

---

## Q8. Card chargebacks

**Question.** Is draft policy 5.5 ("please contact us first; while a dispute is open, the deposit is not passed on") lawful and fair, and does it avoid discouraging a traveller's rights with their card issuer? If a chargeback succeeds after Kwetuly already paid the organiser, can Kwetuly recover from the organiser (link to Q4)? How long must Kwetuly keep evidence (the "Before you pay" acknowledgement, rule version, messages) to defend disputes, and is that consistent with the retention periods in the privacy policy?

**Why it matters.** A lost chargeback costs the full deposit plus a fee (unknown) and staff time. The stored acknowledgement is Kwetuly's main evidence when a traveller cancelled under the disclosed rule.

**Facts the advocate needs.** Chargeback rules and fees for Selcom are unknown and must come from the merchant contract; a "disputed" payment state that blocks payouts is planned (business page section 5, item 8).

**Options.** (a) Keep 5.5 as drafted; (b) remove the "contact us first" line and keep only the payout hold; (c) add the chargeback recovery to Q4's set-off clause.

**Sources.** Card scheme rules are private contracts, not Tanzanian law; no official Tanzanian source found [Unverified].

---

## Q9. Data protection for billing and refund data

**Question.** Under the Personal Data Protection Act, 2022, what may Kwetuly store about payers and refunds (name, email, phone, mobile-money number, Selcom reference, card type or last four digits if Selcom returns them, the refund split and reason), on what lawful basis, and for how long? Is sending payment data to Selcom and, through card schemes, abroad a cross-border transfer that needs extra safeguards? Must the privacy policy name Selcom and list these items? Does the refund reason (for example "fraud suspected") need special handling?

**Why it matters.** Payment data is needed for tax, refunds and disputes, but keeping more than needed, or for too long, breaks the Act. Card data rules (PCI DSS) are an industry standard set by card schemes, not Tanzanian law; Kwetuly stays out of scope only if it never handles card numbers.

**Facts the advocate needs.** Kwetuly never sees card numbers or PINs (Selcom hosted checkout); payment records are kept with the person removed when an account is deleted (README open question on retention); Kwetuly is not yet registered with the PDPC.

**Options.** (a) Store only references and amounts, no card details at all; (b) store last four digits for support; retention period to be set by the advocate.

**Sources.**
- Personal Data Protection Act, 2022 (Act No. 11 of 2022) and the PDPC: official text to be obtained from the PDPC or TanzLII [Unverified]. Secondary: [Clyde & Co, cross-border transfers](https://www.clydeco.com/en/insights/2024/10/cross-border-personal-data-transfers) [Secondary, reports ss. 31-32].

---

## Q10. Electronic acceptance of the refund rule

**Question.** Is a tick box ("I have read how refunds work") plus the stored rule version enough, under the Electronic Transactions Act, 2015, to show the traveller agreed to the refund rule before paying? Does it need to be "I agree" rather than "I have read"?

**Why it matters.** It is the evidence for Q1 and Q8.

**Facts the advocate needs.** Box text in business page section 4; the acknowledgement and rule version are stored on the payment row (planned).

**Options.** (a) Keep "I have read how refunds work"; (b) change to "I agree to the refund rules"; (c) also email the rules with the receipt.

**Sources.** Electronic Transactions Act, 2015: official text not yet obtained [Unverified].

---

## Q11. Does keeping a share of cancelled deposits affect Kwetuly's tourism licensing position?

**Question.** Under the Tourism Act, 2008, does collecting deposits, keeping a cancellation charge and dividing refunds make Kwetuly look more like a travel agent or tour operator that needs a TALA licence? (Links to v0.1 policy question 2 and `travel-agent-and-transfers.md`.)

**Why it matters.** A licence may have conditions (for example on ownership) that Kwetuly cannot meet quickly.

**Facts the advocate needs.** Kwetuly does not sell trips itself under this rule; the organiser sets price and terms; Kwetuly keeps only its own charge.

**Options.** As advised in `travel-agent-and-transfers.md`.

**Sources.** Tourism Act, 2008 via [FAOLEX](https://faolex.fao.org/docs/pdf/tan85329.pdf) [Official copy hosted by FAO]; [Tourist Agents (Licensing) Regulations, TanzLII](https://tanzlii.org/en/akn/tz/act/gn/1998/213/eng@2002-07-31) [Official].

---

## Q12. Travellers from other countries

**Question.** The policy says Tanzanian law applies. Can that choice hold against consumer-protection rules in a traveller's home country (for example the EU, UK or US) when they booked online from there? Does that change what is fair in Q1?

**Why it matters.** Many card payers will be foreign consumers; their banks and home rules decide chargebacks.

**Facts the advocate needs.** The 7 site languages and main source markets (`rafrika-site-languages` memory note; arrival data); traveller terms section on governing law.

**Options.** (a) Keep Tanzanian law with plain-language rules; (b) add a note that travellers keep mandatory rights in their home country.

**Sources.** None found; my own question [Unverified].

---

## Questions to ask the advocate (short list)

1. Are the default tiers and Kwetuly's 10% (with a TSh cap) fair and enforceable, and must the policy be registered with the FCC?
2. Could the 10% count as a card surcharge under the BoT notice of 23 December 2024, online and for non-residents?
3. VAT and receipts on Kwetuly's 10%, the organiser's kept share, and partial refunds.
4. Can Kwetuly deduct refunded amounts and its actual fees (up to 10%) from organisers' next payouts, and under which structure?
5. What exchange-rate wording is needed for foreign cards, and is "about US$" allowed under GN 198 of 2025?
6. Payer fraud: refund, hold or report, and is Kwetuly a reporting person under Cap. 423?
7. Does the split refund flow need BoT approval, and which structure (A, B, C) is safest?
8. Chargebacks: is the payout hold and "contact us first" wording fair, and how long to keep evidence?
9. Data protection for billing and refund data, including Selcom and cross-border transfers.
10. Is a tick box with a stored rule version valid acceptance under the Electronic Transactions Act, 2015?
11. Does the refund flow affect Kwetuly's position under the Tourism Act, 2008?
12. Do foreign travellers keep home-country consumer rights despite Tanzanian law applying?
