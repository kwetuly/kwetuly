# Profile media library and full profile pages

Prepared by tech-lead, 2026-10-30. Paper only: no code, database, migration or Supabase setting was changed.
Asked for by Walter on 2026-10-30: every profile (traveller, guide, business) gets a media library like posts, with photos and maybe videos, each item visible to the public, to guides only, or to specific people; and a complete profile page with the profile, reviews, pictures and trips.

Builds on `docs/tech/profiles-and-linking-safety.md` (the "profiles paper"), `docs/tech/items-approvals-orders-design.md` (the "items paper", section 5.1 logo and cover images, the approval centre) and `docs/legal/group-chat-media-consent.md` (the "consent draft", not yet reviewed by an advocate).

Sizes: XS = a day, S = a few days, M = one to two weeks, L = more than two weeks (one engineer, including review and tests).

## In short

- **Most of the hard parts already exist** in group chats: a private bucket, members-only reading enforced by the database, signed links that expire, photos re-drawn on the device so GPS and camera data never leave the phone, consent and objection rules, and a public gallery ("Moments") that only shows items the database allows. The media library reuses these patterns and components, in its own table and bucket.
- **Found while reading (fix now, it is a bug, not a feature):** chat **videos are uploaded as they are**, so a phone video's GPS location goes into storage and, if featured, onto the public Moments page. Photos are cleaned; videos are not. See section 1.3, F1.
- **Videos:** the Supabase Free plan cannot carry a media library (1 GB storage, 5 GB egress, 50 MB per file). Pro (US$25 a month, already planned for launch) has 100 GB storage and 250 GB egress included. Storage is cheap; **egress (people watching) is the cost**. Supabase does not transcode video. Recommendation: photos first; then **YouTube or TikTok links** (no storage, no egress, no moderation of the file itself); own short videos (30 s, 720p, 25 MB after compression on the phone, guides and businesses only) only when there is demand, and through Cloudflare Stream if they get many views.
- **Data model:** `media_items` with a `visibility` of `public`, `guides`, `people` or `only_me`; `media_shares` for named people and chats; one database function decides who can see an item and is used both by the table rules and by the storage rules, so a private file can never be read, even with a guessed path. Public items go live at once and are checked after (as Walter asked), with reports that hide an item automatically. Location is stripped on the device; deletion removes rows by cascade and files by a server-side sweep.
- **Profile page:** one layout for all three groups: cover and logo/photo, name and badges, about, a media grid, trips, reviews, and contact. Visitors see only what is visible to them; the owner sees everything with "Only me / Guides / People / Public" labels and an "as a visitor" preview. Travellers' pages are **private by default**.
- **Split:** before launch only the video-location bug (F1) and the account-deletion file sweep (F2). Everything else after launch, as Walter proposed.

---

## 1. What exists today

### 1.1 Storage buckets and limits

| Bucket | Public? | Limits | What goes in | Rules | Source |
|---|---|---|---|---|---|
| `avatars` | **Yes** (anyone with the address can read) | 10 MB; JPEG, PNG, WebP | Guide photos, package photos, business photos | Upload and replace only in your own folder (`<user id>/...`) and only after onboarding; owner deletes | `20261012000200_guides.sql` lines 140-150; `20261014000500_upload_limits.sql` lines 3-6; `20261016001800_onboarded_gate_followup.sql` lines 204-216; `20261016000000_delete_my_account.sql` lines 13-15 |
| `verification` | No | 15 MB; JPEG, PNG, WebP, PDF | ID documents, first-aid certificates | Own folder; owner and admins read | same files |
| `chat-media` | No | 50 MB; JPEG, PNG, WebP, HEIC, HEIF, MP4, MOV, WebM | Group-chat photos and videos | Members upload into the chat's folder; members and admins read; anyone reads a **featured, consented, unobjected** item; uploader deletes | `20261013000500_group_chats.sql` lines 327-342; `20261016001800_onboarded_gate_followup.sql` lines 225-230 |

A public bucket such as `avatars` cannot hold anything private: anyone who learns a file address can open it, whatever the table rules say. **Private media therefore needs a private bucket.**

### 1.2 Group-chat media and Moments (the closest thing to a media library)

- **Data**: `group_chat_messages.media_path`, `media_type` (`image` or `video`), `share_public` (the sender's consent), `featured` (Kwetuly's choice), and `group_chat_objections` (any member can block public use). `20261013000500_group_chats.sql` lines 32-59.
- **Who can read**: one rule for the table and one for the files, both built on small `security definer` helpers (`private.is_chat_member`, `private.message_is_public`, `private.media_is_public`, lines 64-111). This is the pattern to copy: the same helper decides for rows and for files.
- **Guard trigger**: the sender's id and name come from the session, `featured` can only be set by admins, the file must be in this chat's folder, and after sending only consent can change (`guard_group_message`, lines 204-238).
- **Cleaning photos**: web `apps/web/src/lib/clean-image.ts` (canvas re-draw, longest side 2560 px, JPEG or PNG, refuses to upload the original if the browser cannot read it); app `apps/mobile/src/lib/clean-photo.ts` (expo-image-manipulator, new JPEG). Both drop GPS, camera and time data. Used in `apps/web/src/components/chat-composer.tsx` lines 62-73 and `apps/mobile/src/app/chat/[id].tsx` lines 63-70.
- **Signed links**: the app creates links valid for 1 hour (`apps/mobile/src/lib/api.ts` line 338) or 15 minutes (`api-more.ts` line 111).
- **Moments page**: `apps/web/src/app/[lang]/moments/page.tsx` lists featured items through `listMoments()`; the database decides what is public (comment at line 17). Videos play with `preload="metadata"` (line 58), which is right for slow connections.
- **Consent rules**: the three-step rule (sharer says yes, Kwetuly chooses, nobody in the chat objects) and the confirmation list (took it yourself, everyone recognisable agrees, no recognisable child, nothing private or illegal) in the consent draft sections 2-3. Not yet reviewed by an advocate.

### 1.3 Gaps found while reading

| # | Finding | Where | Risk | Fix | Size | When |
|---|---|---|---|---|---|---|
| F1 | **Chat videos keep their location.** Photos are re-drawn; videos are uploaded as they are ("Videos are uploaded as they are"). iPhone and most Android cameras write the GPS position into the video file's metadata. A featured video on Moments is readable by anyone. | `apps/web/src/components/chat-composer.tsx` lines 63-65; `apps/mobile/src/app/chat/[id].tsx` lines 58-61; `apps/mobile/src/lib/api.ts` lines 352-357 | Personal data (where someone stays) leaks to chat members and, if featured, to the public. PDPA 2022. | Short term (XS): admins do not feature videos until cleaned; the consent draft and review checklist say so. Real fix (S): compress and re-encode videos on the phone before upload (re-encoding writes a new file without the location; to verify per library, section 2.3), and on the web either re-encode or refuse video upload from the browser and point to the app. | XS then S | **Before launch** (the XS part) |
| F2 | **Account deletion removes files only if the phone or browser manages to.** `delete_my_account` deletes rows; files are removed by the client first through `my_uploaded_files()`. If that call fails or the account is removed another way (admin, cascade), the files stay in storage with no owner. | `20261016000000_delete_my_account.sql` lines 11-33; `apps/web/src/app/[lang]/security/actions.ts` lines 91-100; `apps/mobile/src/app/delete-account.tsx` lines 27-33 | Files of a deleted person stay (PDPA: deletion promise on `/data-deletion` not fully kept); chat photos stay readable to chat members until the message row goes. | A nightly Edge Function with the service key lists `storage.objects` whose `owner_id` no longer exists in `auth.users` and removes them through the Storage API (SQL cannot delete the files themselves). Keep the client step as the fast path. | S | **Before launch** (it backs the published deletion page) |
| F3 | The app reads the whole chat video into memory before upload (`arrayBuffer()` of up to 50 MB). | `apps/mobile/src/lib/api.ts` line 355 | Crashes on low-memory Android phones, common in Tanzania. | Upload from the file with resumable (TUS) upload or `expo-file-system` streaming. Needed anyway for the library. | S | After launch, with videos |
| F4 | `videoMaxDuration: 120` probably only limits **recording**, not choosing an existing video from the gallery. | `apps/mobile/src/app/chat/[id].tsx` line 55 | Longer videos than intended. | Check duration from the picked asset (`asset.duration`) and refuse above the limit. **To verify** on Android and iOS. | XS | After launch |

---

## 2. Videos: limits, costs and options

### 2.1 Facts (checked 2026-10-30)

| # | Fact | Free | Pro | Source |
|---|---|---|---|---|
| V1 | Price | US$0 | from US$25 a month | https://supabase.com/pricing |
| V2 | Storage included | 1 GB | 100 GB, then US$0.0213 per GB a month | same |
| V3 | Egress included (people downloading or watching files) | 5 GB | 250 GB, then US$0.09 per GB | same |
| V4 | Cached egress (served from Supabase's CDN) | 5 GB | 250 GB, then US$0.03 per GB | same |
| V5 | Largest single upload | 50 MB ("can't exceed 50 MB") | up to 500 GB, set under Storage settings (global limit), each bucket can be lower | https://supabase.com/docs/guides/storage/uploads/file-limits |
| V6 | Image resizing on the server | not available | Pro and above; 100 origin images included, then US$5 per 1,000; up to 2500 px, 25 MB; HEIC as input only; **images only** | https://supabase.com/docs/guides/storage/serving/image-transformations ; pricing page |
| V7 | Video transcoding | **None** in Supabase. Third parties do it (Mux, Ittybit, or FFmpeg scripts). | same | search 2026-10-30: https://supabase.com/partners/mux ; https://ittybit.com/guides/video-gallery-with-supabase-rls |
| V8 | Free projects | "paused after 1 week of inactivity" | never paused | pricing page |
| V9 | Cloudflare Stream | US$5 per 1,000 minutes stored a month (prepaid in US$5 steps); US$1 per 1,000 minutes delivered; "Ingress ... and encoding are always free"; no separate bandwidth fee; 30 GB per file | | https://developers.cloudflare.com/stream/pricing/ |

The hosting plan already moves Supabase to Pro at launch (`docs/devops/kwetuly-hosting-plan.md` line 220). On Free, a media library with video is not possible (V2, V3).

### 2.2 What it costs (estimates, our own arithmetic)

Assumptions: a photo shown at 1600 px long side is about 300 KB; its grid thumbnail at 480 px about 40 KB. A 30 s video at 720p and about 2.5 Mbit/s is about 9.5 MB.

| Scenario | Storage | Egress a month | Cost on Pro |
|---|---|---|---|
| 1,000 profiles x 20 photos | 1,000 x 20 x 0.34 MB = **about 7 GB** | 100,000 profile views x 12 thumbnails x 40 KB = **about 48 GB**; plus 20,000 photo opens x 300 KB = 6 GB | inside Pro |
| plus 1,000 own videos (30 s) | **about 9.5 GB** | 10,000 plays x 9.5 MB = **about 95 GB**; one video that goes viral on WhatsApp with 50,000 plays = **about 475 GB** | 95 GB fits; the viral case is about 225 GB over = about US$20 (uncached) |
| same 1,000 videos on Cloudflare Stream | 500 minutes | 10,000 plays x 0.5 min = 5,000 min | about US$5 storage + US$5 delivery a month; viral case 25,000 min = US$25 |

Storage grows slowly and is cheap. **Plays are what cost**, and video plays cost 200 times more than thumbnails. Images stay small only if we never serve the original: thumbnails and display sizes must be made on the device at upload (no server resizing needed, which also avoids V6 charges).

### 2.3 Options for video

| Option | Good | Bad |
|---|---|---|
| A. No video, photos only | Cheapest, simplest, least moderation | Guides and lodges want to show the experience |
| B. **Link a YouTube or TikTok video** (store the provider and the video id, never a free URL, as the items paper's "handles not links") | No storage, no egress, no transcoding; YouTube and TikTok moderate the file; many guides and lodges already post there | Third-party tracking when played; leaves Kwetuly; the video can be changed or removed on the other side |
| C. **Own short videos in Supabase**, compressed on the phone: max 30 s (60 s for businesses), 720p, max 25 MB after compression, MP4 (H.264) | Stays on Kwetuly; same visibility rules as photos (private videos possible, which B cannot do) | Egress cost; moderation of video is slower; needs a native compression library (for example `react-native-compressor`, works in our dev build; **to verify** with SDK 57 and that it removes location metadata); browser uploads cannot easily re-encode |
| D. Own videos through Cloudflare Stream (or Mux) | Encoding free, adaptive quality for slow connections (HLS), predictable cost per minute | A second provider and processor (privacy notice), signed playback tokens for private items, more code |

**Recommendation.**
1. **Photos first.**
2. **Video links (B)** next: YouTube and TikTok ids only, public items only. Show a still card with "Watch on YouTube"; load the player only when tapped, from `youtube-nocookie.com`; TikTok opens in TikTok. Nothing from YouTube or TikTok loads until the person taps, which keeps pages light and avoids tracking cookies before consent.
3. **Own videos (C)** only when guides or businesses ask for them, for **approved guides and businesses only** (not travellers at first), 30 s / 60 s, 720p, 25 MB after compression, at most 6 per profile, re-encoded on the phone (which also fixes location, F1). On the web, video upload only where the browser can re-encode it; otherwise "Add videos from the Kwetuly app".
4. **Move to Cloudflare Stream (D)** if video egress passes about 150 GB a month for two months, or for a promoted video.

---

## 3. Data model

New migration (draft first; tested on a Supabase branch or staging; live only with Walter's approval).

### 3.1 Tables

**`public.media_items`** (RLS on)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_id` | uuid, references `auth.users` on delete cascade | set from the session by the guard |
| `profile_kind` | `traveller`, `guide`, `business` | which profile it shows on |
| `guide_id` / `provider_id` | uuid, on delete cascade | exactly one when kind is guide or business; must be the owner's own row (guard) |
| `kind` | `image`, `video`, `video_link` | |
| `path` | text | file in the `profile-media` bucket: `<owner id>/<item id>/display.jpg` |
| `thumb_path` | text | `<owner id>/<item id>/thumb.jpg` (480 px) |
| `link_provider`, `link_id` | `youtube` or `tiktok`; id checked by pattern | `video_link` only; never a free URL |
| `width`, `height`, `duration_s`, `bytes` | int | for layout and limits (duration up to 30 or 60) |
| `caption` | text, up to 300 | |
| `place_id` | references `places`, optional | the owner may choose a place ("Ngorongoro"); never taken from the photo's GPS |
| `trip_ref` | optional link to a `guide_packages` row or a `group_trips` row | "taken on this trip"; shown only if the viewer can see that trip |
| `visibility` | `only_me`, `people`, `guides`, `public` | default `only_me` for travellers, `public` for approved guides and businesses (decision 3) |
| `consent_people` | boolean | the owner confirmed everyone recognisable agrees (required for `guides` and `public` when the owner says people are in it) |
| `has_people` | boolean | the owner's answer to "Are there people in this?" |
| `status` | `live`, `hidden` (by reports, waiting for a look), `removed` (by Kwetuly), `processing` | |
| `checked_at`, `checked_by` | | set when an admin has looked |
| `report_count` | int | kept by trigger |
| `sort_order`, `pinned` | | owner's order; up to 3 pinned on top |
| `created_at`, `updated_at` | | |

**`public.media_shares`** (RLS on): who can see a `people` item.

| Column | Notes |
|---|---|
| `media_id` | on delete cascade |
| `grantee_id` (a person) **or** `chat_id` (a group chat, judged by current membership) **or** `group_trip_id` (organiser and accepted travellers) | exactly one |
| `created_at` | |

**`public.media_reports`** (RLS on): `media_id`, `reporter_id`, `reason` (`me_in_it`, `child`, `nudity_or_violence`, `private_info`, `not_theirs`, `spam`, `other`), `note` up to 300, `created_at`, `handled_at`, `outcome`. One report per person per item.

**`private.media_events`**: who changed visibility, hid, removed or restored what, and when (admin read only). Needed to answer complaints.

### 3.2 Who can share with whom

To stop strangers from being "shared with" (spam, harassment, finding out who has an account), the guard on `media_shares` only accepts a person the owner already has a link with, judged by a `security definer` helper `private.is_connected(owner, person)`:
- a guide and a traveller with an accepted or completed prep call, or a conversation with contact unlocked (the same test as `private.can_review_guide`, `20261013000200_guide_reviews.sql` lines 26-44);
- members of the same group chat;
- organiser and accepted travellers of the same group trip.

The people picker in the app lists only these people. Sharing to a **chat** follows the chat's members as they change; the owner is warned that anyone who joins later with the invite link will see it (chats can be joined by link, consent draft 1.2). Sharing to a **trip** is safer (members are accepted by the organiser).

### 3.3 Who can see an item (one function for rows and files)

`private.can_view_media(media_id uuid) returns boolean`, `security definer`, `stable`, `search_path = ''`, granted to `anon` and `authenticated`, same style as `private.media_is_public`:

1. The owner: always (also `hidden` and `removed`, so they see why).
2. Admins (`private.is_admin()`, which needs aal2): always.
3. Nobody else when `status` is not `live`, or when the profile it belongs to is not visible (guide or business not approved; traveller page not switched on).
4. `public`: everyone, including visitors not signed in.
5. `guides`: signed-in people with an **approved** guide profile (`guides.verification_status = 'approved'`), and people with an approved crew profile later. Not merely "has a guide row": anyone can start one.
6. `people`: a row in `media_shares` for this person, or for a chat they are a member of now, or a trip they are accepted on now.
7. `only_me`: owner only.

Table rule: `for select using (private.can_view_media(id))`. Owner insert, update, delete their own rows. Admins update `status`.

Storage rule on the new **private** bucket `profile-media`:
- insert: own folder (`(storage.foldername(name))[1] = auth.uid()`) and onboarded, as the avatars rule;
- select: `private.can_view_media(((storage.foldername(name))[2])::uuid)`, so the second folder is the item id and **a file whose item you cannot see is never readable, even with the exact path**;
- delete: owner or admin.
- bucket limits: images 2 MB (the device already makes them about 300 KB), JPEG and WebP only (no HEIC: the device converts), `video/mp4` up to 25 MB only when videos are switched on.

**Guard trigger `guard_media_item`** (as `guard_group_message`):
- `owner_id` from the session; `guide_id` or `provider_id` must belong to the owner;
- `status`, `checked_at`, `checked_by`, `report_count` only by admins (insert: `live`, or `processing` for video);
- `path` and `thumb_path` must start with `<owner id>/<this item id>/`;
- `link_id` must match the provider's id pattern;
- limits per profile: 60 photos for travellers, 120 for guides and businesses, 6 own videos, 20 video links; uploads per person per day: 30;
- changing `visibility` **to** `guides` or `public` requires the confirmation questions (3.5) to be answered;
- `public` is refused for a traveller whose page is not switched on, and for a minor's account if we ever have one (we do not collect age today).

**Signed links**: private items are shown through signed links valid for **15 minutes**, created on the server for each viewer. A signed link keeps working until it expires even if the owner changes visibility, so it must stay short. Pages that show private items are never cached across viewers (section 4.4).

**Public items and speed**: for `public` and `live` items the server may also create signed links, but then nothing is cached by the CDN. Two ways, backend-engineer chooses after measuring:
- (a) simple: signed links with 1-hour expiry, page section cached for 50 minutes per item list;
- (b) faster: when an item is public and live, an Edge Function copies the thumbnail and display file into a **public** bucket `profile-media-public` (cached egress is a third of the price, V4); when it stops being public or is hidden, the copy is deleted at once. Whether Supabase's CDN drops a deleted public file within a minute: **to verify** before choosing (b).

### 3.4 Moderation (live first, checked after, Walter decides)

As Walter asked, uploads go live straight away. To keep that safe:

1. **Before upload, on the device**: the confirmation questions (3.5).
2. **Approval centre**: a new tab "New media" (items paper section 2) lists public and guides-only items not yet checked, newest first, with the profile name. Walter (or later operations) marks "Looks fine", "Hide" or "Remove" with a reason from a list. `people` and `only_me` items are not queued (like a private message), only checked when reported.
3. **Reports** from anyone who can see the item (button "Report" and, for public items, "I'm in this photo: please remove"). Automatic hiding until Walter looks:
   - one report of `child`, `nudity_or_violence`, `private_info` or `me_in_it`;
   - three reports from different people for any other reason.
   The owner is told "Hidden while Kwetuly checks a report" without the reporter's name.
4. **Repeat problems**: two items removed in 30 days turns the owner's new public items into "wait for a look before going live" for 30 days (a flag set by the guard). Walter can lift it.
5. **Service level** (operations-manager to set): reports with automatic hiding looked at within 48 hours, matching the 48-hour takedown in the consent draft 5.3.
6. **Not in this design**: automatic image recognition (nudity, faces). It would send images to another processor; consider only if volume makes manual checks impossible, and with legal.
7. **Online content rules**: the consent draft open question 4 (TCRA Online Content Regulations 2020, amended 2022) applies even more to a library open to every traveller. **Legal must answer before travellers can post public items.**

### 3.5 Location and other hidden data

- **Photos**: always re-drawn on the device before upload, using the existing helpers (`clean-image.ts`, `clean-photo.ts`); two outputs, display (1600 px, about 300 KB) and thumbnail (480 px, about 40 KB). If the device cannot read the photo (HEIC in a non-Safari browser), stop; never upload the original. The bucket only accepts JPEG and WebP, so an unconverted original (HEIC, PNG with metadata) is refused by storage itself.
- **Videos**: re-encoded on the phone (2.3 C), which writes a new file; check on test files with `exiftool` that the location atom is gone (**to verify** for the chosen library on iOS and Android). Until verified, own videos stay off.
- **Captions**: the guard rejects phone numbers and email addresses in captions (same rule as listing texts, if one exists; otherwise a simple pattern), to keep contact going through the platform's unlock rules.
- **Place**: only chosen by the owner from `places`; never read from the photo. Owners are told "Do not post where you are staying while you are there" in the upload sheet.
- **Confirmation questions** before `guides` or `public` (7 languages for travellers; English and Kiswahili for guides and owners):
  1. "Did you take this, or do you have the right to share it?" (required)
  2. "Are there people who can be recognised?" If yes: "Everyone who can be recognised agrees" (required) and "No child can be recognised" (required for `public` and `guides`; decision 6).
  3. "Nothing private: no ID, card, number plate or address" (required).

### 3.6 Deletion

- **Owner deletes an item**: the row is deleted; the files are removed through the Storage API in the same action (as `deleteChatMessage`, `apps/mobile/src/lib/api.ts` lines 383-386); public copies (3.3 b) removed; shares and reports cascade. Reports keep a short record in `private.media_events` (item id, reason, outcome; no file) for 12 months so repeat abuse can be seen; legal to confirm the period.
- **Owner deletes the account**: rows cascade from `auth.users`; `my_uploaded_files()` gains `profile-media` and `profile-media-public` so the app and website remove files first; the nightly sweep (F2) removes anything left. The `/data-deletion` page lists media.
- **Guide or business profile removed or rejected**: items for that profile cascade (`guide_id`, `provider_id` on delete cascade); files go through the sweep (files whose item row no longer exists).
- **Removed by Kwetuly**: status `removed`, the file is kept 30 days for a dispute or a legal request, then deleted by the sweep. Legal to confirm (PDPA and any police request).
- **Backups**: Supabase daily backups keep deleted rows for 7 days (hosting plan, to check); files in storage are not in database backups. The privacy policy should say "removed from backups within [7] days".

### 3.7 Relation to Moments and to existing photo columns

- **Moments stays as it is** (chat items, three-step consent). Later, Moments can also show `public` library items that Kwetuly features, with a separate "Kwetuly may feature this" switch on the item (the consent draft's licence wording applies). Not part of the first build.
- `guides.photo_url`, the planned `cover_url`, `providers.logo_url`, `cover_url` (items paper 5.1) stay as single images in the `avatars` bucket: they are always public on an approved profile.
- `providers.photos[]` and the listing `photos[]` (`20261012000000_initial_schema.sql` line 184; `20261016000200_business_listings.sql` line 11) stay as the listing gallery approved with the listing. After the library ships, a business can mark library items as "Show on my listing" and the old arrays can be retired with a backfill (a later, separate step).

---

## 4. The profile page

One layout for all three groups, built on today's guide page (`apps/web/src/app/[lang]/guides/[slug]/page.tsx`: about, packages, expertise, reviews, contact) and business page (`businesses/[id]/page.tsx`). Travellers have no public page today.

### 4.1 Layout (phone first; two columns from tablet up)

1. **Cover** (1600 x 600, from the items paper; a plain brand colour when missing, no stock photo pretending to be theirs) with the **photo or logo** overlapping its lower edge.
2. **Header**: name; type ("Safari and mountain guide", "Lodge in Karatu", "Traveller from Italy"); region; languages; badges exactly as approved ("Checked by Kwetuly on [date]: [what]", licence checked dates; never "recommended"); rating with count. Sample profiles show the "Sample" label as today.
3. **Main action**: guides "Ask [name]" and "Book a prep call"; businesses "Ask" and the listing's own actions; travellers none (a "Message" button only for people already connected, 3.2).
4. **About**: bio, years, specialties, business fields (profiles paper 3.3).
5. **Media**: a grid of 3 columns on phones (thumbnails, lazy loaded, about 40 KB each, first 12 only), pinned items first; "See all" opens the full library page. Tapping opens a swipe viewer with caption, place and trip. Video links show a still card (2.3).
6. **Trips**:
   - Guides: "Routes I lead" (library links: packages with `trip_id`), "My own trips" (custom packages with days), "Upcoming group trips" they organise. Each with price from and "Ask".
   - Businesses: listings, and tours if they are a tour operator with a valid licence (profiles paper 3.4).
   - Travellers (only if they switch it on): "Trips I joined", from accepted group trips and completed prep calls, showing the trip or guide name and month, never the dates of a future trip (safety: an empty house). Per trip they choose to show or hide.
7. **Reviews**: guides: as today (`guide_reviews`). Businesses: **none exist** (no business review table); the section is hidden until business reviews are designed, never filled with outside ratings except the TripAdvisor field that already has a checked date. Travellers: "Reviews I wrote" only if they switch it on.
8. **Crew** (guides, later): approved crew members (profiles paper 3.2).
9. **Footer**: "Report this profile", share buttons (as on Moments), commission disclosure where a booking is possible.

### 4.2 What visitors see and what the owner sees

| Part | Visitor not signed in | Signed-in traveller | Approved guide | Person shared with | Owner |
|---|---|---|---|---|---|
| Guide or business page | if approved | same | same | same | always, with "Waiting for approval" note |
| Traveller page | **no** (private by default); if switched on: name, country, public items, chosen trips | same | same | same | always |
| `public` items | yes | yes | yes | yes | yes, labelled "Public" |
| `guides` items | no | no | yes | no | yes, "Guides only" |
| `people` items | no | only if shared with them | only if shared with them | yes | yes, "Shared with 3 people" |
| `only_me` items | no | no | no | no | yes, "Only me" |
| `hidden` or `removed` items | no | no | no | no | yes, with the reason and "Ask for a review" |
| Phone, WhatsApp, email | never | never (unlock rules as today) | never | never | in their dashboard only |

The owner gets **"See as a visitor"** and **"See as a guide"** switches, so they can check what others see. Changing visibility is one tap per item and a "select several" mode.

### 4.3 App

Same sections in a native scroll view; the library grid uses a virtualised list (FlashList or `FlatList`, see `apps/mobile/AGENTS.md`); upload from the profile tab with the confirmation questions in a sheet; thumbnails cached by React Query and the image cache, so a profile opened once shows again offline.

### 4.4 Speed and caching on the website

- The public part (header, about, trips, reviews, public media list) uses `'use cache'` with a `cacheTag` per profile, refreshed when the owner changes something, as today.
- The per-viewer part (`guides` and `people` items, owner tools) is a separate component inside `Suspense`, never cached across viewers, with signed links of 15 minutes.
- Page weight goal on a slow connection: under 400 KB before the person scrolls (cover about 150 KB, 6 visible thumbnails 240 KB); everything else lazy.

---

## 5. Costs and risks

| Risk | What could happen | How the design limits it | Left over |
|---|---|---|---|
| Storage growth | Thousands of large originals | Only device-made sizes are stored (about 340 KB a photo); per-profile and per-day limits; removed items deleted after 30 days | Small; 100 GB on Pro covers about 290,000 photos |
| Egress | One shared video or page costs money | Thumbnails in grids, video only by tap, video links first, Cloudflare Stream threshold (2.3) | Watch monthly in the Supabase usage page (devops) |
| Private items leak | A guessed or old link opens a private photo | Private bucket; one function for rows and files; 15-minute links; no cross-viewer caching | A link copied by an allowed viewer works for up to 15 minutes; an allowed viewer can take a screenshot (say so in the share sheet) |
| Abuse: nudity, violence, hate, scams, adverts for illegal goods (ivory, unlicensed gems) | Bad content live for hours | Reports with automatic hiding, "New media" queue, repeat-offender wait, limits per day | Content is live until checked: Walter's choice; legal on TCRA duties |
| Photos of other people | A traveller posts a porter, a Maasai family or another tourist who did not agree | Confirmation questions; "I'm in this photo" report hides at once; people can ask by email (consent draft 5.3) | People who never see Kwetuly cannot object; review checklist rejects public items with recognisable people when in doubt |
| Cultural and site rules | Photos where filming is restricted (military, some government sites); communities that ask for payment or no photos | Report reason; legal's list (consent draft question 6); guidance text in upload sheet | |
| Children | Recognisable children in public posts (school visits, village tours are common trips) | Not allowed in `public` or `guides` items (decision 6); one report hides at once; never auto-featured | Allowed in `people` shares like a private message; advocate to confirm |
| Location | Where someone stays, from hidden data | Re-draw and re-encode on device; place chosen by hand; no future trip dates | F1 for chat videos today |
| Harassment through sharing | Sending unwanted images to a person | Shares only to connected people (3.2); "Report" and "Block" (block is new: hides that person's shares to you) | |
| Business photos that are not theirs | A lodge posts another lodge's or stock photos | Report reason `not_theirs`; listing photos are still approved with the listing | |
| Copyright | Music in videos (TikTok-style); other people's photos | Own videos have no sound by default (decision 7); report reason `not_theirs` | Video links: YouTube and TikTok handle their own copyright claims |
| Deleted accounts | Files left behind | F2 sweep | |

---

## 6. Before or after launch

**Before launch (bug fixes only):**

| # | What | Who | Size |
|---|---|---|---|
| 1 | F1 short term: do not feature chat videos until videos are cleaned; add "videos" to the review checklist; one line in the consent draft | operations-manager, legal | XS |
| 2 | F2: nightly Edge Function that removes files with no owner; add it to the `/data-deletion` description | backend-engineer, devops; security-reviewer | S |

**After launch, in this order:**

| Step | What | Who | Size | Review |
|---|---|---|---|---|
| 1 | Legal: advocate answers on images of people, children, TCRA online content duties, retention of removed items; consent text for library items | legal | | Walter |
| 2 | Migration: `media_items`, `media_shares`, `media_reports`, events, `can_view_media`, `is_connected`, guard, private bucket and storage rules; tested on a branch | backend-engineer | M | security-reviewer (RLS with curl as anon, traveller, guide, shared person, admin) |
| 3 | Photo library on guide and business profiles (upload sheet, grid, viewer, visibility, shares to people and trips), web and app, texts in 7 languages / EN and SW | frontend-engineer, localization, designer | M | qa-tester, security-reviewer |
| 4 | "New media" tab and reports in the approval centre | frontend-engineer, operations-manager | S | qa-tester |
| 5 | Full profile layout (section 4) for guides and businesses, with cover and logo (items paper step 8) | frontend-engineer, designer | M | qa-tester, conversion |
| 6 | Traveller pages (off by default), "Trips I joined", traveller library | frontend-engineer, backend-engineer | M | security-reviewer, qa-tester |
| 7 | Video links (YouTube, TikTok) | frontend-engineer | S | security-reviewer (embeds) |
| 8 | F1 real fix and F3, F4; then own short videos for guides and businesses (2.3 C) | frontend-engineer, backend-engineer | M | security-reviewer, qa-tester |
| 9 | Optional: "Kwetuly may feature this" to Moments; listing photos from the library | | S | legal |

---

## 7. Decisions for Walter

1. **Timing**: everything after launch except the two fixes in section 6 (video location in chat, file sweep after account deletion). Yes or no.
2. **Video**: photos first, then YouTube/TikTok links, then own short videos (30 s guides, 60 s businesses, 720p, 25 MB) only for approved guides and businesses when they ask. Yes, or a different order.
3. **Default visibility**: travellers' items "Only me" and traveller pages off until they switch them on; guides' and businesses' items "Public". Yes or change.
4. **Moderation**: live at once, checked after, with automatic hiding on one serious report or three others, and "wait for approval" for 30 days after two removals. Or: all public items wait for approval (safer, slower).
5. **Who counts as "guides only"**: approved guides only (and later approved crew). Yes or no.
6. **Children**: no recognisable children in public or guides-only items, even with a parent's consent (stricter than the consent draft 3(c), which waits for the advocate). Yes or no.
7. **Own videos without sound by default** (avoids music copyright and keeps files small). Yes or no.
8. **Sharing to chats**: allowed, with the warning that new chat members will see it; or only to named people and trips.
9. **Live database**: the migration is tested on a branch or staging first and goes to live only with your approval.
