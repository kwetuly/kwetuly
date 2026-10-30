# One account, several roles, more ways to sign in

Written by tech-lead on 2026-10-30. Paper only: no code or database was changed.
Asked for in `docs/team/board.md` (2026-10-30, "Sign-in ways, no duplicates, several roles per account", step 1a).

## In short

- **Instagram:** no button. Supabase has no Instagram provider, and Meta's only remaining Instagram login is for business and creator accounts, not for ordinary travellers. Facebook already covers Meta.
- **X:** possible later. Supabase's X provider (OAuth 2.0) only accepts the email if X says it is confirmed. People whose X account has no confirmed email cannot sign in, which is what we want.
- **Phone:** possible, with SMS or WhatsApp codes through Twilio, or through any sender we choose by using Supabase's "Send SMS" hook. The cost per code still needs pricing (business-manager). Whether it needs a paid Supabase plan is still to verify.
- **Duplicates:** Supabase joins sign-ins automatically only when the provider's email is **verified**. An unverified or missing email always makes a **new** account. So the rules are: every account has a verified email, "Allow users without an email" stays off, people can join extra sign-ins by hand from a "Connected sign-ins" screen, and one phone number belongs to one account.
- **Roles:** the database is already closer to "one account, several roles" than it looks. What a person may do as a guide or a business comes from their approved `guides` row or approved `providers` listing, not from `profiles.role`. `profiles.role` now matters for only two things: **admin** (security) and **which screens the website and app show**. The second is where the single-role model really bites.
- **Recommendation:** do **not** add an `account_roles` table. Derive roles from the rows we already have (guide profile, business listings), keep admin as the only role stored on the profile, and fix the screens to show every role a person has.
- **Guide services:** one guide profile per person stays (`guides.owner_id` unique is correct). Safari, mountain and cultural already exist as guide specialities. Add five package kinds: `safari`, `mountain`, `transfer`, `lesson_kiswahili` and `lesson_cooking`. A guide "offers" a service when they have an approved package of that kind.

---

## 1. Facts about providers

Checked on 2026-10-30 unless marked "to verify". Supabase changes often, so check again before building.

| # | Question | Answer | Status |
| --- | --- | --- | --- |
| F1 | Does Supabase have an Instagram provider? | No. The social login list has 19 providers (Apple, Azure, Bitbucket, Discord, Facebook, Figma, GitHub, GitLab, Google, Kakao, Keycloak, LinkedIn, Notion, Slack, Spotify, Twitter/X, Twitch, WorkOS, Zoom). Instagram is not one of them. A "custom OAuth/OIDC provider" exists, but see F2. | Checked on 2026-10-30, https://supabase.com/docs/guides/auth/social-login |
| F2 | What is the state of Instagram login at Meta? | Meta shut down the Instagram Basic Display API on 4 December 2024. The replacements ("Instagram API with Instagram Login" and "Instagram API with Facebook Login") are for business and creator use. Meta wrote that there will be no more set of Instagram APIs for consumer apps. So a normal traveller's personal Instagram account cannot be used to sign in. | Checked on 2026-10-30, https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api. "Professional accounts only" is stated by third-party guides; to verify against Meta's current Instagram Platform docs before any guide-only use. |
| F3 | Does Supabase's X (OAuth 2.0) provider return a verified email? | Yes, when there is one. Supabase's code asks for the `users.email` scope and reads X's `confirmed_email` field. When X sends an email, Supabase marks it as verified ("X returns only confirmed emails"). With no confirmed email, the user has no email. The X app must have "Request email from users" turned on. The provider name is `x`. The old Twitter OAuth 1.0a provider will be deprecated. | Checked on 2026-10-30, https://supabase.com/docs/guides/auth/social-login/auth-twitter and https://github.com/supabase/auth/blob/master/internal/api/provider/x.go |
| F4 | Which phone (SMS) providers does Supabase support? | MessageBird, Twilio (and Twilio Verify), Vonage, and TextLocal (community supported). By default a code can be asked for once every 60 seconds and expires after 1 hour. Supabase advises rate limits and CAPTCHA to control SMS costs. | Checked on 2026-10-30, https://supabase.com/docs/guides/auth/phone-login |
| F5 | Can codes go by WhatsApp? | Yes, through Twilio or Twilio Verify only. The "Send SMS" auth hook also lets us send codes through any service we write (WhatsApp through another sender, or a Tanzanian SMS aggregator). Supabase's own example sends WhatsApp to some countries and SMS to the rest. | Checked on 2026-10-30, https://supabase.com/docs/guides/auth/phone-login and https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook |
| F6 | Does phone sign-in need a paid Supabase plan? | The official phone docs mention no plan limit. One third-party post says phone sign-in needs a paid plan. The SMS or WhatsApp messages are paid to Twilio or the chosen sender in any case. | **To verify:** Walter checks the Supabase dashboard (Authentication, Sign In / Providers, Phone) and the pricing page. The board already plans the Pro upgrade before launch. |
| F7 | Does Supabase join accounts automatically by verified email? | Yes. When someone signs in with a provider, Supabase looks for an existing user with the same **verified** email and adds the new sign-in to that user. If the provider's email is not verified, Supabase never joins. It makes a new user, and if the email is already taken it drops the email from the new user. When it joins, it removes any other unconfirmed sign-ins on that user. | Checked on 2026-10-30, https://supabase.com/docs/guides/auth/auth-identity-linking and https://github.com/supabase/auth/blob/master/internal/models/linking.go |
| F8 | Manual linking (`linkIdentity` / `unlinkIdentity`): which setting, which plan? | Turn on "manual linking" in the project's Authentication settings in the dashboard (`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED` when self-hosting). It is marked **beta**. The person must be signed in, and must keep **at least two** sign-ins to remove one. The app can link with an ID token (native Google/Apple). The docs mention no plan limit. | Checked on 2026-10-30, https://supabase.com/docs/guides/auth/auth-identity-linking. Plan: to verify in the dashboard (no limit found). |
| F9 | What happens when a provider's email is unverified? | Supabase makes a **new, separate** account (see F7), and that is how one person ends up with two accounts. With no email at all and "Allow users without an email" **off** (our Google guide already says to leave it off, `docs/devops/google-sign-in-setup.md` line 114), the sign-in is refused. | Checked on 2026-10-30, linking.go above. The exact error a person sees when there is no email is to verify in qa. |
| F10 | Does a confirmed email setting affect joining? | Yes. If the project "auto-confirms" emails (email confirmation off), Supabase treats **every** email as verified when joining accounts (linking.go reads `Mailer.Autoconfirm`). Someone could then sign up with another person's email and later be joined to that person's Google sign-in. | Checked on 2026-10-30, linking.go. **To verify on live:** "Confirm email" must stay on. The web sign-up flow (`join?sent=1`) suggests it is on. |
| F11 | Facebook and Apple emails | Facebook accounts made with a phone number may have no email; with "Allow users without an email" off they cannot sign in. Apple can hide the real email behind a relay address, so an Apple sign-in may not match the person's Google email and makes a second account. Manual linking is the fix. | To verify: how Supabase marks Facebook emails as verified (check `internal/api/provider/facebook.go`), and Apple relay behaviour, when Apple is turned on. |

---

## 2. Audit of today's single-role model

### 2.1 What exists

| Item | Where | What it does | Problem for "one person, several roles" |
| --- | --- | --- | --- |
| `profiles.role` (`user_role` enum: traveler, provider, investor, admin, guide) | `20261012000000_initial_schema.sql` line 7 and 37; `guide` added in `20261012000300_guide_role_and_leads.sql` line 2 | One value per account. | One value cannot say "traveller and guide and business". |
| `handle_new_user()` | Latest: `20261025000100_neutral_names_and_shop_identity.sql` lines 220-270 | Copies the role the sign-up form asked for (`traveler`, `provider`, `investor`, `guide`) from the sign-up data. Never admin. | The sign-up data comes from the person's browser, so anyone can start as `provider` or `investor` (`investor` cannot be picked on the welcome step, so this is inconsistent but harmless: no rule gives `investor` any rights). |
| `complete_onboarding()` | Latest: `20261025000000_brand_rename_kwetuly.sql` lines 300-330 | Sets the role once (traveller, guide or provider), plus the phone and name, then marks the account set up. Refuses a second call ("Account already set up"). | No way to add a role later. |
| `guard_profile_role()` trigger | Latest: `20261016001800_onboarded_gate_followup.sql` lines 325-345 | Only admins (and the database) may change `role`. | Good for admin safety, but it also stops a traveller from becoming a guide later through `role`. |
| `guides.owner_id unique` | `20261012000200_guides.sql` line 11 (nullable for samples since `20261016001000`) | One guide profile per account. | **Correct, keep it.** One guide with many services needs one profile with many packages, not many profiles. |
| `guides.specialties` (`guide_specialty` enum: mountain, safari, cultural, city, birding, marine, photography, day_trips) | `20261012000200_guides.sql` lines 4 and 19; `packages/shared/src/guides.ts` lines 5-14 | What kind of trips a guide leads. Also used by group trips, trip requests and partner leads (`specialty` columns). | Not mentioned in the board's audit list, but it already covers safari, mountain and cultural. |
| `guides.expertise` (text array with a check) | `20261013000000_guide_expertise.sql` | Who a guide serves (blind, mobility, families, VIP, record climbs...). | Not a service list, and should not become one (the catalogue plan rejects that too, section 2). |
| `guide_packages.kind` | `20261016000100_guide_packages.sql` line 9; `packages/shared/src/packages.ts` lines 7-16 | `cultural`, `one_on_one`, `day_trip`, `multi_day`, `food`, `city`, `nature`, `other`. | No safari, mountain, transfer or lesson kinds. |
| `profiles.phone` | `20261012000000_initial_schema.sql` line 36 | Typed contact number (E.164 checked in `complete_onboarding`). `phone_verified_at` set by an admin or by `private.sync_phone_confirmed()` when Supabase confirms a phone code (`20261016000500_traveller_groups_news_samples_merch.sql` lines 37-54). | **Not unique.** Two accounts can hold the same number. Once phone sign-in exists this also causes a clash: `auth.users.phone` is unique in Supabase, but the profile copy is not. |
| `providers.owner_id` | `20261012000000_initial_schema.sql`; insert policy latest `20261016001800_onboarded_gate_followup.sql` lines 198-201 | Not unique: one account can own several business listings. Any set-up account can create a listing (no role check). | Good: a guide can also own a business listing today at database level. |
| `guides` insert policy | `20261016001800_onboarded_gate_followup.sql` lines 193-196 | Any set-up account may create its own guide profile (no role check); it starts as pending. | Good: a traveller can already become a guide at database level. |

**The key finding:** the database rules that matter (who may offer on trip requests, run group trips, use the Guide Hub, take calls) already check the **approved guide row** or an **approved business listing**, not `profiles.role`. Since `20261016001400`, `private.can_offer()` and `private.can_organize_group()` use `guides.verification_status = 'approved'` and `private.has_approved_business()`. The only database rights that still come from `profiles.role` are **admin** rights.

### 2.2 Everything that reads `profiles.role`

**Database: functions and triggers (current versions)**

| Function / trigger | File and line | Reads role for | Risk if roles change |
| --- | --- | --- | --- |
| `private.is_admin()` | `20261016001400_admin_two_step_business_gate_deposits_leads.sql` lines 38-50 | `role = 'admin'` plus a two-step (aal2) session | **Security.** Called by 156 places across 26 migrations (policies, guards, functions). Must keep the same meaning. |
| `private.is_trusted()` | `20261012000100_private_helpers.sql` lines 10-17 | Through `is_admin()` | Same. |
| `public.guard_profile_role()` (trigger `profiles_guard_role`) | `20261016001800_onboarded_gate_followup.sql` lines 325-345 | Stops non-admins changing `role` | Must still stop anyone granting themselves admin. |
| `private.guard_profile_name()` (trigger `profiles_guard_name`) | `20261025000100_neutral_names_and_shop_identity.sql` lines 123-145 | Admins may use names like "Kwetuly" | Keep the admin test. |
| `private.guard_guide_name()` (trigger `guides_guard_name`) | same file, lines 147-170 | Admin-owned guide profiles may use the brand name | Same. |
| `private.guard_business_name()` (triggers on `providers`, `trip_offers`, `group_trips`) | same file, lines 177-212 | Admin-owned rows may use the brand name | Same. |
| `public.handle_new_user()` (trigger on `auth.users`) | same file, lines 220-270 | Sets the starting role from sign-up data | Changes with the new design (section 3). |
| `public.complete_onboarding()` | `20261025000000_brand_rename_kwetuly.sql` lines 300-330 | Sets the role once | Changes with the new design. |
| `private.after_message()` | `20261025000100_neutral_names_and_shop_identity.sql` from line 275 (label at lines 315-317) | Sender label when there is no name: "Kwetuly" for admins, "A traveller", "A guide" | A guide writing as a traveller would be labelled by role, not by the conversation. Low impact. |
| `public.set_hub_author()` | same file, lines 340-357 | Hub post author label fallback | Low impact. |
| `private.notify_admins()` | `20261012000800_notifications.sql` line 71 | Loops over admins | Keep the admin test. |
| `private.on_lead_created()` | latest `20261016001700_onboarded_gate_and_scrub.sql` line 255 | Sends enquiries without a guide to admins | Same. |
| `private.on_payment_review()` | `20261016001600_payments_review_fixes.sql` line 79 | Alerts admins on payment mismatches | Same. |
| One-off data updates (shop identity, brand rename) | `20261025000000` line 397; `20261025000100` lines 365-470 | Admin-owned rows | Already run; no change needed. |

**RLS policies:** no current policy reads `profiles.role` directly. They read it through `private.is_admin()`. The older policies that did (`20261013000300` line 75, `20261014000100` line 73, `20261016000500` line 82, `20261016000600` line 15) were replaced by the approved-row checks in `20261016001400` lines 72-93.

**Website (`apps/web/src`)**

| File and line | Use |
| --- | --- |
| `lib/auth.ts` lines 29, 33 | Loads `profiles.role` into `CurrentUser.role` |
| `lib/auth.ts` line 44 | `canUseHub`: admin or approved guide |
| `lib/auth.ts` lines 104, 111 | `isAdminSession`, `requireAdmin` |
| `lib/auth.ts` line 123 | `businessApproval`: returns `'none'` unless `role = 'provider'`. **Bug for several roles:** a guide or traveller who owns an approved listing is told they are not a business, while the database lets them act as one. |
| `app/[lang]/(auth)/actions.ts` lines 20, 31, 67, 84, 96, 106 | Sign-up, social sign-in and welcome step send one role |
| `app/[lang]/(auth)/join/page.tsx` line 46, `join/join-form.tsx` lines 42-60, `welcome/page.tsx` lines 55-68 | Pick one account type |
| `components/social-sign-in.tsx` line 45 | Passes the chosen role |
| `app/[lang]/dashboard/page.tsx` lines 53-56 | **One dashboard per role:** guide editor, or business, or traveller. A person with a guide profile and a listing sees only the guide one. |
| `app/[lang]/dashboard/page.tsx` lines 134, 429; `dashboard/business-listing.tsx` line 74 | Admins may use reserved names |
| `app/[lang]/group-trips/actions.ts` lines 34, 77; `group-trips/new/page.tsx` lines 65, 109; `group-trips/mine/page.tsx` line 112 | Admin or approved business |
| `app/[lang]/requests/page.tsx` line 52; `requests/[id]/page.tsx` lines 51, 306; `requests/actions.ts` line 100 | Who can offer; reserved names |
| `app/[lang]/hub/actions.ts` line 26; `hub/news/page.tsx` line 61 | Admins post news |
| `app/[lang]/security/page.tsx` line 35 | Admin two-step notice |
| `components/auth-links.tsx` lines 41, 102 | Admin menu link |
| `app/[lang]/admin/**` (page.tsx lines 30, 141, 219, 278, 317, 441, 513; businesses-admin.tsx 27; pending-packages.tsx 15; commissions 34; listings 101; media 37; messages 47; news 71; operators 38 and [id] 30; places 38 and [id] 29; shop 66; trips 47 and [id] 73) | Admin-only pages (the database checks again with `is_admin()`) |

**App (`apps/mobile/src`)**

| File and line | Use |
| --- | --- |
| `lib/auth.tsx` lines 6, 53 | Loads `profiles.role` |
| `lib/api-more.ts` lines 135-140 | Welcome step sends one role |
| `app/welcome.tsx` lines 22, 44, 61; `app/sign-in.tsx` line 201; `lib/onboarding.ts` line 19 | Pick one account type |
| `app/(tabs)/account/index.tsx` lines 22, 26, 51, 125 | Shows guide or business sections by role. `isBusiness` is `role === 'provider'`, so a guide with a listing does not see business tools. |
| `hooks/use-can-offer.ts` lines 14-25 | Same bug as `businessApproval` on the web: business approval only counts when `role === 'provider'` |
| `app/group-trip/new.tsx` line 28; `app/my-group-trips.tsx` line 22 | Admin shortcut |

Not affected: `supabase/functions` (no reads of `profiles.role`), `packages/shared` (no reads).

### 2.3 Other findings, ranked

1. **Security, medium:** the auto-confirm risk in F10. Before launch, confirm on live that "Confirm email" is on, so that auto-joining never trusts an unconfirmed email.
2. **Broken flow, medium:** `businessApproval` (web `lib/auth.ts` line 123) and `useCanOffer` (app `hooks/use-can-offer.ts` line 18) hide business tools from anyone whose role is not `provider`, although the database allows them. Fix: check for an approved listing whatever the role.
3. **Broken flow, medium:** one dashboard per role (`dashboard/page.tsx` lines 53-56, app `account/index.tsx`). Today a traveller reaches the guide editor only through the hidden `?as=guide` link.
4. **Data quality, medium:** `profiles.phone` not unique. Two accounts can share a number, and `sync_phone_confirmed` would fail (rolling back the phone confirmation in Supabase) if a unique index is added without handling the clash.
5. **Polish, low:** `handle_new_user` accepts `investor` from sign-up data, but the welcome step does not. Harmless today; remove when the role code changes.

---

## 3. Proposed data design

### 3.1 Roles: derive them, do not store them twice

| Role | Comes from | Who grants it | Approval |
| --- | --- | --- | --- |
| Traveller | Every account | Automatic | None |
| Guide | The person's `guides` row (one per account) | The person creates it from Account settings ("Become a guide") | Existing guide review (`verification_status`, checks, licence) |
| Business owner | One or more `providers` rows | The person adds a listing ("List a business") | Existing listing review, per listing |
| Admin | `profiles.role = 'admin'` only | Set by hand in the database by Walter | Never self-granted; `guard_profile_role` stays; two-step sign-in stays |

Changes (after launch, see section 4):

1. Add `public.my_roles()` (SQL, `security invoker`, runs under the caller's RLS) returning `traveller` plus `guide` / `guide_pending`, `business` / `business_pending`, and `admin` (from `is_admin()`). Web `getCurrentUser` and app `useProfile` use it instead of `profiles.role`.
2. `profiles.role` keeps only two meanings: `admin`, or "what the person picked at sign-up" (used to land them on the right page first, and in analytics). No database right depends on it except admin, which is already true today.
3. `complete_onboarding` stops setting a role for good. It stores the first choice as the landing page only; "Become a guide" and "List a business" create the guide row or listing, as the insert policies already allow.
4. Messaging and hub labels (`after_message`, `set_hub_author`) label by the conversation or the guide row ("A guide" when the author has a guide profile), not by `role`.
5. Later, if needed: move admin to its own private table (`private.admins`), so `profiles.role` can be dropped. Not needed for launch.

**Why not an `account_roles` table (board step 3):** guide and business approval already live on `guides.verification_status` and `providers.verification_status`. A roles table would store the same fact twice, and the two would drift (an approved guide whose role row says pending). Every RLS helper already uses the rows. A table only makes sense for a role with no row of its own, and none is planned (`investor` has no rights today).

### 3.2 Guide services

One guide profile, many services. A service is offered when the guide has at least one **approved package** of that kind. No new profile field, no separate "teacher" or "driver" account. This matches the catalogue plan's rule ("a teacher is an approved guide who has at least one approved lesson package", `post-launch-catalogue-lessons-payments-plan.md` line 136).

| Service | Guide speciality (exists) | Package kind | Notes |
| --- | --- | --- | --- |
| Safari | `safari` | **add `safari`** (today only `day_trip` / `multi_day`) | Park entry and vehicles: see licences below. |
| Mountain | `mountain` | **add `mountain`** | Kilimanjaro and Meru climbs go through licensed operators and park-registered guides; to verify with legal. |
| Cultural | `cultural` | `cultural` (exists) | In person. |
| Kiswahili lessons | none (do not add one) | **add `lesson_kiswahili`** (as in the catalogue plan) | Online; `duration_minutes`, 18+ tick, teaching rules, as in the plan, section 2. |
| Cooking lessons | none | **add `lesson_cooking`** (as in the plan) | Online. The in-person meal stays `food`. |
| Transfers | none | **add `transfer`** | Requires `guides.has_vehicle = true` and `price_per = 'group'` (per vehicle), checked in the package guard. Carrying paying passengers needs road transport and tourism licences; to verify with legal before the kind is switched on. |

Kept as they are: `one_on_one`, `day_trip`, `multi_day`, `food`, `city`, `nature`, `other`; `guides.expertise` (who the guide serves); `guides.specialties` (still used by search, group trips, trip requests). Lessons and transfers are **not** added to `guide_specialty`, because that enum is also the trip type on trip requests and group trips, where they make no sense.

Work: one migration (check list on `guide_packages.kind`, guard rules for `transfer` and lessons), `PACKAGE_KINDS` in `packages/shared/src/packages.ts` in 7 languages, and a "Services" line on the guide profile built from approved package kinds. The lesson parts are already sized in the catalogue plan (Part 2); `safari`, `mountain` and `transfer` are an S on top.

### 3.3 Preventing two accounts for one person

Rules:

1. **Every account has a verified email.** Google gives one. Facebook and X give one only when confirmed; without it the sign-in is refused because "Allow users without an email" stays **off** for every provider. Email sign-up confirms by link ("Confirm email" stays **on**, F10).
2. **Auto-join by verified email** (Supabase default, F7). Email account plus Google with the same address gives one account (already in `docs/devops/google-sign-in-setup.md` line 149).
3. **"Connected sign-ins" screen** in Account settings (web and app): lists the person's sign-ins (`getUserIdentities`), "Connect Google / Facebook" (`linkIdentity`), "Remove" only when at least one other way in remains (Supabase also requires two, F8). Needs manual linking turned on (Walter, dashboard). Admin accounts: link and unlink only in a two-step session.
4. **One phone number per account:** a unique index on `profiles.phone` (numbers are already stored in one format, E.164). Before it: a read-only check for duplicates on live; any found go to Walter, nothing is merged or deleted automatically. The welcome step and the details form show "This number is already on another Kwetuly account. Sign in with that account, or contact us." `sync_phone_confirmed` must handle the clash (skip and alert admins) so it never blocks a phone confirmation in Supabase.
5. **Phone is a way back in, not a way to start** (when phone sign-in comes):
   - A person adds their phone in Account settings while signed in (`updateUser({ phone })` plus the code). After that, "Sign in with phone" finds the same account.
   - New accounts that start from a phone code are refused in `handle_new_user` (provider `phone` without an email). Supabase's own `shouldCreateUser: false` option is only a browser setting, so the database must enforce it.
   - **Phone first, Google later:** with this rule it cannot happen, because there is no phone-only account. If Walter instead wants phone-first sign-up, the welcome step must ask for an email and confirm it before the account is set up. If that email already belongs to another account, the person is told to sign in there and add the phone; the empty phone-only account is removed with the existing "delete my account" path. Without one of these two rules, a person who signs in by phone and later by Google gets **two accounts**, because the phone account has no email for Supabase to match (F7, F9).
6. **Apple relay emails** (later): an Apple sign-in with a hidden email makes a second account; the welcome step offers "Already have a Kwetuly account? Sign in there and connect Apple."
7. **Instagram:** not a sign-in. Guides keep the Instagram link on their profile (`guides.instagram_url`).

---

## 4. Before launch and after launch

**Safe and small before launch** (each needs Walter's yes; database work goes to backend-engineer, then security-reviewer and qa-tester):

1. Walter, in the Supabase dashboard: "Confirm email" on (check), "Allow users without an email" off for Google and Facebook, turn on manual linking. No code.
2. Read-only duplicate check of `profiles.phone` on live (backend-engineer, with Walter's approval for live access).
3. Migration: unique index on `profiles.phone`, friendly errors in `complete_onboarding` and the details form, clash handling in `sync_phone_confirmed`. Size S.
4. "Connected sign-ins" screen on web and app (Google and Facebook only). Size S-M. Texts in 7 languages.
5. Fix `businessApproval` (web) and `useCanOffer` (app) to check approved listings whatever the role. Size XS, no database change.
6. Friendly message when a provider sends no email ("Your Facebook account has no confirmed email. Use Google or email instead."). Size XS.

**After launch:**

1. Roles from rows (`my_roles()`), dashboards and the app Account tab show all roles, "Become a guide" and "List a business" in Account settings, `complete_onboarding` no longer locks a role, message and hub labels. Size M. Security review for admin escalation.
2. Guide services: package kinds `safari`, `mountain`, `transfer`, together with the lesson kinds from the catalogue plan (Part 2), plus a "Services" line on guide profiles. Size S on top of Part 2. Legal check for transfers and climbs first.
3. Phone sign-in: after business-manager prices SMS and WhatsApp codes for Tanzania, after F6 is checked, with rule 5 above, CAPTCHA and rate limits. Legal adds phone lines to the privacy notice.
4. X sign-in: only if Walter wants it; it already meets the verified-email rule (F3).
5. Apple sign-in: after the Apple Developer account (already on the board), with rule 6.

## 5. Decisions for Walter

1. **Roles from rows, no `account_roles` table** (this replaces board item 3's table). Yes or no.
2. **Phone sign-in rule:** phone is only a way back into an account that already has a verified email (recommended), or phone-first sign-up with an email asked for straight after.
3. **Transfers as a guide service:** allowed only for guides with a vehicle, priced per vehicle, and only after legal confirms the licences. Yes or no, or wait.
4. **Before-launch list (section 4, items 1-6):** approve all, or pick.
5. **Live access for the read-only phone duplicate check:** yes or no.
6. **X:** build after launch (it meets the email rule), or skip.
