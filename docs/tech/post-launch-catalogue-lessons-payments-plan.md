# Post-launch plan: business catalogue, online lessons, more ways to pay

Prepared by tech-lead, 2026-10-30. Design only: no code, database or migration was changed.
Decisions approved by Walter on 2026-10-30 (see `docs/team/board.md`, entry 2026-10-29). Build order, all after launch:
1. Business item catalogue. 2. Online lessons. 3. More ways to pay (after company registration and Selcom).

Sizes: S = a few days, M = one to two weeks, L = more than two weeks (one engineer, including review and tests).

---

## 0. Things found while mapping the code (read first)

These matter for the plans below. None blocks launch, but two should be fixed in the first catalogue migration.

| # | Finding | Where | Risk | Fix |
|---|---|---|---|---|
| F1 | The unused `listings` table lets an owner publish items themselves. The policy "Owners manage own listings" is `for all`, and public read only needs `is_published` plus an approved business. No admin review, no onboarded check, no guard trigger. No page reads `listings` today, so nothing shows, but the rows are readable through the public API. | `supabase/migrations/20261012000000_initial_schema.sql` lines 174-188 (table), 390-408 (policies) | Low today, high the day a page lists items (banned goods could go live unreviewed). | Part 1 replaces these policies and adds a guard trigger. Until then nothing should read `listings`. |
| F2 | "One business per account" is only in app code (`maybeSingle()` on `providers.owner_id`). The database allows several; if a second row appears, the dashboard query errors and the owner is locked out of their page. | `apps/web/src/app/[lang]/dashboard/business-actions.ts` line 39; only an ordinary index at `20261012000000_initial_schema.sql` line 137 | Broken dashboard for that owner; orders could go to the wrong row. | Unique index on `providers(owner_id)` after a read-only check that no duplicates exist. |
| F3 | The prep call's "paid flag" is not wired. `call_requests.payment_status` exists, but the `payments` Edge Function only knows `offer` and `group` deposits, and `payments.kind` only allows `offer_deposit` and `group_deposit`. Nothing ever sets a call to paid. Today a "paid" prep call is a price shown, not money taken. | `20261012000500_calls_jobs_hub.sql` lines 42-43; `20261014000200_payments.sql` line 9; `supabase/functions/payments/index.ts` lines 140-195 | Lessons cannot be "paid through Kwetuly" until Part 3; the copy must not say they are. | Part 2 launches with "pay the teacher directly" (like shops); Part 3 wires call payments. |
| F4 | `call_requests.meeting_link` accepts any text up to 300 characters (no `https://`, no host check). | `20261012000500_calls_jobs_hub.sql` line 41 | A guide could send a phishing link that looks like it came from Kwetuly. More exposure once strangers book lessons. | Part 2 adds an `https://` check and a short list of allowed video hosts. |

---

## 1. Business item catalogue (built right after launch). Size: M

### 1.1 What already exists

- Business = a row in `public.providers` with `business_type` (16 types incl. `curio_shop`, `gem_shop`, `gear_rental`, `restaurant`, `spa`), photos, admin approval (`verification_status`) and the admin-only badge fields, protected by `public.guard_provider_admin_fields()`.
  `supabase/migrations/20261016000200_business_listings.sql`; type list mirrored in `packages/shared/src/businesses.ts` (`BUSINESS_TYPES`, `OWNER_BUSINESS_TYPES`, `BUSINESS_PAGES`).
- `merch` (Kwetuly Shop) is reserved for admins; the shop identity is fixed in `site_settings.shop_provider`. `20261025000100_neutral_names_and_shop_identity.sql` lines 375-442; `apps/web/src/lib/merch.ts`.
- Sample businesses are flagged `providers.is_sample` (owner cannot change it). `20261016000500_traveller_groups_news_samples_merch.sql` lines 190-215.
- The unused `public.listings` table: `provider_id`, `pillar` (required), `category` (required), `title`, `description`, `region` (required), `price_from_usd`, `price_note`, `photos[]`, `is_published`. Referenced by `favourites.listing_id` and `leads.listing_id`. `20261012000000_initial_schema.sql` lines 174-207, 261.
- A ready-made pattern for "owner edits, admin approves, edits go back to review": `public.guard_guide_package()` and its policies. `20261016000100_guide_packages.sql` lines 4-95; admin queue `apps/web/src/app/[lang]/admin/pending-packages.tsx`.
- Photo uploads go straight from the browser/app to the public `avatars` bucket under the owner's own folder (10 MB, jpeg/png/webp). `20261014000500_upload_limits.sql`; server check of the path in `apps/web/src/app/[lang]/dashboard/business-actions.ts` line 15.

### 1.2 How shop order requests are stored today

There is no orders table. An order request is an ordinary enquiry row in `public.leads`:
- `provider_id` = the shop, `traveler_id` = the signed-in traveller or null, `source = 'contact_form'`, `traveler_name`, `traveler_contact`, and `message`.
- The order is free text in `message`, built by `orderMessage()` in `packages/shared/src/businesses.ts` lines 103-112: a first line "Order: deliver to ..." or "Order: hold for collection ...", a blank line, then what the traveller typed (for the Kwetuly Shop: "2 × T-shirt (size M)" plus a note).
- Business orders: `askBusiness()` in `apps/web/src/app/[lang]/businesses/[id]/actions.ts` (only types in `ORDER_TYPES`: curio, gems, gear). Kwetuly Shop orders: `orderMerch()` in `apps/web/src/app/[lang]/merch/actions.ts`. The app does the same in `apps/mobile/src/lib/businesses.ts` line 31.
- Insert is allowed by policy "Anyone can send an enquiry to an approved guide or business" (`20261016001800_onboarded_gate_followup.sql` lines 184-190) through `private.lead_target_ok(guide_id, provider_id)`. `leads.listing_id` exists but is never filled and is not checked.
- The owner reads it in their dashboard; `leads_notify` alerts them (`20261012000800_notifications.sql` line 121). No status, no quantity, no price: the owner replies by WhatsApp or phone and the traveller pays the shop.

### 1.3 What is missing

1. Admin approval per item, and an owner "hide/show" that does not need re-approval.
2. Item fields that fit shops: price in TZS (owners think in shillings), not a safari `pillar`.
3. Type first: the sign-up form today asks name, type and everything at once.
4. A link from an order request to the item (`leads.listing_id`), checked by the database.
5. Banned and restricted goods enforcement (list from legal, still being drafted).
6. One business per account in the database (F2).
7. Item pages, owner catalogue editor, admin item queue, on web and app.

### 1.4 Proposed data changes (in words)

`public.listings` (reuse, adapt):
- Make `pillar` and `region` optional (shops are not pillar-based; region comes from the business). Keep `category` but make it optional; use it later for sub-types (e.g. "carvings", "tanzanite jewellery").
- Add `price_tzs` (whole shillings, 0 to 100,000,000, null = "price on request"). Keep `price_from_usd` for rentals and optional; never show a converted price as if the shop set it.
- Add `status` using the existing `package_status` type (`draft`, `pending`, `approved`, `rejected`), plus `review_note` and `reviewed_at` (admin-only).
- Keep `is_published` as the owner's own show/hide switch.
- Add length checks: title 3-120, description up to 2000, at most 6 photos, `price_note` up to 160.
- Add `sort_order` (owner arranges items).
- Index for the public list: approved and published items per business.

Guard trigger on `listings` (copy of `guard_guide_package`):
- Non-admins can only set `draft` or `pending`; `review_note` and `reviewed_at` are admin-only.
- Changing title, description, price, photos or category on an approved item sends it back to `pending`.
- `provider_id` cannot change after insert.
- Each photo URL must be in the `avatars` bucket under the owner's own user folder (same rule the server action checks, now enforced in the database).
- Items cannot be added to the Kwetuly Shop row by non-admins (merch stays in `shop_products`).

Row level security on `listings` (replaces F1 policies):
- Public read: `status = 'approved'` and `is_published` and the business is approved. Sample businesses' items are readable but labelled as samples on every screen.
- Owner: read, insert, update and delete only their own business's items, and only with a finished account (`private.is_onboarded()`), the same pattern as guide packages.
- Admin: everything.
- Optional per-business cap (e.g. 50 items) checked in the guard, to limit spam.

`public.providers`:
- Unique on `owner_id` (one business per account; F2). Read-only duplicate check first.
- Changing `business_type` after approval sends the business back to `pending` (today it does not). Admin-only for `merch` stays.
- Add `catalogue_terms_accepted_at` (owner sets it to "now" only, never a past date): the owner confirms they sell nothing on the banned list. Item submission requires it (checked in the listings guard).

`public.leads`:
- `private.lead_target_ok` also checks that `listing_id`, when given, belongs to the same `provider_id` and is approved. Order messages keep the `orderMessage()` text, now with the item title and the listed price at that moment, so the owner sees what the traveller saw.
- No new orders table yet. If owners ask for order status, add a small `status` on leads later (S).

Banned goods:
- Keep the list in `packages/shared` (ids plus 7-language names for travellers, English and Kiswahili for owners) once legal hands it over; the admin item queue shows it as a checklist. No automatic keyword filter at first (false matches in Kiswahili); the admin review is the control. Gem items: show what proof the shop must hold (to be named by legal); no claim by Kwetuly that a stone is genuine.

Which types get a catalogue: proposal is the order types (`curio_shop`, `gem_shop`, `gear_rental`) first, then `restaurant`, `spa`, `salon` as a price list (enquiry only, no delivery). Stays and transport keep the enquiry form. Walter to confirm.

### 1.5 Screens

Web (`apps/web/src/app/[lang]`):
- `dashboard/` business sign-up: step 1 "What kind of business?" (cards from `OWNER_BUSINESS_TYPES`), step 2 the existing form (`business-listing.tsx`).
- New `dashboard/catalogue/`: item list with status (draft, waiting for review, live, needs changes plus the admin note), add/edit item form with photos, show/hide switch, catalogue terms acceptance.
- `businesses/[id]/page.tsx`: item grid under the business; each item opens `businesses/[id]/items/[itemId]` (or a sheet) with "Order or ask" pre-filling the existing ask form with the item. Cached with a `listings` cache tag; images sized for slow phones.
- `admin/listings` or a new `admin/items`: approval queue with the banned-goods checklist, approve or reject with a note (same shape as `pending-packages.tsx`).
- Item cards on `[section]` pages (e.g. shop/art) can come later; start with items on the business page.

App (`apps/mobile/src/app`):
- `my-business.tsx`: type-first step, then a "Catalogue" section and an item editor screen (photo picker with compression to about 1600 px, under 500 KB).
- `business/[id].tsx`: item list and item detail, "Order or ask" pre-filled.
- Admin queue stays web-only.

### 1.6 Texts

Traveller-facing, 7 languages: items heading, "price on request", "listed price, confirm with the shop", "You pay the shop directly. Kwetuly takes no payment for this order.", order form with item name, "sample item" label, empty state.
Owner-facing, English and Kiswahili: type picker heading and help, item form labels and limits, statuses (draft, waiting for review, live, needs changes, hidden), catalogue terms and the banned-goods list, photo tips, "changes go back for review".
Admin: English only.

### 1.7 Risks and security review

- Security review needed: uploads (path ownership, size, type, EXIF location data in photos: strip on the device before upload), the new RLS and guard, `leads.listing_id` check, the unique owner constraint.
- Illegal goods (wildlife products, unlicensed gems, antiques): admin review plus the owner declaration; legal list required before go-live.
- Honesty: prices are the shop's own; no "verified item" wording; badge stays about the business only.
- Personal data (PDPA 2022): order requests carry name and contact; already covered by the lead flow and its retention, nothing new.
- Speed: photos are the main cost; list pages use small thumbnails and lazy loading.

---

## 2. Online lessons (built next). Size: M

### 2.1 What already exists

- Guide profile with admin approval and separate checks (identity, licence, first aid) shown only when ticked. `20261012000200_guides.sql`, `20261014000600_guide_checks.sql`, `packages/shared/src/guide-checks.ts`. A teacher without a guide licence can be approved with only the identity check; the licence check simply does not show.
- `guides.expertise` (audience specialities: accessible travel, families, ...) with a check list. `20261013000000_guide_expertise.sql`.
- Guide packages with `kind` `cultural` and `food`, admin review, re-review on change. `20261016000100_guide_packages.sql`; `packages/shared/src/packages.ts`.
- Prep calls: `guides.call_enabled`, `call_price_usd`, `call_minutes`, `call_topics`; `public.call_requests` with `price_usd`, `meeting_link`, `scheduled_at`, `status` (requested, accepted, declined, completed, cancelled), `payment_status`. Guard `public.guard_call_request_fields()` in `20261012000600_call_status_rules.sql` (price copied from the guide on insert; guide sets time and link; traveller can only cancel). Insert policy in `20261016001800_onboarded_gate_followup.sql` lines 51-59.
- Contact unlock after acceptance (`20261012001100_messaging.sql` line 255), alerts (`20261012000800_notifications.sql` lines 141, 168), reviews tied to completed calls (`20261013000200_guide_reviews.sql` line 37).
- Screens: web `guides/[slug]` (request a call), `calls/page.tsx`, `hub/page.tsx`; app `call/[guideId].tsx`, `calls.tsx`, `hub/`.

### 2.2 Decision: what is a teacher

Smallest change: a teacher is an approved guide who has at least one approved lesson package. No new profile, no "teacher" flag that admins must keep in sync.
- Add two package kinds: `lesson_kiswahili` and `lesson_cooking` (online, by video). The existing `cultural` and `food` stay for in-person visits.
- Teaching rules are accepted once: `guides.teacher_terms_accepted_at` (guide sets "now" only). A lesson package cannot be submitted without it (checked in the package guard). HR is drafting the code of conduct.
- A "Teachers" page lists guides with approved lesson packages.

Rejected alternatives: an expertise value (expertise describes who a guide serves, and would not carry a price or length); a separate teachers table (duplicates profile, checks, reviews and approvals).

### 2.3 What is missing

1. Lesson kinds and lesson length in minutes (packages only have whole hours or days).
2. Booking a specific lesson: `call_requests` has no link to a package, and the price always comes from `guides.call_price_usd`.
3. Adults only: no age data anywhere. Need an 18+ confirmation from the learner at booking.
4. Safe video links (F4).
5. Time zones: learners are abroad; times must show in the learner's zone and in East Africa Time.
6. Payment (F3): until Part 3, the learner pays the teacher directly, and the copy says so.

### 2.4 Proposed data changes (in words)

`public.guide_packages`:
- Add kinds `lesson_kiswahili`, `lesson_cooking` to the check and to `PACKAGE_KINDS`.
- Add `duration_minutes` (15-180), required for lesson kinds, not used by others (checked in the guard).
- Add `level` for Kiswahili (beginner, intermediate, advanced), optional.
- Guard: lesson kinds require `guides.teacher_terms_accepted_at` and a price (no "price on request" for lessons, so the booking price is fixed).

`public.call_requests`:
- Add `package_id` (nullable, references `guide_packages`). Null = ordinary prep call, as today.
- Add `adult_confirmed_at`: required for lesson bookings, set to "now" by the guard when the learner ticks "I am 18 or older".
- Guard on insert: if `package_id` is set, the package must be an approved lesson package of the same guide; `price_usd` and the length come from the package, not the guide's call price. `topic` defaults to the package title.
- Guard on update: `meeting_link` must start with `https://` and be on an allowed host (Google Meet, Zoom, Microsoft Teams, Jitsi, Whereby; list in shared code and in the guard). This also fixes F4 for prep calls.
- Insert policy: allow a booking either when `call_enabled` (prep call, as today) or when `package_id` points to an approved lesson package of an approved guide; finished account still required.

`public.guides`: add `teacher_terms_accepted_at` (guide-settable to now, admin can clear).

No recordings by Kwetuly; no storage of lesson content. Reviews reuse the existing call-review rule.

### 2.5 Screens

Web:
- `dashboard/packages`: two new kinds with minutes and level; teaching rules acceptance before the first lesson.
- New `[section]` or `teachers` page: list of teachers by subject, cached, light.
- `guides/[slug]`: "Lessons" block with each lesson's price and length; "Book this lesson" opens the call request form with the package chosen, the 18+ tick, and preferred times shown with the learner's time zone.
- `calls/page.tsx` and `hub/page.tsx`: show lesson name, time in both zones, video link (only after acceptance), and the payment line ("Pay the teacher directly as agreed" until Part 3).
- `admin/pending-packages.tsx`: lesson kinds included; reviewer checks the teaching rules were accepted.

App: same in `my-packages.tsx`, `guide/`, `call/[guideId].tsx`, `calls.tsx`, `hub/`. Video links open in the system browser, never inside the app.

### 2.6 Texts

Traveller-facing, 7 languages: "Online lessons", "Learn Kiswahili", "Cook Tanzanian food", level names, "Lesson length: {n} minutes", "I am 18 or older", "Times shown in your time zone ({zone}); the teacher is in East Africa Time", "You pay the teacher directly. Kwetuly does not take payment for lessons yet.", "The video link appears when the teacher accepts", cooking safety note (knives, heat, allergies), "Kwetuly does not record lessons."
Guide/teacher-facing, English and Kiswahili: lesson kinds, minutes, level, teaching rules and code of conduct, "adults only", allowed video services, how to send the link.

### 2.7 Risks and security review

- Security review needed: new insert policy and guard on `call_requests` (price taken from the package, never the client), the link host check, who can see `meeting_link` (only the two parties and admins), contact unlock still only after acceptance.
- Safeguarding: adults only is a self-declaration; legal to confirm it is enough at the start, and what to do if a minor is reported. Code of conduct from HR before go-live.
- Off-platform payment disputes: Kwetuly takes no money, so it cannot refund; the copy must say so and customer care needs a script.
- PDPA: no new personal data beyond the age confirmation (a timestamp, not a date of birth).
- Tax and licences for paid teaching: legal question, not a build blocker.

---

## 3. More ways to pay (after company registration and Selcom). Touch points only. Size: L

The payments-engineer is choosing providers in parallel. This lists only where the code will change.

### 3.1 What exists

- `public.payments` (Selcom deposits): `kind` limited to `offer_deposit`, `group_deposit`; `amount_usd`, `amount_tzs`, `status`, `order_id`, `provider_reference`, `provider_channel`, `payout_done` (admin-only tick), plus `provider_amount`, `usd_tzs_rate`, `rate_source` and a `review` path for mismatches. `20261014000200_payments.sql`, `20261016001300_payment_review_status.sql`, `20261016001600_payments_review_fixes.sql`.
- `public.guard_payment()` (only `payout_done` is editable by admins), `private.on_payment_paid()` (alerts; builds links only for offer and group).
- Edge Function `supabase/functions/payments/index.ts`: `config`, `check`, `checkout`, `status`, webhook that re-asks Selcom and never trusts the body; one fixed USD to TZS rate from the environment; `loadOrder()` knows only `offer` and `group`.
- `call_requests.payment_status` and `price_usd` (not wired, F3).
- Payouts: manual, by the team, recorded only as `payout_done`. No payout destination is stored.

### 3.2 Touch points

1. `payments.kind`: add `call_payment` with a `call_request_id` column and the matching one-of check.
2. Edge Function: a `call` kind in `loadOrder()` (only accepted, scheduled, unpaid calls; amount from `call_requests.price_usd`); card checkout for foreign cards (provider choice pending); the rate source per payment.
3. A trusted trigger sets `call_requests.payment_status = 'paid'` when its payment is paid, and `refunded` when refunded. The current call guard already blocks users from changing it.
4. `private.on_payment_paid()`: link for calls (`/calls`).
5. Video link only after payment, for paid lessons (decide with Walter).
6. Payouts: a payout destination per guide or business (mobile money number and network, or bank) in the private tables `guide_private` / `provider_private`, owner-editable, admin-readable; a `payouts` table (payee, amount TZS, method, provider reference, status, which payments it covers) replacing the bare `payout_done` tick; the commission split shown to the payee before payout.
7. Refunds and chargebacks for foreign cards: a `refunded` / `disputed` path and the deposit and refund policy (`docs/legal/deposit-and-refund-policy.md`) extended to lessons.
8. Reconciliation: daily match of provider settlement reports against `payments` and `payouts`.

### 3.3 Risks and security review

- Holding customer money for others may need Bank of Tanzania approval: prefer the aggregator's split or direct settlement, or same-day payouts; legal to confirm before build.
- Card fraud and chargebacks from abroad; 3-D Secure required.
- Exchange rate honesty: show the TZS amount charged and the rate used.
- Security review needed for every step: webhook trust, payout destination changes (a changed number must be confirmed and alerted, the main fraud path), admin powers on payouts (two-step sign-in already required).

---

## 4. Order of work and sizes

| Step | Part | Size | Who builds | Who checks |
|---|---|---|---|---|
| 1 | F2 unique owner + F1 listings rules + listings guard | S | backend-engineer | security-reviewer |
| 2 | Catalogue screens web and app, admin queue | M | frontend-engineer, designer | qa-tester, localization |
| 3 | Lesson kinds, call_requests package link, 18+ tick, link check (F4) | S-M | backend-engineer | security-reviewer |
| 4 | Lesson screens, teachers page | M | frontend-engineer | qa-tester, localization |
| 5 | Call payments, cards, payouts | L | payments-engineer, backend-engineer | security-reviewer, accounting |

## 5. Questions for Walter

1. Which business types get a catalogue first (proposal: curio, gems, gear rental; then restaurant, spa, salon as price lists)?
2. Lessons before Part 3: is "pay the teacher directly" acceptable, or do lessons wait for online payment?
3. Should a changed business type send an approved business back for review (proposal: yes)?
4. Per-business item cap (proposal: 50)?
