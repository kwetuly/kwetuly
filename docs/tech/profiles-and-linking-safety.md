# Profiles and linking safety

Prepared by tech-lead, 2026-10-30. Paper only: no code, database, migration or Supabase setting was changed.
Asked for in `docs/team/board.md` (2026-10-30 Profiles, step 1a).

Builds on `docs/tech/one-account-roles-and-sign-in.md` (the "roles paper": roles come from rows, one guide profile, services as package kinds) and `docs/tech/items-approvals-orders-design.md` (the "items paper": item types, approval centre, `needs_info`, handles instead of URLs). Where this paper changes them it says so.

Sizes: XS = a day, S = a few days, M = one to two weeks, L = more than two weeks (one engineer, including review and tests).

## In short

- **The linking API is open today and enforces almost nothing.** Supabase checks only that the caller is signed in and that manual linking is on. No re-authentication, no two-step (aal2) check, no rate limit, no "same email" rule. Removing a sign-in can also change the account's own email address. So security findings M1 (an admin at aal1 can link) and L4 (linking someone else's Google) are both real today, through the API, even though our buttons are hidden behind the flags.
- **Immediate, free fix:** Walter switches manual linking **off** again in Supabase until the safety step ships. The flags are 0, so nobody loses a feature. This closes M1 and L4 today.
- **The real gate has to be in the database**, because anyone with a session can call the API directly. Design: a short-lived "link intent" that only a fresh sign-in (or an email code) can create, checked by a trigger on `auth.identities`; admins cannot link at all; the account's email sign-in cannot be removed; notices to the account email and to the newly linked address.
- **Traveller audit:** two bugs before launch (the app cannot change name or phone; the app's "Add phone" button opens the guide editor), one security gap to close with the same step-up (account deletion needs no fresh sign-in). Everything else is after launch.
- **Profile design:** guide types already exist (`guides.specialties`); library links and custom trips reuse `guide_packages`; crew get their own small profile and never pay; business per-type fields copy the item-type pattern; tour operators and travel agents link a business account to the existing `tour_operators` row, hidden automatically when the licence expires; crew hiring extends `jobs` with applications.
- **Facts:** email one-time codes work today (the magic link template needs `{{ .Token }}`). Passkeys are a Supabase **beta** since 2026-05-28 with an experimental API and no documented Expo / React Native path: not for launch.

---

## 1. Linking

### 1.1 What Supabase enforces (facts)

Checked on 2026-10-30. Source code read from `github.com/supabase/auth` (master branch) on that date. Supabase changes often, so check again before building.

| # | Question | Answer | Source |
|---|---|---|---|
| L1 | What guards the linking endpoints? | `GET /user/identities/authorize` (`linkIdentity`) and `DELETE /user/identities/{id}` (`unlinkIdentity`) sit under `requireAuthentication` (any valid session) and `requireManualLinkingEnabled`. Nothing else: **no aal check, no re-authentication, no rate limit, no anonymous-user check** on these routes. | `internal/api/api.go`, route definitions |
| L2 | Does linking require a fresh sign-in or aal2? | **No.** `LinkIdentity` reads the user from the session and builds the provider's redirect URL. The docs page does not mention re-authentication either. | `internal/api/identity.go`; https://supabase.com/docs/guides/auth/auth-identity-linking |
| L3 | Must the linked sign-in have the same email? | **No.** The docs: manual linking "allows a user to initiate identity linking with a different email address when they are signed in". | Docs page above |
| L4 | What does linking refuse? | An identity already linked to this user ("Identity is already linked") or to another user ("Identity is already linked to another user", code `identity_already_exists`, 422). If the provider's email is **not verified**, Supabase sends a confirmation email and returns 422 instead of linking. A verified provider email confirms the user. | `identity.go`, `linkIdentityToUser` |
| L5 | What does unlinking refuse? | Fewer than two identities (code `single_identity_not_deletable`), or an identity that is not the user's. | `identity.go`, `DeleteIdentity`; docs: "at least 2 linked identities" |
| L6 | Can unlinking change the account's email? | **Yes.** After removing a non-phone identity, Supabase runs `UpdateUserEmailFromIdentities`; the code comment says removing an identity "may promote another identity's email onto the user record". Our web and app never offer to remove the `email` sign-in, but the API does. | `identity.go`, `DeleteIdentity` |
| L7 | Where is the link actually made? | In Supabase's provider callback (`linkIdentityToUser` runs while the provider sends the person back), for the user recorded when the link was started. Whoever finishes the Google sign-in in their own browser decides which Google account is added. | `identity.go`; the "phishing link" behaviour is inferred from the code: **qa-tester to confirm on staging** |
| L8 | Native linking? | Yes: `linkIdentity` also accepts an ID token from Google, Apple, Facebook, Kakao or Keycloak (same providers as `signInWithIdToken`). | Docs page above |
| L9 | Notice emails | Supabase has security notification emails for **identity linked** and **identity unlinked** (plus password, email, phone changed and two-step on or off). Announced 2025-11-11 as a feature preview; templates released 2025-12-03; switched on per project under Authentication, Emails; the `{{ .Provider }}` variable names the provider. They go to the account's email only. Custom senders get `identity_linked_notification` and `identity_unlinked_notification` through the Send Email hook. Whether they are generally available or still a preview on our project: **Walter checks in the dashboard.** | https://supabase.com/changelog/40349-notify-users-about-security-sensitive-actions-on-their-accounts ; https://supabase.com/blog/introducing-seven-new-email-templates-for-auth ; https://supabase.com/docs/guides/auth/auth-email-templates |
| L10 | Re-authentication endpoint | `GET /reauthenticate` exists (sends a one-time nonce). In the code it is consumed by a password change (`updateUser({ password, nonce })`), not by linking. | `api.go`; nonce use from memory of `user.go`, **to verify** before relying on it. We do not use it in this design. |
| L11 | Does Supabase know about our aal2 rule? | No. aal2 for admins is Kwetuly's own rule (`private.is_admin()` reads the JWT's `aal`, `20261016001400_admin_two_step_business_gate_deposits_leads.sql` lines 38-50). GoTrue's own database session carries no request JWT, so a trigger on `auth.identities` **cannot see the caller's aal** either. | Code above |

### 1.2 What this means for Kwetuly today

Manual linking was switched on 2026-10-30. Our own guards (`apps/web/src/app/[lang]/security/actions.ts` lines 20-22, 30, 52; `apps/mobile/src/components/connected-sign-ins.tsx` lines 22, 64, 135) only hide buttons. Anyone with a session can call the two endpoints with the public key.

| # | Risk | How | Impact | Severity |
|---|---|---|---|---|
| M1 (security review) | Admin at a lower level links | Someone who has an admin's password but not the authenticator signs in (aal1) and links their own Google. | Admin powers still need aal2, so no admin action. But they keep a second way in that survives a password reset, and can read everything a normal account can. | Medium |
| L4 (security review) | "Link someone else's Google" | An attacker starts a link on their own account, sends the provider URL to a victim ("sign in with Google to see your booking"). The victim's Google lands on the attacker's account. Later the victim signs in with Google, sees a Kwetuly account, and types passport, insurance or trip details into it. | Data goes to the attacker; confusing support case. | Low to medium |
| N1 (new) | Stolen session becomes permanent | A session left open on a shared phone or stolen by malware links the thief's Google. | Persistent access even after the owner changes the password. | Medium |
| N2 (new) | Account email changed by unlinking | A session holder unlinks the `email` identity; Supabase promotes the Google address onto the account (L6). Notices then go to the new address. | Account takeover helper. | Medium |
| N3 (new) | Account deleted from a stolen session | `deleteAccount` (web `security/actions.ts` lines 83-106, app `delete-account.tsx` line 22) asks only to type the email, which a session holder can read. | Data loss for the owner. | Medium (data loss) |

### 1.3 Design

Four layers. Layer A is what people see; layer B is the gate that holds even when someone calls the API directly; C and D tell the owner.

**A. In the website and the app**

1. **Fresh sign-in or email code before linking or unlinking.** "Fresh" = the session's JWT has an `amr` entry (password, otp, oauth or totp) with a timestamp in the last 10 minutes. A refreshed session keeps the old timestamps, so a stolen long-lived session is never fresh. If not fresh: "To keep your account safe, we sent a 6-digit code to w…@gmail.com". The code is sent with `signInWithOtp({ email: user.email, options: { shouldCreateUser: false } })` and checked with `verifyOtp({ email, token, type: 'email' })`, which gives a new session whose `amr` says `otp` now. The code goes to the account's own address, which a thief usually does not have. (Facts in section 4.)
2. **Confirm screen** (web page section and app sheet), in the person's language: "You are connecting **Google** to the Kwetuly account **walter@example.com**. After this, signing in with that Google account opens this account. Only continue if both are yours." Buttons: "Connect Google" (green) and "Cancel". The full email is shown: it is the owner's own address.
3. **Start**: the confirm button calls `public.start_identity_link(provider)` (layer B), then `linkIdentity`.
4. **Finish**: back on `/auth/confirm` (web) or after `exchangeCodeForSession` (app), call `public.finish_identity_link()`. It marks the intent done and returns the email of the new sign-in. The success message shows it: "Google account maria@gmail.com is now connected." A different address than expected is visible at once.
5. **Unlink**: same fresh check, then `public.start_identity_unlink(identity_id)`, then `unlinkIdentity`.
6. **Admins**: no "Connect" button at all (see B4). The web check `guardAdmin` stays.
7. **Delete account** (N3): the same fresh check before `delete_my_account`. The RPC itself checks freshness from `auth.jwt()` so the API path is covered.

**B. In the database (the real gate)**

New migration (draft first; tested on a Supabase branch or staging, never first on live):

1. `public.identity_link_intents` (RLS on): `id`, `user_id` (default `auth.uid()`), `action` (`link` or `unlink`), `provider` (`google`, `facebook`, later `apple`), `identity_id` (unlink only), `created_at`, `expires_at` (created + 10 minutes), `used_at`, `finished_at`. Owners insert and read their own rows; nobody updates or deletes except through the functions below.
2. `public.start_identity_link(provider)` and `start_identity_unlink(identity_id)`: **security invoker** functions (they run with the person's own RLS). They check: signed in; `auth.jwt() ->> 'aal'` and the `amr` timestamps show a sign-in or code in the last 10 minutes; not an admin (`profiles.role <> 'admin'`); at most 5 intents per person per day. Then insert the intent.
3. `private.guard_identity_insert()`: **BEFORE INSERT trigger on `auth.identities`**, `security definer` (owned by postgres, `search_path = ''`, not callable by users; same pattern as the existing triggers on `auth.users`, `20261012000000_initial_schema.sql` line 91). Rules:
   - The user has no identities yet: a new sign-up. Allow.
   - The new identity's email equals the account's confirmed email (lower-cased) and the provider says it is verified: Supabase's automatic join (roles paper F7) or a same-address link. Allow, except for admins (rule 4).
   - Otherwise (a manual link to a different address): require an unused, unexpired `link` intent for this user and provider; mark it used. No intent: `raise exception 'link_not_confirmed'`. Supabase then fails the callback and `/auth/confirm` shows the existing friendly error.
4. **Admins never gain a new sign-in** (closes M1): if `profiles.role = 'admin'`, refuse every new identity after sign-up, including the automatic Google join. Admin accounts are email, password and authenticator only. Walter's own traveller or guide activity uses a separate non-admin account. (If Walter prefers Google on his admin account, the alternative is an intent that requires aal2; it is weaker because the trigger cannot see aal, only the intent can.)
5. `private.guard_identity_delete()`: **BEFORE DELETE trigger on `auth.identities`**:
   - If the parent `auth.users` row is already gone (account deletion cascade), allow.
   - Refuse deleting the `email` identity (closes N2; L6).
   - Otherwise require an unused, unexpired `unlink` intent for that identity id; mark it used.
6. **Unfinished links are removed** (closes most of L4): a `pg_cron` job every 5 minutes finds identities linked through an intent that was used but not `finished_at` within 15 minutes, deletes that identity row, and sends a notice. In the phishing case the callback ends in the victim's browser, so the attacker's page never calls `finish_identity_link()`. (A victim who copies the final address back to the attacker defeats this; the notice in C2 covers that case.)
7. Audit: each insert, delete and refusal writes a row to `private.identity_events` (user, provider, action, result, time; no tokens), admin read only.

Things to verify before building B (backend-engineer, on a branch): that Supabase lets us put triggers on `auth.identities` (it allows them on `auth.users`, which we already use; `auth.identities` is not documented either way); the exact error a person sees when the trigger refuses; that Supabase's automatic join and its own clean-up of unconfirmed identities (roles paper F7) still work with the triggers. **If triggers on `auth.identities` are not allowed**, the fallback is the documented Custom Access Token hook: refuse to issue tokens while the account has an identity that is not covered by a finished intent; heavier, and it signs the person out until the identity is removed.

**C. Notices**

1. Switch on Supabase's **identity linked** and **identity unlinked** emails (L9), in English and Kiswahili text in one email (the templates have no language switch; to check), "Not you? Reply to this email or write to support@kwetuly.com".
2. Our own event `identity_linked_elsewhere` through the existing `notify` function, sent to the **newly linked address** when it differs from the account email: "Your Google account maria@gmail.com was connected to a Kwetuly account (w…@e….com). If you did not do this, tell us." This is the warning the L4 victim gets. The account email is masked here.
3. Both need working email: custom SMTP with Resend for Supabase Auth (`docs/devops/kwetuly-hosting-plan.md` line 140). The built-in mailer has a very low hourly limit.

**D. Admins two-step**

Already in place for admin powers (`private.is_admin()` needs aal2). Added by this design: admin accounts cannot link (B4), unlinking needs an intent (B5), and the web and app hide the buttons. security-reviewer checks M1 again after B ships.

### 1.4 Order

| Step | What | Who | Size |
|---|---|---|---|
| 0 | Manual linking **off** in Supabase until steps 1-4 pass review (Walter, one switch) | Walter | none |
| 1 | Migration draft: intents table, start/finish functions, two triggers, cron clean-up, events table | backend-engineer | S-M |
| 2 | Web and app: fresh-check and email code screen, confirm screen, finish call, success text with the linked email, delete-account fresh check; texts in 7 languages | frontend-engineer, localization | S-M |
| 3 | Supabase settings: identity notices on, magic link template with `{{ .Token }}`, custom SMTP (Resend), "Confirm email" on (roles paper F10) | Walter (devops guide) | none |
| 4 | security-reviewer (M1, L4, N1-N3, the API path with curl), then qa-tester (web, Android, iOS dev build; a phishing link test; account deletion) | | |
| 5 | Manual linking on, then the two flags to 1 | Walter (devops guide) | none |

---

## 2. Traveller audit

What a signed-in traveller can do today, read from the code on 2026-10-30.

| Area | Website (`apps/web`) | App (`apps/mobile`) |
|---|---|---|
| Name and phone | Yes: "My details" on the dashboard (`dashboard/page.tsx` lines 461-484; `dashboard/actions.ts` lines 219-230), phone with country hint | **No**: only at the welcome step (`complete_onboarding`, `lib/api-more.ts` line 141), which runs once. No `profiles` update anywhere in `apps/mobile/src`. |
| Prep calls | List with status, time and join link (`dashboard/page.tsx` lines 404-447) | Same (`(tabs)/account/index.tsx`, traveller card) |
| Group trips | "My group trips" and "Find" links | "My group trips" |
| Trip requests | Mine and post | Mine and post |
| Become a guide | Link to `?as=guide` | Link to the guide editor |
| Business tools with an approved listing | Yes, whatever the account type (`DashboardForRole`) | Yes (`useCanOffer`) |
| Connected sign-ins | Built, hidden by flag | Built, hidden by flag |
| Two-step sign-in | Yes (`security/page.tsx`) | Yes (`security.tsx`) |
| Delete account | Type the email (no fresh sign-in) | Same |
| Language | From the address | Language chips |
| Phone alerts | n/a | Push on/off |
| Sent enquiries and shop orders | No list | No list |
| Change email or password while signed in | No (password only by reset email) | No |
| Profile photo, social handles | No | No |
| Download my data | No | No |
| Add a business / travel agent profile | No (only via sign-up as business) | No |

### 2.1 Against the board's decisions

| Decision (board, 2026-10-30) | State | Gap |
|---|---|---|
| Profiles (1): flags on only after the safety step | Flags off; API open | Section 1. **Before launch.** |
| Profiles (2): fresh sign-in or code, confirm screen, notices | Not built | Section 1. **Before launch.** |
| Profiles (9): traveller sign-in email and Google; Facebook parked | Buttons show whatever Supabase has switched on (`lib/auth-providers.ts`, `lib/social.ts`) | Walter keeps Facebook off in Supabase; no code needed. |
| Sign-in and roles (4): one login, each profile with its own name and phone, "Add a profile" | Traveller name and phone editable on web only | App: **bug before launch** (B1). "Add a profile" itself: after launch (roles paper section 4). |
| Sign-in and roles (6): business tools for anyone approved, Connected sign-ins, friendly no-email message | Done on web and app (`/auth/confirm` `NO_EMAIL`, `lib/social.ts` `failure`) | qa-tester to recheck with the step-up. |
| Walter's list (2): phone field with country picker on web and app | Web `PhoneField` and app `PhoneField` exist; changes in progress (git status) | qa-tester. |
| Walter's list (8) and decided: admins can read enquiries and orders; privacy line | Legal line pending (A4) | Not a traveller screen; before launch per board. |
| Items: orders signed-in only, "My orders" | Not built | After launch (items paper step 6). |
| Profile images and handles | Not built | After launch (items paper step 8). |

### 2.2 Bugs, before launch

| # | Bug | Where | Risk | Fix | Size |
|---|---|---|---|---|---|
| B1 | The app has no way to change name or phone after the welcome step. | `apps/mobile/src/app/(tabs)/account/index.tsx` (no details section); no `profiles` update in the app | Travellers with a wrong or old number cannot fix it on the phone, where most of them are; group trips need a confirmed phone. | "My details" screen in the app, same rules as web `saveMyDetails` (E.164, reserved names, `phone_verified_at` cleared by `guard_profile_role` when the number changes). | S |
| B2 | "Add phone" on the app's group trip form opens the **guide editor**. | `apps/mobile/src/app/group-trip/new.tsx` line 69 (`router.replace('/profile-edit')`) | A traveller lands in "Become a guide", may start a guide profile by mistake, and still has no phone. | Point it at the B1 screen with a "back" target, as the web does (`group-trips/new/page.tsx` line 94). | XS (with B1) |
| B3 | Account deletion needs no fresh sign-in (N3). | Web `security/actions.ts` lines 83-106; app `delete-account.tsx` line 22; `delete_my_account` RPC | Data loss from a stolen or shared session. | Same fresh check or email code as linking; `delete_my_account` checks the `amr` time from `auth.jwt()`. | S (shares the step-up) |


### 2.3 After launch, in the board's order

1. Guide types and library links (section 3.2) and the "Add a profile" / "List a business" path for travellers (roles paper section 4, after launch item 1).
2. "My enquiries" and "My orders" for travellers (items paper step 6).
3. Change email (Supabase `updateUser({ email })` with confirmation to both addresses) and change password while signed in, both behind the step-up.
4. Profile photo and optional social handles (items paper 5.1, 5.2).
5. "Download my data" (PDPA 2022 right of access; legal to confirm what it must include) and alert preferences on the web.

---

## 3. Profile data design

Principles kept from the roles paper: one login; roles come from rows (`guides`, `providers`, and below `crew_profiles`), never from `profiles.role` except admin; every public profile waits for Walter's approval; private details live in `*_private` tables readable by the owner and admins only.

### 3.1 Traveller (`profiles`)

| Field | Now | Change |
|---|---|---|
| `full_name`, `phone` (E.164), `phone_verified_at` | Yes | none |
| `avatar_url` | no | add (items paper 5.1), after launch |
| `preferred_locale` | no | add, so alerts use the person's language (one of the 7) |
| `home_country` (ISO code) | no | optional; default for the phone picker and for insurance and visa links (always the official sites: NIC mainland, ZIC Zanzibar, the official e-visa site) |
| `social_handles` | no | optional, off by default (items paper 5.2) |

Not stored: passport numbers, insurance policy numbers, dates of birth. Nothing needs them yet (PDPA: collect the least).

### 3.2 Guide (`guides`, `guide_packages`)

**Types.** Walter's list is exactly the existing `guide_specialty` enum: `safari`, `mountain`, `city` (shown as "Town or city"), `cultural`, `birding`, `marine`, `photography`, `day_trips` (`20261012000200_guides.sql` line 4; `packages/shared/src/guides.ts`). No database change; only the "Town or city" label in 7 languages.

**Services.** As in the roles paper 3.2: a service is offered when the guide has an approved package of that kind. Add package kinds `safari`, `mountain`, `lesson_kiswahili`, `lesson_cooking`, and `transfer` (kept switched off until the advocate answers, board decision 8).

**Links to the trip library.** The library is the existing `trips` table (tours, `tour_stops`, `places`), filled with facts from marketing's step 1b (official park sources first, own words, sources cited). Change: a library flag on `trips` (an enum value `library` on `tour_type`, or a boolean; backend-engineer decides after marketing's mapping). A guide links to a library trip by creating a **package** with `guide_packages.trip_id` set:
- The package carries the guide's own price, group size, dates note and what is included; the route facts come from the library row and are never edited by the guide.
- One link per guide per trip (unique `guide_id, trip_id`).
- The package goes through the normal package approval (Walter approves every link, board decision 5); leads already point at packages (`leads.package_id`), so enquiries work unchanged.
- Public: shown on the trip page as "Guides who lead this route" only when both the trip and the package are approved and the guide is approved.

**Custom trips.** A package with no `trip_id`, plus day-by-day lines in a new `guide_package_days` (`package_id`, `day_no` 1-40, `title`, `place_id` from `places` or a short place name, `overnight`, `altitude_m`, `distance_km`, `notes` up to 500). Approved by Walter like any package; changing the days sends it back to review (same rule as `guard_guide_package` today).

**Crew** (a lead guide invites a chef, assistant guides and porters; each member has their own profile, is approved, never pays):

- `public.crew_profiles` (one per account, `profile_id` unique): `display_name`, `roles` (`job_role[]`: `assistant_guide`, `cook`, `porter`, `driver`, `other`; reuses the jobs enum), `region`, `languages`, `years`, `bio` (up to 600), `photo_url`, `verification_status` (`review_status`, plus `needs_info` from the items paper), `is_sample`. No plan, fee or payment columns.
- `public.crew_private`: phone, WhatsApp, park registration number (KINAPA or TANAPA where it applies), ID document path. Owner and admins only, like `guide_private`.
- `public.crew_memberships`: `lead_guide_id` (or `lead_provider_id` for an operator, exactly one), `crew_profile_id`, `role`, `kind` (`permanent` or `temporary` with `starts_on`, `ends_on`), `status` (`invited`, `accepted`, `declined`, `removed`), `invite_code`, timestamps. Unique open membership per lead and member.
- Invite: the lead creates an invite and **shares the link or code themselves** (WhatsApp from their own phone). Kwetuly does not message people who have not signed up. The member signs up (a traveller account), opens the code, fills the crew profile, and Walter approves it once. An accepted membership shows on the lead's public page only after both the crew profile and the membership are approved, with first name, role and photo (member's consent tick).
- Never pays: no payment, badge or seat row may reference a crew profile (guard). A later team-seat fee (board decision 4, none at the start) is charged to the lead.
- An assistant guide who is also a licensed guide can have a guide profile too; the two are separate rows, as the roles paper allows.
- Porter pay and conditions: legal's step 1d research decides what we show or require; nothing is invented here.

### 3.3 Business (`providers`) with per-type fields

Mapping Walter's types to the existing `business_type` check (`20261016000500_traveller_groups_news_samples_merch.sql` lines 196-198):

| Walter's type | `business_type` | Note |
|---|---|---|
| Hotel | `hotel`, `lodge`, `hostel`, `homestay` | |
| Apartment or Airbnb | `rental` | |
| Equipment rental | `gear_rental` | items paper item types |
| Curio | `curio_shop`, `gem_shop` | gems are a restricted item type |
| Restaurant | `restaurant` | |
| Transfers (later) | `transport`, `car_hire` | hidden from the sign-up list until the advocate answers |
| Others | `spa`, `salon`, `nightlife`, `other` | |
| Tour operator, travel agent | **add** `tour_operator`, `travel_agent` | section 3.4 |

New, copying the items paper pattern:
- `public.business_type_fields`: `business_type`, `key`, `kind` (`number`, `choice`, `multi_choice`, `yes_no`, `time`), `min`, `max`, `unit`, `options`, `required`, `is_public`, `sort_order`. Admins edit; public read.
- `providers.attributes` (jsonb), checked by the business guard against the list: known keys only, right kind, within limits, required keys present, at most 30 keys. No free text.
- Labels in `packages/shared` (`business-types.ts`): 7 languages for travellers, English and Kiswahili for owners; a unit test checks every key has every label.

Starting fields (partnerships and designer refine; nothing claims a grade Kwetuly has not seen):

| Type | Fields |
|---|---|
| Hotel, lodge, hostel, homestay | rooms (number), price from per night (TZS), check-in and check-out times, breakfast included, wifi, parking, power backup (generator or solar), accessible room, pool, official grading (choice, shown only with "seen by Kwetuly on [date]") |
| Apartment or Airbnb | bedrooms, beds, sleeps up to, minimum nights, price from per night (TZS), kitchen, wifi, power backup, water tank, security guard, self check-in |
| Equipment rental | categories offered (from item types), deposit asked (yes or no), delivery and collection (items paper delivery areas) |
| Curio and gems | goods categories, export papers help (yes or no; legal wording), restricted goods declaration (required for gems) |
| Restaurant | cuisine (multi), halal, vegetarian options, price per person range (TZS), opening hours, delivery, alcohol served |
| Others | opening hours, price range |

Private documents (TIN, business licence, TALA for tourism businesses) stay in `provider_private` with "seen by Kwetuly on [date]" (decided 2026-10-30). One business per account for now (decided).

### 3.4 Tour operator or travel agent, linked to `tour_operators`

`tour_operators` (`20261015000000_tours.sql` lines 16-39) is today an admin-managed directory with `licence_number`, `licence_authority`, `licence_checked_at` and `status`. Design:

- An operator or agent signs up as a business of type `tour_operator` or `travel_agent` (a `providers` row, own dashboard, own approval). No individual travel agents: approval needs a company registration number and TIN in `provider_private`.
- **Claim**: the owner asks to link their business to the directory row ("This is my company"), or Walter creates the row. `providers.tour_operator_id` (unique) is set by admins only (guard), after the MNRT licence has been seen.
- Add to `tour_operators`: `licence_kind` (tour operator or travel agent, as written on the licence), `licence_expires_on` (date, required when `licence_number` is set), `provider_id` back-reference (optional).
- **Hidden when expired, without a job**: the public read policy becomes `status = 'published' and licence_expires_on >= current_date` (admins still read all). Pages that cache operator data use a cache life of at most one day, or check the date when rendering, so an expired operator disappears the same day. Trips that name an expired operator hide the operator link.
- A daily `pg_cron` notice 30 and 7 days before expiry to the owner and to admins.
- Wording: "Licence checked by Kwetuly on [date], valid to [date]". Never "trusted", "recommended" or "verified partner". Kwetuly introduces, the operator sells; commissions are disclosed (legal step 1d drafts the wording; GN 487A and the MNRT check are legal's).
- The TripAdvisor fields stay as they are (rating with checked date).

### 3.5 Crew hiring through the jobs hub

`jobs` (`20261012000500_calls_jobs_hub.sql` lines 113-128; `kind` crew or handover from `20261013000100_partners.sql` line 11) already has `role_needed` with the crew roles.

- Add `jobs.lead_guide_id` or `jobs.lead_provider_id` (who hires; must be the poster's own approved row), `kind` gains `temporary` and `permanent` dates (`start_date`, `end_date` exist), `pay` stays text until legal's porter and pay research says what must be shown.
- New `public.job_applications`: `job_id`, `applicant_profile_id`, `crew_profile_id` or `guide_id` (the applicant must have an approved one), `message` (up to 500), `status` (`applied`, `shortlisted`, `hired`, `declined`, `withdrawn`), timestamps. The poster reads applications to their own jobs; the applicant reads their own; admins read all. Limits: 10 applications a day per person.
- Contact details unlock only when shortlisted (same idea as the offer contact unlock, `offer_contacts`).
- **Hired** creates a `crew_memberships` row (temporary or permanent) or, for a guide, a link noted on both profiles. The "enlisted guide" rule and whether operators may hire guides temporarily are legal's step 1d.
- Applicants never pay; posting stays free at the start.

### 3.6 Who reviews what

| New thing | security-reviewer | qa-tester | legal |
|---|---|---|---|
| Linking gate, step-up, deletion step-up | yes (auth, API path) | yes | no |
| Crew profiles, invites, memberships | yes (personal data, ID documents) | yes | porter rules, consent |
| Business per-type fields | jsonb guard | yes | grading and restricted-goods wording |
| Operator claim, licence expiry hide | yes (admin-only fields) | yes | MNRT, GN 487A, wording |
| Job applications | yes (contact unlock, spam) | yes | enlisted rule, pay display |

---

## 4. Facts: email one-time codes and passkeys

Checked on 2026-10-30.

| # | Question | Answer | Source |
|---|---|---|---|
| E1 | Can Supabase sign people in with an emailed code instead of a link? | Yes. Email codes use the **Magic Link** template: add `{{ .Token }}` and people type the code. Send with `signInWithOtp({ email })`; check with `verifyOtp({ email, token, type: 'email' })`, which returns a session. | https://supabase.com/docs/guides/auth/auth-email-passwordless |
| E2 | Can it refuse to create new accounts? | Yes, `shouldCreateUser: false`. By default a new email gets an account. This is a client option: our database rule for sign-ups (`handle_new_user`) stays the real gate. | Same page |
| E3 | Limits | One request per 60 seconds per user by default. Codes expire after 1 hour by default (configurable; more than one day "strongly discouraged" and only through the Management API). The same expiry setting also covers magic links, invitations and password reset links. | Same page |
| E4 | Code length | Six digits in the docs' examples; whether the length is configurable on our plan: **to verify** in the dashboard (Authentication, Email). | to verify |
| E5 | Does it work with our email? | It sends through Supabase Auth's mailer; with the built-in mailer the hourly limit is very low, so custom SMTP (Resend) is needed before real use. | `docs/devops/kwetuly-hosting-plan.md` line 140 |
| P1 | Does Supabase support passkeys? | **Beta** since 2026-05-28. Switch on under Authentication, Passkeys; the client opts in with `auth: { experimental: { passkey: true } }`; methods `registerPasskey()`, `signInWithPasskey()`, `passkey.list/update/delete`. "The API may change without notice." | https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta ; https://supabase.com/docs/guides/auth/passkeys |
| P2 | Requirements | Relying party name, ID (bare domain, e.g. `kwetuly.com`) and up to 5 origins. Registration needs "an existing, confirmed, non-anonymous user". Discoverable credentials: no email typed at sign-in. supabase-js v2.105.0 or later (we have ^2.117.3). | Same pages; `apps/web/package.json`, `apps/mobile/package.json` |
| P3 | Native apps | Documented for Swift (iOS 16+) and Flutter. **React Native / Expo is not mentioned**, so the app would need its own native passkey module and Apple/Android domain association files. | Docs page above |
| P4 | Security history | A third-party coordinated-disclosure record (ANT-2026-0JJXMV3G) describes a passkey registration issue in supabase/auth where a stolen token could register a passkey that survived a password change; it says a patch shipped 2026-06-04. Not checked against Supabase's own advisories: **to verify**. Either way it is the same persistence risk as linking (N1): any passkey registration must sit behind the same fresh sign-in or code. | https://red.anthropic.com/2026/cvd/findings/ANT-2026-0JJXMV3G |

**Recommendation.** Use email codes now, only as the step-up in section 1 (and, after launch, optionally as a sign-in way for travellers who forget passwords; a code is easier than a link on a phone that opens emails in another app). Passkeys: not before launch; look again when Supabase marks them stable and documents a React Native path, then add them behind the step-up.

---

## 5. Decisions for Walter

1. **Switch manual linking off now** until the safety step passes security-reviewer and qa-tester (recommended; the flags are 0, nobody loses anything). Yes or no.
2. **Admin accounts never link other sign-ins** (email, password and authenticator only; a separate non-admin account for personal use). Yes, or allow with aal2.
3. **Before-launch list:** linking gate (B), step-up screens and confirm screen (A), notices (C), app "My details" and the "Add phone" fix (B1, B2), fresh sign-in before account deletion (B3). Approve all, or pick.
4. **Supabase settings** (Walter clicks, devops guide): identity linked and unlinked emails on, magic link template with `{{ .Token }}`, custom SMTP with Resend, "Confirm email" on.
5. **Live database:** the migration is tested on a Supabase branch or staging first, then applied to live only with your approval.
6. After launch: library links and custom trips as packages, `business_type_fields`, operator claim with licence expiry, crew profiles and job applications, in the board's order (P-a to P-d). Agree with the data shapes in section 3, or ask for changes.
