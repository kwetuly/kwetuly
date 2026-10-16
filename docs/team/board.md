# Team board

Kept by `chief-of-staff`. Walter approves everything in "Waiting for Walter".

Goal (set 2026-10-16): a soft launch. The website goes live on a real domain for invited guides and travellers. Deposits stay off until Selcom is ready, and no sample data is shown.

## Waiting for Walter
- 2026-10-16: Approve the soft-launch plan (scope: website first, invite-only, deposits off).
- 2026-10-16: Create a private git remote (GitHub) so the code is backed up. Right now it exists only on this PC.
- 2026-10-16: Hosting accounts: Vercel, and buy or point rafrika.com. Decide whether to use a second Supabase project for staging.
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

## In progress

## Done
- 2026-10-16: Menu with the selling points, shop order requests, traveller group trips with phone confirmation, news, merchandise, invest page, sample data (labelled), researched content (needs_review), native app icon tiles, 21-agent team.
