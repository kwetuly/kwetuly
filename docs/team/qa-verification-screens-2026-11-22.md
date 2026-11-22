# QA: verification screens (branch claude/verification-screens), 2026-11-22

Commits tested: 5cb9103 (verification screens, admin documents and prices, Pay box while payments are off) and 5bf8718 (security review L1 and L2).
Tester: qa-tester. Website on localhost:3000 (Next dev). Test accounts from `supabase/test-accounts.local.md`, localhost only.

Accepted by Walter, not reported: the "Are you a Tanzanian citizen?" answer is not saved; the disabled Pay box may show on offers from not-yet-approved guides while payments are off.

## What actually ran

| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p .` in apps/web | Passed (exit 0) |
| `npx tsc --noEmit -p .` in apps/mobile | Passed (exit 0) |
| `npx expo lint` in apps/mobile | Passed (no warnings or errors printed) |
| `npm test --workspace packages/shared` | Passed: 9 files, 178 tests |
| Website /en and /sw dashboard/verification, signed in as a traveller, desktop and 375px | Ran. Loading skeleton, then "for guides and business owners" message with a My account button. No sideways scroll at 375px. Kiswahili text and tab title correct. |
| Identity number form (website, before the session restart) | Server log shows saveIdentifier returning `consent`, `empty` and `not_configured` answers, so the three error paths were exercised. |
| Admin documents page as a non-admin, crafted link `?e=Hello from a link&ok=accepted` | Ran. Redirected to the home page; nothing from the link was shown. |
| Admin documents and prices pages as an admin | Not run in the browser: admin needs two-step sign-in, which I cannot complete. Reviewed in code only. |
| App screens (verification, account rows, Pay box) in the app web preview on 8082 | Not run: the Expo web server crashed three times while starting (exit codes 3221226505 and 134, a Node crash, most likely low memory with the Next dev server also running). Reviewed in code only. Needs a run on a phone in Expo Go. |
| Document upload and withdraw, admin accept/reject/end check | Not run (no admin two-step session; upload needs a guide or owner account plus admin to clean up). |
| L2 `cacheControl: '0'` on verification uploads | Code review: present on website member upload, website DirectUpload (verification bucket only), app uploadDocument, and app businesses upload (verification bucket only). Not checked on a real upload response. |
| L1 fixed message codes on admin documents | Code review: actions only put short codes in the address; the page maps `ok` and `e` through fixed tables and ignores unknown codes. Correct. |

## Issues

| # | Severity | Page | Steps to repeat | What happened | What should happen | Suggested fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | Website /dashboard/verification (traveller) | Sign in as a traveller, open /en/dashboard/verification | The intro says "Please send the documents below. A person at Kwetuly checks each one by hand", then the card says travellers do not need to send anything. Mixed message for a first-time traveller. | Travellers see only the "for guides and business owners" message, or an intro that fits everyone. | Render the intro inside the member branch, or move it below the role check. (The app already does this: non-members only see the empty state.) |
| 2 | Medium (dev only, watch in production) | Website /dashboard/verification | Open the page several times in dev | Server took 2 to 15 seconds (application-code up to 11.9 s) before the content replaced the skeleton. A traveller on a weak connection waits a long time to learn the page is not for them. | Under 2 to 3 seconds. | Check the role first and return the traveller message before loading documents, checks and identifiers; measure again on a production build. |
| 3 | Low | Admin /admin/documents | Code review: a person with a saved passport | Passport line shows the raw date (`until 2030-01-31`) while every other date on the card uses adminDate. | Same date format as the rest of the card. | Use `adminDate(\`${ids.passport_valid_until}T12:00:00Z\`)`. |
| 4 | Low | Admin /admin/documents | Code review: more than 50 documents waiting | Heading says "Waiting (50)" because of `.limit(50)`; the admin cannot tell more are waiting. | "Showing the oldest 50" or a real count. | Add a count query (`count: 'exact', head: true`) or a note when the limit is reached. |
| 5 | Low | App verification screen | Code review: valid-until and passport expiry fields | Dates are typed as YYYY-MM-DD in a text field; easy to get wrong on a phone. Error text explains it, so not a dead end. | A date picker, or at least a clear example (the placeholder gives one). | Later: native date picker. |
| 6 | Info | App web preview | `npm run web` in apps/mobile while the Next dev server runs | Expo web server crashed during bundling (Node exit 134). | Starts reliably. | devops: check Node memory (`NODE_OPTIONS=--max-old-space-size`) on this machine. Not a product bug. |

No high or critical issues found in what ran or what I read.

## What worked well

- Clear role gate on the website and the app: travellers are told plainly the page is not for them and get a way back (My account); the app hides the Verification row from travellers.
- Kiswahili page and tab title present and natural.
- Loading skeleton (aria-busy) appears at once, so the page is never blank.
- Identity numbers: never prefilled, autocomplete off, only the last three characters shown back; "opens soon" message when the identifiers function is off, instead of a raw error.
- Honesty: paid verification buttons and the Pay deposit box are visibly disabled with "opens soon"; the admin prices grid shows "not set" in every cell, no amount is invented, and saving is disabled.
- Admin documents: one document at a time, no "approve all", file opening logged before a 60-second link, own documents blocked, reject needs a reason, accept needs the printed date for dated papers, fixed message codes in the address (L1 done correctly), non-admins redirected.
- Upload errors map to clear texts (too many, not set up, upload failed) and the app drops photo location data by re-saving the image.
- Build checks: both typechecks, app lint and 178 shared tests pass.

## Verdict

Ready with known issues, for merging to main behind the current switches (payments off, identifiers off). Fix issue 1 before guides and owners are invited to the page; issues 2 to 5 can follow. Before a public release: run the app screens on a phone in Expo Go and an end-to-end upload, admin accept and reject with a two-step admin session (test documents named "Test ... please reject", withdrawn afterwards), and confirm a rollback plan with devops.
