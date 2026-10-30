# Team board

Kept by `chief-of-staff`. Walter approves everything in "Waiting for Walter".

Goal (set 2026-10-16): a soft launch. The website goes live on a real domain for invited guides and travellers. Deposits stay off until Selcom is ready, and no sample data is shown.

## Waiting for Walter
- 2026-10-30 DECIDED: Walter said yes to all 7 recommendations below. Research started: payments-engineer, legal, tech-lead (then hr and business-manager). Moved out of waiting once the research is back.
- 2026-10-30 WAITING: research is back (docs/tech/post-launch-catalogue-lessons-payments-plan.md, docs/legal/lessons-payments-items-research.md, docs/business/payments-research-2026-10-30.md, docs/business/new-ideas-business-view-2026-10-30.md, docs/team/teacher-code-of-conduct.md, docs/legal/interim-privacy-notice.md, docs/devops/facebook-sign-in-setup.md). Decision list sent to Walter 2026-10-30. Walter is doing the Google sign-in clicks now; Facebook decided yes (reverses "skip Facebook"); iPhone hides Google/Facebook until Apple is on (code done).
- 2026-10-29: Three new ideas (online teachers, more ways to pay including crypto, business sign-up by type with item catalogues). None of them blocks the launch. Decisions: (1) Launch first, then build these. (2) Do the research now (paper only, no contacts, no sign-ups): business-manager, legal and payments-engineer each check payments; legal checks online teaching and banned or licensed goods. (3) Crypto: park it, no build, until legal confirms the Bank of Tanzania position in writing; offer cards and mobile money instead. (4) Teachers get a teacher profile that reuses the guide profile and the paid prep-call booking (video link), not a separate system; adults only (18+) at the start. (5) Business catalogues reuse the existing `listings` table, one owner can choose their type first, items wait for admin approval, and the traveller still pays the shop directly (order request, no online payment). (6) Build order after launch: business catalogue first, then online lessons, then the extra ways to pay (after company registration and Selcom).
- 2026-10-27: Social sign-in. Buttons are already in the web and app code, but they only show once a provider is turned on in Supabase, and all three are off. Recommended order: Google now, Apple after company registration, D-U-N-S and the Apple Developer account, Facebook optional and later. Decisions: (1) Start Google in "Testing" mode (only the team's own Google addresses, listed as test users) until a privacy page exists. (2) Privacy page for Google's consent screen: either wait for the advocate, or publish a short interim notice that Walter approves (legal drafts it). (3) The iPhone app shows no Google button until Apple sign-in is ready (App Store rule). (4) Facebook: skip for now. Walter does all the Google Cloud and Supabase clicks himself and enters the keys; agents never see the secret.
- 2026-10-27: Accounts in one place (kwetuly@gmail.com). Recommended: Supabase option A, invite kwetuly@gmail.com as Owner of the existing "Kwetuly" organization; nothing moves, URL and keys unchanged. Keep the GitHub login (kismatidigital) as second owner. Turn on 2FA on both Supabase logins and on kwetuly@gmail.com itself (recovery phone, backup codes kept offline). Set the org billing email to kwetuly@gmail.com before the Pro upgrade. Same rule for the others: Vercel team and GitHub org get kwetuly@gmail.com as a second owner (check whether an extra Vercel Pro member costs money); create Resend, Expo, PostHog new on kwetuly@gmail.com; Meta business portfolio with two admins. Walter does all clicks; agents never see passwords or codes.
- 2026-10-25: Send one test email to support@kwetuly.com from another address and confirm it lands in kwetuly@gmail.com (ImprovMX).
- 2026-10-25: Resend for alerts@kwetuly.com: create the Resend account himself (check the free plan limits on resend.com), add domain kwetuly.com, then paste the DNS records Resend shows into Vercel DNS. Then enter RESEND_API_KEY, EMAIL_FROM and SITE_URL himself in Supabase, Edge Functions, Secrets. Agents never see the key.
- 2026-10-25: Approve the Next.js security upgrade before it is pushed to the live site (after qa-tester passes it).
- 2026-10-25: Upgrade Supabase to Pro (check current price) before launch, then turn on leaked-password protection. Upgrade Vercel to Pro (check current price) before launch, since Hobby is non-commercial.
- 2026-10-25: Still open: WhatsApp template kwetuly_alert (Meta), Google/Facebook sign-in keys, social handles, legal brief blanks, company registration, then D-U-N-S, then Apple/Google developer accounts, Expo account, Vercel billing address, PostHog account, Selcom (after company), approve real guides, publish the 30 draft tours, native-speaker review, advocate for privacy policy and terms.
- 2026-10-24: Rename to Kwetuly, open questions (none of these block step 1):
  - (a) Answered 2026-10-24: nothing was registered under Rafrika, so the app ids are changing to `com.kwetuly.app`, with slug and scheme `kwetuly`.
  - (b) Answered 2026-10-24: "remove everything rafrika". The internal names (`rafrika_pct`, `@rafrika/shared`, storage keys, the `rafrika_recovery` cookie, map layer ids) are being renamed now. The repo folder on disk stays `rafrika` for now.
  - (c) Data already stored in the database (shop product names, sample guides and trips, any badge text kept in rows): change it with a new migration, never by editing old migrations. Walter approves the migration before it runs on the live Supabase project.
  - (d) Email sender: `alerts@kwetuly.com` (Resend) and `payments@kwetuly.com` need DNS records on kwetuly.com that Walter adds in Vercel. The WhatsApp template `rafrika_alert` needs a new Meta-approved template; Walter submits it.
  - (e) Vercel: connect the project with Walter's GitHub account (needs the private GitHub remote below), add kwetuly.com, and choose a free email-forwarding service for support@kwetuly.com. Hobby plan is for non-commercial use, so upgrade to Pro (about US$20 a month) before launch.
  - (f) Approve the Kwetuly wordmark from designer before frontend uses it.
  - (g) Approve the legal brief, then Walter (not an agent) sends it to the advocate for the BRELA and Zanzibar search.
  - (h) Choose the handles and slogans from marketing; Walter checks and claims the handles himself.
- 2026-10-24 (decided, kept for history): Brand name. Decided 2026-10-24: Kwetuly. Walter dropped Rafrika on 2026-10-24, so the earlier "keep Rafrika by 2026-10-27" rule is cancelled. Shortlist, waiting for Walter to choose (.com free and no web usage found, both checked 2026-10-24): **1. Habario** (habari = the "how are you" greeting), **2. Nuruly** (nuru = light, same pattern as Karibly), **3. Akwaby** (akwaaba = welcome in Twi, a pan-African twin of Karibly). Walter checks Gmail, Instagram and TikTok for his favourite and buys the .com himself at Cloudflare (about US$10.50 a year). The advocate then runs a BRELA and Zanzibar search on it (brief: docs/legal/brand-name-search-brief.md, with the name swapped in). New rule: Walter picks one of the three or asks for another round. Until a name is picked, nobody renames anything. Excluded on purpose: Diraly (sounds like Diaralia, a French diarrhoea medicine) and Hadithio (close to "hadith", which is religiously sensitive).
- 2026-10-16: Approve the soft-launch plan (scope: website first, invite-only, deposits off).
- 2026-10-16: Create a private git remote (GitHub) so the code is backed up. Right now it exists only on this PC.
- 2026-10-16: Hosting accounts: Vercel, and buy or point the domain for the new name (see Brand name). Decide whether to use a second Supabase project for staging.
- 2026-10-16: Choose an SMS provider for phone codes, or launch with admin phone confirmation only.
- 2026-10-16: Turn on leaked-password protection in Supabase (one toggle).
- 2026-10-16: Create the PostHog account (EU), add the keys, and turn on cookieless mode.
- Set the yearly badge fee in /admin.
- Set merchandise prices and photos in /admin/shop (or hide the shop for the soft launch).
- Review trips flagged "Details being re-checked" in /admin/trips.
- Reject the test group "Test group from Claude (please reject)".
- Run `eas init` and the first EAS builds with his Expo account (iOS and Android). Not needed for a website-first soft launch.
- Privacy policy and terms with a Tanzanian advocate (legal drafts first).
- Native-speaker review of the 6 non-English languages.
- Parked: credits idea. Advice so far is no stored-credit wallet, because it likely needs Bank of Tanzania approval.

## To do
- 2026-10-29 New ideas plan (none is launch-critical; research runs now, building waits for Walter's go and the launch):
  - Phase 1, research only, in parallel: (a) payments-engineer: options to take international payments and pay people in Tanzania (Selcom cards, Pesapal, DPO Pay, Flutterwave, Stripe, PayPal, Wise, crypto), with what each needs and costs, every fact marked "checked on [date], source" or "to verify". (b) legal: Bank of Tanzania position on crypto, whether Kwetuly holding money for others needs a licence, online-teaching rules (minors, recordings), banned or licensed goods for shops (wildlife products, gemstones such as tanzanite, antiques). (c) business-manager: costs, fees and earnings for each idea, go or no-go. (d) tech-lead: reuse map for the three ideas (guides, call_requests, guide_packages, providers.business_type, the unused listings table, shop order requests, payments), with a small data design. (e) hr: draft code of conduct for online teachers.
  - Phase 2, after Walter decides and after launch: Business catalogue: backend-engineer (catalogue rules on listings, photo uploads, admin approval), frontend-engineer (choose your type first, then add items; web and app), designer (item card and catalogue look), localization (texts), operations-manager (item approval queue), then security-reviewer (uploads, owner rules) and qa-tester.
  - Phase 3: Online lessons: backend-engineer and frontend-engineer (teacher profile on the guide profile, lesson types Kiswahili and cooking, booking via prep calls with a video link), guide-success (teacher onboarding guide), marketing (who learns Kiswahili online and where), then security-reviewer (personal data, video links) and qa-tester.
  - Phase 4, after company registration and Selcom: payments-engineer (cards for travellers abroad, payouts by mobile money, a second provider if Walter approves), accounting (reconciliation and statements), security-reviewer and qa-tester.
- 2026-10-27: devops (after Walter finishes the Supabase invite): one-page account register (service, which login owns it, second owner, 2FA yes/no, billing email). No passwords, codes or personal details in the file.
- 2026-10-25 plan (in order):
  - 1. devops: Resend setup guide for Walter (click by click), check the Resend DNS records do not clash with ImprovMX MX/SPF, check the notify function is deployed on live and its trigger and 5-minute retry work. No account changes, no keys.
  - 1b. tech-lead (in parallel): Next.js security upgrade on a branch, then qa-tester checks it. Walter approves before it goes live.
  - 2. After Walter enters the secrets: devops sends one test alert to Walter's own address; qa-tester checks a booking and an enquiry notice end to end (English and Kiswahili); security-reviewer checks sender setup (SPF, DKIM, DMARC) and that no personal data leaks in emails.
  - 3. frontend-engineer: the small QA findings on forms and labels; qa-tester re-checks.
  - 4. Replaced 2026-10-27 by the social sign-in plan below.
- 2026-10-27 Social sign-in plan (in order):
  - 1. backend-engineer: click-by-click Google guide for Walter in docs/devops/google-sign-in-setup.md (Google Cloud project on kwetuly@gmail.com, consent screen in Testing mode, test users, web OAuth client, redirect URI = the Supabase callback, paste ID and secret into Supabase Providers himself). Also check the code: buttons hidden when off, the app's iOS screen hides Google until Apple is on, new Google users get the traveller role and no admin rights. No keys, no account changes. In parallel: legal drafts a short interim privacy notice for a /privacy page (marked as interim, no invented company details), only if Walter picks that option.
  - 2. Walter: does the Google Cloud and Supabase clicks from the guide.
  - 3. security-reviewer: checks the setup after the keys are in (redirect URLs, scopes only email and profile, account linking with an existing email account, roles, secret not in any file).
  - 4. qa-tester: sign-up and sign-in with Google on the website (team preview) and the app (Android and iOS dev build), English and Kiswahili, plus an existing email user using the same Google address.
  - 5. Later, after Walter approves: Google consent screen to Production (needs the public /privacy and /terms pages reachable past "Coming soon"); Apple after D-U-N-S and the Apple Developer account (backend-engineer guide, then security-reviewer and qa-tester); Facebook only if Walter wants it.
  - 5. devops: WhatsApp kwetuly_alert submission guide for Walter (Meta).
- tech-lead: launch-readiness audit, giving a blocker list and the order of fixes (step 1).
- security-reviewer: independent review of sign-in, personal data, uploads, admin and payments, plus Supabase RLS and advisors (step 1, in parallel).
- legal: draft the privacy policy, terms, deposit/refund and media-consent texts for the advocate (step 1, in parallel).
- frontend-engineer / backend-engineer: fix the blockers from step 1 (step 2).
- devops: staging site on Vercel, environment variables, error monitoring, database backups, release checklist (step 2, after Walter sets up the accounts).
- qa-tester: end-to-end tests with real (non-localhost) accounts on staging; release verdict (step 3).
- security-reviewer: re-check the fixes (step 3).
- operations-manager: launch-day checklists and approval queues for guides, listings, groups and reviews, with service levels (step 2).
- guide-success: shortlist and outreach drafts for the first 10 real guides. Walter sends them (step 2).
- partnerships: badge-check checklist and draft agreement for the first businesses. Walter contacts them (step 2).
- localization: list of texts for the native-speaker review (step 2).
- data-analyst: soft-launch scorecard and event check once PostHog is live (step 3).
- customer-care: FAQ and reply templates for the soft launch (step 3).
- Before launch: delete all sample data in /admin/listings and publish only the reviewed trips.

- 2026-10-24 Rename to Kwetuly (about 1,500 mentions of "Rafrika" in 282 files: about 160 web, about 95 app, about 650 in the 7-language dictionaries, 39 in the email/WhatsApp alerts, 30 migrations and seeds, 7 legal drafts, 22 agent files):
  - Step 1, now, in parallel: designer (wordmark and missing icons), legal (update brand-name-search-brief.md for Kwetuly, BRELA and Zanzibar), marketing (update slogans-and-handles.md, @kwetuly, English and Kiswahili slogans), devops (written plan for Vercel, domain, email forwarding, Pro upgrade; no account changes).
  - Step 2, after the wordmark and answers (a) to (c): frontend-engineer (web, app, shared texts, metadata, app name, badge "Checked by Kwetuly", CLAUDE.md and agent files) and backend-engineer (email and WhatsApp alerts, payments function defaults, new data migration as a draft).
  - Step 3: localization, all 7 languages, plus how "Kwetuly" sounds in each.
  - Step 4: qa-tester, sweep for leftover "Rafrika"; security-reviewer only if the email sender, sign-in cookie or recovery code changes.
- (Older plan, replaced by the line above) Brand name, after Walter picks a name and buys the .com: (1) designer makes the new wordmark and the missing files from docs/design/logo-check-2026-10.md, and Walter approves; (2) frontend-engineer renames the website and app (texts, metadata, app name and bundle display name, emails), working with backend-engineer on database and email-template text; (3) localization updates the 7 languages and checks how the name sounds in each; (4) legal swaps the name in the drafts and the BRELA brief; (5) marketing redoes the slogans and handle list; (6) devops sets up the domain and support@ email forwarding; (7) qa-tester checks the whole site for any leftover "Rafrika". Steps 1, 4, 5 and 6 can run in parallel. Step 2 needs the wordmark from step 1, and step 7 comes last.

## In progress
- 2026-10-25: Website alerts email from alerts@kwetuly.com (Resend), step 1 (devops guide and checks).


## Done
- 2026-10-25: Website live on Vercel at https://kwetuly.com (www redirects); domain DNS in Vercel.
- 2026-10-25: Supabase (Kwetuly, free plan): Site URL and redirect URLs set to kwetuly.com; minimum password length 8. Leaked-password protection waits for Pro.
- 2026-10-25: Email forwarding: ImprovMX free, any address @kwetuly.com goes to kwetuly@gmail.com; MX and SPF records verified. Test email not yet confirmed.
- 2026-10-25: Both rename migrations applied on live (brand_rename_kwetuly, neutral_names_and_shop_identity). Rename to Kwetuly finished in code (commits c71711c, 276b193).
- 2026-10-24: Brand name chosen: Kwetuly (Kiswahili "kwetu" = our place, our home; say "kweh-TOO-lee"). Walter bought kwetuly.com on Vercel (team "kwetuly", Hobby plan, US$11.25 a year). Aim widened to all of Africa, starting in Tanzania. Walter approved starting the rename.
- 2026-10-16: Menu with the selling points, shop order requests, traveller group trips with phone confirmation, news, merchandise, invest page, sample data (labelled), researched content (needs_review), native app icon tiles, 21-agent team.
