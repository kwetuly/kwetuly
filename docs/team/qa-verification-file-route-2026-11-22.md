# QA: verification file route (commit 7c700ca), 2026-11-22

By `qa-tester`. Saved by the main session from the tester's report.

**Verdict: ready with known issues.** Nothing blocks. Main gap: no admin test account, so opening a real file as an admin was not run.

## Checks
- tsc in apps/web and apps/mobile: passed. `npx expo lint` in apps/mobile: passed. `npm test --workspace packages/shared`: 180 passed.

## Tested on localhost:3000 (read-only)
- Signed out: admin documents page and the file route (POST and GET) go to `/en/login` (`/sw/login` for Kiswahili); cross-site Origin too.
- Signed in as the test guide (not admin): every admin page and file route request ends on the home page.
- Notice on `/en` and `/sw` dashboard/verification shows the new PDF text; it matches what the website and app actually do to photos. Other languages fall back to English. No sideways scroll at 375px.
- Admin page code: the Open button is a plain POST form with `target="_blank"`; `bad_file` text present; `openDocument` fully removed.

## Issues
1. Low: after a failed opening the error page lands in the new tab, showing a second copy of the documents page. Accept for now.
2. Low: with an ended session the proxy answers 307, so the POST is resent to `/en/login` and there is no `next` back to Documents. Fix: 303 and `next` in proxy.ts `adminOnly`.
3. Low (wording): the Kiswahili privacy sentence reads awkwardly. Suggested: "Taarifa zilizofichwa kwenye picha, kama mahali zilipopigwa, huondolewa kabla hazijatumwa."
4. Info: older admin pages still use 10-minute signed links (security M1).
5. Info: docs/team/design-crew-and-trip-management-2026-11.md line 378 still describes the old 60-second link.

## Not tested
- Opening a real JPEG, PNG or PDF as an admin, the log row, the error banners (needs an admin with two-step sign-in).
- Chrome's PDF viewer under the route's content security policy with the real route.
- The app's verification screen (Expo web server ran out of memory; the app reads the same shared text and its checks pass).
- Slow network and keyboard focus on the Open button.
