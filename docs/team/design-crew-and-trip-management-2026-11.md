# Design: crew (C1-C7) and trip management (D1-D9), data and access (2026-11)

Task 2b of `docs/product/ideas-2026-11-08.md` (approved by Walter 2026-11-08). Written by `tech-lead`. **Paper design only:** no migration is written or applied, no code is changed, nothing touches the live database, and nobody is contacted. Build: crew first after launch, trip management months 2 to 4 after launch. Dietary needs (D3) and insurance details (D4) are built only after `legal` and `security-reviewer` have looked at them.

It follows the people rules already drafted by guide-success (`docs/guides/crew-teams-design-2026-11.md`, "GS" below) and hr with legal (`docs/team/crew-fairness-rules-2026-11.md`, "FR" below). Where this design needs one of their rules to be enforced by the database, it says so.

## 0. What I read, and facts that shape the design

Migrations: `20261012000100_private_helpers.sql` (`private.is_trusted`), `20261012000200_guides.sql` (guides, guide_private), `20261012000300_guide_role_and_leads.sql`, `20261012000500_calls_jobs_hub.sql` (`jobs`, `job_role`, `private.is_verified_guide`), `20261012001100_messaging.sql` (conversations), `20261013000200_guide_reviews.sql` (reviews, `can_review_guide`), `20261013000300_group_trips.sql` (group trips and members), `20261013000400_onboarding_phone.sql` (`complete_onboarding`), `20261013000500_group_chats.sql`, `20261014000100_trip_requests_offers.sql`, `20261014000200_payments.sql`, `20261015000000_tours.sql` (`trip_stops`), `20261016000100_guide_packages.sql` (`leads.package_id`), `20261016001400_admin_two_step_business_gate_deposits_leads.sql` (`private.is_admin` needs two-step sign-in, `has_approved_business`), `20261016001700` and `20261016001800` (`is_onboarded`, account scrub), `20261030000100_order_alerts_to_owner.sql` (latest `scrub_deleted_user`). Design notes: `docs/team/design-guide-checks-2026-11.md` ("GC" below), `docs/team/plan-guide-checks-2026-11.md`. App: `apps/mobile/src/lib` (no query persistence or offline store today, only `local-storage.ts`).

Facts:

1. **There is no single "booking" table.** A confirmed trip is one of three things today: an accepted `trip_offers` row (the traveller accepted a guide's or company's offer), an accepted `group_trip_members` row on an approved `group_trips` row, or a package enquiry (`leads.package_id`) followed by a conversation with `contact_unlocked = true`. The third has no "accepted" state at all. Trip management needs one anchor that points at any of the three.
2. **`trips` already means the tour library** (`trips`, `trip_stops`, `trip_guides`, `saved_trips`). New tables must not be called `trips` or `trip_days`. This design uses **`trip_files`** ("faili la safari") for the booked trip.
3. **Reviews are one per traveller per guide** (`unique (guide_id, author_id)`), not per trip, and eligibility is "accepted call or unlocked conversation". Nothing links a review to a trip, so a crew credit cannot yet be tied to "the trip where this porter carried my bag".
4. **Jobs are visible only to approved guides** (`private.is_verified_guide()`), so a porter can never see a porter job today. `jobs.pay` is free text, so the minimum-pay rule cannot be checked. `job_role` (`guide, assistant_guide, cook, porter, driver, other`) can be reused as the crew role list.
5. **Account types** are chosen once in `complete_onboarding` (`traveler`, `guide`, `provider`). There is no crew account type.
6. **Sign-in is email, Google or Apple only.** Phone sign-in waits for company registration (board 2026-10-30, decision 9). So most wapagazi with basic phones cannot hold an account at the start. GS route A (the guide invites, the person confirms by link or by a call from Kwetuly) means **a crew profile must be able to exist without an account**, with consent recorded by Kwetuly staff.
7. **The guide checks tables are not built yet** (GC migration 1 is still a draft). That is the moment to make them work for crew as well, instead of copying them later.
8. **The app has no offline store.** React Query caches in memory only. On the mountain (no signal above the first camps on most Kilimanjaro routes, patchy on safari) nothing would show after the app restarts.

## 1. Principles for the data

- **The person owns their crew profile, not the guide.** A guide can invite people, list a person on his own trip and remove someone from his team. He can never edit a crew profile, see a crew member's other teams, private feedback or ID, or give consent on their behalf (GS 2.1, FR 4.2). Enforced by RLS plus guard triggers.
- **Consent switches are data, off by default** (FR 4.1): named by travellers, show trip record, contact for jobs. Every read rule that shows a name, record or phone checks the switch at read time, so switching off takes effect at once (FR allows 48 hours; this is faster).
- **No stars, no averages, no ranking of people** anywhere in the schema: tags come from fixed lists, and only counts are shown.
- **Health, insurance and ID data live in their own tables** with their own column grants. They never go into `notification_outbox` payloads, logs or analytics (same rule as GC 1f), and they are deleted on a schedule after the trip.
- **Samples:** every new public-facing row type gets `is_sample` like guides, and is exempt from the live gate in the same way (GC 7).
- **Tanzania date:** every "has the trip ended / has the window closed" rule uses `private.tz_today()` from GC 2a.

## 2. Crew (C1-C7)

### 2.1 Crew profiles (C1)

`public.crew_members` (public-facing fields only)

| Column | Notes |
| --- | --- |
| id uuid pk | |
| owner_id uuid unique null, fk profiles on delete set null | the person's own account, when they have one. Null for basic-phone members confirmed by a call (fact 6) |
| first_name text not null (1-40) | the public name is `first_name` plus `last_initial` only (FR 4.3) |
| last_initial text null (1 char) | |
| roles job_role[] not null | `porter`, `cook`, `driver`, `assistant_guide`, `other`; check: not empty, never `guide` (guides use `guides`) |
| base_region text, languages text[], areas text[] | stated by the person, shown in grey as "Stated by {name}" |
| years_experience int null | stated by the person |
| photo_path text null | only if the person chose a photo (GS 3.3); public bucket, same 15 MB and image-type rules |
| looking_for_work boolean default false | |
| consent_status text not null default 'invited' | `invited`, `confirmed`, `declined`, `withdrawn` (check). Set only by the person, or by an admin recording a call |
| consent_method text null | `own_account`, `link`, `phone_call` |
| consented_at timestamptz null | |
| status review_status default 'pending' | admin approval (P-d: "each member's own profile approved by Walter") |
| live_until date null | computed like `guides.live_until` (GC 1e) from the crew member's required checks, section 2.3 |
| share_named_in_reviews, share_trip_record, share_contact_for_jobs boolean default false | the three switches (FR 4.1) |
| is_sample boolean default false | |
| created_by uuid | the inviting guide or the person; never gives edit rights |
| created_at, updated_at | |

`public.crew_private` (one row per crew member, crew_member_id pk): `phone` (international format, same check as onboarding), `whatsapp_number`, `admin_notes`, `consent_call_by uuid` (the staff member who made the call), `consent_call_note` (what was read, and the script version). The owner and admins read and write; nobody else. The inviting guide never reads it back. GS 2.1 says the guide may see the phone number only if he entered it himself: the app shows him what he typed, from his own `crew_invites` row, not from this table.

Identity numbers (NIDA) do not go here. They use the shared identifiers table in section 2.3.

Guard trigger `crew_members_guard_admin_fields` (same shape as `guard_guide_admin_fields`): sessions that are not trusted cannot set `status`, `live_until` or `is_sample`, cannot set `consent_method = 'phone_call'`, and cannot change `created_by` after insert. Only the owner (with an account) may change `consent_status`, the switches and the profile fields; when there is no owner, only admins may. A guide session can never update a `crew_members` row.

Account type: add `crew` to `user_role` and to `complete_onboarding` (one screen, Kiswahili first, GS 1.3). A person who later becomes a guide keeps the crew row. `guides.owner_id` and `crew_members.owner_id` are both unique, so one account can hold both (the C7 path from mpagazi to mpishi to mwongozaji).

**Claiming:** a basic-phone member who later gets a smartphone account claims the row with a one-time code from Kwetuly (a staff action after a call), never with a code the guide holds (FR 4.2). `private.claim_crew_profile(code)` is security definer, with hashed codes like `private.invite_codes`.

### 2.2 Teams with consent (C2)

`public.crew_teams`: id, `guide_id` (fk guides) **or** `provider_id` (fk providers, for operators; check: exactly one), name, created_at. One team per guide at the start (unique on guide_id); operators may have several later.

`public.crew_team_members`: team_id, crew_member_id, `status` (`requested`, `invited`, `active`, `declined`, `left`, `removed`), `invited_at`, `joined_at`, `ended_at`, primary key (team_id, crew_member_id).

`public.crew_invites` (the guide's side of an invitation): id, team_id, `first_name`, `role`, `phone` (what the guide typed, shown back only to him), `no_smartphone boolean` (asks Kwetuly to call, GS 2.1 step 4), `code_hash`, `expires_at` (14 days), `crew_member_id` (set on confirm), `status` (`sent`, `confirmed`, `declined`, `expired`, `cancelled`). The link carries the code, never the phone number or the name (no personal data in URLs).

Status changes (guard trigger on `crew_team_members`):
- `invited` to `active` or `declined`: only the crew member (own account, or confirming through the invite link) or an admin recording a call.
- `requested` (the person asked to join from the guide's profile, GS 2.1 step 5) to `active` or `declined`: only the team owner.
- `active` to `left`: only the crew member, at any time. There is no reason field (GS 2.1).
- `active` to `removed`: the team owner or an admin. There is no reason column at all, so no public reason can leak.
- Every other change is refused. Nothing on the team row says "exclusive" (GS 2.1, no exclusivity).
- Limit: 30 open invites per guide per week (against spam and harvesting of numbers), like `throttle_leads`.

### 2.3 Crew checks, reusing the guide checks design (C3)

Recommended change to GC, **before its migration 1 is written** (fact 7): make its tables about a person, not only a guide.

- `guide_documents` and `guide_document_checks` become `person_documents` and `person_document_checks`, with `guide_id uuid null` and `crew_member_id uuid null`, `check (num_nonnulls(guide_id, crew_member_id) = 1)`, and partial unique indexes per subject. `guide_identifiers` becomes `person_identifiers` in the same way (NIDA, TIN, masked functions, column grants and audit unchanged). `guide_check_log` becomes `person_check_log`.
- Same kinds enum. Crew use `identity` (NIDA card or number, GC 1c-bis), `first_aid`, `driving_licence`, and `other` with a title. **No new enum values for documents nobody has confirmed exist** (porter registration cards, food-handler certificates): those are entered as `other` with a title until legal confirms them.
- `private.crew_live_until(crew_id)`: the required kinds per role are a constant in the function, as in GC 2d. Proposal (Walter decides, section 7): `identity` for everyone, `driving_licence` for `driver`, nothing else required. Drivers are listed as people only, not as a transfer service (transfers stay off).
- `private.crew_is_live(status, is_sample, live_until, consent_status)`: approved, consent confirmed, and (a sample, or `live_until >= tz_today()`).
- Public check lines for crew follow GC 3 exactly ("NIDA seen {date}", "Driving licence seen {date}, valid until {date}"), never "verified".
- The paid crew check (C3) adds no column now. When it comes (after registration and payments), a `check_orders` row links a `payments` row to a crew member, with `paid_by_user_id`. GS and FR both recommend that **crew never pay** and that only the guide or operator may pay. The trigger can enforce that (payer is never the crew member's own account). This conflicts with row C3, so it is Walter's decision (section 7).
- GS decision 4, enforced: no job, team or review may require a check. There is no "checked only" column on jobs.

### 2.4 Trip crew list and check-in (D1, also the base for C4 and C5)

`public.trip_crew` (one row per person on one trip file, section 3.1):

| Column | Notes |
| --- | --- |
| id uuid pk (made on the phone, for offline use) | |
| trip_file_id fk on delete cascade | |
| crew_member_id uuid null, fk crew_members on delete set null | a profile on Kwetuly |
| name_only text null (1-40) | a first name typed by the guide for someone with no profile. Seen only by people on that trip; never public, never credited, cleared 30 days after the trip |
| role job_role not null | |
| added_by uuid | lead guide |
| self_confirmed_at timestamptz null | the crew member said "I am on this trip" (own account), or an admin recorded a call |
| checked_in_at timestamptz null, checked_in_by uuid | check-in at the gate by the lead guide (works offline, section 4) |
| outcome text null | `completed`, `left_early`, `did_not_start`. No reason column, so the reasons that must never count against crew (FR 1.4) are kept out by design |
| disputed_at timestamptz null | the person said "I was not on this trip" (GS 5.4) |
| check `num_nonnulls(crew_member_id, name_only) = 1` | |

Only **self-confirmed, checked-in and undisputed** rows count for reviews, credits and the trip record. A guide cannot invent a trip history for anyone, and a dispute hides the row from credits at once.

### 2.5 Guide notes on crew (C4)

`public.crew_reviews`: id, trip_crew_id (unique: one per person per trip), crew_member_id, author_guide_id, `tags text[]` (1 to 3, from a fixed list in shared code and a check constraint), `note text null` (up to 200 characters, FR 1.3; phone numbers, links and ID-like numbers blocked by the same masking function as messages), `crew_decision` (`pending`, `shown`, `hidden`), `crew_reply text null` (up to 300), `held_for_check boolean` (FR 1.8), `appeal_status` (`none`, `open`, `kept`, `edited`, `removed`), `withdrawn_at`, created_at.

Rules in the database:
- Insert only if the author is the lead guide of a **finished** trip file, both he and the person were checked in, and `tz_today()` is within 14 days after the end (FR 1.2; GS says 30, to settle in section 7).
- `held_for_check` is set by trigger when the person has an open report or private feedback about that guide or his trips (FR 1.8). Held rows are visible to admins only.
- Public read: only `crew_decision = 'shown'`, not held, no open appeal, not withdrawn, and the person's `share_trip_record` switch is on. The public sees **counts per tag** through a narrow security definer function, `public.crew_record(crew_id)`, which returns tag counts and the trip count with no author and no text. Shown note text appears only on the person's own profile, and only if Walter keeps notes public.
- The author may withdraw a note, but never edit it once it is shown (GS 4.6).

`public.crew_feedback` (private problems and the porter's own voice, FR 1.5 and 1.9, GS 4.8): id, trip_file_id null, from_user, and one of about_crew_member, about_guide or about_provider, `kind` (`concern`, `report`, `welfare`), `body`, `welfare_answers jsonb` (the five yes or no questions), created_at. **Admins read it, nobody else**; the sender reads their own. An operator only ever sees totals, from `private.welfare_totals(provider)`, which returns nothing below 5 answers (FR 1.9).

### 2.6 Crew credit in traveller reviews (C5)

- Add `guide_reviews.trip_file_id uuid null` (fk trip_files on delete set null).
- `public.review_crew_thanks`: review_id, trip_crew_id, tag (from a fixed thank-you list), `thanks text null` (up to 200), `crew_decision` (`pending`, `shown`, `hidden`), primary key (review_id, trip_crew_id).
- Insert only by the review author, and only for `trip_crew` rows of the same trip file that are self-confirmed, checked in and undisputed, and whose person has `share_named_in_reviews` on. Everyone else appears in the form only as a count ("and 3 more wapagazi", GS 5.1). There are no free-text names, so no wrong person can be linked.
- Thanks only: there is no rating column at all (FR 4.3.4).
- Public read: shown, switch still on, review not hidden. The profile shows "Named in N trip reviews", counting shown, non-sample rows only (GS 5.7).

### 2.7 Job posts (C6)

Extend `jobs` rather than add a table (the hub, approval and notices already exist):

- `poster_guide_id` or `poster_provider_id` (who is shown), `positions int` (1-50), `park_or_area`, `days int`, `pay_per_day_tzs integer not null` for crew roles, `pay_when text`, `pay_method` (`mobile_money`, `bank`, `cash`), `work_type` (`per_trip`, `ongoing`), `provided text[]` (fixed list), `porter_load_kg int` (porter jobs), `tips_rule text`, `closes_on date`, `declarations_at timestamptz` (the three ticked statements, GS 6.1). `pay` stays for old rows and other roles.
- `public.pay_floors` (admins write, anyone reads): role, period (`day`), `amount_tzs`, `source text`, `checked_on date`, `valid_from`. Filled only with figures legal confirms (FR and the legal note give secondary sources only). A trigger refuses approval (`status = 'approved'`) of a crew job below the current floor for its role, and the poster gets a clear error when saving.
- Read rule: approved jobs are visible to live guides **and live crew** (`private.is_verified_guide() or private.is_live_crew()`), and to approved businesses. A job past `closes_on` drops out through the read rule; no scheduled job is needed.
- `public.job_interest`: job_id, crew_member_id, `share_phone boolean` (the person decides for each job, GS 6.3), created_at, unique pair. The poster sees first name, role and the public profile. He sees the phone only when `share_phone` is true, through `public.job_applicant_contact(job, crew)` (security definer, poster only, each read logged).
- Paid unlock of contact details (Walter, 2026-10-30) waits for the advocate and for payments. Later it becomes a `contact_unlocks` row written only by the payments Edge Function. Not built now.

### 2.8 Course channel (C7)

`public.courses` (later): provider name, title, from_role, to_role, place or online, price text, `sponsored boolean` with `sponsor_name` (labelled "Sponsored"), link (the provider's official site), `status` (admin approval), `is_sample`. Public read once approved. No enrolment or payment table until payments exist, and no promise fields ("job guaranteed", "licence"). Size S, information only (GS decision 10).

## 3. Trip management (D1-D9)

### 3.1 The trip file

`public.trip_files`

| Column | Notes |
| --- | --- |
| id uuid pk | |
| source text not null | `offer`, `group_trip`, `package` |
| trip_offer_id uuid unique null | accepted offer |
| group_trip_id uuid unique null | approved group trip |
| conversation_id uuid null, package_id uuid null | package: unlocked conversation with that guide |
| check: exactly one source set, matching `source` | |
| lead_guide_id uuid null (fk guides) | the guide who runs the trip; null when a company runs it with no guide on Kwetuly |
| organiser_user_id uuid not null | the offer's `offered_by` or the group trip's `organizer_id` |
| tour_id uuid null (fk `trips`, the tour library) | optional, to copy the day plan from `trip_stops` |
| title, start_date, end_date | copied at creation; the organiser may change dates before the start |
| status | `planned`, `under_way`, `finished`, `cancelled` |
| traveller_confirmed_at | needed for `package` files (see below) |
| started_at, finished_at | |
| is_sample boolean | |

How a file is made:
- `offer`: an AFTER trigger when `trip_offers.status` becomes `accepted` (the traveller has already said yes).
- `group_trip`: on the first accepted member of an approved group trip.
- `package`: the guide makes it from an unlocked conversation. It stays `planned` and does nothing until the traveller taps "Yes, this is my trip" (`traveller_confirmed_at`). This stops a guide making a file to open reviews or crew records for a trip that never happened.

`public.trip_file_people` (who is in it, kept up to date by triggers): trip_file_id, user_id, role (`organiser`, `lead_guide`, `traveller`), display_name, primary key (file, user). Travellers come from `trip_requests.traveler_id` or from accepted `group_trip_members`; leaving or being declined removes the row. Crew are in `trip_crew` (2.4), linked to an account only through `crew_members.owner_id`.

Helper: `private.trip_file_role(p_file uuid) returns text` (security definer, `search_path = ''`, executable by authenticated) returns `admin`, `organiser`, `lead_guide`, `traveller`, `crew` (an account that owns a self-confirmed `trip_crew` row) or null. Every policy below uses it.

Status: only the organiser or the lead guide moves a file from `planned` to `under_way` to `finished`. It never goes back, except by an admin. `finished` is refused before `start_date`. A daily job sets a file still `under_way` 3 days after `end_date` to `finished`, so review windows open even if the guide forgets.

### 3.2 Day by day (D2)

`public.trip_file_days`: id, trip_file_id, day_no (1-40), date, `plan_title`, `plan_text` (up to 600), `camp_or_place text` (a name, never coordinates), `place_id null` (fk places). Copied from `trip_stops` when a library tour is linked; otherwise the guide fills it from the offer's itinerary. The organiser or the lead guide edits it.

`public.trip_day_updates` (add-only, built for offline use): id (made on the phone), trip_file_id, day_id, `status` (`on_plan`, `changed`, `rest_day`, `turned_back`, `done`), `note` (up to 280), `recorded_at` (phone time, kept by trigger between the file's start minus 1 day and `now()`), `received_at` default now(), author. Nobody except admins can update or delete a row. The day's current state is the row with the latest `recorded_at`.

No live location, no GPS track, and no "safe" or "all well" wording. The texts say what the guide wrote and when it reached Kwetuly ("Sent from the mountain at 14:10, received 18:45"). That matters for honesty: a family must never read an old update as news from now.

Family view (later, chosen by each traveller and withdrawable): `trip_share_links` (traveller, code hash, expires 3 days after the trip ends). It shows day titles and statuses only: no names of other travellers or crew, and no notes. Size S, in phase 5.

### 3.3 Dietary needs (D3, only after legal and security-reviewer)

`public.trip_member_needs`: trip_file_id, user_id, `diet text[]` from a fixed list (vegetarian, vegan, halal, no pork, no alcohol in food, gluten free, lactose free, nut allergy, shellfish allergy, other), `other_text` (up to 200, the only free text), `consent_at` not null, `delete_after date` (end date plus 30 days, for legal to confirm), primary key (file, user).

- Read by: the traveller; the lead guide and the organiser; and **crew with the role `cook` who are self-confirmed on that file**, only from 3 days before the start until the end. Cooks read through `public.trip_needs_for_cooks(file)` (security definer), which returns the diet items without travellers' surnames.
- Never in notifications, chat previews, analytics, reports or exports. A nightly job deletes rows past `delete_after`.
- Allergies are health data: the screen asks for as few words as needed and says who will see them.

### 3.4 Insurance (D4, only after legal and security-reviewer)

`public.trip_member_insurance`: trip_file_id, user_id, `insurer_name`, `policy_number null`, `insurer_emergency_phone null`, `delete_after`. Read by the traveller and the lead guide only (not crew, and not the organiser unless he is the lead guide). Every field is optional.

The links to the official portals (NIC for the mainland, ZIC for Zanzibar) are **not stored** in the database: shared code holds the official addresses and picks one from the trip's region, so a wrong link is fixed in one place. Kwetuly does not sell, check or recommend any policy, and the screen says so.

### 3.5 Transfers (D5)

No table. Transfers stay off until the advocate answers. The day plan can say "Drive to Moshi" as plain text; nothing is booked or priced.

### 3.6 Rentals and included items (D6, D7)

`public.trip_file_items`: id, trip_file_id, `kind` (`included`, `rental`), `title` (up to 120), `qty`, `provider_id null` (gear shop, fk providers), `lead_id null` (the order request sent through the existing leads flow), `status` for rentals (`requested`, `confirmed_by_shop`, `returned`), `source` (`offer_includes`, `package_includes`, `added_by_guide`).

- `included` rows come only from the accepted offer's `includes` or the package's `includes` when the file is made, or are added by the guide before the start, where the traveller can see them. The traveller text is "Included in your agreed price". The word "free" is not used for these items in any dictionary (D7).
- Rentals stay order requests: the shop is paid directly (current rule), and Kwetuly holds no money. This table may not link to `payments`.

### 3.7 Trip report (D8)

`public.trip_reports`: trip_file_id pk, author (lead guide), `days_completed int`, `route_changes text` (up to 600), `highest_point text null` (only what the guide states, shown as "Stated by the guide"), `crew_count int` (filled by trigger from `trip_crew`), `notes_for_travellers text`, `submitted_at`. Editable until submitted, then frozen by a guard; after that only admins can change it. Travellers on the file read it and may add one comment each (`trip_report_comments`). Incidents and safety events do **not** go in the report. They go to `crew_feedback` or to operations-manager's incident process, privately.

### 3.8 Reviews after the trip (D9)

- `private.can_review_guide` gets a third path: the person is a traveller on a `finished` trip file whose lead guide is that guide.
- The review form attaches `trip_file_id` when there is one and shows the crew thanks block (2.6).
- One review per traveller per guide stays for now. Allowing one review per trip later means changing the unique key and `refresh_guide_rating`. Version 1 does not need it.

### 3.9 Who can see what

| Data | Public | Traveller on the file | Lead guide or organiser | Crew on the file | Admin |
| --- | --- | --- | --- | --- | --- |
| Crew profile basics (first name, initial, roles, stated areas) | live guides and approved businesses only (Walter decides whether everyone may see them) | first name and role of crew on their trip | yes | own | yes |
| Crew phone | no | no | only what he typed himself, or `share_phone` for his job | own | yes |
| Crew checks (kind, date) | same as profile basics | no | yes | own | yes, plus files and who checked |
| Crew trip record and tag counts | only if `share_trip_record` is on | no | same as public | own, including hidden items | yes |
| Crew private feedback, reports, welfare answers | no | no | totals only, from 5 answers | own sent items | yes |
| Trip file, days, day updates, items | no | yes | yes, and writes | yes, reads days and items | yes |
| `trip_crew` list | no | first names of those with the review switch on, others as counts | yes | yes | yes |
| Dietary needs | no | own | yes | cooks only, from 3 days before | yes |
| Insurance | no | own | lead guide only | no | yes |
| Trip report | no | yes, plus a comment | writes | reads | yes |

All tables: RLS on; clients list the columns they select (no `*`); helpers are `security definer` with `search_path = ''`, and execute is revoked from `public` and `anon` unless needed. Account deletion: `scrub_deleted_user` is extended to clear `trip_crew.name_only` and crew names in queued notices. For `crew_members`, `owner_id on delete set null` would keep a basic profile when the person deletes their account; security-reviewer should decide whether the row is deleted instead (recommended: deleted).

## 4. Offline and low bandwidth on the mountain

What must work with no signal: the day plan, the crew list and check-in, included items, the traveller's own diet line and insurance contact, and writing day updates. What does not need to: reviews, jobs, team invites and uploads.

- **One small download before the trip.** `public.trip_file_bundle(p_file)` (security definer, aware of the person's role) returns one JSON object with only what that person may see: the file, days, latest update per day, crew list, items and report draft. Text only, no photos, aiming for under 30 KB. The app fetches it when the file is opened and again at the gate.
- **Keep it on the phone.** Add React Query persistence for the trip-file queries only, through the existing `local-storage.ts` wrapper (no new native module in version 1). The diet and insurance parts go in encrypted storage (`expo-secure-store`), because phones get lost on climbs. Everything is cleared 7 days after the trip.
- **Writes wait on the phone.** Check-ins, day updates and outcomes are inserts with an id made on the phone, so sending one twice does nothing (`on conflict (id) do nothing`). The queue sends them in order when signal returns, waiting longer after each failure, and says honestly "Waiting to send (3)".
- **No conflicts by design.** Day updates and check-ins are add-only events. The few editable rows (day plan, report draft) use the row's `updated_at` as the version, like the admin screens do. An edit made on an old copy is refused, and the app shows both texts.
- **Phone clocks.** `recorded_at` is kept within limits by trigger, and the server time `received_at` is always shown as well.
- **Website.** The installable website (J1) does not promise offline use. Offline trip management is an app feature; the website shows the same file when online.
- **No SMS or USSD fallback** in version 1 (cost, and it needs the registered company, GS 1.2). Guides keep using WhatsApp where there is signal.
- **Push notices:** at most one per trip per day to travellers ("Day 3 update from your guide"), sent when the update arrives, to keep roaming data and notice costs low.

## 5. Build order and sizes

S = days, M = 1 to 3 weeks, L = a month or more. In every phase: backend-engineer drafts migrations (not applied), frontend-engineer builds web and app, localization translates (crew and guide texts in English and Kiswahili, traveller texts in 7 languages), security-reviewer reviews (every phase touches personal data), and qa-tester tests. Applying anything on live is Walter's decision each time.

| Phase | When | Contents | Size | Depends on |
| --- | --- | --- | --- | --- |
| 0 | Now, paper | Change the GC tables to person tables (2.3) before GC migration 1 is drafted; agree tag lists with hr and guide-success; legal gets the questions in section 7 | S | GC step 2a not started yet |
| 1 | Month 1 after launch | Crew profiles, private table, `crew` account type, consent switches, invites, teams, claim code, admin approval queue, crew checks on the person tables | M to L | Phase 0, the guide checks build, GS route A, a named staff member for consent calls |
| 2 | Months 2 to 3 | Trip files (three sources), people, `trip_crew` and check-in (D1), day plan and updates (D2, no family link), included items and rentals (D6, D7), trip report (D8), offline bundle and queue | L | Phase 1 for named crew (works with `name_only` before that) |
| 3 | Month 3 | Reviews linked to trip files and crew thanks (C5, D9), guide notes on crew with the person's approval, reply and appeal (C4), private feedback and welfare totals | M | Phase 2, FR code of conduct approved |
| 4 | Months 3 to 4 | Jobs version 2 fields, pay floors, crew can see jobs, interest with phone sharing per job (C6) | M | Legal confirms the source for the pay floor |
| 5 | Month 4, only after legal and security-reviewer | Dietary needs (D3), insurance (D4), family share link, deletion jobs | S to M | Advocate's answers on health data and how long to keep it |
| Later | After registration and payments | Paid crew checks (C3), paid contact unlock (C6), paid courses (C7), transfers (D5) | M each | Registered company, Selcom, advocate |

## 6. Risks

1. **Consent without an account** (basic phones). A guide could invent a person or fake their agreement. Mitigation: nothing is public or counted until the person confirms themselves or Kwetuly staff record a call. Calls cost staff time, so phase 1 needs a named person and a daily limit.
2. **Power imbalance in reviews.** Mitigated by positive tags only, the person approving first, the held-for-check rule, no stars, and private reports. It still needs the FR code, and an appeal reviewer other than Walter alone once numbers grow.
3. **Personal data on lost phones** on the mountain (offline copies of diet and insurance). Mitigation: encrypted storage, as few fields as possible, automatic clearing.
4. **Health data (allergies) under the PDPA 2022**, and the region where Supabase stores data: legal first. Phase 5 waits for that.
5. **Day updates read as live safety tracking.** Mitigation: no location, both times shown, wording reviewed by legal. operations-manager keeps the real emergency process outside the app.
6. **A wrong figure in `pay_floors`** makes Kwetuly look as if it approves low pay. Mitigation: only figures legal has confirmed, with source and date shown to posters.
7. **Harvesting crew phone numbers** through invites or jobs. Mitigation: no phone in any public read, sharing decided per job, an invite limit, and logged contact reads.
8. **Fake trip files** made to open reviews or crew records. Mitigation: package files need the traveller's yes, and crew rows need the person's own confirmation.
9. **Creeping into escrow or a booking engine** (warning in the 2026-11-06 plan, 2.4). Mitigation: no money columns on trip files or items; deposits stay in `payments` as today.
10. **Too many rules repeating the same check.** As GC fact 2 showed for guides, many rules will ask "is this crew member live?". They all go through `private.crew_is_live` and `private.trip_file_role`, never written out again inside a policy.
11. **The two people drafts disagree** on the review window (GS 30 days, FR 14 days). Walter settles it below.

## 7. Questions

For Walter:
1. Should the guide checks tables become person tables now, so crew can reuse them (2.3)? Recommended: yes, before GC migration 1 is drafted.
2. Who may see crew profiles: only signed-in live guides and approved businesses, or everyone? Recommended: guides and businesses only at first. Everyone else sees crew only as thanks in reviews.
3. Required checks for crew to be listed: NIDA for everyone, a driving licence for drivers, nothing else. Recommended: yes.
4. Crew never pay for checks (GS and FR 3.4 both recommend this; row C3 says they pay). Your decision; the schema supports either.
5. Review window for guide notes on crew: 14 days (FR) or 30 days (GS). Recommended: 14.
6. A trip file made from a package needs the traveller's "Yes, this is my trip". Recommended: yes.
7. No location at all in day updates in version 1. Recommended: yes.

For legal (to add to the advocate memo):
- Consent recorded by a staff phone call for a person with no account: is it valid consent under the PDPA 2022, and what must be kept as proof?
- Dietary and allergy data: lawful basis, who may see it (cooks), and how long to keep it.
- Holding crew NIDA numbers and images: the same questions as in the guide checks memo.
- Which pay floor applies per day to porters and cooks (the legal note has only secondary sources), so `pay_floors` can be filled.
- Whether a crew member's public "trip record" counts as a reference that creates liability for Kwetuly.
