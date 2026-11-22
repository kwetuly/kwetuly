# Security review: verification screens (commit 5cb9103), 2026-11-22

By `security-reviewer`, diffed against 83ebdc9. Saved by the main session from the reviewer's report.

**Verdict: OK to merge.** Nothing Critical, High or Medium. The four Low items should be fixed before the identifiers function is switched on.

## Findings

**L1. A crafted link can put any message on the admin documents page.** `apps/web/src/app/[lang]/admin/documents/page.tsx:76-77,128-129` shows the `ok` and `error` values from the address, which `actions.ts` fills with raw database messages. React escapes the text, so there is no cross-site scripting, but someone could phish an admin with a link like `?error=Your session ended, sign in again at …`. The database messages also land in the address bar and in Vercel logs. Fix: the actions redirect with short fixed codes, the page maps each code to a fixed text and ignores unknown codes.

**L2. An opened ID file can stay in the admin's browser for up to an hour.** Uploads set no `cacheControl`, so the storage default of 3600 seconds applies. A file opened through the 60-second link may stay on disk after the link expires. The link itself (path plus token) also stays in the browser history; that part is accepted under the current design. Fix now: upload with `cacheControl: '0'` on the website and in the app. Fix next round: a server route that checks admin and two-step, logs the opening, and returns the file with `no-store`, `inline`, `nosniff` and a strict content security policy, so no signed link reaches the browser.

**L3. A file's type is only what the uploader says.** The bucket rule checks the declared type, not the bytes. A modified client could upload an HTML page labelled `image/png`, and an admin opening it from the storage address could see a fake sign-in page. Fix: the L2 server route checks the first bytes (JPEG, PNG, WebP or `%PDF-`) before serving.

**L4. PDFs keep their hidden details; "I agree" is set by the browser.** Photos are redrawn on the website and in the app, which removes location data, but PDFs are uploaded as they are. The "I agree" flag is a hidden field, so the server records which notice version was shown, not proof that the box was ticked. Fix: say in the privacy notice that PDF details are kept; optionally strip them on the server later.

**Note for backend-engineer (older code).** The storage upload rule does not limit how many files without a document row a person can upload before the hourly clean-up. A cap per folder would stop storage abuse.

## Checked and found fine

- **Admin actions:** two-step admin is checked on the server and again in the database. Ids are UUIDs and decisions, reasons and dates are checked. Self-review is blocked. The opening is logged before the link is signed with the admin's own session.
- **Redirects:** none is open.
- **Identity numbers:**
  - fields come from an allow-list;
  - no user id is sent; the Edge Function uses the token, and the database checks the owner;
  - the number is never logged, returned or pre-filled.
- **Uploads and withdrawals:** the path is built by shared code and enforced by the database. The guard checks owner, business, file, onboarding and the 30-file cap. Withdraw changes only the caller's own waiting rows.
- **"Are you Tanzanian":** kept in memory only, never sent.
- **New migration `20261122000100_my_business_identifiers.sql`:** security definer with an empty search_path. It returns the last 3 characters only, to the business owner. Execute is granted to authenticated only. Fine to apply.
- **"Show all buttons":** every disabled button is inert. Nothing starts a charge or writes data.
- **Who sees what:** travellers get no verification link, and the database rules decide in any case.

## Not checked

The live project and site, the Supabase security advisors, `npm audit`, localhost click-through, the real storage cache and nosniff headers, and an action redirect to another site's address on Vercel.
