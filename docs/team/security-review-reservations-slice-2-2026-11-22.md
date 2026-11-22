# Security review: reservations slice 2 (commit edd9053) and slice 1 fixes (a521e06), 2026-11-22

By `security-reviewer`, code reading only (SQL not run; live not queried). Saved by the main session from the reviewer's report.

**Verdict:** no Critical or High. Slice 2 can go to qa-tester and a test-project run. M1-M4 must be fixed or accepted before `feature.reservation_commission_billing` is switched on. Slice 1 findings are fixed in code except L7 (migration history repair on live, an operations step).

## Medium (supabase/migrations/20261122300000_reservations.sql)

- **M1. Under-reporting.** mark_came accepts any head count from 1 to the party size and the traveller's answer is yes/no only; mark_no_show removes commission unless the traveller answers; late cancellations are not flagged. Fix: ask the traveller how many came when the count is lower; admin view of no-show, low-count and late-cancel rates.
- **M2. A business alone can pause a traveller.** The no-show pause counts disputed no-shows, no-show is allowed one minute after start, admins can only choose completed or no_show, and an admin decision restarts the clock. Fix: skip open disputes, 30-minute grace, a "business fault" outcome, count from the reservation time.
- **M3. Spam and WhatsApp costs.** Cancelling frees slots, so requests are unlimited across businesses; fake accounts bypass the pause. Fix: caps on requests and cancellations per 24 hours, tighter for new accounts.
- **M4. Notes kept forever.** `note` (often holding health details) stays readable by the owner forever. Fix: clear it with the diet line after 30 days; tell travellers to put health details in the diet line; [legal] retention for the reservation row.

## Low

- L1 owners can read every reservations column directly (traveller id, guide id, notes); use functions or named columns.
- L2 deleted businesses are lumped into one commission row; copy a `provider_ref`.
- L3 one bad row stops the hourly job (and the 30-day deletion); catch errors per row.
- L4 a late "No" on an invoiced line alerts nobody.
- L5 waiving is final and invoiced lines cannot be waived; the error text points to a step that doesn't exist.
- L6 guide share can be self-referred via a second account; pay guide shares only after the business pays (payments-engineer, later).
- L7 different refusal leaks existence for rows of deleted travellers.
- L8 free text can go into the log; fixed codes only.
- L9 admin reads of diet lines are not logged (optional).

## Possible SQL or test problems

`reservations.business_name` 160-character limit vs `providers.business_name`; the test's `person_document_checks` insert; notify texts are English/Kiswahili only for travellers; the expired-offer text blames the business.

## Checked and found fine

RLS and no client writes on all three tables; append-only log; rate copied and immutable; commission set only by the trigger; invoiced and paid locked; billing switch off; no overflow; state machine checks role, status and time with row locks; no self-reservation; dispute logic; diet line consent, masking, visibility window and deletion; alerts carry ids only; every security definer function has an empty search_path and narrow grants; admin functions and pages require two-step sign-in and redirect with fixed codes.

## Not checked

Running the SQL and tests, the live database, the reservation screens (not committed at review time), npm audit, the Supabase advisors, the Edge Function deploy.
