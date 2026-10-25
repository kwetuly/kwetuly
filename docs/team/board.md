# Team board

Kept by `chief-of-staff`. Walter approves everything in "Waiting for Walter".

Goal (set 2026-10-16): a soft launch. The website goes live on a real domain for invited guides and travellers. Deposits stay off until Selcom is ready, and no sample data is shown.

## Waiting for Walter
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
- 2026-10-24: Rename to Kwetuly, step 1 (designer, legal, marketing, devops).


## Done
- 2026-10-24: Brand name chosen: Kwetuly (Kiswahili "kwetu" = our place, our home; say "kweh-TOO-lee"). Walter bought kwetuly.com on Vercel (team "kwetuly", Hobby plan, US$11.25 a year). Aim widened to all of Africa, starting in Tanzania. Walter approved starting the rename.
- 2026-10-16: Menu with the selling points, shop order requests, traveller group trips with phone confirmation, news, merchandise, invest page, sample data (labelled), researched content (needs_review), native app icon tiles, 21-agent team.
