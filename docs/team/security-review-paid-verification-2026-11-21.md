# Security and privacy review: paid verification design (2026-11-21)

Reviewer: `security-reviewer`. Paper review of "Addendum 2026-11-21: paid verification" in `docs/team/design-crew-and-trip-management-2026-11.md` (lines 307-498, "A" below), `docs/team/plan-paid-verification-2026-11-21.md` ("PV"), and the migrations up to `20261108000000`. No code, database, project or account was touched. Nothing here says the design is "secure" or "compliant"; it lists what I checked and what must change.

**Verdict: OK with changes.** Migration A may be drafted once the A-scope changes below (H2, M1-M5, M11, L1, L5, L6) are written into the draft. H1 and M6-M10 belong in B, C, D and E. H3 is a gate before any real ID document or number is collected, not before drafting.

No Critical findings.

---

## High

### H1. The server must choose the price row from the subject, never from the client (C, E)
Where: A.4 (design lines 423-440), "takes the amount from `price_list` and never from the client".
Abuse: the amount comes from `price_list`, but nothing says *which* row. If checkout accepts a `price_id` (or `account_type`, or `business_type`) from the client, a guide can buy the porter row, a hotel can buy the generic `business_type = null` row when a dearer hotel row exists, and the guide then gets `covers_rank` for "porter" or a period at the wrong price. Money lost on every subscription.
Required change: checkout and `private.apply_subscription_payment()` derive `account_type`, `business_type` and `covers_rank` from the subject row (the guide, the crew member's requested highest role, the provider's `business_type`), pick the single active row by (type, most specific business type, service, period) on today's Tanzania date, refuse null amounts and `legal_hold`, and refuse if the payment's `amount_tzs` differs from that row. The client may send only the subject id, the service code and `month` or `year`. SQL test: a guide session asking for a porter price is refused.

### H2. ID document files are not reliably deleted (A)
Where: A.1 "Files" (line 378) relies on "the existing bucket cleanup". That cleanup runs in the client: `apps/web/src/app/[lang]/security/actions.ts` lines 93-99 and `apps/mobile/src/app/delete-account.tsx` lines 29-35 list `my_uploaded_files()` and remove files before `delete_my_account()`. `supabase/migrations/20261016000000_delete_my_account.sql` lines 11-12 confirm storage is not cleaned by SQL.
Harm: a failed or interrupted request, an old app build, or an admin deleting a user in the Supabase dashboard leaves NIDA card and passport images in the `verification` bucket with no owner and no row. The retention rule (`removed_at`) has no job either. With every porter, cook and driver uploading NIDA, this becomes the largest set of identity images Kwetuly holds.
Required change: a server-side sweep (scheduled Edge Function, service role) that deletes every `verification` object whose first folder is not an existing profile, every object with no `person_documents` row after 24 hours, and every object whose row is `withdrawn`, `rejected` past N days, or past the retention date (sets `removed_at`). The client cleanup stays as a fast path. Migration A adds what the sweep needs (unique `path`, index on `review_state, reviewed_at`); the sweep must exist before real documents are accepted.

### H3. PDPA 2022 gate before real identity data (all)
Where: PV 3.5 and A.1 leave retention, lawful basis and registration to "later".
Harm: collecting NIDA images and numbers (and passports) of many people without a confirmed lawful basis, a retention period, a privacy notice that names these items, registration with the Personal Data Protection Commission, and a view on cross-border transfer (Supabase and Vercel may host outside Tanzania; I did not check the project region) exposes Kwetuly and the people concerned.
Required change: no real ID document or number is accepted (test accounts and samples only) until legal confirms with the advocate: (a) registration as data controller, (b) the lawful basis per item, (c) whether storage outside Tanzania is allowed and on what terms, (d) retention periods for images, numbers, checks and the audit log. Add to the advocate pack and to gate 6.2.

---

## Medium

### M1. Owners can delete or replace the file of an accepted document (A)
Where: `supabase/migrations/20261016000000_delete_my_account.sql` lines 17-19 lets the storage owner delete any of their `verification` objects at any time; the insert policy (`20261016001800_onboarded_gate_followup.sql` lines 218-223) lets them upload again under the same name. A.1 checks that the object exists only when the row is inserted.
Abuse: after acceptance the owner deletes `{user_id}/{id}.jpg` and uploads a different image under the same name. The check stays, but the evidence the admin relied on is replaced, and a later dispute or re-review looks at the wrong file.
Required change in A: replace the storage delete policy for `verification` so the owner may delete only objects with no `person_documents` row, or whose row is `waiting` or `withdrawn` (lookup by exact path). Make `person_documents.path` unique and exactly `{user_id}/{id}.{ext}` (not only a first-folder test; `ext` from a fixed list). Note the design's `verification/{user_id}/...` includes the bucket name; storage object names do not. H2's sweep removes what owners may no longer delete.

### M2. "withdrawn" needs an owner update path the RLS plan does not have (A)
Where: A.1 `review_state` includes `withdrawn` "by the owner before review" (line 345), but A.6 (line 473) gives owners select, insert and delete-while-waiting only.
Abuse: if the drafter adds a general owner update policy to make withdrawal work, the owner can set `review_state = 'accepted'`, `reviewed_at`, `review_reason` or `removed_at` unless the guard catches every column.
Required change: pick one. Either drop `withdrawn` and use delete-while-waiting, or add `public.withdraw_my_document(id)` (security definer, acts only on the caller's `waiting` rows, sets only `review_state = 'withdrawn'`, writes the log row). No owner update policy on `person_documents`. The insert guard forces `review_state = 'waiting'`, null `review_reason`, `review_note`, `reviewed_at`, `removed_at`, and `uploaded_at = now()` for untrusted sessions; for business kinds it checks the caller owns `provider_id`.

### M3. Cipher format: bind each value to its row and field, and version both keys (A)
Where: A.1 "Encryption" (lines 371-376).
Risks: one `key_version` per row covers three ciphers, so a half-finished rotation leaves rows that say V2 holding a V1 cipher; a cipher copied from one user's row or column to another decrypts without error; the HMAC key has no version, so it cannot be rotated gradually; passport numbers are unique only per country; inconsistent input (spaces, lower case) gives different HMACs for the same number.
Required change: one self-describing value per field: `version byte || 12-byte random nonce (CSPRNG, new for every encryption, never derived from the user or the value) || ciphertext || 16-byte tag`, with associated data `subject id || field name`. Keys `IDENTIFIER_ENC_KEY_V1` and `IDENTIFIER_HMAC_KEY_V1` (32 random bytes each, base64), the active version in `IDENTIFIER_ENC_KEY_ACTIVE`. Store the HMAC key version with each hash. Normalise in `packages/shared` before HMAC and encryption (strip spaces and dashes, upper case); passport HMAC over `country || number`. Decryption fails closed with a generic error. Rotation: a one-off server script re-encrypts value by value; the old key is removed only when no value carries its version. `key_version` on the row can stay as a summary, but the version inside each value is the one that counts.

### M4. Run the crypto in one place, without the service role key on the web host (A)
Where: A.1 line 372, "web server action, or the Edge Function for the app". No web code uses the service role today (searched `apps/` for service role use: none).
Risks: two implementations (Node and Deno) and two copies of both keys plus the service role key (Vercel and Supabase). Every Next.js server action is a public POST endpoint.
Required change: one Edge Function, `identifiers`, used by both website and app. It verifies the caller's JWT with `auth.getUser(jwt)` (not by decoding only), refuses non-onboarded users, takes no `user_id` from the body for owner writes (uses the caller), checks provider ownership for a business TIN, and for the full read requires `aal = aal2`, `profiles.role = 'admin'` read from the database, and a reason. Responses carry `Cache-Control: no-store`; no request or response body is logged; errors are generic. Keys and service role only in Supabase secrets. Rate limits: owner writes (for example 10 a day) and admin full reads (for example 20 an hour, with an email alert to Walter above that).

### M5. The audit log cannot see the real actor when the service role writes (A)
Where: A.1 `person_check_log` "triggers write" with `actor` (line 355); identifiers are written by the service role (line 375).
Risk: under the service role `auth.uid()` is null, so `identifier_set` and `identifier_viewed` rows would have no actor, and a crash after decrypting but before logging gives an unlogged read. Opening a file is not logged at all: the action list has no `document_opened`.
Required change: `private.log_identifier_event(p_subject, p_field, p_action, p_actor)` (security definer, execute only for `service_role`), called by the Edge Function with the verified caller id. For `identifier_viewed` it runs **before** decryption and the read stops if it fails. Add `document_opened` to the action list and write it in the admin action that makes the 60-second link.

### M6. Crew rows must not be attachable to someone else, and crew features must need the crew role (B, D)
Where: A.2 (lines 384-390), TM 2.1 "Claiming" (`private.claim_crew_profile(code)`, line 66), A.5 `crew.*` = "owner of a crew row" (line 449).
Abuse: (a) a guide creating a crew row for an invite sets `owner_id` to another user's id; because `owner_id` is unique, that person can then never create their own crew row, and "owns" a row they never saw. (b) A traveller redeems a claim code (or an admin is talked into issuing one) and owns a crew row, so `has_feature('crew.*')` is true while `traveller.*` is also true: the mix A.2 forbids.
Required change: on insert by an untrusted session, `owner_id` must be null (guide invite); only `complete_onboarding`, `add_crew_profile` and `claim_crew_profile` set it, always to `auth.uid()`, and the last two refuse role `traveler`. `has_feature('crew.*')` requires `profiles.role in ('crew', 'guide')` and an owned crew row; `traveller.*` requires role `traveler` (plus whatever guide and business exception Walter keeps, A.8 question 4), never role `crew`. SQL tests for both.

### M7. Email sign-ups never reach the welcome step, so "crew only from complete_onboarding" breaks (B)
Where: `apps/web/src/app/[lang]/(auth)/actions.ts` lines 47-54 and `apps/mobile/src/app/sign-in.tsx` lines 147-155 send `role` and `phone` in sign-up metadata; `handle_new_user` (latest in `20261025000100_neutral_names_and_shop_identity.sql`, line 263) maps unknown roles to `traveler` and sets `onboarded_at` when a role and phone are present; `complete_onboarding` then refuses ("Account already set up").
Risk: if the sign-up form offers "crew", the account becomes a permanent traveller that A.2 says may not add a crew profile. Fixing that by hand later is where escalation paths get added.
Required change in B: when metadata asks for `crew`, `handle_new_user` creates `traveler` with `onboarded_at` null, so the welcome step runs and `complete_onboarding` sets `crew` and creates the row. Never accept `crew` as a metadata role. Existing, Low: metadata still accepts `investor`; `has_feature` must give `investor` nothing.

### M8. Guards and security definer functions (B, C, D)
Where: `private.is_trusted()` (`20261012000100_private_helpers.sql` lines 10-17) is true whenever `current_user` is not `anon` or `authenticated`, which includes the body of every security definer function. A names guards for `crew_members` (B) but not for the new columns on `guides` and `providers` (`paid_until`, `covers_rank`, `live_until`, `suspended_at`, `suspended_reason`).
Abuse: a guide sets `guides.paid_until` to 2030 if the guide guard is not extended; any new public security definer function (`add_crew_profile`, `claim_crew_profile`, `withdraw_my_document`, the new `complete_onboarding`) that writes columns from its arguments passes every guard.
Required change: C extends `guard_guide_admin_fields` and the provider guard to keep those columns from `old` for untrusted sessions. Every new security definer function writes an explicit column list, acts only on `auth.uid()`, has `set search_path = ''`, and has execute revoked from `public, anon` (and from `authenticated` for private helpers; Postgres grants execute to PUBLIC by default). SQL tests: a guide, a crew member and a business owner each try to set `paid_until`, `live_until`, `covers_rank`, `suspended_*`, `status`, `is_sample`.

### M9. Business features are per business row, not per account (D)
Where: A.5 `business.listed`, `business.orders`, `business.offers`, `business.catalogue` = "verified business (for that business row)", but `private.has_feature(p_code)` takes no row (line 444). `providers.owner_id` is not unique (A fact 2).
Abuse: an owner with one verified business and one unverified business passes `has_feature('business.offers')` and makes offers or takes orders as the unverified one.
Required change: business codes are never checked with `has_feature` alone in a policy; every business write and listing read uses `private.provider_is_verified(provider_id)` for the row in question. SQL test with one owner holding a verified and an unverified business.

### M10. Subscription activation details (C, E)
Where: A.4 `subscriptions` (lines 423-440) and A.3.
Risks: two checkouts started before either is paid both compute "the day after the current end" and overlap (the person pays twice for one period); `is_test` defaults true and the design does not say who sets it false; stored `paid_until` includes test periods, so switching `verification_payment_required` on would count them unless every reader filters; a refund does not say it recomputes `paid_until`; `payment_id` unique alone does not prove the payment is paid, is a subscription payment, or came from the subject's owner.
Required change: `apply_subscription_payment` locks the subject row, computes `starts_on` at activation (not at checkout), and checks `payments.status = 'paid'`, `kind = 'subscription'`, payer = subject owner, `amount_tzs` = the price (H1). `is_test` is copied from the payment row, set by the Edge Function from the processor environment (sandbox or live), never from the client. Store live and test paid dates separately, or compute `paid_until` from non-test rows only once payment is required. A refund sets `refunded` and the trigger recomputes. Refunds go back to the original payment method only; no balance, credit or wallet, so nothing becomes stored value.

### M11. Data minimisation and consent for NIDA and passport (A)
Where: PV 3.1 (NIDA card image, "number optional"), A.1 `method` values `nida_number` and `passport_number`.
Points: (a) a typed number alone proves nothing (Kwetuly has no NIDA or passport lookup), so a check with method `nida_number` or `passport_number` records a self-statement as a check, against the badge honesty rule; (b) the card image shows the number in clear, so encrypting the number protects little while the image is kept; (c) nothing records which privacy notice the person saw.
Required change: collect a number only for a named use (the HMAC duplicate flag; TIN for payouts). Drop `nida_number` and `passport_number` as check methods, or label them "number given, not checked" and never show them as a check line. Delete images a short, fixed time after the decision (proposal for legal: rejected and withdrawn within 30 days, accepted within 90 days; keep kind, dates and method). Add `notice_version text not null` and `consented_at` to `person_documents` and to identifier writes. Passport photo page images: refused by a check constraint until legal and Walter agree (PV 3.1 already says so).

---

## Low

- **L1. Signed links.** Existing admin pages create 600-second links at page render for every card shown: `apps/web/src/app/[lang]/admin/review/page.tsx` line 137, `apps/web/src/app/[lang]/admin/businesses-admin.tsx` line 43, `apps/web/src/app/[lang]/admin/all/page.tsx` line 355. For `person_documents` use the A.1 rule: one server action per click, 60 seconds, made with the admin's own session (so the storage select policy and its `aal2` check decide, not the service role), the `download` option for PDFs so they are not rendered inline, and the M5 log row. Move the old pages to the same rule when GC replaces their columns.
- **L2. Settings keys.** `verification_grace_days` and `verification_payment_required` live in `site_settings` (anyone reads, any `aal2` admin writes, no history). `private.grace_days()` must parse safely (default 7, clamp to 0-30) so a bad value cannot break every listing policy; log every change of these two keys with the actor.
- **L3. Admin grants.** `admin_grant_period` needs a reason, a maximum length (for example 12 months), no backdating, a log row, and refuses a grant to the admin's own subjects.
- **L4. One admin action for accept plus check.** "Accepting a document and creating its check happen in one admin action" must be one database function (one transaction), not two client calls.
- **L5. Uploads.** Photo metadata stripping in the client cannot be enforced; acceptable for private files, but the notice should not promise it. Bucket types are checked against the declared type only. Add a per-user cap on open `person_documents` rows (for example 30), since anyone onboarded can upload 15 MB files.
- **L6. Audit log on deletion.** `person_check_log` with `user_id` on delete cascade loses the record of who viewed a deleted person's number. Proposal: `on delete set null` for `user_id`; keep actor, action, field and time for the period legal confirms.
- **L7. Analytics.** PostHog captures page URLs (`apps/web/src/lib/analytics.ts` line 28). Keep identifier and document ids out of admin URLs, or turn analytics off under `/admin`.
- **L8. Old document columns.** `guide_private` and `provider_private` paths keep second copies of ID images. Plan their move into `person_documents` and the removal of the old columns, so one retention rule covers everything.

---

## Checked and found fine (on paper)

- No unique index on `_hmac`; duplicates only flagged to admins. The owner must not learn about a duplicate from any error or timing; keep it that way.
- No client grants on `person_identifiers` and `business_identifiers`; owners see only last 3, country and date through `my_identifiers()`; admins see masked values by default. Keys never in the database, Vault or the app bundle.
- Reviewer id not on `person_documents`; `review_note` masked for digit runs.
- `handle_new_user` does not accept `crew` (but see M7); `complete_onboarding` refuses a second run and `p_crew_roles` excludes `guide`.
- Feature codes are a fixed `case` in `private.has_feature`, so no admin screen can grant a feature; lapses switch off by date, with no job needed.
- Prices: no amounts seeded, null means not for sale, `legal_hold` cannot go active in one save, used rows frozen, admins write with `aal2`.
- `payment_id` unique on `subscriptions` makes a repeated webhook harmless (with M10's checks).
- No credit, pro-rating or wallet; early renewal is a prepaid period, not stored value.
- `private.is_admin()` requires `aal2` (`20261016001400_admin_two_step_business_gate_deposits_leads.sql` lines 38-50). The `verification` bucket is private, 15 MB, JPG, PNG, WebP and PDF only (`20261014000500_upload_limits.sql`).

## Not checked

- Any migration or code for A to E: none exists yet. This review must be repeated on the drafts (PV step 9) and on E (PV step 15: webhook signatures, processor adapters).
- Supabase project region, backups and their retention, and the live project's security advisors (not run).
- Storage `nosniff` and content-type behaviour for files whose declared type differs from their content.
- `apps/mobile` upload code and how it would strip metadata.
- `npm audit`.
- The legal questions under PDPA 2022 (lawful basis, registration, cross-border transfer, retention): for `legal` and the advocate.
