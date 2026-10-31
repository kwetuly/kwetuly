# Bike, village and host samples: how they fit (tech-lead, paper only)

Board item: "2026-10-31 Bike, village and concierge samples", step 1 (b). Prepared 2026-10-31 by tech-lead from the code and migrations only. Nothing was changed in code or in the database. The Supabase tool was not authorised in this session, so **no live state was confirmed**. Every "today" below assumes live matches the migrations in `supabase/migrations`.

## 1. Can a sample guide appear on a published tour's "Meet your guides" today? Yes (urgent)

**The premise "sample guides are link_only" is not in the repo.** `20261016001000_sample_guides_packages_groups.sql` lines 28-79 insert all 16 sample guides with `visibility = 'public'` and `verification_status = 'approved'`. No later migration changes them (`link_only` appears only in the enum definition, `20261012000200_guides.sql` line 7). If someone set them to `link_only` by hand on live, that is not recorded; backend-engineer's read-only SELECT (board step 1a) must confirm.

How they reach a tour page:

| Path | Web `apps/web/src/lib/trips.ts` | App `apps/mobile/src/lib/api.ts` |
| --- | --- | --- |
| Linked through `trip_guides` | lines 83-90: approved **and** public | lines 124-126: approved only, **no visibility filter** |
| Automatic match (no `trip_guides` rows) | lines 93-103: approved, public, specialties overlap; **no `is_sample` filter, no region filter** | lines 127-138: same |

- No migration inserts `trip_guides` rows (only the table in `20261015000000_tours.sql` line 130), so the 35 tours published on 2026-10-31 (`20261031000200_publish_tours.sql`; the file header still says "DRAFT, NOT APPLIED", confirm on live) all use the automatic match.
- Every published tour whose categories map to a specialty (`SPECIALTIES_BY_CATEGORY`, `packages/shared/src/tours.ts` line 340: mountain, walking, safari, chimpanzee, beach, marine, cultural, historical, event) gets up to 4 approved public guides. With no real approved guides yet, these are sample guides. All have `rating_count = 0`, so the order among them is arbitrary.
- **Region is ignored**: a Zanzibar sample guide (Zawadi, Asha, Fatma) can be suggested on the Moshi Chagga or Ng'iresi tour. Same problem for real guides later.
- The tour's enquiry form lists these guides (`apps/web/src/app/[lang]/tours/[slug]/page.tsx` line 520), so a traveller can address an enquiry to a sample guide (it goes to the admin inbox per the seed comment, but nothing on the tour page says so).

How they are labelled today:

- **Web** `MeetGuides` (`tours/[slug]/page.tsx` lines 419-450): no sample label. The only label is the name suffix in the data ("Baraka (sample guide)"). The verified tick is correctly hidden (samples have no recorded checks).
- **App** `GuideRow` (`apps/mobile/src/app/tour/[slug].tsx` lines 330-353): no sample label, and line 337 shows a green tick after **every** name unconditionally. That reads as "verified" for sample guides and for any real guide without recorded checks. This breaks the honesty rule today.
- **About to get worse:** the realistic-names draft (`docs/guides/sample-guides-2026-10-31.md`) removes "sample" from names and relies on the UI label "on every card and page". Applied as it stands, sample guides would appear on 35 live tours under realistic names with **no label at all** on "Meet your guides" (web and app).

**Gate:** the realistic-samples seed must not be applied on live until section 2 is live on the website and in an app build/update.

Latent bug (not sample-specific): the app's linked path lacks `g.visibility === 'public'`, so a `link_only` guide linked to a tour would show in the app but not on the web. Fix in the same change.

## 2. Proposal: label sample guides on "Meet your guides" (web and app)

Code only, no migration. `is_sample` is already in `GUIDE_COLUMNS` on both (web `apps/web/src/lib/guides.ts` line 46; app `api.ts` line 42). The texts exist: `t.extras.sampleGuide` (used by `apps/web/src/components/guide-card.tsx` line 53, `apps/mobile/src/components/cards.tsx` line 41) and `t.extras.sampleGuideNote`.

Web, `MeetGuides`:
1. Under the name: when `g.is_sample`, the same sand badge as `guide-card.tsx` ("Sample guide"); hide `RatingSummary` ("New guide") for samples.
2. Below the list, once, when any shown guide is a sample: `t.extras.sampleGuideNote` (enquiries reach Kwetuly, not a real guide).
3. Enquiry select (line 520): option text `display_name · Sample guide` for samples.

App, `GuideRow`:
1. Replace the unconditional tick with the rule in `cards.tsx` line 41: sample badge when `is_sample`, tick only when `hasRecordedCheck(guide)`.
2. Hide "New guide" for samples; one `sampleGuideNote` line under the list.
3. `api.ts` line 125: add `&& g.visibility === 'public'`.

Both paths (linked and automatic):
4. Real guides before samples: add `.order('is_sample', { ascending: true })` first in the automatic query (web and app).
5. Region fit: filter the automatic match by the tour's area. Simplest: overlap `guides.regions` with the region names of the tour's stops or a small `circuit -> regions` map in `packages/shared/src/tours.ts`; if nothing matches, show none rather than the wrong coast. Needs a decision on the map, so it can follow 1-4.
6. `trip_guides` rows for samples (board step 2, guide-success table) are fine once 1-3 are live; delete-all already removes them through `on delete cascade` on `trip_guides.guide_id`.

Cache: web `getTourGuides` is tagged `guides`, so the admin delete-all must `revalidateTag('guides')` (check it does). Size: S, frontend-engineer, no new texts. Then qa-tester (web and app, a tour with samples linked and one with automatic match). No security-reviewer needed (no personal data or rules change).

Quick stop-gap if Walter wants it before the label ships: `.eq('is_sample', false)` on the automatic query in both files. Tours would then show no guides until real ones are approved; linked samples (step 2) would still show.

## 3. VIP personal trip host and investment visit host

**They are guide services, not new account types or business types.** `docs/tech/one-account-roles-and-sign-in.md` section 3.2: one guide profile, many services; a service is offered when the guide has an approved package of that kind; `guide_specialty` is not extended because it is also the trip type on trip requests and group trips.

| | VIP personal trip host | Investment visit host |
| --- | --- | --- |
| Profile | normal `guides` row | normal `guides` row |
| Who they serve | `guides.expertise` already has `vip` (`packages/shared/src/expertise.ts` line 24); travel style `vip` exists on tours | add expertise `investors` (7 languages) or nothing |
| Service | new package kind **`personal_host`** | new package kind **`investment_visit`** |
| Approval | not in `SIMPLE_PACKAGE_KINDS` (`apps/web/src/lib/admin-queue.ts` line 44): approved one by one | same, plus a legal checklist in the review |
| Excluded (legal, step 1d) | close protection and security work; driving (transfers stay off until the `transfer` kind and its licence checks exist); no holding money | no investment, legal or tax advice; no promise of approvals or speed; no payments to officials; official links only (TISEZA, as on the invest page `packages/shared/src/invest.ts`); the host does logistics, interpreting and visits, not representation before TISEZA |
| Privacy | VIP names and plans are personal data under PDPA 2022: keep in the existing private enquiry flow, never on public pages | same |

Why not a business type: `BUSINESS_TYPES` (`packages/shared/src/businesses.ts`) are places and companies with listings (hotel, transport, shop). A host is a person. A concierge **company** could later list as `other` or a new `concierge` type, but that is not needed for the samples.

Work: one migration (extend the check list on `guide_packages.kind`, `20261016000100_guide_packages.sql` line 9; it is a `text` check, not an enum, so it is a drop-and-add constraint), `PACKAGE_KINDS` in 7 languages, package form help text for the two kinds (English and Kiswahili for hosts), "Services" line on the profile (already planned in 3.2). Can be done together with the 3.2 kinds (`safari`, `mountain`, `transfer`, lessons) in one migration. Size S. The two sample hosts are then two sample guides with one sample package each, in the realistic-samples seed.

## 4. "Become a host" application

Nothing new is needed in the database; the pipeline exists:

1. New page `apps/web/src/app/[lang]/hosts/page.tsx` (and a section in the app later): what a host does, what is excluded (section 3), the checks Kwetuly makes (identity, licence where needed, references), commission disclosure. Traveller-visible parts in 7 languages; host-facing parts in English and Kiswahili.
2. Its button goes to the existing sign-up: `/[lang]/join?role=guide` (`(auth)/join/page.tsx` line 47 already reads `role`). The invite code is checked in the database at sign-up (`20261016001500_invite_codes.sql`, `private.redeem_invite`, `handle_new_user`). Without a valid code the account stays a traveller until the welcome step, as today, so recruitment stays invite-only. Walter creates a host-specific code in admin, so uses can be counted per code.
3. The person completes the normal guide onboarding; the guide row is created with `verification_status = 'pending'` and already appears in the admin review queue (`apps/web/src/lib/admin-queue.ts` line 272, shown on `apps/web/src/app/[lang]/admin/review/page.tsx`).
4. To mark them as a host: they add a `personal_host` or `investment_visit` package (section 3), which lands in the same queue as a pending package (line 273). Optional, no migration: a `?intent=host` on the join link that the onboarding stores in the user's metadata, shown as a "wants to be a host" line on the queue item.

Not recommended: a separate applications table. It would store personal data twice and needs its own RLS, retention and deletion path.

Reviews: security-reviewer (personal data in the form and onboarding, the copy about checks), qa-tester (code, onboarding, queue). Publishing the page and any outreach: Walter.

## 5. Adding a "cycling" tour category: size S

`trips.categories` is a Postgres enum array (`public.trip_category`, `20261012000700_trips.sql` lines 7-8, 21), so it needs a migration.

1. Migration A: `alter type public.trip_category add value 'cycling';` (alone: a new enum value cannot be used in the same transaction). Migration B, data: add `cycling` to `mto-wa-mbu-village-bike` (and any other bike tour Walter confirms). Both need Walter's approval on live.
2. `packages/shared/src/trips.ts` `TRIP_CATEGORIES`: one entry with an icon and 7 labels. Check that the icon name exists in the web `Icon` component (`apps/web/src/components/icon.tsx`) and in the app `components/glyph.tsx` (SF Symbol `bicycle`, Material `directions-bike`); add it if not.
3. `packages/shared/src/tours.ts`: `SPECIALTIES_BY_CATEGORY.cycling = ['cultural', 'day_trips']` (no guide specialty for cycling; do not add one, same reason as section 3), and in `tourMatchesTheme` let `cycling` count for the `cultural` theme (or `mountain`, Walter's call). Add a shared test.
4. Admin trip form picks it up automatically (`admin/trips/actions.ts` line 193 filters by `TRIP_CATEGORIES`); web trip card and app `categoryName` read the same list.

About half a day including tests; localization checks the 7 labels.

## Order

1. Section 2, items 1-4 (labels, app tick, visibility filter, real guides first): before anything else, and before the realistic-samples seed goes live.
2. Confirm live state (backend-engineer read-only SELECT): sample guide visibility, `trip_guides` rows, which tours are published.
3. Region fit for the automatic match (section 2 item 5).
4. Package kinds `personal_host` and `investment_visit` with the 3.2 kinds, after legal (step 1d).
5. Cycling category.
6. "Become a host" page, after Walter approves the wording.
