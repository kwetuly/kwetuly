# Security review: reservations slices 0 and 1 (commits 4ac0dc1, 2e4d72f), 2026-11-22

By `security-reviewer`, code reading only (the SQL has not been run anywhere; the live database was not queried). Saved by the main session from the reviewer's report.

**Verdict:** no Critical or High. Slice 1 can go to qa-tester and a test run after M1 is fixed. Slice 0 does not weaken anything.

## Medium

**M1. An owner can change the business type after approval, then switch on reservations.** `guard_provider_admin_fields` (20261025000100_neutral_names_and_shop_identity.sql:377-415) leaves `business_type` editable (only 'merch' blocked) and does not send the listing back to review. An approved hotel or shop could become a "restaurant" or "salon", accept terms and take reservations as a type Kwetuly never checked. Fix: record the approved type and block when it differs, or reset approval on a type change; add a test.

## Low

- **L1.** An aal2 admin can switch reservations on by updating `providers` directly; the design says owner only. Require `old.owner_id = auth.uid()` for client callers switching on.
- **L2.** The reservation guard trusts `new.verification_status`, safe only because of trigger name order. Use `old.verification_status` for client callers.
- **L3.** Closed-date notes are public. Remove `note` from the public read, or label it "Shown to guests".
- **L4.** The public read rules on hours, closed dates and services run the full blockers check for every row (5-8 queries each). Use a cheap check; keep the full check in the slice 2 booking function.
- **L5.** `price_list_log` can be changed or deleted by server-side roles, and deleting a draft is not logged. Refuse UPDATE/DELETE on the log.
- **L6.** `/admin/prices` looks up messages with plain objects; `?e=__proto__` breaks the page (admins only, nothing leaks). Use `Object.hasOwn`.
- **L7.** Three hand-pasted migrations are missing from live's migration history; a future `supabase db push` would fail. Fix with `supabase migration repair --status applied <version>` after Walter agrees.
- **L8.** Signed-out callers can probe whether a service id exists through `reservation_rate`. Optional: require the business to be open for reservations.
- **L9 (for slice 2).** Commission depends on prices the owner sets. Slice 2 must copy the price, rate kind and `price_list_id` into the reservation at request time.

## Possible test-file problems

The providers insert may miss NOT NULL columns; direct writes to `person_document_checks` may hit a guard; the ">= 7 logged" check passes trivially. Missing tests: another owner updating or deleting services and closed dates, owner changing `provider_id`, the M1 case, and the L1 case.

## Checked and found fine

RLS and owner-only writes on the five new tables; column grants (no changing `provider_id`, closed dates only from today to 366 days); `price_list` has no client writes and hides admin columns; terms acceptance is server-time and owner only and cannot be faked through the table; the switch is checked in a trigger for every caller and re-checked at read time; every security definer function has an empty search_path and narrow grants; admin price changes need aal2 in the action and the database, are logged, cannot edit active rows and cannot be backdated; admin price redirects carry fixed codes only; `reservation_rate` returns no sensitive data; slice 0 files are idempotent and keep `payments_live` off.

## Not checked

The live database (including that it matches slice 0), running the SQL, npm audit, the owner screens, and slice 2.
