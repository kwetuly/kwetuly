# Rafrika legal drafts: pack for the Tanzanian advocate

> **DRAFT - not reviewed by an advocate.** Nothing in this folder is published, linked from the website or app, or sent to anyone. Not legal advice. Prepared 2026-10-16 by the Rafrika legal research helper (AI) for Walter and the advocate.

## Documents

| File | What | Status |
| --- | --- | --- |
| privacy-policy.md | Privacy policy under the Personal Data Protection Act, 2022 | Draft 0.1 |
| traveller-terms.md | Terms for travellers | Draft 0.1 |
| guide-terms.md | Terms for guides (English and Kiswahili needed) | Draft 0.1 |
| business-listing-terms.md | Listing terms, "Checked by Rafrika" badge, referral commission agreement template | Draft 0.1 |
| deposit-and-refund-policy.md | Deposits and refunds (deposits are OFF at soft launch) | Draft 0.1 |
| group-chat-media-consent.md | Group-chat photos and videos, and public sharing | Draft 0.1 |

No earlier legal drafts existed under docs/ (checked 2026-10-16). The drafts were written against the database migrations in supabase/migrations and the site texts in packages/shared/src/dictionaries.

## Laws and bodies that may apply (to be confirmed by the advocate)

Section numbers are only given where a source reported them, and none have been checked against the official gazetted text.

| Area | Law / body | Why it matters for Rafrika | Sources found |
| --- | --- | --- | --- |
| Personal data | Personal Data Protection Act, 2022 (Act No. 11 of 2022); Personal Data Protection Commission (PDPC); 2023 regulations (names and GN numbers differ between sources) | Registration as data controller; lawful bases; rights; cross-border transfers (reported as ss. 31-32) | [Clyde & Co, cross-border transfers](https://www.clydeco.com/en/insights/2024/10/cross-border-personal-data-transfers); [FB Attorneys, registration deadline](https://fbattorneys.co.tz/registration-for-companies-under-data-protection-law-extended/); [Afriwise, 2023 regulations](https://www.afriwise.com/blog/tanzania-regulations-made-under-the-personal-data-protection-act-2022-23-june-2023); official text to be obtained from the PDPC or TanzLII |
| Tourism licensing | Tourism Act, 2008; Ministry of Natural Resources and Tourism (TALA licensing) | Whether Rafrika is a tour operator / travel agent because of bookings, deposits, Signature trips, commissions; guide licensing | [Tourist Agents (Licensing) Regulations 1998, TanzLII](https://tanzlii.org/en/akn/tz/act/gn/1998/213/eng@2002-07-31); [Tourism (Fees and Charges) Regulations 2015, TanzLII](https://tanzlii.org/en/akn/tz/act/gn/2015/267); Act text via [FAOLEX](https://faolex.fao.org/docs/pdf/tan85329.pdf) |
| Payments | National Payment Systems Act, 2015; Payment Systems (Licensing and Approval) Regulations, 2015; Payment Systems (Electronic Money) Regulations, 2015 (GN 447 of 2015); Bank of Tanzania | Collecting and holding deposits and paying guides out; no stored credit or wallet without approval | [BoT: National Payment Systems Act](https://www.bot.go.tz/Publications/Acts,%20Regulations,%20Circulars,%20Guidelines/Acts/en/2020030902433783.pdf); [Electronic Money Regulations, TanzLII](https://tanzlii.org/en/akn/tz/act/gn/2015/447/eng@2015-10-16) |
| Consumer protection | Fair Competition Act, 2003 (Cap. 285); Standard Form (Consumer Contracts) Regulations, 2014; Fair Competition Commission | Misleading conduct (badges, "verified" claims); unfair terms; possible registration of traveller terms with the FCC | [Fair Competition Act 2003, TanzLII](https://tanzlii.org/akn/tz/act/2003/8/eng@2003-12-31/source.pdf); [Clyde & Co, SFCC registration](https://www.clydeco.com/en/insights/2025/10/tanzania-s-requirement-to-register-standard-form-c) |
| Insurance | Insurance Act; TIRA; NIC (mainland) and ZIC (Zanzibar) portals | Rafrika must not sell insurance without agency approval; link only to official portals | Official URLs to be confirmed |
| Online content | Electronic and Postal Communications (Online Content) Regulations, 2020, amended 2022 (GN 136 of 2022) and reportedly 2025; TCRA | Traveller moments, travel news, guides' forum: is a licence needed? | [Bowmans, 2020 regulations](https://www.bowmanslaw.com/insights/technology-media-and-telecommunications/tanzanian-electronic-and-postal-communications-online-content-regulations-2020-published/); [Afriwise, 2022 amendments](https://www.afriwise.com/blog/tanzania-amendments-to-the-regulations-under-the-electronic-and-postal-communications-act) |
| E-contracts | Electronic Transactions Act, 2015 | Click-to-accept terms, electronic records | Official text to be obtained |
| Investment | TISEZA; Capital Markets and Securities Authority (to be confirmed) | The invest page makes introductions | Not researched yet |
| Tax | TRA (VAT, withholding, EFD receipts) | Badge fees, commissions, merchandise, deposits | For accounting and the advocate |

## Texts on the site and app that promise more than Rafrika can show (for Walter, frontend-engineer and localization)

| Where (packages/shared/src/dictionaries/en.ts unless stated) | Current text | Problem | Suggested fix |
| --- | --- | --- | --- |
| Home, "Checked by Rafrika" tile (line ~314) and partners page (line ~464) | "We check every guide's tourism registration before they appear" / "Every guide is checked against their tourism registration before they appear" | Approval does not require `licence_checked_at`; sample guides exist | Make approval require the licence check, or say "Each profile shows which checks Rafrika has done" |
| Requests and offers (line ~714) | "Only verified guides and registered tour companies can see trip requests" | Any account with role "provider" can see requests; registration is not checked | "Only approved guides and business accounts..." or add a company registration check |
| Operators subtitle (line ~123) | "The Verified badge means Rafrika has checked their licence and details" | Only true if a licence check is recorded per operator | Show what was checked and when, as for guides |
| For guides (line ~307) | "builds your own name, for life" | Cannot be promised | "builds your own name on Rafrika" |
| Requests (line ~687) | "Guides usually reply within a day" | No data yet | Remove until measured |
| Guide dashboard (line ~233) | "Held by Rafrika" | Holding funds may need Bank of Tanzania approval | Change once the deposit structure is decided |
| Moments subtitle (line ~605) | "with their permission" | Only the sharer actively agrees | See group-chat-media-consent.md section 8 |
| apps/web/src/lib/analytics.ts comment | "no consent banner is needed" | Not confirmed under Tanzanian law | Advocate question |
| Home stats (line ~291) | "verified guides" count | Must not count sample guides | Confirm the count excludes `is_sample` |

## Before any of this goes live

1. Advocate reviews all six drafts and answers the open questions at the end of each.
2. Walter fills the placeholders with real company details (no guesses).
3. localization prepares Kiswahili (and, for traveller texts, all 7 languages) from the reviewed English.
4. Walter approves publication. Only then may frontend-engineer add the pages and footer links.
