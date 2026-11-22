# Security review: verification file route (commit 7c700ca), 2026-11-22

By `security-reviewer`, diffed against origin/main. Saved by the main session from the reviewer's report. Scope: fixes for L2 (second half), L3 and L4 from security-review-verification-screens-2026-11-22.md.

**Verdict: OK to merge.** No Critical or High findings. M1 and M2 should be fixed or confirmed before launch.

## Medium

**M1. Older admin pages still put 10-minute signed links to ID files into the page.** `apps/web/src/app/[lang]/admin/all/page.tsx:356`, `admin/review/page.tsx:137`, `admin/businesses-admin.tsx:43` call `createSignedUrl(path, 600)` on the `verification` bucket for the older guide ID, licence, first-aid and business licence files. The links land in browser history, the opening is not logged, the bytes are not checked and the file is served with the uploader's declared type (the L3 risk). Fix: send these through the same kind of server route (two-step admin, log, byte check, same headers) and remove the `createSignedUrl` calls, or retire those flows with a date on the board.

**M2. Files over about 4.5 MB may not open on Vercel.** `route.ts:61-66` reads the whole file and returns it in one piece; uploads allow 15 MB. Vercel limits function responses to 4.5 MB (streamed responses are said to avoid this, with a conflicting community report). An admin who cannot open a valid PDF may reject a genuine guide. Fix: check the first bytes, stream the rest with the same headers, and test a 14 MB PDF on a Vercel preview; or lower the upload limit to 4 MB everywhere.

## Low

**L1. The opening is logged even when the file is then refused** (`file_missing`, `bad_file`). The log over-counts, never under-counts. Optional: log `document_open_refused`, or document that `document_opened` means "access granted".

**L2. An admin can still read any verification file directly with their own session, skipping the log** (older storage policy, `supabase/migrations/20261012000200_guides.sql:155-157`). Fix next round (backend-engineer): remove admin read from the storage policy and download with a server-only key after the RPC checks and logs; or accept and write it down.

**L3. The PDF check needs `%PDF-` at byte 0.** Some scanner files have junk first and will be refused (fails safe). Accept; if real cases appear, allow the header within the first 1024 bytes.

**L4. PDFs open in the browser's own PDF viewer.** The CSP cannot control links or forms inside a PDF; phishing links remain the risk. Keep admin browsers updated; optionally add "Never follow links or fill in forms inside a document" next to the Open button. `sandbox` in the CSP is not recommended (Chrome then refuses to show PDFs).

## Checked and found fine

- **Sign-in and two-step:** three layers — the proxy (`apps/web/src/proxy.ts:66-87`), the route's own `getCurrentUser()` + `isAdminSession()`, and `private.is_admin()` (aal2) in `admin_log_document_opened`; the download uses the admin's own session.
- **Origin and CSRF:** POST only (GET 405); `Sec-Fetch-Site: same-origin`, else Origin must match Host; missing or null Origin refused; refusal happens before any user check; session cookies are Lax.
- **No signed link or path reaches the browser:** `openDocument` removed with no callers left; fixed file name `document.{ext}`; `Referrer-Policy: no-referrer`.
- **Byte check:** type from first bytes only (JPEG, PNG, WebP, `%PDF-`); declared type ignored; polyglots are served with the fixed type plus `nosniff`; SVG and HTML cannot pass; tests cover look-alikes.
- **Headers:** `no-store`, `inline`, `nosniff`, `default-src 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, `base-uri 'none'`, CORP same-origin, `noindex`; no scripts or connections allowed.
- **Error redirects:** 303 with a relative address, allowed locales only, fixed codes only, id added after the UUID check. No open redirect.
- **Coming-soon gate:** a POST without the team cookie is rewritten to /coming-soon; a non-admin never reaches the route.
- **Logging before serving:** the RPC writes the log and returns the path in one call; removed documents are refused.
- **Notice version:** `privacy-2026-11-b` fits the database pattern `^[A-Za-z0-9._-]{1,40}$` and the Edge Function's NOTICE regex; website and app share the constant; older rows keep `privacy-2026-11`.

## Not checked

PDF and image display under this CSP in Chrome, Edge, Firefox and Safari on desktop and mobile; the 15 MB case on Vercel; the live storage policies and advisors; whether non-Tanzanian business owners need the notice in the other five languages; mobile lint and type check (mobile changes only through the shared constant).
