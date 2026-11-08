# Design: guide document checks and the live gate (2026-11-08)

Step 1b of `docs/team/plan-guide-checks-2026-11.md`. Written by `tech-lead`. This is a design only: no migration is written or applied, and nothing touches the live database. Walter's answers to the plan's decisions (W1) can change the parts marked **[W1-n]**.

## 0. What I read

- Migrations: `20261012000200_guides.sql` (guides, guide_private, "Read guides" policy, verification bucket and its storage policies), `20261014000600_guide_checks.sql` (the four check columns), `20261016001100_security_review_fixes.sql` (latest `guard_guide_admin_fields`), `20261016001000_sample_guides_packages_groups.sql` (`guides.is_sample`, `guard_guide_sample`), `20261014000500_upload_limits.sql` (15 MB, JPG/PNG/WebP/PDF), `20261012000800_notifications.sql` (`notification_outbox`, `private.notify_user`, `private.notify_admins`, pg_cron), `20261016001400_admin_two_step_business_gate_deposits_leads.sql` (`private.lead_target_ok`, `private.can_offer`), `20261016001800_onboarded_gate_followup.sql` (conversation and call policies), `20261016000100_guide_packages.sql`, `20261014000100_trip_requests_offers.sql`, `20261030000000_profile_link_checks.sql`.
- Shared: `packages/shared/src/guide-checks.ts`.
- Web: `apps/web/src/app/[lang]/admin/actions.ts` (`reviewGuide` lines 30-130, approve-all lines 420-440), `apps/web/src/lib/admin-queue.ts` (`guideReadiness`, `packageReadiness`), `admin/all/page.tsx`, `admin/review/page.tsx`, `admin/page.tsx`, `dashboard/actions.ts` (lines 203-217), `dashboard/page.tsx`, `lib/guides.ts`, `lib/requests.ts`, `lib/today.ts`, `components/guide-checks.tsx`, `components/guide-card.tsx`, `guides/[slug]/page.tsx`, `tours/[slug]/page.tsx`, `requests/[id]/page.tsx`.
- App: `apps/mobile/src/app/profile-edit.tsx`, `apps/mobile/src/lib/api-more.ts` (uploads, lines 225-262), `lib/api.ts`, `lib/api-requests.ts`, `components/guide-checks.tsx`, `components/cards.tsx`, `guide/[slug].tsx`, `tour/[slug].tsx`, `request/[id].tsx`. `welcome.tsx` has no document upload today.

Facts that shape the design:

1. Postgres fires BEFORE triggers on one table in **alphabetical order of trigger name**. On `guides` today: `guides_guard_admin_fields`, `guides_sample_guard`, `guides_updated_at`. Any new trigger that must see the final row has to sort after them.
2. About 15 policies and functions decide "is this guide open for business" with `verification_status = 'approved'` alone: "Read guides", "Read approved packages of approved guides", "Travellers start conversations with approved guides", "Travelers request calls with guides who offer them", `private.lead_target_ok`, `private.can_offer`, the group-trip creation check, the referral function in `20261016000400`, `private.on_trip_request_created` (who is told about a new request). If "stays live only with current checks" is only added to the listing queries, a paused guide can still be reached through all of these.
3. `lib/today.ts` uses the UTC date. Tanzania is UTC+3, so between 00:00 and 03:00 EAT the website and the database would disagree about "today". The database must own the date rule, and shared code must use the same Tanzania date.
4. Admin actions use `updated_at` as an optimistic version. Anything that writes `guides` as a side effect bumps that version.
5. The mobile app is not in the stores yet and the website deploys as one unit, so there are no old clients to keep working for long.

## 1. Table or columns: two tables

Recommended: **two tables**, one the guide writes and one only admins write. Columns on `guides` would need 5 kinds x (checked_at, valid_until) plus a list for "other", and they cannot keep a history of renewals.

### 1a. `public.guide_documents` (the guide's uploads, private)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| guide_id | uuid not null, fk guides on delete cascade | |
| kind | `public.guide_document_kind` not null | enum: `identity`, `guide_licence`, `first_aid`, `wfr`, `driving_licence`, `other` |
| title | text | required for `other` (2-80 chars), null for the rest (check constraint) |
| path | text not null | object in the `verification` bucket; first folder must be the owner's user id (checked in the guard trigger against `guides.owner_id`) |
| uploaded_at | timestamptz not null default now() | forced to `now()` by the guard for non-trusted sessions |
| removed_at | timestamptz | set when the file is deleted under the retention rule (legal step 1d); the row and dates stay |

RLS: owner and admin select; owner inserts for their own guide; no update by the owner (rows are immutable, a renewal is a new row); owner may delete a row only while no check points at it (`not exists` a check with `document_id = id`); admins do everything. Index on `(guide_id, kind, uploaded_at desc)`.

### 1b. `public.guide_document_checks` (what Kwetuly looked at, admin-only writes)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| guide_id | uuid not null, fk guides on delete cascade | |
| kind | `guide_document_kind` not null | |
| title | text | same rule as above; for `other` this is the certificate name shown to travellers ("Mountain rescue course") |
| document_id | uuid fk guide_documents on delete set null | the file looked at |
| checked_at | timestamptz not null default now() | |
| valid_until | date | **required** for `guide_licence`, `first_aid`, `wfr`, `driving_licence` (check constraint); optional for `identity` and `other` |
| ended_at | timestamptz | null = current record of that kind. Set when a newer check replaces it, or when an admin withdraws it |
| end_reason | text | `renewed` or `withdrawn` (check constraint); expiry is not stored, it follows from the date |
| reminder_sent_at | timestamptz | 30-day reminder sent (system only) |
| expired_notice_at | timestamptz | "expired, profile paused" notice sent (system only) |

Constraints: `valid_until >= checked_at::date`; `valid_until <= checked_at::date + 15 years` (typo guard); one current row per kind: unique partial index on `(guide_id, kind) where ended_at is null and kind <> 'other'`, and on `(guide_id, lower(title)) where ended_at is null and kind = 'other'`.

Insert trigger (BEFORE, security definer not needed, admin session): refuse `valid_until < private.tz_today()` (no recording an already expired document as current); set `ended_at = now(), end_reason = 'renewed'` on the previous current row of the same kind (same title for `other`).

RLS: insert/update/delete only `private.is_admin()` (and the service role). Select: admins all rows; the owner their own rows; anon and authenticated the **public rows** defined in section 3.

### 1c. `public.guide_check_log` (admin-only audit)

`id, guide_id, check_id, action ('checked','withdrawn','renewed','sample_set','sample_cleared'), actor uuid, note text, created_at`. Written by an AFTER trigger on `guide_document_checks` (actor = `auth.uid()`) and on `guides.is_sample` changes. RLS: admin select only; no client writes. This is where "who checked" lives, so the checks table carries no `checked_by` column that could leak.

### 1d. `guides.drives_guests boolean not null default false`

Set by the guide ("I drive guests"), separate from `has_vehicle`. Not admin-guarded. Turning it on without a current driving licence check pauses the profile (section 3). Turning it **off** while approved notifies admins (`guide_drives_changed`, same pattern as `link_changed`), because a guide-driver could switch it off to get back online.

### 1e. `guides.live_until date` (computed, nobody writes it)

The date until which the guide's required checks are all current, or null if one is missing. Computed in a BEFORE trigger from the checks table; `'infinity'` when nothing required has an end date (only possible if all required kinds are dateless, which they are not). Because it is a **date and not a flag**, expiry needs no job: the read rules compare it with today, so a guide drops off on the day a check expires even if the cron job fails.

`private.guide_live_until(p_guide uuid, p_drives boolean) returns date` (security definer, `set search_path = ''`, execute revoked from public/anon/authenticated):

```
least(
  max(valid_until) of current guide_licence checks,
  max(valid_until) of current first_aid or wfr checks,          -- the later of the two
  case when p_drives then max(valid_until) of current driving_licence checks else 'infinity' end,
  case when <identity required> then (current identity check exists ? coalesce(valid_until,'infinity') : null) else 'infinity' end
)
```

`least()` ignores nulls in Postgres, so the function must return null explicitly when any required part is missing. "Current" here means `ended_at is null`.

Kept up to date by:
- trigger `guides_y_live_until` BEFORE INSERT OR UPDATE on `guides`: `new.live_until := private.guide_live_until(new.id, new.drives_guests)`. This also overwrites any value a client sends, so no guard is needed.
- trigger AFTER INSERT/UPDATE/DELETE on `guide_document_checks`: `update public.guides set live_until = null where id = <guide>` (the BEFORE trigger recomputes it). Side effect: `guides.updated_at` changes. The admin action must re-read the version after saving checks (it already does this for ticks today).

## 2. The approval gate

### 2a. `private.tz_today()`

`select (now() at time zone 'Africa/Dar_es_Salaam')::date`, stable. Used everywhere the database compares a check date with today. Shared code gets the same rule (`todayInTanzania()`), and `apps/web/src/lib/today.ts` switches to it.

### 2b. `private.guide_is_live(status review_status, is_sample boolean, live_until date) returns boolean`

Plain SQL, stable, inlinable:
`status = 'approved' and (is_sample or live_until >= private.tz_today())`.
Every policy and function in fact 2 above switches from `verification_status = 'approved'` to `private.guide_is_live(g.verification_status, g.is_sample, g.live_until)`.

### 2c. Trigger `guides_z_live_gate` BEFORE INSERT OR UPDATE on `guides`

Named to sort after `guides_guard_admin_fields`, `guides_sample_guard`, `guides_updated_at` and `guides_y_live_until`, so it sees the final `is_sample` and `live_until`. A comment in the migration says the name order matters.

Fires when the row becomes "approved and not a sample", meaning `new.verification_status = 'approved' and not new.is_sample` and the old row was not (insert, pending to approved, rejected to approved, or `is_sample` true to false while approved). Then:
- if `new.live_until is null or new.live_until < private.tz_today()`: `raise exception 'guide_checks_missing' using errcode = 'P0001', detail = <list of missing kinds>`.

Applies to every session, including admins, the service role and the SQL editor (only `alter table ... disable trigger` gets around it, which is visible and needs the owner role). Samples are exempt **[W1-5]**.

It does not fire for a guide who is already approved: those are handled by the read rule (2b), so a lapse pauses them without changing their approval. "Paused" is therefore derived, never stored: approved, not a sample, `live_until` null or past.

### 2d. Identity **[W1-1]**

Recommended: keep it required (it ties the licence to the person). It is one boolean in `guide_live_until`; I suggest a constant in the function, not a settings table. If Walter drops it, only that function and the shared mirror change.

### 2e. Admin side

`reviewGuide` and approve-all keep a server check so the admin gets a readable error, but they call the shared `liveReadiness()` (section 5) instead of the two column tests, and they catch `guide_checks_missing` from the database as the same error. Approve-all filters on `live_until >= today` instead of `.not('identity_checked_at', ...)`.

## 3. Public read rules (staying live)

- "Read guides": `private.guide_is_live(verification_status, is_sample, live_until) or owner_id = auth.uid() or private.is_admin()`. Link-only guides keep working as today (visibility is a listing filter).
- Listing and profile queries (web `lib/guides.ts` four queries, app `lib/api.ts` lines 58, 71, 137, 414) add `.gte('live_until', todayInTanzania())` **or** rely on RLS. Recommended: rely on RLS for safety and keep the explicit `verification_status` filter for readability; but samples have `live_until` null, so a client-side `.gte` would hide them. Use RLS only, no client date filter.
- Embedded guides (tours, requests, trips) are already filtered by RLS on `guides`, so a paused guide disappears from those joins. The UI must treat `guides: null` on an offer or tour as "guide not available" (it mostly does today for unapproved guides; to be tested).
- Existing conversations, booked trips and payments are not cut off: only the "start new" policies change. A traveller with a confirmed trip can still message a paused guide. **[open question Q3]**
- Public check rows: select policy for anon and authenticated on `guide_document_checks` with `ended_at is null and (valid_until is null or valid_until >= private.tz_today()) and exists (guide where guide_is_live(...) and not is_sample)`. Column privileges: `revoke select on guide_document_checks from anon, authenticated; grant select (id, guide_id, kind, title, checked_at, valid_until, ended_at) to anon, authenticated;` Admin-only columns (`document_id`, reminder columns) are read by admins through a narrow security definer function `private.admin_guide_checks(p_guide)`, or the admin pages use the service-role client already used for signed URLs. No view, so no "security definer view" advisor warning, and PostgREST can embed `guide_document_checks(kind, title, checked_at, valid_until)` from `guides` through the foreign key. Clients must list columns (no `*`).

## 4. Uploads: a renewal no longer clears a check **[W1-4]**

- Web `dashboard/actions.ts` lines 203-217 and app `api-more.ts` lines 240-258 stop writing nulls to the check columns. They insert a `guide_documents` row instead (path in `<user id>/guide-<kind>-<timestamp>.<ext>`, same bucket and limits).
- Document status for the guide, per kind: `checked` (current check, no newer upload), `checked_renewal_waiting` (current check plus a newer upload), `expiring` (current, 30 days or less left), `waiting`, `missing`, `expired`.
- The admin "waiting" counter (`admin/page.tsx` lines 79-126) becomes: a latest document per kind that is newer than the current check of that kind.
- Storage: no new bucket. The "Owners delete their verification documents" policy and the account-deletion cleanup already cover the bucket. The retention rule (delete the image a set time after the check, keep the dates) is a later cron job once legal answers; `removed_at` and `document_id on delete set null` are there for it.
- `guard_guide_admin_fields` keeps protecting the old columns until they are dropped; the "may clear" branch becomes dead code and goes in the drop migration.

## 5. Expiry reminders (pg_cron)

`private.guide_check_reminders()` (security definer, revoked from clients), scheduled `select cron.schedule('guide-check-reminders', '0 3 * * *', ...)` = 06:00 EAT, next to the existing `flush-notifications` job:
- current required checks with `valid_until <= tz_today() + 30` and `reminder_sent_at is null` (`<=` so a missed day still sends): `notify_user('guide_check_expiring', owner, {kind, title, valid_until, link:'/dashboard'}, guide_phone)` and `notify_admins` with the same payload; set `reminder_sent_at`.
- current checks with `valid_until < tz_today()` and `expired_notice_at is null`: `guide_check_expired` to guide and admins, saying the profile is paused until a new document is checked; set `expired_notice_at`.
- samples are skipped.
- A new check row starts with both columns null, so the next renewal gets its own reminders.
- `drives_guests` switched on without a driving licence check: immediate `guide_paused` notice from the trigger (not the job).
- The `notify` Edge Function (`supabase/functions/notify/index.ts`) needs English and Kiswahili text for `guide_check_expiring`, `guide_check_expired`, `guide_paused`, `guide_drives_changed` (admins, English). Text only, no document images or links to files.

## 6. Moving the existing checks

In the data migration, inside one transaction, for non-sample guides:
- `guide_private.id_document_path`, `license_document_path`, `first_aid_document_path` become `guide_documents` rows (`uploaded_at` = `guide_private.updated_at`, the best date we have).
- `identity_checked_at` becomes an `identity` check (no end date), linked to that document.
- `licence_checked_at`: today there is **no licence expiry on record**, and the new constraint requires one. **[W1-2]** Two choices:
  - A (recommended, matches the plan's "pause"): do not migrate licence checks; the admin re-enters each one with the date printed on the card. The guide is paused until then.
  - B (grace): migrate with `valid_until = <grace date>` (for example 30 days after go-live) and an `end_reason`-free row marked in the log as `migrated`. Travellers would then see "valid until {grace date}", which is not the card's real date, so B also needs the card line hidden for migrated rows. I advise against B for honesty.
- `first_aid_checked_at` with `first_aid_valid_until`: migrate as `first_aid` checks. Without a date: same choice as the licence.
- Before applying: backend-engineer's read-only counts (1a) tell Walter how many approved guides pause under A.
- Old columns stay one release, unused by the code, then a later migration drops them, the old guard lines, and `guide_private` path columns.

## 7. `is_sample`

- Owners cannot change it today: `guard_guide_sample` resets it for non-trusted sessions on insert and update. No change needed for that.
- Admins can, and the gate exempts samples, so marking a real guide as a sample would bypass the checks. It cannot mislead travellers (every sample page says "Sample guide") but it is an admin-power risk. Add: the `guide_check_log` entry and an admin notice on any `is_sample` change of a row with an owner. Clearing `is_sample` on an approved guide runs the gate (2c), so a sample cannot become a real listed guide without checks.
- "Walter Mushi" (W2): if it is owned by Walter's account, setting `is_sample = true` puts it in the pre-launch "delete all samples" step. Separate decision for Walter (plan W1-6).

## 8. Shared code (`packages/shared/src/guide-checks.ts`)

Replace the column-based types with:
- `GUIDE_DOCUMENT_KINDS`, `type GuideDocumentKind`, `REQUIRED_KINDS` (with the identity flag), `DATED_KINDS`.
- `type PublicCheck = { kind; title: string | null; checked_at: string; valid_until: string | null }`.
- `todayInTanzania(now = new Date()): string` (yyyy-mm-dd, UTC+3; Tanzania has no daylight saving).
- `currentChecks(checks, today)`: not ended, not expired; display order identity, licence, first aid, WFR, driving licence, others by title.
- `liveReadiness({ checks, drivesGuests, isSample }, today)`: `{ ready, liveUntil, missing: GuideDocumentKind[] }`. Must give the same answer as `private.guide_live_until`; the tests list the cases side by side with the SQL test cases below.
- `documentStatus(latestUpload, currentCheck, today)` with the six states in section 4.
- `profileCompletion`: licence required; first aid **or** WFR required; driving licence required when `drives_guests`; identity required **[W1-1]**; others optional.
- Badge: `hasLicenceAndFirstAidCheck(checks, today)` (licence plus first aid or WFR, current) replaces `hasIdAndLicenceCheck`. Callers still require approved and not sample. Dictionary key `guides.idLicenceChecked` gives way to `guides.licenceFirstAidChecked` ("Licence and first aid checked"; "ID, licence and first aid checked" only if Walter wants the ID named). Keep the old export one release as a deprecated alias to avoid breaking the screens the other engineer is editing.
- Remove `GuideCheckFields`, `guideChecks`, `hasRecordedCheck` once the screens are moved.

## 9. Migrations (drafts in step 2a; none applied without Walter)

| # | File | Contents | Destructive? |
| --- | --- | --- | --- |
| 1 | `2026111000000_guide_document_tables.sql` | enum `guide_document_kind`; `guide_documents`, `guide_document_checks`, `guide_check_log` with constraints, indexes, RLS, column grants, guard and insert triggers; `guides.drives_guests`; `private.tz_today()` | No |
| 2 | `2026111000100_guide_live_until.sql` | `guides.live_until`; `private.guide_live_until()`; triggers `guides_y_live_until` and the AFTER trigger on checks; `private.guide_is_live()`; `guides_z_live_gate`; `guide_drives_changed` and `is_sample` log/notice triggers | No (but approving starts to need checks) |
| 3 | `2026111000200_guide_checks_backfill.sql` | copies documents and checks per section 6 (choice A or B); read-back counts as `raise notice` | No (copies only) |
| 4 | `2026111000300_guide_live_read_rules.sql` | replaces "Read guides", packages read, conversation and call creation policies, `lead_target_ok`, `can_offer`, group-trip check, referral function, `on_trip_request_created`, `on_guide_changed` with `guide_is_live` | **Yes, for visibility**: approved guides without current checks disappear at once. Apply only together with the code release (W3) |
| 5 | `2026111000400_guide_check_reminders.sql` | `private.guide_check_reminders()`, cron schedule | No |
| 6 | later: `2026112xxxxxxx_drop_old_guide_check_columns.sql` | drops the four check columns on `guides`, the three path columns on `guide_private`, the old guard lines | **Yes** (drops columns). Only after a release reads the new tables, with Walter's OK and a backup |

Each file states its undo at the top, like the existing migrations. Migration timestamps are placeholders; use the day they are written. After applying to a branch or local database: `get_advisors` (security and performance), and the test list in section 11.

## 10. Screens touched

Files marked * are being edited by another engineer on this branch right now (dictionaries and some app/web files): coordinate before changing them.

Website (`apps/web/src`):
- `app/[lang]/dashboard/page.tsx` and `dashboard/actions.ts`: upload cards for licence, first aid, WFR (alternative), driving licence (shown when "I drive guests" is on), "Add another certificate" with title; status per section 4; "I drive guests" toggle; a "Your profile is paused until we check {document}" banner.
- `app/[lang]/admin/actions.ts`: `reviewGuide` writes check rows (one card per document, valid-until required for dated kinds), withdraw a check, approve uses `liveReadiness` and the database error; approve-all filter.
- `app/[lang]/admin/review/page.tsx`, `admin/all/page.tsx`: one check card per document (open file, valid-until, tick, title for others).
- `app/[lang]/admin/page.tsx`: waiting counter; new queue "Expiring in 30 days / expired / paused".
- `lib/admin-queue.ts`: `guideReadiness`, `packageReadiness` ("Guide live, licence checked"), new `GuideRow` fields.
- `lib/guides.ts`, `lib/requests.ts`: select `drives_guests`, `live_until` and embedded `guide_document_checks(...)` instead of the four columns.
- `lib/today.ts`: Tanzania date.
- `components/guide-checks.tsx`: checks card lines for WFR, driving licence, other certificates.
- `components/guide-card.tsx`*, `app/[lang]/guides/[slug]/page.tsx`*, `app/[lang]/tours/[slug]/page.tsx`*, `app/[lang]/requests/[id]/page.tsx`*: new badge function and label.
- Not touched: `admin/operators/*`, `operators/[slug]` (operator `licence_checked_at` is a different table).

App (`apps/mobile/src`):
- `app/profile-edit.tsx`*: same upload cards, toggle, statuses and paused banner as the web dashboard.
- `lib/api-more.ts`: insert `guide_documents` rows, stop clearing checks; load documents and current checks for the owner.
- `lib/api.ts`, `lib/api-requests.ts`: new columns and embed.
- `components/guide-checks.tsx`, `app/guide/[slug].tsx`*, `components/cards.tsx`*, `app/tour/[slug].tsx`*, `app/request/[id].tsx`*: badge and checks card.
- `app/welcome.tsx`: no change needed (no uploads there today); the plan mentions it only if guide sign-up gets a documents step later.

Shared and server:
- `packages/shared/src/guide-checks.ts`, `packages/shared/src/shared.test.ts`, dictionaries* (7 languages traveller texts, en/sw guide texts).
- `supabase/functions/notify/index.ts`: four new events.
- `docs/operations/admin-queues.md` (operations-manager, step 1c).

## 11. Test cases

Database (run on a Supabase branch or local stack, as admin, guide and anon sessions):
1. Admin approves a pending guide with no checks: refused with `guide_checks_missing`, also from the SQL editor as `postgres`.
2. Licence plus first aid current, not a driver, identity current: approve succeeds.
3. Licence plus WFR (no first aid): succeeds. Licence only: refused.
4. `drives_guests` on, no driving licence: refused; with a current driving licence: succeeds.
5. Approved guide turns `drives_guests` on without a driving licence: disappears for anon at once, owner and admin still see it; guide gets `guide_paused`.
6. Licence `valid_until` = yesterday (EAT): anon cannot read the guide, its packages, start a conversation, request a call, send an enquiry; the guide cannot make offers. Today (EAT) at 02:00 UTC+3 boundary: the guide is live until the end of the EAT day.
7. Guide uploads a renewal: current check stays, guide stays live, admin queue shows "renewal waiting".
8. New check of the same kind ends the previous one (`end_reason = renewed`); two current checks of one kind are impossible.
9. Check with `valid_until` in the past, or before `checked_at`, or 20 years ahead: refused. Licence check without a date: refused.
10. Guide session tries to insert or update `guide_document_checks`, set `live_until`, set `is_sample`, or set `verification_status`: no effect or refused.
11. Anon reads `guide_document_checks`: only kind, title, checked_at, valid_until of live non-sample guides; `select *` and `document_id` fail; ended and expired rows invisible; rows of paused guides invisible.
12. Guide inserts a `guide_documents` row with a path in another user's folder: refused. Deletes a document that a check points to: refused; an unchecked one: allowed.
13. Sample guide approved with no checks: allowed and listed. Admin clears `is_sample` on it: refused while approved without checks. Admin sets `is_sample` on a real guide: allowed, logged, admins notified.
14. Reminder job: check expiring in 30 days sends once to guide and admins; run twice, still once; expired check sends one "paused" notice; samples get nothing.
15. Backfill: counts of documents and checks match the old columns; migrated identity and first aid dates equal the old ones.
16. Existing conversation with a paused guide still works; a new one is refused.
17. Advisors: no new security warnings (no definer view, every new function has `search_path = ''`, execute revoked where it should be).

Shared (`npm test --workspace packages/shared`):
18. `liveReadiness` for each case 2-6 and 13 gives the same result as the SQL.
19. `todayInTanzania` at 21:30 UTC returns the next day.
20. `documentStatus` gives each of the six states.
21. `profileCompletion`: first aid or WFR counts; driving licence required only when driving.
22. Badge true only with current licence plus first aid or WFR.

Screens (qa-tester, web and app, 7 languages for traveller texts, en and sw for guide texts):
23. Sign-up to live: guide uploads, admin enters dates and ticks, approves; profile, card badge and checks card appear.
24. Renewal: upload, profile stays live, admin checks the new one, new date shown.
25. Expiry: move a test check's date into the past; profile gone from lists, link shows "not available", dashboard shows paused and why.
26. Guide-driver toggle on and off, with and without a driving licence.
27. Other certificate with title shows as "{certificate} seen {date}".
28. Approve-all skips guides that fail the gate; single approve shows a clear error.
29. Offer or tour whose guide is paused shows no broken card.

## 12. Open questions for Walter

- Q1 **[W1-1]** Keep the ID check as required? (Recommended yes; badge text can still leave it out.)
- Q2 **[W1-2]** Existing licence checks have no expiry date on record. Pause those guides until the admin re-enters the card's date (recommended), or a grace period?
- Q3 A paused guide: may travellers with an existing conversation or confirmed trip keep talking to them? (Recommended yes; only new contact is blocked.)
- Q4 A guide licence or certificate with no printed expiry date: what should the admin enter? Proposal: check date plus 12 months, so it is looked at again yearly. Needs to be true on the traveller card, so the line would read "seen {date}, check again {date}" for these.
- Q5 Should the ID check show to travellers at all? It does today ("ID checked"); the new card would list it only if Walter wants.
- Q6 Retention of document images (delete after N days, keep dates) waits for legal (1d); the design is ready for it.
