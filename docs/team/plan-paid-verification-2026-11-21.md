# Plan: free sign-up, paid verification, features by account type, prices set by Walter (2026-11-21)

Kept by `chief-of-staff`. Built on Walter's answers of 2026-11-21 (end of `docs/team/decisions-2026-11-21.md`). Paper only: no migration is written or applied, nothing is charged, nobody is contacted. **No price appears in this file.** Walter fills every amount in the admin dashboard himself.

Goal in one line: anyone registers free; porters, cooks, drivers, guides and businesses pay monthly or yearly to be verified; verification (documents checked plus an active subscription) unlocks the features of their account type; each account type sees only its own screens; Walter sets every price in admin.

Read for this plan:
- Migrations: `20261012000000_initial_schema.sql` (`profiles.role` enum `traveler, provider, investor, admin`; `providers.verification_status`, `listing_fee_paid_until`), `20261012000300` (adds `guide`), `20261012000200_guides.sql` (`guides.verification_status`, `plan msingi/pro`, `plan_expires_at`, `guide_private` paths in the private `verification` bucket), `20261014000600_guide_checks.sql` (check columns, admin-only), `20261016000200_business_listings.sql` (badge columns, `site_settings` with `badge_fee` null), `20261014000200_payments.sql` (`payments`, kinds `offer_deposit`, `group_deposit`, written only by Edge Functions), `20261013000400_onboarding_phone.sql` (`complete_onboarding` accepts `traveler, guide, provider` once), `20261016001400` (`private.is_admin()` needs a two-step session), `20261016001700` (`private.is_onboarded()`), `20261013000200_guide_reviews.sql` (`can_review_guide`: no time window today).
- `docs/team/design-guide-checks-2026-11.md` (GC), `docs/team/plan-guide-checks-2026-11.md`, `docs/team/design-crew-and-trip-management-2026-11.md` (TM), `docs/guides/crew-teams-design-2026-11.md` (GS).

Facts that shape the plan:
1. One account has one `profiles.role`, set once at onboarding. There is no crew type. TM 2.1 proposes adding `crew` with sub-roles in `crew_members.roles` (`porter`, `cook`, `driver`, `assistant_guide`, `other`, from `job_role`).
2. "Approved" today means an admin looked at the profile. GC adds "live" (documents current, `live_until`). Nothing today records a paid period except two unused columns: `providers.listing_fee_paid_until` and `guides.plan_expires_at` (the retired Pro plan).
3. The only admin-set price today is `site_settings.badge_fee` (null). There is no price table.
4. The document tables (GC migration 1) are not drafted yet, so they can still become person tables (decision 10, yes) and take passports.
5. Payments are deposits only. Subscriptions need a new payment kind and the processor Walter has not chosen yet (payments-engineer is comparing PesaPal, Flutterwave and AzamPay in `docs/business/payment-processor-choice-2026-11-21.md`).
6. Crew with basic phones may have no account (TM fact 6). A person with no account cannot pay or be "verified" on their own.

---

## 1. Account types and statuses (proposal for Walter to adjust)

### 1.1 Account types

| Account type | Today | Proposal |
| --- | --- | --- |
| Traveller | `traveler` | unchanged |
| Porter (mpagazi) | none | crew account, role `porter` |
| Cook / chef (mpishi) | none | crew account, role `cook` |
| Driver | none | crew account, role `driver` (a person, not a transfer service; transfers stay off) |
| Assistant guide | none | crew account, role `assistant_guide` |
| Guide | `guide` | unchanged |
| Business owner | `provider` with `business_type` (hotel, lodge, homestay, hostel, rental, curio_shop, gem_shop, gear_rental, transport, restaurant, spa, salon, nightlife, other) | unchanged; the price can differ per business type |
| Tour operator | `tour_operators` table, no account link yet (board P-c) | a business type, later |
| Admin | `admin`, two-step sign-in | unchanged; never self-granted |
| Investor | `investor` (unused by onboarding) | leave as is |

Price ranking Walter asked for (cheapest first), to be completed by Walter: porter < cook < driver < assistant guide < guide < business types. Only "porter < guide < shop owner" is Walter's; the places of cook, driver, assistant guide and each business type are a placeholder for him to set.

A person with two crew roles (porter and cook) pays one subscription, at the price of the highest role they ask to be verified for (proposal).

One login can hold more than one profile (2026-10-30 decision 4, "Add a profile"). Screens follow the profile that is switched on, so a guide who also owns a shop sees guide screens or shop screens, never traveller or crew screens mixed in.

### 1.2 Statuses (one set for every paid type)

| Status | Meaning | Stored or worked out |
| --- | --- | --- |
| Registered | signed up free, welcome step done (`onboarded_at`) | stored (exists) |
| Documents sent | uploads waiting for an admin | worked out from the document tables |
| Checked, not paid | admin has checked the required documents; no active subscription | worked out |
| Verified | required documents current **and** subscription paid up | worked out: `verified_until = least(live_until, paid_until + grace)` |
| Grace | subscription ended less than the grace days ago; features still on, banner shown | worked out |
| Locked again | grace over, or a required document expired; features off, profile and data kept | worked out |
| Rejected | admin said no to a document or profile, with a reason | stored |
| Suspended | conduct or safety (dispute process, decision 54) | stored, admin only |

Because "verified" is worked out from two dates (GC pattern), nothing needs a nightly job to switch features off: every rule compares the dates with `private.tz_today()`.

Proposed order: documents are checked first, then the person pays to switch verification on. Nobody pays and is then rejected, so no refunds are needed for failed checks. Cost: Kwetuly does the check work before any money comes in. Walter decides (Decisions, item 3).

### 1.3 What each account type sees and can do (proposal for Walter to adjust)

Rule for every row: unverified people never see the screens of other account types; travellers never see crew screens; crew never see traveller booking screens.

| Account type | Unverified (free) | Verified (paid) |
| --- | --- | --- |
| Traveller | Everything travellers have today: browse, enquire, request trips, join group trips, pay deposits, review. No verification asked (decision 42) | Not applicable, unless Walter's passport answer says travellers can verify |
| Porter, cook, driver, assistant guide | Own profile (private until verified), join a guide's team by consent, be on a trip crew list, private feedback to Kwetuly, crew code and rights pages, course list | Profile visible to live guides and approved businesses (decision 12), public check lines ("NIDA seen {date}"), shown as "looking for work", named in traveller thanks (if the person's switch is on), trip record and tag counts. **Seeing and applying for jobs: on hold for the advocate (gate 6.3).** |
| Guide | Draft profile visible only to the guide, uploads, guide hub and forum, invite crew (team stays private) | Listed in search and on tours, receives enquiries, calls and trip requests, makes offers, publishes packages and group trips, receives deposits, public checks card, crew team shown |
| Business owner | Draft listing visible only to the owner, uploads, business tools on the own listing | Listed, receives order requests and enquiries, catalogue items shown, "Checked by Kwetuly" lines with dates. Whether verification replaces or sits next to the yearly badge: Decisions, item 5 |
| Admin | n/a | n/a |

Things verification never buys, for any type: a higher place in search, a star, the word "recommended", or a "verified first" sort. Listed people are listed in the same order rules as today (2026-10-30 decision 3).

Public wording: the code and the admin say "verified". Screens for travellers say only what was checked and when ("NIDA seen 3 Dec 2026", "Guide licence seen, valid until ..."), never "verified" or "trusted" (badge honesty rule). The member's own dashboard can say "Your checks are active until {date}" in English and Kiswahili; localization proposes the Kiswahili word.

---

## 2. Price table for the admin dashboard (structure only, no amounts)

### 2.1 Table `public.price_list` (admins write, two-step session; anyone reads active rows)

| Column | Notes |
| --- | --- |
| id uuid | |
| account_type | `porter`, `cook`, `driver`, `assistant_guide`, `guide`, `business` |
| business_type text null | only when account_type = `business`; null = every business type |
| service_code | from a fixed list in shared code (2.2) |
| period | `month`, `year`, `once`, `percent` |
| amount_tzs integer null | TZS only (shilling rule). Null = "not set", and the service cannot be bought |
| percent numeric null | only for `percent` rows (commission defaults); a check makes exactly one of amount and percent set |
| rank int | the account type's place in Walter's ranking, used for the warning in 2.3 |
| active_from date, active_to date null | a price change is a new row; old rows are kept |
| status | `draft`, `active`, `legal_hold` (cannot be activated while on hold) |
| note text | Walter's own note, never shown publicly |
| created_by, created_at | logged in the admin action log (board phase 2) |

### 2.2 Grid Walter fills in (every cell blank on purpose)

| Service | Porter | Cook | Driver | Assistant guide | Guide | Business (per type) | Period choices | Status today |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Verification subscription | | | | | | | month, year | legal hold for crew until gate 6.3; open for guide and business after gates 6.1 |
| "Checked by Kwetuly" business badge (exists: `site_settings.badge_fee`) | n/a | n/a | n/a | n/a | n/a | | year | moves into this table |
| Extra checks (video interview, references, certificates; 2026-10-30) | | | | | | | once or year | Walter decides if separate from verification |
| Crew team seats paid by the guide or operator | n/a | n/a | n/a | n/a | | (operators) | year | optional |
| Prep calls (`kili_prep_call`, `safari_prep_call`, `combo_design`) | n/a | n/a | n/a | n/a | | n/a | percent | proposed 15% (decision 32 pattern) |
| Deposit commission | n/a | n/a | n/a | n/a | | | percent | working number 10% (decision 26) |
| Classes share | n/a | | n/a | n/a | | (restaurants) | percent | proposed 15% (decision 32), after classes start |
| Business referral commission | n/a | n/a | n/a | n/a | n/a | | percent | stays per agreement (`business_agreements`); this row is only the default shown to Walter |
| Contact unlock for operators | n/a | n/a | n/a | n/a | n/a | (operators) | once | legal hold (decision 17) |
| Job post by a guide or business | n/a | n/a | n/a | n/a | | | once | Walter decides; never paid by the job seeker |

Services not in the grid need a new `service_code` (a small code change), so nobody can invent a new charge from the admin screen alone.

### 2.3 Admin screen rules

- One page `/admin/prices`, website only, two-step session.
- Each row shows "not set" until Walter types an amount.
- Ranking warning: if a cheaper-ranked type would pay more than a higher-ranked type for the same service and period, the screen warns and asks Walter to confirm. It does not block.
- A new price applies to new subscriptions and renewals only. People already paid keep their price until their period ends. Members get the new price shown before they pay.
- Nothing on this page can switch on live charging (gate 6.1). In test mode the page shows "Test prices only".

---

## 3. Document checks per role

### 3.1 What each role sends (proposal; legal confirms each item before it is required)

| Role | Identity | Role documents | Notes |
| --- | --- | --- | --- |
| Porter | NIDA (card image, number optional) | none required. Anything else is "other" with a title | No porter registration card is confirmed to exist (TM 2.3) |
| Cook / chef | NIDA | food-handler or similar certificate as "other" until legal names a real one | |
| Driver | NIDA | driving licence with valid-until (class to confirm with legal) | |
| Assistant guide | NIDA | licence or registration card if one applies (legal to confirm) | |
| Guide | NIDA | guide licence with valid-until; first aid or WFR with valid-until; driving licence if "I drive guests" (GC) | as in the guide checks plan |
| Business owner | NIDA (Tanzanian owner) or passport number (non-Tanzanian owner) | business licence, TIN (decision Q9 pattern), MNRT licence for tour operators (expiry recorded) | partnerships keeps the per-type checklist |
| Traveller | none | none | Passport for travellers is still Walter's open question in decision 9 |

Passport: number (and, only if security-reviewer and legal agree, an image of the photo page), country, expiry date. Stored like NIDA in the identifiers table.

Whether a non-Tanzanian may work as a guide, porter, cook or driver at all is a question for the advocate (GS 6.2 says non-citizen guides are declined). Until then passports are for business owners only.

### 3.2 Data (reuse, no second system)

- GC migration 1 is drafted as **person tables** (TM 2.3, decision 10): `person_documents`, `person_document_checks`, `person_identifiers`, `person_check_log`, each with `guide_id`, `crew_member_id` or `provider_id` (exactly one).
- New document kinds: `passport`, `business_licence`, `tin_certificate`, `operator_licence`, beside GC's `identity`, `guide_licence`, `first_aid`, `wfr`, `driving_licence`, `other`. `identity` keeps `method` (`nida_card`, `nida_number`).
- `person_identifiers`: `nida_number`, `passport_number`, `passport_country`, `passport_valid_until`, `tin`. Column grants: owners write and read back the last 3 digits only; admins see masked values; a full read goes through one server action and writes a log row (GC 1f).
- Files stay in the private `verification` bucket (15 MB, JPG, PNG, WebP, PDF, own folder). Admins open them with short-lived signed links only.

### 3.3 Who reviews in admin

- Walter, as admin with two-step sign-in. A second admin can be added later (board 2026-10-31); every check records who did it in the log, never on the public row.
- One check card per document: open the file, compare the name with the profile, enter valid-until, tick. Always one by one; "approve all" only takes people whose checks are already done (2026-10-31 rule).
- Service level: 2 days for guides and businesses (docs/operations/admin-queues.md); operations-manager adds crew and passports.
- No AI or OCR reads ID documents (2026-10-30 decision 6).

### 3.4 Expiry reminders

- GC section 5 job, made for all person types: reminder 30 days before any dated document ends, then "expired, features locked" on the day after. Guide or member and admins both get it (email, push; WhatsApp after the template exists). Text only, never a file or number.
- The same job sends subscription reminders (section 4).

### 3.5 Secure storage (security-reviewer must review before anything is applied)

- Encrypt `nida_number` and `passport_number` now, in the application, with a server-only key (GC 1f recommended "before payouts"; with paid verification for every role the number of people grows, so earlier is safer). security-reviewer decides.
- Never in: public reads, notices, logs, analytics, error reports, admin notes, URLs, WhatsApp.
- Retention: delete document images a set time after the check and keep only the dates, once the advocate answers; PDPC registration and the retention policy are on paper now (decision 49).
- Account deletion removes identifiers and documents (cascade plus the bucket cleanup that exists).

---

## 4. Subscriptions (depends on the processor choice)

### 4.1 Data

- `public.subscriptions`: id, subject (`guide_id`, `crew_member_id` or `provider_id`, exactly one), `account_type`, `price_id` (fk price_list), `amount_tzs` (copied at payment, never changes), `period` (`month`, `year`), `starts_on`, `paid_until`, `status` (`active`, `grace`, `ended`, `refunded`), `payment_id`, created_at. Written only by the payments Edge Function and admins.
- `payments.kind` gains `subscription`; `payments.subscription_id` added. Same rule as deposits: rows only from the Edge Function, admins may only mark payouts.
- The unused `guides.plan` / `plan_expires_at` (retired Pro) and `providers.listing_fee_paid_until` are not reused, so no "Pro" label comes back; they are dropped later with Walter's OK.

### 4.2 Paying and renewing

- Cards and mobile money, both through the chosen processor (Walter's answer to 1-5).
- The member starts each payment. No saved cards and no automatic charges (decision 24 pattern), unless payments-engineer shows the chosen processor has a documented, consent-based recurring product and Walter approves it.
- Monthly or yearly at the price in `price_list`. A yearly price is whatever Walter sets; no discount is assumed.
- Paying early extends from the current `paid_until`, never from today.

### 4.3 Expiry

| Step | Proposal (placeholders for Walter) |
| --- | --- |
| Reminders | 7 days and 1 day before `paid_until` (monthly); 30 and 7 days before (yearly) |
| Grace | 7 days after `paid_until`, features still on, banner "Please renew by {date}" (same 7 days as decision 21) |
| Locked again | after grace: features off, profile hidden from the public, data kept, documents and checks kept |
| Existing work | conversations, confirmed trips and deposits already paid carry on (GC Q3 pattern); only new contact is blocked |
| Renewal | paying switches features back on at once if documents are still current; no new check needed |
| Document expired while paid | features locked until a new document is checked; the paid time is not extended (proposal; Walter may choose to extend) |
| Refunds | none for a started period, except where Kwetuly caused the problem ("who causes it pays"); legal drafts the terms |

### 4.4 Receipts

- A numbered receipt for every paid subscription: name on the account, account type, service, period, amount in TZS, payment method, processor reference, date. Shown in the dashboard and sent by email.
- Company name, address, TIN and any VAT line only once the company is registered and accounting confirms the VAT position. Before that only test receipts exist, marked "Test".
- accounting sets the numbering and the monthly statement; the daily match with the processor's settlement report (decision 2 pattern) is part of payments-engineer's work.

---

## 5. Build order with owners

S = days, M = 1 to 3 weeks, L = a month or more. Every database change is a draft, tested on a local or test project; live only with Walter's yes.

| # | Task | Agent | Input | Output | Size | Depends on | Walter before next step? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Can start before the processor is chosen** | | | | | | | |
| 1 | Update the data design: account types, statuses, `verified_until`, person tables with passport, price_list, subscriptions, feature rules per type | tech-lead | this plan, GC, TM, Walter's answers to the Decisions below | short design addendum to GC and TM | S | Walter's answers to Decisions 1-6 (can start on the proposals) | yes, on the feature table |
| 2 | Migration draft A: person document tables, identifiers (NIDA, passport, TIN), new kinds, `tz_today` | backend-engineer | step 1, GC sections 1-2 | draft migration plus shared types and tests | M | step 1 | no (drafts only) |
| 3 | Migration draft B: crew account type in `user_role` and `complete_onboarding`, `crew_members`, `crew_private` (TM phase 1 core, no teams yet) | backend-engineer | TM 2.1 | draft migration | M | step 2 | no |
| 4 | Migration draft C: `price_list` with every amount null, ranking, history; badge fee moved from `site_settings` | backend-engineer | section 2 | draft migration | S | step 1 | no |
| 5 | Migration draft D: `private.account_type()`, `private.is_verified(...)`, `private.has_feature(code)`; read rules so each type sees only its own data | backend-engineer | step 1 feature table | draft migration and SQL tests | M | steps 2-4 | no |
| 6 | Admin pages: price table (`/admin/prices`), document check cards for every role, expiry queue | frontend-engineer | steps 2-5, docs/design/admin-dashboard-layout.md | web admin pages | M | steps 2-5 | no |
| 7 | Member screens: upload cards per role, status card ("checked", "waiting", "expires"), screens and menus by account type on web and app | frontend-engineer | steps 2-5 | web and app screens | M to L | steps 2-5 | no |
| 8 | Texts: guide, crew and business texts in English and Kiswahili; traveller-facing check lines in 7 languages | localization | screens from steps 6-7, GS section 8 drafts | dictionary entries | S to M | steps 6-7 | yes, Walter checks the Kiswahili |
| 9 | Security review: documents, identifiers, encryption, signed links, RLS per account type, admin powers, price table | security-reviewer | drafts 2-5, screens 6-7 | findings list | M | steps 2-7 | no |
| 10 | Tests: sign-up per type, uploads, admin checks, feature locks per status, a traveller never sees crew screens and the other way round, expiry by date | qa-tester | steps 2-9 fixed | release verdict | M | step 9 fixes | yes, apply drafts 2-5 on the test project |
| 11 | Checklists and service levels for crew and passport checks | operations-manager | section 3 | update of docs/operations/admin-queues.md | S | step 1 | no |
| 12 | Subscription terms, refund rule, the job-seeker fee question, passport and non-citizen questions, in the advocate pack | legal | this plan, gate 6.3 | additions to the advocate pack | S | none | yes, Walter sends the pack |
| **Needs the processor choice** | | | | | | | |
| 13 | Subscriptions table, `payments.kind = subscription`, checkout for cards and mobile money, webhook check, renewal, grace, receipts, daily match | payments-engineer | processor choice doc, sections 4.1-4.4 | Edge Function, draft migration E, receipt format | M to L | Walter picks the processor; sandbox account | yes, processor choice |
| 14 | Receipt numbering, statements, VAT line rule | accounting | step 13 | receipt and statement spec | S | step 13 | no |
| 15 | Security review of money: webhook signature, amounts from `price_list` only (never from the client), no card data on Kwetuly, refunds | security-reviewer | step 13 | findings | M | step 13 | no |
| 16 | Tests in sandbox: pay monthly and yearly by card and mobile money, failed and expired payments, grace, lock, renewal, receipts | qa-tester | steps 13-15 | release verdict | M | step 15 fixes | yes, live switch-on (all of gate 6.1) |

Can start now without the processor: steps 1-12. Steps 13-16 wait for the processor choice; steps 13 and 16 run only in the processor's sandbox until gate 6.1 is met.

---

## 6. Hard gates

1. **No live charging** of any subscription, badge or fee until the company is registered (Walter, 2026-11-08) **and** the chosen processor's live merchant account is approved. Until then only the processor's sandbox is used, and every price and receipt is marked "Test".
2. **Migrations go to the live database only with Walter's explicit yes**, one by one, after security-reviewer and qa-tester. The read-rule migration (like GC migration 4) hides people at once, so it ships together with the code release.
3. **Job-seeker fees:** the advocate pack must ask whether a verification fee paid by porters, cooks, drivers or assistant guides who look for work is a fee to job seekers that Tanzanian law forbids or limits (hr and legal flagged it). Until the advocate answers, the crew verification price stays on legal hold and no crew feature linked to finding work (jobs, "looking for work", contact by operators) is put behind payment.
4. No ID documents are read by AI, and no document or identity number leaves the private storage and tables (section 3.5).
5. Prices exist only when Walter types them. No agent proposes, seeds or shows an amount as real.

---

## 7. Earlier recommendations that now conflict with Walter's answers

Listed once, so Walter can see them. No arguments.

| # | Earlier recommendation (accepted with "yes to all") | What Walter's 2026-11-21 answer now says |
| --- | --- | --- |
| 2, 3, 4, 5 | Selcom dispute record, Selcom questions, switch-on after Selcom, card texts after the 26a75bd merge | Selcom parked; these move to the chosen processor |
| 6, 7 | Crew never pay; one TZS price per crew member paid by the guide or operator | Crew pay their own monthly or yearly verification, at Walter's price per type |
| 8 | No check needed for a profile, a team, a review mention or a job application; job posts may not ask for checked crew | Features follow status: unverified and verified differ |
| 9 | No ID to be on a team; NIDA seen on a call, nothing copied | NIDA documents (and passports) are collected and stored |
| 11 | Crew sign up by guide invite and Kwetuly call, with no account needed | A paid subscription needs the person's own account (sign-in with email, Google or Apple until phone sign-in) |
| 13 | 14-day review window, 7 to reply, 14 to appeal | 30 days. Open: does 30 days also apply to traveller reviews of guides (no window today) and crew thanks? |
| 24, 26, 33 | Saved cards, fee checks and the class minimum price measured against Selcom | Measured against the chosen processor |
| 28 | Paying in parts waits for Selcom's answers | Waits for the chosen processor's answers |
| 35 | Paid crew checks come "later, after registration and payments" | Paid verification moves into the main build (still not charged before gate 6.1) |
| 40 | One check that says what and when; no tiers | Still one level, but "verified" becomes a paid status; public wording stays "what and when" |
| 41 | No paid access or subscriptions for porters and drivers | Porters and drivers pay a subscription to be verified |
| 42 | No ID from travellers | Open: passport for travellers or only for non-Tanzanian providers |
| 44 | Basic approval and listing free for good; guides pay only for the document check | Guides register free, but listing and bookings follow paid verification |
| 45 | Stay with Selcom for launch | PesaPal, Flutterwave or AzamPay |
| 47 | Businesses list free; optional paid badge and commission | Businesses pay a price ranked above guides; every service is income |
| 2026-10-30 | Verification fees guide US$10, chef US$7, porter US$5 | Replaced by prices Walter sets in admin, in TZS |
| 2026-10-30, decision 3 | Basic approval free and required for any listing | Listing follows paid verification (see 44) |
| GS and FR principle | "Kwetuly charges crew no fee"; draft messages M10 and the "no check needed" line | These drafts need rewriting once gate 6.3 is answered |

---

## Decisions for Walter

1. **Feature table (1.3).** Recommended: approve it as the starting point and change any row you want.
2. **Ranking.** Recommended: you place cook, driver, assistant guide and each business type between "porter" and "shop owner".
3. **Order: check first, then pay.** Recommended: yes, so nobody pays and is then rejected.
4. **Crew jobs while the advocate is asked.** Recommended: seeing and applying for jobs stay free for crew until the advocate answers (gate 6.3).
5. **Businesses.** Recommended: business verification becomes the yearly "Checked by Kwetuly" badge (one product, not two), priced in the new table.
6. **Passport.** Recommended: only for non-Tanzanian business owners for now; travellers give no ID (decision 42).
7. **Review window 30 days.** Recommended: 30 days for guide notes on crew (as you said) and for traveller reviews of guides and crew thanks too, so there is one rule.
8. **Grace and reminders (4.3).** Recommended: 7 days' grace, features locked after, data kept.
9. **Encrypt NIDA and passport numbers now** rather than before payouts. Recommended: yes, security-reviewer confirms.
10. **Two people who share a role** (porter and cook): one subscription at the higher role's price. Recommended: yes.

## Run next

Run `tech-lead` with: "Read docs/team/plan-paid-verification-2026-11-21.md, docs/team/design-guide-checks-2026-11.md and docs/team/design-crew-and-trip-management-2026-11.md. Write a short addendum (step 1) as a new section at the end of docs/team/design-crew-and-trip-management-2026-11.md: person document tables with passport and business kinds, account types and the crew role, the worked-out verified status (`verified_until`), price_list and subscriptions tables, and one `private.has_feature` rule per account type from the plan's table 1.3. Paper only, no migrations, no prices."
