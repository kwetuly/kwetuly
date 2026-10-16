Rafrika - Walter's to-do (2026-10-16)

TODAY (about 1 hour)
1. GitHub: create a free account at github.com if you don't have one, then tell Claude. Claude creates the private repo and uploads the code; you only sign in once.
2. Supabase connection: done (Claude can reach the live database; samples are hidden).
3. Supabase dashboard > Authentication: turn on "Leaked password protection" and "Secure password change".
4. Vercel: create an account at vercel.com (Pro plan, about US$20/month). Tell Claude when done.
   When the website is set up there, the hosting settings need RECOVERY_COOKIE_SECRET: a long random
   secret (at least 32 characters) that protects the "set a new password" step after a password reset
   link. Without it, password reset is switched off. Set it only in Vercel and in .env.local, never in
   chat or in the code.
5. Resend: create an account at resend.com (free) for sign-up emails. Tell Claude when done.
6. Domain: confirm you own rafrika.com (or the domain you want) and where it is registered.

THIS WEEK
7. Company details: legal name, BRELA number, TIN, address, and a privacy contact person.
8. Advocate: send docs/legal to a Tanzanian advocate. Get 2 written quotes first.
9. Data protection: ask the advocate about registering with the PDPC (Personal Data Protection Commission).
10. Trips: in /admin/trips, press Reviewed only on trips you have checked.
11. Badge fee: choose one yearly price in TSh (set it in /admin).
12. PostHog: create an EU account (free), cookieless mode on, and send the project key to Claude through .env.local, not in chat.

LATER
13. Expo account: run eas init and the app builds (Claude helps).
14. Native speakers: check the French, Italian, German, Polish and Chinese texts.
15. SMS provider for phone codes (not needed for the soft launch).
16. Merch: prices and photos before the shop comes back.
