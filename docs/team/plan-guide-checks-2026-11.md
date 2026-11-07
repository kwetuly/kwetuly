# Plan: a guide goes live only after Kwetuly has checked their documents (2026-11-08)

Kept by `chief-of-staff`. Walter decided this on 2026-11-08. Nothing in this plan is applied to the live database, and nothing is sent to any guide, unless Walter approves. The restyle branch (`claude/app-restyle-2`) is not live yet.

Goal: a guide profile is shown only after Kwetuly has seen a current guide licence, a current first aid or WFR certificate and, for guide-drivers, a current driving licence. Other certificates are recorded with the date seen and their expiry date. Walter's "Walter Mushi" profile is labelled as a sample.

## 1. What exists today (read on 2026-11-08)

- **Checks.** These are columns on `guides`: `identity_checked_at`, `licence_checked_at`, `first_aid_checked_at` and `first_aid_valid_until` (migration `20261014000600_guide_checks.sql`). The trigger `guard_guide_admin_fields` (latest version in `20261016001100_security_review_fixes.sql`) stops a guide from setting them. A guide can only clear them.
- **Missing fields.** There is no licence expiry date, no WFR, no driving licence and no "drives guests" flag. The licence check means "looked at the card". It is never confirmed with a government register.
- **Uploads.** The private `verification` bucket takes JPG, PNG, WebP or PDF up to 15 MB, in the owner's own folder. Paths are stored in `guide_private`: `id_document_path`, `license_document_path`, `first_aid_document_path`. Guides upload them on the web dashboard (`apps/web/src/app/[lang]/dashboard/actions.ts`, lines 203-217) and in the app (`apps/mobile/src/app/profile-edit.tsx`). A new upload clears that check, and the guide stays approved.
- **Self-declared items.** `certifications text[]` is free text with the hint "(First Aid, WFR…)". `association` and `has_vehicle` are also typed by the guide. Travellers see all of these under "Stated by the guide" (commit 964944d).
- **How admins record checks.** On `/admin/all` and `/admin/review` the admin ticks ID, licence and first aid, with an optional first aid valid-until date, then presses "Save checks". `reviewGuide` (`apps/web/src/app/[lang]/admin/actions.ts`, lines 96-108) refuses approval without ID and licence ticks. `guideReadiness` (`apps/web/src/lib/admin-queue.ts`) uses the same rule. First aid is optional (`profileCompletion` marks it optional).
- **The gate is not enforced by the database.** Only the web server action checks the rule. The database still lets an admin session approve a guide with no checks, for example through another code path or the SQL editor. The rule also never takes a guide offline again. An approved guide stays listed after a check is cleared, and after first aid expires.
- **Samples.** Sample guides have `is_sample = true` and no check dates. "Walter Mushi" is not in any seed or migration. The name appears only in `packages/shared/src/shared.test.ts`. It is therefore a live row, probably owned by Walter's own account, and it needs a read-only lookup before anything changes.

## 2. Data model changes (backend-engineer drafts, tech-lead designs first)

Recommended: one admin-written table instead of more columns.
- `guide_document_checks`: guide_id; kind (`identity`, `guide_licence`, `first_aid`, `wfr`, `driving_licence`, `other`); title (required for `other`, for example "Mountain rescue course"); checked_at; checked_by; valid_until (required for licence, first aid, WFR and driving licence); document_path; superseded_at.
- RLS on that table: admins write. The guide reads their own rows. The public sees only kind, title, checked_at and valid_until, for approved non-sample guides, through a view. No paths and no checker are ever exposed.
- `guides.drives_guests boolean`. The guide sets it. It is separate from `has_vehicle`, because a guide can drive a company car.
- Private upload paths for WFR, driving licence and a list of other certificates.
- Move the existing ID, licence and first aid dates into the table. The old columns stay until web and app read the table, then they are dropped in a later migration.
- Change: a new upload no longer clears the current check. The old check stays valid until its own expiry, and the new document is marked "waiting for check". This stops a guide disappearing the moment they upload a renewal.
- Shared code (`packages/shared/src/guide-checks.ts`) gets the new kinds, expiry for every kind, `isLiveReady(guide)` and tests.

## 3. The approval gate (server-enforced)

- A database trigger on `guides`. `verification_status` may become `approved` only if all of these hold:
  - a current guide licence check exists (valid_until is today or later);
  - a current first aid or WFR check exists;
  - if `drives_guests`, a current driving licence check exists;
  - if Walter keeps it, an identity check exists.
- Sample rows are exempt. They are test data, they are labelled, and they are removed before launch.
- **Staying live.** The public "Read guides" policy and the listing queries also need those checks to be current. When a check expires, or `drives_guests` is switched on without a driving licence, the profile drops off the lists and its page shows "not available". The guide sees why on the dashboard.
- **Reminders.** The guide and admin get a notice 30 days before any expiry (the existing notification_outbox, text only).
- **Admin side.** The web server action and approve-all keep their own check too, so the admin gets a clear error.

## 4. Traveller texts that become true (7 languages)

- Badge: "Licence and first aid checked" replaces "ID and licence checked". If the ID check is kept, the wording becomes "ID, licence and first aid checked".
- Checks card lines:
  - "WFR certificate seen {date}, valid until {date}";
  - "Driving licence seen {date}, valid until {date}" (guide-drivers only);
  - "{certificate} seen {date}" for other certificates.
- `partners.why[0]`: "Before a guide's profile goes live, Kwetuly looks at their guide licence and a first aid or WFR certificate (and the driving licence of guides who drive). Each profile shows what we checked and when."
- `intro.s1Body` and `explore.statGuides` change to match.
- Never use "verified", never "confirmed with the register", never "recommended". Certificates Kwetuly has not seen stay under "Stated by the guide".

## 5. Guide-facing texts (English and Kiswahili)

- `documentsWhy`: licence, plus first aid or WFR, plus driving licence if you drive guests.
- New: the "I drive guests" toggle, the upload for an alternative WFR certificate, "Add another certificate", the "valid until" note, a "waiting for check" status, the 30-day expiry reminder, and "Your profile is paused until we check {document}".
- Guide-success drafts the notice to the already-approved guides. Walter sends it himself.

## 6. Admin workflow and service levels (operations-manager)

- One check card per document: open the file, compare the name with the profile, enter the valid-until date, then tick. Other certificates can be added with a title.
- Checks are always one by one. Approve-all only takes guides that pass the gate.
- New queue "Expiring in 30 days / expired".
- Service levels: first check within 2 days (as in `docs/operations/admin-queues.md`), renewals within 2 days, safety-related expiry noticed the same day.
- The checklist says what Kwetuly does not do: no confirmation with the government register, and no judgement of skill.

## 7. Legal (drafts for the Tanzanian advocate)

- Storing images of licences, driving licences and IDs: whether this is allowed, the lawful basis, consent wording, the retention period (for example, delete the image a set time after the check and keep only the dates), who may see them, and where the data is held (Supabase region). The Personal Data Protection Act 2022 applies, to confirm.
- Which driving licence class a guide-driver carrying guests needs, and whether that is a fact Kwetuly may check. Nothing is stated until legal confirms it.
- Liability and wording: whether "first aid checked" or "seen" creates a duty of care; consumer-law risk of the badge.
- Whether a lawful route exists to confirm a guide licence at the source.

## 8. Steps

| # | Task | Agent | Input they need | Output | Order | Walter before next step? |
| --- | --- | --- | --- | --- | --- | --- |
| 1a | Read-only counts on live: approved real guides by which checks they have (licence, first aid, ID, none); look up the "Walter Mushi" row (id, is_sample, owner is an admin account yes or no, any check dates, packages and trip links). Counts only; no names, phones or emails go into files | backend-engineer | This plan; live project read-only | Counts and the row facts, in the report only | Now, parallel | No |
| 1b | Data and gate design: table vs columns, trigger, public view, listing filter, "upload does not clear", expiry job and reminders, is_sample exemption, whether an owner can change is_sample | tech-lead | Sections 1-3; the review doc | Design note with the list of migrations and the screens touched (web and app) | Now, parallel | No |
| 1c | Admin checklist per document, expiry queue, service levels | operations-manager | Sections 1, 3, 6 | Checklist and service levels added to docs/operations/admin-queues.md | Now, parallel | No |
| 1d | Advocate questions in section 7 | legal | Sections 1, 7 | Memo of questions for the advocate (no advice given as fact) | Now, parallel | No |
| 1e | Guide notice drafts (en, sw): new rule, what to upload, paused or grace wording | guide-success | Sections 5 and 9 | Drafts only; Walter sends | Now, parallel | No |
| W1 | Decisions 1-7 below | Walter | Outputs 1a-1e | Answers | After step 1 | **Yes** |
| W2 | "Walter Mushi" set to sample (one update on live) | backend-engineer prepares, Walter OKs | 1a facts | is_sample = true on that row only, then a read-back | Can go before the rest | **Yes, explicit OK** |
| 2a | Migration drafts (not applied), shared guide-checks code and tests | backend-engineer | 1b design, W1 answers | Draft migrations, shared code and tests | After W1 | No |
| 2b | Upload screens (web dashboard, app profile-edit and welcome), admin check cards, expiry queue, profile checks card, badge | frontend-engineer | 2a, 1c | Web and app changes | After 2a | No |
| 2c | Look of the check cards, badge and "paused" state | designer | 2b screens | Brand check (green #1D951A actions, 5px corners, no all caps, no arrows) | With 2b | No |
| 2d | Translations: traveller texts in 7 languages, guide texts in en and sw | localization | English texts from sections 4-5 | Dictionary entries | With 2b | No |
| 3a | Review uploads, personal data, RLS and the public view, trigger bypass, is_sample change | security-reviewer | 2a-2b | Findings; fixes go back to the engineers | After 2 | No |
| 3b | Test: sign-up to live, expiry, renewal, guide-driver toggle, samples, approve-all, 7 languages | qa-tester | 2a-2b, 3a fixes | Release verdict; tsc, lint and shared tests pass | After 3a | No |
| W3 | Apply the migrations on live; what happens to existing guides; merge to live | Walter | 3a, 3b | Go or no-go | After 3 | **Yes** |
| 4 | FAQ lines on what the badge means | customer-care | Final texts | FAQ draft | After W3 | Walter approves publishing |

## 9. Decisions for Walter

1. **Keep the ID check as a requirement?** Recommended: yes. It is already required today and it ties the licence to the person. The traveller badge can still say "Licence and first aid checked".
2. **Approved guides without the new checks.** Recommended: once 1a gives the count, pause them when the gate goes live. Do not reject them. They return as soon as the documents are checked, and guide-success drafts a note that you send. Alternative: a 30-day grace period with the checks card showing what is still missing.
3. **Expiry.** Recommended: the profile is hidden automatically on the day any required check expires, with reminders 30 days before.
4. **Renewal upload.** Recommended: a new upload does not clear the current check (it is cleared today).
5. **Samples.** Recommended: exempt from the gate, and still removed before public launch.
6. **"Walter Mushi".** Recommended: OK one update on live, `is_sample = true` on that row only. If the profile is owned by your own account, the "delete all samples" step before launch would also delete this guide profile. Say whether that is fine, or whether we should move it out of your account.
7. **Data model.** Recommended: one checks table, as in section 2. The tech-lead's design can change this.

## 10. Run next

Run in parallel: backend-engineer (1a, read-only), tech-lead (1b), operations-manager (1c), legal (1d) and guide-success (1e), each with this file as input.
