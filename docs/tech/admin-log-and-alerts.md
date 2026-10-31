# Admin action log and admin alerts (draft, 2026-10-31)

Part of the 2026-10-31 "Admin dashboard" plan in `docs/team/board.md` (step 1c, phase 2). Nothing here is applied. Every live database change waits for Walter, and comes after the two waiting migrations (`20261030000000_profile_link_checks.sql`, `20261030000100_order_alerts_to_owner.sql`).

## 1. Admin action log

Draft migration: `supabase/migrations/20261031000000_admin_action_log.sql`.

**What gets logged.** One row each time the approval status changes on a guide (`verification_status`), a business (`providers.verification_status`), a guide package (`status`), a group trip (`status`) or a job (`status`). Each row records when it happened, who did it (`actor_kind`, plus `actor_id` for admins only), which kind of item and which row, the status before and after, an action (`approved`, `rejected`, `sent_back` or `other`), a reason and a batch id.

**How rows get written.** `AFTER UPDATE` triggers on the five tables call one `SECURITY DEFINER` function, `private.log_status_change()`. That means:
- Every path is logged: today's per-item admin actions, a future batch approve, the app, the SQL editor and cron. Phase 1 can go live first, and the log starts recording as soon as the migration is applied, with no code change.
- The browser and the app never write the log. Who did it comes from the JWT (`private.is_admin()`, `auth.uid()`), not from anything the client sends.
- The triggers run after the guard triggers. So a change a non-admin is not allowed to make has already been undone before the log sees the row, and it is never logged.
- The triggers have no `UPDATE OF status` list on purpose. When an owner edits an approved package, the guard moves it back to pending by itself, and `UPDATE OF` would miss that change. Those rows are logged as `owner` / `sent_back`.

**Who did it.**
- `admin`: a two-step admin session. Their user id is kept.
- `owner`: a signed-in non-admin, for example a package going back to pending after an edit. No user id is kept, because the owner is already the row's owner and ordinary users' ids do not belong in an admin log.
- `system`: the service role, cron or the SQL editor. Admin actions must therefore keep using the signed-in user's client (`createClient()` in `apps/web/src/lib/supabase/server.ts`) and never the service role, or the change is not tied to a person.

**Reason and batch id.** These are optional request headers that an admin server action can send. PostgREST exposes them to the trigger in `request.headers`:
- `x-admin-batch`: one `crypto.randomUUID()` per "Approve selected" click.
- `x-admin-reason-b64`: the admin's note, encoded as base64 of UTF-8, because header values must be ASCII and a note may be in Kiswahili or Chinese.

They are read only when the actor is an admin. They are labels only and grant nothing. A bad value is stored as null and the approval still goes through. For packages, `review_note` is used as the reason when no header is sent. The web side needs a small change: `createClient({ headers })`, or a second helper that passes `global.headers` to `createServerClient`. Until that change exists, rows are still written, just without reason or batch id. **To verify on localhost:** that the Supabase gateway passes custom `x-` headers through to `request.headers`. If it does not, fall back to a `SECURITY INVOKER` RPC in `public` that runs `set_config('kwetuly.batch_id', ..., true)` and then the updates in the same transaction.

**Append-only.**
- There are no insert, update or delete policies, and table privileges are revoked from `anon` and `authenticated`. Only `SELECT` is granted, and only rows passing `private.is_admin()` are returned.
- A trigger refuses `UPDATE`, `DELETE` and `TRUNCATE` for every role, including the service role.
- There are no foreign keys, because a cascade from a deleted account or listing would have to change log rows. A `target_id` can point at a row that no longer exists; the page shows it as "deleted".

**Read on the website.** On a phase-2 "History" tab, an admin server component selects from `admin_action_log` and joins names on the server with the admin's own client. Batches are grouped by `batch_id`, as in "18 approved by Walter, 31 Oct 10:14".

**Follow-ups, not in this draft.** The same table and function could cover other admin actions by adding a `target_kind` and a trigger for each:
- guide document ticks (`identity_checked_at`, `licence_checked_at`)
- badges (`providers` badge fields)
- `payments.payout_done` (payments-engineer first)
- `profiles.role` (log only changes made by admins, since onboarding sets the role once)
- `profiles.phone_verified_at` set by an admin
- `guide_reviews.hidden`
- featured media

## 2. Admin alerts page (design, next migration after the log)

**Today.** Admin alerts go only by email and WhatsApp:
- `link_changed` (from `20261030000000`)
- `guide_pending`
- `job_pending`
- `interest_*`
- `lead_for_admin`

`private.notify_admins()` writes them to `notification_outbox`. One alert becomes up to two rows per admin (email and WhatsApp), and each row holds `recipient`, an email address or phone number. The outbox has RLS with no policies and has to stay that way. A select policy for admins would also expose `recipient`, and the `contact` and `message` fields inside `lead_for_admin` and `interest_*` payloads.

**Proposal.** Add a separate table, `public.admin_alerts`, with one row per alert, not per admin or channel:

| column | notes |
| --- | --- |
| `id`, `created_at` | |
| `event` | `link_changed`, `guide_pending`, `job_pending`, `business_pending`, `package_pending`, `interest`, `lead_for_admin`, ... |
| `ref_kind`, `ref_id` | the item the alert is about (guide, business, package, job, lead) |
| `summary` | jsonb built from an **allow-list** of keys only: `kind`, `name` (public guide or business display name), `changes`, `before`, `after` (public profile links), `guide`, `region`, `title`, `company`, `section`, `item`, `lead_id`, `link` |
| `handled_at`, `handled_by` | the only fields admins may change |

- **Writer.** `private.notify_admins()` is replaced, keeping the same signature, so that it also inserts one `admin_alerts` row with `summary := p_payload` filtered to the allow-list. Every existing trigger then feeds the page with no other change. Never copied: `contact`, `phone`, `email`, `message`, `recipient`, `traveler_*`, or anything not on the list. The `lead_for_admin` admin loop in `on_lead_created()` (from `20261030000100`) calls `notify_user` directly, so it needs the same one-row insert added.
- **Access.**
  - RLS select requires `private.is_admin()`.
  - There is no insert policy; only the definer function writes.
  - Update is allowed only through a guard trigger that lets admins change `handled_at` and `handled_by`, and nothing else (`handled_by := auth.uid()` is forced).
  - There is no delete. Keeping 12 months and then purging with a cron job is a decision for legal (PDPA).
- **Contact details** never appear on this page. A lead alert shows "New enquiry for a tour" with a link. The contact is shown only in phase 3, behind "Show contact" per row, after the privacy line is live.
- **Deletion scrub.** `private.scrub_deleted_user()` deletes `admin_alerts` rows whose `ref_id` is the deleted user's guide, business or lead, or blanks their `summary`. Otherwise their display name and old links stay in the alert.
- **Backfill.** Optional, and read-only on the outbox: copy existing `link_changed` rows once, grouped by `payload ->> 'ref'` and `created_at`, through the same allow-list.
- **Page.** `/admin/alerts` lists unhandled alerts first, with a "Mark handled" button and a count tile on the admin home. Links in `before` and `after` are shown as plain text, not clickable, unless they pass the shared `normaliseSocial` / `normaliseWebsite` check again.
- **Alternative considered.** A `SECURITY DEFINER` RPC over the outbox that strips contact details. Rejected because it would need a function in the exposed `public` schema reading a table full of contact details, one bug away from a leak, and it would show duplicate rows per admin and channel.

## 3. Batch approve: does it need a database change?

**No.** Phase 1 "Approve selected" can be built only in `apps/web/src/app/[lang]/admin/actions.ts` on the existing per-item paths. The admin's own client already passes RLS and the guard triggers (`private.is_trusted()` through `is_admin()`), and the existing notification triggers keep sending per-item notices. The server action must:

1. Re-check `getCurrentUser()` and `isAdminSession()` once.
2. Accept at most 50 ids per kind, all valid uuids, and refuse anything else.
3. Update **per item** in a loop, not with one `.in('id', ids)` per kind. The group trip guard raises an error for a traveller group without a confirmed phone, and in a single statement that error would undo the whole kind. A loop also gives the "18 approved, 2 not approved: reason" result line.
4. Make every update conditional, so a page left open cannot approve something that changed:
   - `.eq(statusColumn, 'pending')` (also makes a double tap harmless)
   - `.eq('updated_at', shownUpdatedAt)`, sent from the page. If the owner edited the item after the page loaded, nothing is updated and it is reported as "changed, look again".
   - for guides: `.not('identity_checked_at', 'is', null).not('licence_checked_at', 'is', null)` plus the other readiness rules from operations-manager
   - `.eq('is_sample', ...)` matching the page filter

   Then `.select('id')` to count what was really approved.
5. Use the approve path only. Batch approve must not save guide document ticks; those stay one at a time, and the per-item `reviewGuide` keeps doing that.
6. `revalidateTag` once per kind at the end.

The existing single-item actions do not have the `pending` / `updated_at` conditions today. Adding them is a code-only hardening worth doing in phase 1 too.

Once the log migration is applied, the same server action only adds the `x-admin-batch` header (and `x-admin-reason-b64` for rejections in phase 2). These things do need database work and belong to phase 2:
- one notice per owner per batch
- "needs more info"
- reject with a reason for every kind
- owners sending again after a rejection

## 4. Security risks

1. **Log integrity against the database owner.** Append-only holds for `anon`, `authenticated` and the service role. The `postgres` owner, or anyone with the dashboard SQL editor, can drop the guard trigger or the table. Mitigations:
   - keep the Supabase dashboard to Walter, with two-step sign-in
   - rely on backups / PITR
   - optionally export the log weekly to storage outside the database

   The log is a record of what happened, not proof against the platform owner.
2. **Service-role writes lose the person.** Any admin action moved to the service role (or to an Edge Function) is logged as `system`. Rule: admin actions use the signed-in admin client. security-reviewer checks this in each admin change.
3. **Header labels are admin-controlled.** `x-admin-batch` and `x-admin-reason-b64` are trusted only as labels written by the admin who is acting. A non-admin's headers are ignored. They cannot change who did it or what changed. The reason is limited to 500 characters with control characters removed, and is shown as plain text (no HTML) on the page.
4. **Personal data in reasons.** An admin could type a phone number or ID detail into a reason. The reason is visible to admins only, but it lasts forever in an append-only table. Rules:
   - The page warns "Do not write contact or ID details".
   - Retention, and whether rows may be purged after N years by a migration, is a question for legal (PDPA, Tanzania).
5. **Log rows outlive deletions.** Target ids, and admin ids, stay after an account is deleted. No names, contacts or messages are stored, and owner ids are not stored at all. This is the reason the log has no `target_label` column.
6. **Fail-closed approvals.** The log insert runs in the same transaction as the approval, so if it fails, the approval fails. Constraints are kept loose: statuses are free text, a bad reason or batch becomes null, and the reason is trimmed. The only remaining failure is a real database fault. QA must test approve, reject and owner edit on all five kinds on localhost.
7. **The SECURITY DEFINER function.** It uses `search_path = ''`, execute is revoked from `public`, `anon` and `authenticated`, it lives in the private schema, inserts exactly one row and returns nothing to the caller. The Supabase security advisors must show no new warning after applying.
8. **Realtime.** Do not add `admin_action_log` or `admin_alerts` to the `supabase_realtime` publication. RLS applies there too, but it is not needed.
9. **Outbox contact details.** Never add an admin read policy to `notification_outbox`. Use `admin_alerts` with the allow-list (section 2). The allow-list is a fixed key list in SQL, not "everything except contact", so a new payload key is hidden until someone adds it on purpose.
10. **User text on admin pages.** Alert names, `changes`, `before` and `after` are typed by users, so they are rendered as text only. Old and new links are not clickable unless they pass the shared link checks again.
11. **Batch approve mistakes.** Risks are approving many items at once, approving stale content, and a burst of notifications. Mitigations:
    - the 50-item cap
    - a confirm screen with the count and names
    - conditional updates on `pending` and `updated_at`
    - no batch reject in phase 1
    - Next.js server-action origin check against CSRF
    - two-step admin session (`aal2`), already required by `private.is_admin()`
12. **Untested draft.** There was no local Postgres or Supabase CLI in this session, so the SQL has only been reviewed by reading. Before Walter is asked to approve it:
    - apply it to a local or branch database
    - run the read-only checks in the migration header
    - test, as an admin, a non-admin and the service role, that insert, update, delete and truncate are refused
    - run the security advisors
