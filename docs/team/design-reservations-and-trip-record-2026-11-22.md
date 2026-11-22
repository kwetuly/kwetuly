# Design: reservations with commission, and the trip record (2026-11-22)

Addendum to `docs/team/design-crew-and-trip-management-2026-11.md` ("TD" below) and to its paid verification addendum ("A.x"). Written by `tech-lead` for the board item "2026-11-22 Service bookings and trip dashboard". **Paper only:** no code, no migration written or applied, nothing live, nobody contacted.

Walter approved decisions 1-10 of 2026-11-22 ("yes to all") with these overrides, which this paper follows:
- **Build now**, not after launch. Each slice still ships to live only with Walter's yes.
- **Do not wait for the lawyer.** The team lawyer (and then the Tanzanian advocate) fixes wording and rules before official go-live. Every point marked **[legal]** is a placeholder to be checked then.
- **Kwetuly earns commission on reservations** (replaces decision 3).
- All trip points are in scope now: arrival, daily report, departure, diet, insurance, the trip process per role, crew pay records, incident reports, offline in the app.

Where this paper and TD disagree, this paper wins.

## 0. What exists today (read from the migrations and the live project, read-only)

1. **Live database:** the migration history on live ends at `traveller_groups_call_before_publish` (2026-11-08). The tables of migration A (`person_documents`, `person_document_checks`, `person_check_log`, `person_identifiers`, `business_identifiers`, and `private.tz_today()`) and of the Flutterwave work (`payment_provider_details`, `payment_events`, `payment_checkout_links`) are on live but not in the history list (Walter pasted them by hand).
2. **Drift:** live also has four migrations with **no file in any branch** of the repo: `feature_switches`, `trip_category_farm_retreat`, `experience_package_kinds`, `stories`. New migrations must not be written on top of a repo that does not match live (slice 0).
3. **Migrations B, C and D are not written.** The only trace is the design (A.2-A.6, commit a09dfc3). No file named for crew, `price_list` or feature rules exists in any branch or worktree. `/admin/prices` is a read-only grid that says "Price saving opens soon"; there is no `price_list` table.
4. **Nothing of the trip record exists**: no `trip_files`, days, updates, crew, diet, insurance or incident tables. `trips` is the tour library (TD fact 2).
5. **Businesses:** `providers.business_type` already includes `restaurant`, `spa`, `salon`. There are no opening hours and no bookable services. `listings` (pillar enum, USD price) is the item table for the shop catalogue and does not fit timed services.
6. **Commission pattern that works today:** `business_agreements` (per business, percent) plus `referral_sales` (status `reported`, `invoiced`, `paid`) and the monthly statement at `/admin/commissions`. Reservations reuse that page and the same three statuses.
7. **Enquiry envelope:** `leads` already reaches the business owner by WhatsApp (`order_alerts_to_owner`, live). Reservations use a `leads` row as the envelope, like the orders design (`docs/tech/items-approvals-orders-design.md` 1.2).
8. `service_bookings` exists on live (empty, unused, made for Kwetuly's own paid services with a Selcom order id). **Do not reuse it** for reservations; it has payment columns and the wrong meaning.
9. **App:** `expo-sqlite` (localStorage) and `expo-crypto` are installed. `expo-secure-store` and a network listener are not. React Query keeps data in memory only.

## 1. Decisions this paper takes (Walter can still change them)

| # | Decision |
| --- | --- |
| P1 | Commission rate is set **per business type** (restaurant, spa, salon) in `/admin/prices`, as a `price_list` row: either **TZS per guest** or **percent of the listed service price**. No rate active for a type means no "Reserve" button for that type. |
| P2 | Commission is owed only on **completed** reservations. Declined, cancelled (by anyone, at any time), no-show, expired and disputed reservations owe nothing. Kwetuly never charges the traveller anything. |
| P3 | A confirmed reservation that the business has not marked by 3 days after its time becomes **completed automatically**. The business confirmed it and had 3 days to say "did not come". |
| P4 | The traveller is asked the day after "Did your visit happen?" A mismatch with the business's answer marks the reservation **disputed**; commission is held until an admin decides. |
| P5 | One retention rule for diet, allergy and insurance data: **deleted 30 days after the end date** (trip end, or the reservation date); phone copies are cleared 7 days after. Chosen because 30 days matches the review and dispute window. **[legal]** |
| P6 | Incident reports are kept **2 years** (evidence for insurance and complaints), then deleted. **[legal]** |
| P7 | Fold the `price_list` table of migration C into slice 1 (table only, exactly as A.4). Write migration B as its own slice (slice 3). Do **not** fold D: the new tables use narrow helpers now and switch to `has_feature` when D lands. |
| P8 | Spa and massage: reservations switch on only when Kwetuly has a **current premises or business licence check** for that business (`person_document_checks`, kind `business_licence`, migration A, live). No home visits: services have no "at your place" option and the form has no address field. **[legal]** |

## 2. Slices in build order

Each slice is one migration, web screens and app screens. Sizes: S = days, M = 1-3 weeks.

| Slice | Contents | Size | Needs |
| --- | --- | --- | --- |
| 0 | Repo matches live: pull the four undocumented migrations and the hand-pasted A and Flutterwave SQL from live (read-only) into migration files | S | nothing |
| 1 | Business setup: opening hours, services offered, `price_list` with reservation commission rates, "take reservations" switch and terms | S-M | 0 |
| 2 | Reservations: request, statuses, diet line, commission recorded, monthly commission owed per business | M | 1 |
| 3 | Crew account type (migration B as designed in A.2 and A.6) | M | 0 |
| 4 | Trip file core: files, people, days, arrival and departure, daily reports, crew list and check-in, reservations linked to a day, trip process view per role, operator list, offline cache and send queue | M-L | 2, 3 |
| 5 | Incident reports (private, offline, admin alert and 4-hour queue) | S-M | 4 |
| 6 | Crew pay records (guide records, person confirms or disputes) | S | 3, 4 |
| 7 | Diet and insurance on the trip file, cooks' view from 3 days before, deletion job | S-M | 4 |

Slice 2 can go live before 3-7: it is the part that earns money. Slices 5, 6 and 7 are independent of each other after 4.

---

### Slice 0: repo matches live

- backend-engineer reads the definitions of `feature_switches`, `trip_category_farm_retreat`, `experience_package_kinds`, `stories`, the migration A objects and the Flutterwave tables from live (read-only queries, schema only, no rows) and commits them as migration files with their live version numbers. Then checks that a local stack built from the repo matches live (`list_tables` verbose compared).
- No live change. Walter does nothing except approve the merge.

### Slice 1: business setup and commission rates

**Migration `..._reservation_setup.sql`**

`public.business_hours`: id, provider_id (fk providers, cascade), weekday smallint (0 Sunday to 6), opens time, closes time, check `closes > opens` (no overnight hours in version 1), up to 3 rows per day (trigger).

`public.business_closed_dates`: provider_id, day date, note text (up to 80), primary key (provider_id, day).

`public.business_services` (what can be reserved; spa and salon must have at least one, restaurants may have none):
| Column | Notes |
| --- | --- |
| id, provider_id | |
| name text | 2-80 characters, owner's words (en or sw) |
| duration_min int | 15-480; restaurants: default table time, 90 |
| price_tzs integer null | the business's own listed price; **required for spa and salon** when the type's rate is a percent |
| max_people int | 1-50 |
| active boolean, sort int, created_at, updated_at | |

`public.price_list`: exactly A.4 and PV 2.1 (amount null = "not set", `status` draft, active, legal_hold, one active row per key and date, frozen after first use, every save logged). Seeded with three rows, all **null and draft**: `account_type = business`, `business_type` restaurant, spa, salon, `service_code = reservation_commission`. For this service: `period = 'percent'` with `percent`, or `period = 'once'` with `amount_tzs` meaning **TZS per guest**. Migration C later adds only `price_ranks`, `subscriptions` and their triggers.

`providers` new columns: `takes_reservations boolean default false`, `reservation_terms_version text null`, `reservation_terms_at timestamptz null`, `reservation_min_notice_min int default 120` (30-2880), `reservation_max_days int default 60` (1-180). The guard trigger lets the owner switch `takes_reservations` on only when: approved business; type restaurant, spa or salon; terms accepted (version and time set by the server action, not typed); for spa, a current `business_licence` check (P8); at least one opening hours row; and spa or salon with at least one active service.

`public.reservation_rate(p_provider uuid)` (security definer, `search_path = ''`, anon and authenticated): returns `kind` (`per_guest` or `percent`) and the value from the active `price_list` row for the business's type, or nothing. The public page shows the disclosure from this.

**RLS:** hours, closed dates, services: anyone reads rows of approved, `takes_reservations` businesses (and samples); the owner writes own; admins all. `price_list`: anyone reads `active` rows; admins with two-step sign-in write. No client ever writes a commission value anywhere else.

**Web:** `dashboard/business/reservations-setup` (owner, en and sw): hours per weekday, closed dates, services list, the terms (shows the current rate: "Kwetuly receives {rate} for each reservation that takes place. You do not add this to the guest's price."), switch on. `/admin/prices`: the three reservation commission rows become editable (TZS per guest or percent, active from a date); the rest of the grid stays read-only until C.
**App:** the same owner setup screen in the business area (en and sw).
**Walter:** type the three rates in `/admin/prices` and set them active. Until then nobody sees "Reserve".

### Slice 2: reservations and commission owed

**Migration `..._reservations.sql`**

Enum `public.reservation_status`: `requested`, `confirmed`, `declined`, `other_time_offered`, `cancelled`, `no_show`, `completed`. Plus `disputed` as a separate flag (P4), not a status, so the history stays readable.

`public.reservations`
| Column | Notes |
| --- | --- |
| id uuid pk | |
| lead_id uuid unique, fk leads | the envelope: owner alert, admin view, deletion scrub already work |
| provider_id, traveler_id | traveller = `auth.uid()`; never the business's own owner |
| service_id uuid null | required for spa and salon |
| starts_at timestamptz | Tanzania time on screens; within opening hours, not a closed date, between min notice and max days (checked in the function) |
| party_size int | 1 to the service's `max_people` (restaurant default limit 20) |
| note text null | up to 300, masked like messages (no phone numbers or links) |
| status, status_at, cancelled_by (`traveller`, `business`, `admin`) | |
| offered_starts_at timestamptz null | set with `other_time_offered` |
| business_note text null | up to 300, shown to the traveller |
| traveller_said_happened boolean null, disputed_at, dispute_resolved_at, dispute_outcome (`completed`, `no_show`) | P4 |
| completed_by text null | `business`, `auto`, `admin` |
| trip_file_id uuid null, trip_day_no int null | added in slice 4 (fk then) |
| commission_kind, commission_rate, price_basis_tzs | **copied at request time** from `reservation_rate()` and the service price, so the disclosed rate is the rate owed |
| commission_tzs integer null | set by the trigger when the status becomes `completed`: per guest x party size, or percent x service price x party size, rounded to whole shillings |
| commission_status | `none`, `owed`, `invoiced`, `paid`, `waived`; `owed` only when completed and not disputed |
| price_list_id fk | the row used |
| is_sample boolean | sample businesses take sample reservations; commission is always `none` for samples |
| created_at, updated_at | |

`public.reservation_diet_lines`: reservation_id pk (cascade), `text` (up to 120, the only free text, masked), `consent_at` not null, `delete_after date` (reservation date + 30, P5). **Never** copied into `leads.message`, notification payloads, chat or analytics.

**Functions (no direct insert or update grant on either table):**
- `public.place_reservation(provider, service, starts_at, party_size, note, diet_line, trip_file_id null)` (security definer): signed in and onboarded (`private.is_onboarded()`); not crew (when B exists); business approved and `takes_reservations`; an active rate exists; time rules; at most 5 open requests per traveller and 3 per traveller per business per day; inserts the `leads` row (message built without the diet line), the reservation with the rate copied, and the diet line.
- `public.reservation_action(id, action, offered_starts_at null, note null)` (security definer, state machine):

| From | Action | By | To |
| --- | --- | --- | --- |
| requested | confirm / decline / offer other time | business owner | confirmed / declined / other_time_offered |
| requested, other_time_offered | cancel | traveller | cancelled |
| other_time_offered | accept (starts_at := offered) / refuse | traveller | confirmed / cancelled |
| confirmed | cancel | traveller or business | cancelled |
| confirmed, after `starts_at` | mark came / did not come | business owner | completed / no_show |
| confirmed, `starts_at` + 3 days | (daily job) | system | completed, `completed_by = auto` |
| requested or other_time_offered, past `starts_at` | (daily job) | system | declined, note "no answer" |
| completed or no_show, the day after | "Did your visit happen?" yes / no | traveller | sets `traveller_said_happened`; a mismatch sets `disputed_at`, commission `none` until resolved |
| disputed | resolve | admin | `dispute_outcome`; commission follows it |

Every other move is refused. Statuses never go back except by an admin, and every admin change is logged.

**Commission rules (P2):** owed only on `completed` and not disputed. No-shows: no commission; the business keeps its no-show count. Cancellations, late or not: no commission and **no fee to the traveller** (there is no deposit). A traveller with 2 no-shows in 90 days cannot reserve for 30 days (proposal for operations-manager). A business that cancels many confirmed reservations is flagged for an admin (proposal).

**Commission owed list:** view `public.reservation_commission_monthly` (`security_invoker`): provider, month (Tanzania date of `starts_at`), count completed, total `commission_tzs`, by `commission_status`. `public.admin_set_commission_status(provider, month, status)` moves all `owed` rows to `invoiced`, or `invoiced` to `paid`, logged. The business reads its own reservations with the commission of each (no surprise on the invoice). Accounting invoices outside the app; the business pays Kwetuly directly. Kwetuly never holds the traveller's money.

**Notifications** (existing `notify_user` and outbox): new request to the owner (WhatsApp, through the existing lead alert); confirm, decline, other time to the traveller (push and email); a reminder to the owner at `starts_at` + 2 hours to mark came or did not come. No diet line, no note and no phone number in any payload.

**RLS:** traveller reads own reservations and own diet line; business owner reads reservations of own providers, and the diet line only while the reservation is requested, confirmed or other_time_offered and until the day after `starts_at`; admins read all. Columns listed in every select. `scrub_deleted_user` clears notes and the diet line of a deleted traveller, keeps the commission figures.

**Web:** on restaurant, spa and salon pages (7 languages): "Reserve" with date, time (only open slots), people, service, note, optional diet line with "Only {business} sees this, for this reservation. Deleted 30 days after.", and the **disclosure before Send**: "{business} pays Kwetuly {rate} when your reservation takes place. You pay {business} its normal price on the day. Nothing is added for you." Traveller "My reservations" with status and actions. Owner `dashboard/reservations` (en, sw): today and upcoming, confirm, decline, offer other time, came or did not come, commission per reservation and per month. `/admin/commissions`: a "Reservations" section per month, per business, with invoiced and paid buttons. `/admin/reservations`: read-only list with disputes first.
**App:** the same three traveller screens and the owner list, with the same rules.

### Slice 3: crew account type (migration B)

Exactly A.2 and A.6 row B: B1 enum value alone, then B2 `crew_members`, `crew_private`, guard, new `complete_onboarding` with crew roles, `scrub_deleted_user` extended (recommended: delete the crew row with the account). Screens: crew welcome step (Kiswahili first), crew profile and switches, web and app (en and sw). Needed so a crew member can confirm "I am on this trip" and "I was paid". Without it slice 4 still works with typed first names only.

### Slice 4: trip file core

**Migration `..._trip_files.sql`** (TD 3.1, 3.2, 2.4 as written, plus the items below)

New tables: `trip_files`, `trip_file_people`, `trip_file_days`, `trip_day_updates` (the **daily report**), `trip_crew`, `trip_milestones`; helper `private.trip_file_role(file)`; `public.trip_file_bundle(file)`; `reservations.trip_file_id` and `trip_day_no` foreign keys. File sources and the "Yes, this is my trip" rule for package files as TD 3.1.

Daily report (`trip_day_updates`) adds to TD 3.2: `meals_ok boolean null`, `crew_count int null`, `next_plan text null` (up to 200). Still add-only, id made on the phone, `recorded_at` kept between start minus 1 day and now, `received_at` from the server, both shown. No location, no "safe".

`public.trip_milestones` (arrival and departure, decision 9):
| Column | Notes |
| --- | --- |
| id uuid pk (made on the phone) | |
| trip_file_id | |
| kind | `arrived` ("met the guide"), `departed` ("trip ended") |
| user_id uuid null | one traveller, or null for the whole group |
| place_text text null | up to 80, a name (airport, hotel, gate), never coordinates |
| note text null | up to 200; no flight numbers asked for |
| recorded_by, recorded_at, received_at | lead guide or organiser |
| traveller_confirmed_at | the traveller taps "Yes, I met my guide" / "Yes, my trip ended" |

The first `arrived` moves the file to `under_way`; a `departed` for everyone allows `finished` (TD 3.1 rules stay). No airport pickup is booked (transfers off).

**Trip process view per role** (one file, decision 10; every view reads only through `trip_file_bundle`):
| Role | Sees | Does |
| --- | --- | --- |
| Traveller | days, latest report per day with both times, arrival and departure, crew first names (TD 3.9 rule), own reservations on each day, official visa and insurance links (the ones on `/travel-info`) | confirm arrival and departure, add a reservation to a day, own diet and insurance (slice 7) |
| Lead guide or organiser | everything on the file except crew pay of other guides and admin notes | edit days, write daily reports, record milestones, crew list and check-in, incident report (5), crew pay (6) |
| Tour operator | a list of all files where they are organiser, with status and last report time | same as organiser on each file |
| Crew | days, own role, own check-in, cooks see diet from 3 days before (7) | confirm "I am on this trip", own pay records (6) |
| Admin | every file, open incidents first | resolve, never edit reports |

**RLS:** every policy uses `private.trip_file_role()`; reports, milestones and check-ins are insert-only for the lead guide or organiser, no update or delete except admins; days editable by the organiser or lead guide with `updated_at` as version (TD 4).

**Web:** `trips/my` and `trips/{file}` per role (traveller texts 7 languages; guide, operator and crew texts en and sw); operator list; admin `/admin/trip-files`. Online only.
**App:** the same screens, plus offline (section 3).

### Slice 5: incident reports

**Migration `..._trip_incidents.sql`**

`public.trip_incidents`
| Column | Notes |
| --- | --- |
| id uuid pk (made on the phone) | sending twice does nothing |
| trip_file_id, day_no null | |
| reported_by | lead guide or organiser (decision 8) |
| kind | `illness_injury`, `altitude`, `evacuation`, `vehicle`, `theft_loss`, `conduct`, `route_weather`, `other` |
| severity | `minor`, `serious`, `emergency` |
| happened_at (phone time, bounded), received_at | |
| place_text | up to 80, a name, no coordinates |
| people_affected int | count only, no names in fields |
| summary, actions_taken | up to 1000 each; may hold health facts, treated as health data |
| rescue_called boolean, rescue_note text null | up to 120: who was called |
| delete_after date | happened_at + 2 years (P6) |

`public.trip_incident_admin` (admins only): incident_id pk, `acknowledged_at`, `acknowledged_by`, `status` (`open`, `acknowledged`, `closed`), `admin_note`.

- Insert trigger calls `private.notify_admins('trip_incident', {incident_id, severity})`: ids only, no text. WhatsApp and email to admins: "New incident report. Open the admin page."
- `/admin/incidents`: open first, time since received, red after 4 hours without acknowledgement (decision 8, `docs/operations/admin-queues.md` safety level). Whether `emergency` reports page Walter outside working hours (08:00-18:00, Monday-Saturday) is for operations-manager and Walter.
- **Read:** the author and admins only. Not travellers, crew, the operator (unless he wrote it), and not the trip report. No edit after sending; an addition is a new report pointing to the first (`follow_up_of uuid null`).
- **Screen, first thing on it:** "If someone is in danger, call for help first." with the official emergency numbers from operations-manager's list (official sources only, kept in shared code, none invented here), then the form. The form never says help is on its way.

### Slice 6: crew pay records

**Migration `..._trip_crew_pay.sql`**

`public.trip_crew_pay`
| Column | Notes |
| --- | --- |
| id uuid pk (made on the phone) | |
| trip_crew_id fk | |
| amount_tzs integer | > 0 and below a typo ceiling |
| method | `mobile_money`, `bank`, `cash` |
| paid_on date | |
| reference text null | up to 20 letters and digits (a mobile money reference); no phone numbers |
| recorded_by, recorded_at | lead guide or organiser |
| withdrawn_at | the guide may withdraw before the person answers; a correction is a new row |
| response | `pending`, `confirmed`, `disputed` |
| responded_at, response_by (`self`, `admin_call`) | |
| dispute_note text null | up to 300; admins and the person only |

- **No link to `payments`** (no foreign key, no money columns elsewhere). Screen text: "Recorded by the guide. Kwetuly does not handle this money."
- Only the person (own account through `crew_members.owner_id`) answers; for a typed name with no account the row stays "not confirmable" unless an admin records a phone call (TD 2.1 pattern). No edit after an answer.
- **Read:** the person, the guide who recorded it, admins. Never travellers, other crew, the public or the operator's other guides; no totals anywhere public. The guide sees "disputed, Kwetuly will contact you", not the note.
- A dispute notifies admins (ids only) and is listed on `/admin/trip-files`.
- Screens: guide (en, sw) "Team paid" per trip; crew (en, sw, Kiswahili first) "Nimelipwa" / "Sijalipwa" with an optional note.

### Slice 7: diet and insurance on the trip file

**Migration `..._trip_member_needs.sql`:** `trip_member_needs` and `trip_member_insurance` exactly as TD 3.3 and 3.4, with `delete_after` = end date + 30 (P5), plus a daily job that deletes rows past `delete_after` (and diet lines of slice 2, and incidents of slice 5 past theirs).

Access (decision 5):
- **Diet:** the traveller; the lead guide; crew with role `cook` self-confirmed on that file, from 3 days before `start_date` until `end_date`, through `public.trip_needs_for_cooks(file)` (first name and items only). Not the organiser unless he is the lead guide.
- **Insurance:** the traveller, the lead guide and admins only. Not crew, not the organiser.
- A diet line on a reservation (slice 2) is separate and goes only to that business.
- Never in notifications, chat previews, analytics, exports or the bundle's plain part.
- Screens (7 languages): fixed diet list plus up to 200 characters, "Who sees this" line; insurance fields all optional with "Kwetuly does not sell, check or recommend insurance" and the official NIC (mainland) or ZIC (Zanzibar) link from shared code.

## 3. Offline in the app (slices 4, 5, 6, 7)

The smallest approach that works on the mountain; the website stays online only.

- **Download once:** `trip_file_bundle(file)` returns one JSON for the caller's role, text only, under 30 KB, in two parts: `plain` (file, days, latest reports, milestones, crew first names and roles, own reservations) and `private` (own diet and insurance, cooks' diet list, own pay records). Fetched on opening the file, on app start when online, and by the "Update before you go" button.
- **Stored on the phone:** `plain` through React Query persistence into the existing SQLite localStorage (trip queries only). `private` and every queued incident and pay record in **`expo-secure-store`** (iOS Keychain, Android Keystore), one key per item to stay under about 2 KB each. This adds a native module, so it needs a new development build.
- **Send queue:** one outbox in SQLite for daily reports, milestones and check-ins; incidents and pay records in the secure store. Each item carries its phone-made id, so a repeat send does nothing (`on conflict (id) do nothing`). Sends in order when the network comes back (`expo-network` listener, also new), on app foreground and after a success, waiting longer after each failure; refreshes the sign-in session before sending. The screen says "Waiting to send (3)" and, for incidents, "Not sent yet. If someone is in danger, call for help now."
- **Clearing:** the whole trip cache 7 days after `end_date`; everything on sign-out (with a warning if items are still waiting to send).
- **Not offline:** reservations, reviews, jobs, uploads, admin.

## 4. Security notes per table

| Table | Writes | Reads | Notes for security-reviewer |
| --- | --- | --- | --- |
| business_hours, closed_dates, services | owner, admin | public for live reserving businesses | owner cannot write for another provider |
| price_list | admin, two-step | active rows public | no client sets a rate or amount anywhere else |
| reservations | only `place_reservation`, `reservation_action`, daily job | traveller own, owner own business, admin | rate copied at request; commission set only by trigger; owner cannot mark came before `starts_at`; throttles; no reservation at own business |
| reservation_diet_lines | only `place_reservation` | traveller, that business in its window, admin | never in leads, outbox, logs |
| trip_files and children | organiser, lead guide (insert-only for reports, milestones, check-ins) | `trip_file_role` | package files need the traveller's yes; phone times bounded |
| trip_incidents | author insert only | author, admin | outbox ids only; 2-year delete |
| trip_crew_pay | recorder insert, person answers | person, recorder, admin | no link to payments; answer only by owner of the crew row |
| trip_member_needs, insurance | the traveller | as section 2, slice 7 | cooks through a function; 30-day delete |

All: RLS on; listed columns, no `*`; definer functions with `search_path = ''`, execute revoked from `public` and `anon` unless needed; `is_sample` on public-facing rows; `scrub_deleted_user` extended per slice; SQL tests as traveller, owner of another business, guide not on the file, cook before day minus 3, crew on another trip, operator, admin.

## 5. Texts

- Traveller texts in all 7 languages: reserve form, disclosure, statuses, "Did your visit happen?", trip file traveller view, arrival and departure confirm, diet and insurance screens.
- Guide, operator, crew and business owner texts in English and Kiswahili: setup, owner reservations, daily report, milestones, incident form, team paid, crew confirm.
- Admin texts in English, as today.
- Every text follows `docs/brand/voice.md`; localization writes, Walter checks the Kiswahili. No word "free" for included items; no "safe" or "verified".

## 6. Who does what, per slice

| Slice | backend-engineer | frontend-engineer | Reviews | Walter |
| --- | --- | --- | --- | --- |
| 0 | pull live definitions into files, compare | none | qa-tester: local stack matches live | approve merge |
| 1 | migration, RLS, guard, `reservation_rate` | owner setup (web, app), `/admin/prices` rows | security-reviewer (prices, guard), qa-tester | paste SQL on live; type the 3 rates; approve terms text (legal drafts) |
| 2 | migration, functions, daily job, view, notices | reserve form, My reservations, owner list, admin sections (web, app) | security-reviewer (personal data, diet line, commission integrity), qa-tester (every status move, disputes, samples) | paste SQL; approve go-live; accounting gets the first monthly list |
| 3 | migration B as A.6 | crew welcome and profile | security-reviewer, qa-tester | paste SQL (B1 then B2) |
| 4 | migration, bundle, helper | trip screens per role, operator list, offline cache and queue | security-reviewer, qa-tester (airplane mode on a real phone) | paste SQL; new development build (EAS, his account) for secure store and network |
| 5 | migration, admin alert | incident form, admin queue | security-reviewer, qa-tester (offline send, 4-hour flag); operations-manager supplies the official numbers | paste SQL; who is on call for `emergency` |
| 6 | migration | team paid, crew confirm | security-reviewer, qa-tester | paste SQL |
| 7 | migration, deletion job | diet, insurance, cooks' view | security-reviewer (health data), qa-tester | paste SQL |

localization works in every slice with screens; designer checks the new screens at 375 px. No agent applies anything on live; Walter pastes each migration after the reviews pass.

## 7. What this pulls forward in the trip design phases

- Phase 2 (trip files, days, updates, crew list and check-in, offline) is pulled forward into slice 4. Included items, rentals (D6, D7) and the trip report (D8) stay in phase 2 but are **not** in these slices; they can follow slice 4.
- Phase 5 (diet, insurance, deletion jobs) is pulled forward into slice 7, without waiting for the advocate. The family share link stays in phase 5.
- Phase 1 is partly pulled forward: only the crew account type (slice 3), not teams, invites or claim codes.
- Phases 3 and 4 (reviews linked to files, crew notes, jobs) are unchanged.
- New, not in TD: reservations, commission, milestones, incident reports, crew pay records, operator list.

## 8. Open points

For Walter: (1) per-business commission rates that override the type rate (through `business_agreements`), or one rate per type only? Recommended: one rate per type at first. (2) Traveller no-show limit (2 in 90 days, 30-day pause). (3) May travellers and crew also send an incident report, or only the lead guide (decision 8)? Recommended: lead guide now, others through the private feedback channel later. (4) On-call for `emergency` incidents outside working hours.

**[legal]** before official go-live: reservation terms for businesses and the commission disclosure wording; spa and massage licence type and conduct; food allergy liability for the diet line; the 30-day rule for health and insurance data and the 2-year rule for incidents (PDPA 2022); crew pay records as evidence; incident reports and liability.
