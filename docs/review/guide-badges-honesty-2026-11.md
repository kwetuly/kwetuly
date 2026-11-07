# Guide badges and checks: honesty review (2026-11-07)

Reviewer: conversion. This is a read-only review of branch `claude/app-restyle-2`. No code was changed. Walter approves; frontend-engineer builds; qa-tester checks the result.

## What the data proves

| Field | Who sets it | What it proves |
| --- | --- | --- |
| `identity_checked_at`, `licence_checked_at`, `first_aid_checked_at` (+ `first_aid_valid_until`) | Admin only. The `guard_guide_admin_fields` trigger in `supabase/migrations/20261016001100_security_review_fixes.sql` stops guides from setting them | A Kwetuly admin looked at the document on that date. The licence check means "looked at the licence or registration card". It does **not** mean the number was confirmed with the government register. |
| `verification_status = 'approved'` | Admin only | The profile was reviewed. New approvals need ID and licence ticks (`apps/web/src/app/[lang]/admin/actions.ts` lines 99, 108, 434). But a check is cleared when the guide uploads a new document, and the guide stays approved. So "approved with no check recorded" really happens. |
| `certifications text[]`, `association text` | **The guide, as free text** (dashboard and app profile-edit, with the hint "(First Aid, WFR…)") | Nothing. Kwetuly has not seen any of it. |
| `expertise[]`, `female_guide` | The guide (admin "approve one by one after you have seen the proof", but no proof date is stored) | Nothing that is recorded. |
| `years_experience`, `summits` | The guide | Nothing. These are already labelled with `extras.ownFigures`. Good. |
| `plan = 'pro'` | Admin (paid plan, dormant) | Payment, not quality |

## Every place travellers see these

### App (apps/mobile)
1. **`app/guide/[slug].tsx` line 110**: "Verified guide" mint badge with a tick, shown when `hasRecordedCheck(g)`.
2. **Line 114**: one mint tick badge per check ("Identity checked" and so on). These are honest because they come from `guideChecks`.
3. **Line 117**: gold "Pro" badge.
4. **Line 146**: the `GuideChecksCard` (`components/guide-checks.tsx`). Honest: it gives the date, the validity and a plain "none" text.
5. **Line 163, the main problem**: the "Certifications" list (free text plus association) uses `<Badge>` with the default tone **`mint`**: green fill, forest text, bold (`components/ui.tsx` line 305). It looks almost the same as the real check badges on line 114; the only difference is that it has no tick. A guide who types "First Aid" gets a green "First Aid" chip, while the card above says no documents were checked. Specialties, languages, expertise and regions use the same mint style, so self-declared skills also look like approved items.
6. **`components/cards.tsx` line 45**: "Verified guide" badge on guide cards, plus "Pro" on line 48.
7. **`app/tour/[slug].tsx` line 344**: a tick after the guide's name. Its only accessible label is "Verified guide".
8. **`app/request/[id].tsx` line 137**: "Verified guide" on offers. Unlike the other places, it has no `is_sample` or approved guard.
9. Wording (shared dictionary): `intro.s1Body` "Verified local guides…", `guides.empty` "No verified guides match yet".

### Website (apps/web)
10. **`app/[lang]/guides/[slug]/page.tsx` line 138**: `GuideBadges` shows "Verified guide" (mint, `BadgeCheck` icon) or a neutral "Approved profile". "Pro" is gold.
11. **Line 141**: `GuideCheckPills`, mint pills for each real check. Honest.
12. **Lines 155–162**: the "Certifications" list. The chips are neutral grey (`bg-surface`), which is better than the app. But the list contains free text, "Association: X" and "Has own vehicle", and it sits **directly above** "What Kwetuly checked". It reads as "credentials", and then "not checked" right after. This is the contradiction QA saw. Nothing says who wrote the list.
13. **Lines 191–204**: expertise cards with green icons. Self-declared, with no label saying so.
14. **`components/guide-card.tsx` lines 60–67**: "Verified guide" and "Pro" on every listing card.
15. **`tours/[slug]/page.tsx` line 433** and **`requests/[id]/page.tsx` line 144**: "Verified guide" ticks.
16. **Home `page.tsx` line 63**: "{n} verified guides". `siteStats` counts *approved, not sample* guides. Approved is not the same as "verified" under our own `hasRecordedCheck` rule.
17. **Partners page copy** (`partners.why[0]`): "Every guide is checked against their tourism registration before they appear." **This is false as written.** We look at a card; we do not check it against a register (the paid-check plan in `docs/business/paid-guide-check-and-team-seats.md` lists "registration confirmed at the source" as future work that needs legal advice). `partners.subtitle` "book registered Tanzanian guides" has the same problem.
18. `SimilarGuides` code comment says "Other verified guides", but the list includes approved guides with no checks. The page doesn't show this text, so it is low priority.

## What is misleading (ranked by harm)

| # | Issue | Why it misleads |
| --- | --- | --- |
| A | Partners copy "checked against their tourism registration" (17), plus "registered guides" | A factual claim about a check we do not do. It is aimed at agencies, who rely on it commercially. |
| B | App "Certifications" chips in the same mint style as real checks (5) | Self-declared items look checked by Kwetuly. This is the case QA reported. |
| C | Web "Certifications" with no "stated by" note, placed right before "What Kwetuly checked" (12) | It reads as credentials, then contradicts itself. |
| D | **Bug:** `hasRecordedCheck` (`packages/shared/src/guide-checks.ts` line 34) ignores first-aid expiry, while `guideChecks` drops expired first aid. A guide whose only check is an expired first-aid one shows "Verified guide", and their checks card says "We have not checked any of this guide's documents yet". | The badge contradicts the checks list. |
| E | "Verified guide" is shown when *any one* check exists. First aid alone (or ID alone, after the licence check was cleared) still says "Verified guide". | A vague, broad word that rests on a narrow fact. Most travellers will read "verified" as "licensed guide". |
| F | "Pro" gold badge, and lists sorted `plan desc` ("Pro guides first", `apps/web/src/lib/guides.ts` line 89; `apps/mobile/src/lib/api.ts` lines 59 and 414) | Paid status that looks like quality, and paid ranking with no disclosure. It is dormant (no guide has `pro` today), but it goes live the moment an admin sets one. |
| G | "verified guides" in the home stat, empty states, intro and partners | The count and the lists include approved guides with no current check. |
| H | Expertise and "Female guide" as green chips or cards (app mint chips, web green icons) | Self-declared. "Female guide" matters for safety. |
| I | `request/[id].tsx` (app) and `requests/[id]` (web) "Verified" with no `is_sample` guard; check pills not gated on `is_sample` | No harm today (samples have no check dates), but it breaks the sample-labelling rule if the data changes. |

## Fixes, ranked

1. **Fix the partners copy now** (A). Draft text:
   - `partners.why[0].title`: "ID and licence looked at"
   - `partners.why[0].body`: "Before a guide's profile goes live, Kwetuly looks at their government ID and their guide licence or registration card. Each profile shows what we checked and when."
   - `partners.subtitle`: replace "registered Tanzanian guides" with "Tanzanian guides".
2. **Make self-declared items look different, on both platforms** (B, C, H).
   - Rename the "Certifications" block to **"Stated by the guide"**. Put certifications, "Member of {association}", "Has own vehicle" and the expertise items in it, with one caption under it: "The guide wrote these. Kwetuly has not checked them."
   - App: use `tone="neutral"` (grey) for these chips, never mint. Keep mint with a tick **only** for `guideChecks` items. Languages, regions and specialties can stay neutral too, so that green means only "Kwetuly checked".
   - Web: keep the grey chips and add the same heading and caption. Move "What Kwetuly checked" **above** this block, so the facts come first.
   - If a stated certification matches a check type (first aid) and that check is recorded and still valid, show it once, inside "What Kwetuly checked". Do not show a second green chip.
3. **Fix `hasRecordedCheck` to use `guideChecks(guide).length > 0`** (D). This respects expiry. Add a shared test for "only an expired first-aid check means not verified". payments-engineer is not involved; this is shared code, so frontend-engineer or backend-engineer does it and qa-tester checks it.
4. **Replace "Verified guide" with a specific label** (E). Recommended: show **"ID and licence checked"** only when *both* current checks exist. Otherwise show nothing in the header and let the check pills speak. The word "verified" disappears from badges. Tick-only marks (tour rows) get the same accessible label.
5. **Fix the general "verified" wording** (G). Use "approved guides" in `explore.statGuides`, and "No guides match yet…" in `guides.empty`. Use "Local guides whose ID and licence Kwetuly has looked at…" in `intro.s1Body`. In guide-facing texts (`forGuidesBody`, `joinBody`, hub `subtitle`, jobs), "approved guides" is the accurate word.
6. **Retire "Pro" before any guide is set to it** (F). Remove the gold pill and the `plan desc` sort, which was already recommended in `docs/business/paid-guide-check-and-team-seats.md` item 259. If Walter keeps a paid tier, it must be labelled as paid, and it must not change ranking without a visible note.
7. **Add sample guards** (I): `!is_sample && approved` before any "checked" mark in the request offers (app and web) and before the check pills.
8. **Later, with the paid guide check**: certificates Kwetuly has actually seen move from "Stated by the guide" into "What Kwetuly checked" as "{certificate} seen, {date}, valid until {date}". That needs a new admin field (a per-certificate seen date), which is backend-engineer work.
9. **Optional wording fix for "approved, no checks"**: this state now mostly comes from a check that was cleared after a new upload. "We have not checked any documents yet" can be untrue in that case. A truthful option: "Kwetuly approved this profile. A newer document is waiting for our check." It needs a public "document waiting" flag, which is backend work. Walter decides whether such guides should stay listed at all while they wait.

## New texts (English drafts)

Traveller texts need all 7 languages (the localization agent translates). Guide texts need English and Kiswahili.

| Key (suggested) | English | Who sees it |
| --- | --- | --- |
| `profile.statedTitle` | Stated by the guide | Travellers (7) |
| `profile.statedNote` | The guide wrote these. Kwetuly has not checked them. | Travellers (7) |
| `profile.memberOf` | Member of {association} | Travellers (7) |
| `guides.idLicenceChecked` (replaces `guides.verified`) | ID and licence checked | Travellers (7) |
| `explore.statGuides` (change) | approved guides | Travellers (7) |
| `guides.empty` (change) | No guides match yet. Try fewer filters, or check back soon. | Travellers (7) |
| `intro.s1Body` (change) | Local guides for Kilimanjaro, safari, Zanzibar and culture. See what Kwetuly checked, read reviews, chat and book a prep call. | Travellers (7) |
| `partners.why[0]`, `partners.subtitle` (change) | see fix 1 | Agencies (7, the same dictionary) |
| `dashboard.certificationsHint` (new) | Travellers see these as "Stated by the guide" until Kwetuly has seen the certificate. | Guides (en, sw) |

## How to ship and measure

- **Do not A/B test the misleading version.** Showing some travellers green chips for unchecked items is the problem itself. Ship fixes 1–7 to everyone and measure before and after.
- Main metric: guide profile view → enquiry started and enquiry sent (`EVENTS.guideViewed`, `enquiryStarted`, `enquirySent`), compared over 4 weeks before and 4 weeks after, on web and app separately.
- Guardrails: enquiry → guide reply rate, deposit rate, complaints and care tickets about "verified" or "licensed", and report or refund reasons.
- Expected effect: roughly neutral on enquiries, from −3% to +3%. Traffic is small, so the noise may be bigger than that. The real gain is lower risk of complaints and legal claims, and more trust in the checks that really happened. If enquiries fall, the fix is to get more guides fully checked, not to blur the labels.
- Optional honest A/B test later: test where "What Kwetuly checked" sits (top of the profile or after the bio). Both versions must be truthful.

## Needs Walter or legal

- **Walter:** approve fixes 1–7, and choose "ID and licence checked" over keeping the word "Verified" (fix 4). Retire "Pro" or keep it with disclosure (fix 6). Decide whether "Female guide" and expertise need proof stored before they show (H). Decide whether guides whose check was cleared stay listed (fix 9).
- **Legal (draft for the Tanzanian advocate):** confirm which consumer-protection rules on misleading claims apply, in Tanzania and in travellers' home markets. Confirm what wording we may use for the licence check ("looked at" versus "confirmed"). Confirm whether a lawful route exists to confirm registration at the source; until then, no copy may say "checked against registration". Confirm whether "Verified" in any form is safe. Nothing in this report is legal advice.
