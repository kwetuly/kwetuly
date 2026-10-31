-- APPLIED 2026-11-01 (in five parts: realistic_samples_media, _businesses, _guides, _items_links). Was DRAFT, NOT APPLIED. Realistic sample data (board 2026-10-31 DECIDED: "Realistic samples" and
-- "Bike, village and hosts"). Apply on live only with Walter's approval: section 2 DELETES the 24
-- sample businesses with real names (data removal, needs his explicit go-ahead at apply time).
-- Runs after 20261101000000_trip_category_cycling.sql and 20261101000100_host_package_kinds.sql (the two
-- host packages below use the new kinds).
--
-- Sources (texts copied from these approved drafts, nothing invented beyond what is noted inline):
--   docs/business/sample-listings-2026-10-31.md       16 invented businesses and shop item price ranges
--   docs/guides/sample-guides-2026-10-31.md           16 guide names, bios, 16 packages, 2 group trips
--   docs/guides/bike-village-hosts-2026-10-31.md      tour links, 3 bike/village packages, 2 hosts
--   docs/design/sample-photos-2026-10-31.md           photo storage keys and credit lines (94 of 101)
--   docs/tech/bike-village-hosts-fit.md               how hosts fit (guides with a host package)
--   docs/tech/post-launch-catalogue-lessons-payments-plan.md   public.listings shape (F1, section 1.4)
--
-- GATE (tech-lead, docs/tech/bike-village-hosts-fit.md section 2): do not apply on live until the
-- "Sample guide" label is live on "Meet your guides" on the website AND in an app build/update. The
-- guide names below no longer say "sample", and section 6 links sample guides to five published tours.
--
-- Photos: section 1 creates the public bucket 'sample-media'. The 94 WebP files must be uploaded to it
-- at the storage keys listed in section 1 (devops, board step 3) right after this migration (or create
-- the bucket first in the dashboard with the same id; the insert below then only sets its limits).
-- Until the files are there the image URLs 404; a NOTICE at the end counts the missing files.
--
-- What it does:
--   1. Storage bucket 'sample-media' (public, WebP/JPEG/PNG, 2 MB per file). Public URLs need no read
--      policy; only admins can list, upload, replace or delete files. Table public.sample_media_credits
--      (path, credit, source_url, licence), readable by anyone, written by admins only, filled with the
--      94 chosen photos.
--   2. Deletes the 24 sample businesses with real names seeded by 20261016000800 (matched by exact name
--      AND is_sample). Stops with an error if any of them has referral sales or quotes (those would be
--      deleted by cascade). Enquiries (leads) to them are kept with provider_id set to null (existing
--      "on delete set null"); a NOTICE counts them. Their provider_private rows, listings and
--      favourites go by the existing cascades.
--   3. Inserts the 16 invented businesses (Mzunguko Bunk Hostel replaces "Kahawa Bunk Hostel"), owned by
--      the oldest admin profile like the old seed, approved, is_sample, no website, no source_url, no
--      badge, no referral agreement, cover photo in photo_url and the other photos in photos[].
--   4. Renames the 16 sample guides (new slug from the name, new display name, headline, bio, photo;
--      years_experience, summits and association null, certifications empty, no check dates), rewrites
--      the 8 package summaries and the 2 group trips without "sample", adds 8 packages so every sample
--      guide has one, the 3 bike/village packages, and the 2 sample hosts with one package each.
--   5. Shop items in public.listings for the curio, gem and gear shops: typical price ranges in
--      price_note starting "Typical price", price_from_usd null, is_published true.
--   6. trip_guides links from the bike/village table (Lushoto left empty on purpose).
--
-- Everything is a sample through its parent: providers.is_sample, guides.is_sample (packages, group trips
-- and trip_guides rows hang off sample guides; listings off sample businesses). The admin "Delete all
-- samples" removes them; see the gaps listed at the end of this header.
--
-- Columns checked against the migrations (no guessing):
--   providers: owner_id, business_name, business_type, base_region, location (<=160), story, website,
--     source_url, languages, photo_url, photos, verification_status, verified_at, is_sample, badge_checks,
--     badge_checked_at, badge_valid_until, has_referral_agreement (20261012000000, 20261016000200/0300/
--     0400/0500). There is no opening-hours column: hours are added as the last sentence of story.
--   guides: slug, display_name, photo_url, headline, bio, base_region, regions, specialties, expertise,
--     languages, max_group_size, years_experience, summits, certifications (text[] not null, so '{}'
--     instead of null), association, female_guide, open_to_partners, visibility, verification_status,
--     verified_at, identity_checked_at, licence_checked_at, first_aid_checked_at, first_aid_valid_until,
--     is_sample. No Kiswahili bio column: the Kiswahili host bios are not stored (frontend/localization).
--   guide_packages: guide_id, kind, title (3-120), summary (10-500), details (<=4000), duration_hours,
--     duration_days, price_usd (null = on request), max_group, includes, meeting_point, photo_url, status,
--     reviewed_at, sort_order. No Kiswahili summary column.
--   group_trips: price_per_person_usd is "integer not null" (0-100000), so it cannot be null. It stays 0
--     and frontend shows "Price on request" for 0 on a sample. No photo column, so the two group trip
--     photos are only recorded in sample_media_credits.
--   listings: provider_id, pillar (enum, required), category (required), title, description, region
--     (required), price_from_usd, price_note, photos, is_published. pillar/region/category are fillers
--     until the catalogue plan makes them optional: pillar 'culture' for curio and gem items,
--     'kilimanjaro' for gear; region = the business's base_region; category = the business_type.
--
-- Alerts: inserting the 2 host guides fires the existing guides_notify trigger, so admins get two
-- "guide_pending" alerts (the 2026-10-16 seed did the same for 16). No traveller or owner is notified:
-- no status changes, and group trip status is not in any SET list.
--
-- Access rules: no existing policy or guard changes. New: sample_media_credits (public read, admin
-- write) and the storage policies for 'sample-media' (admin only). Known open issue, not changed here:
-- public.listings still has the F1 policies (owners can publish items without review); no page reads
-- listings yet. The catalogue plan, part 1, replaces them.
--
-- Idempotency: inserts use "where not exists" / "on conflict do nothing"; renames match the old slug or
-- title, so a second run finds nothing to change; the delete matches exact old names only.
--
-- Read-only checks after applying (localhost first; local dev uses the same project, so only after
-- Walter's go-ahead):
--   select business_name, business_type, base_region, cardinality(photos) from public.providers where is_sample order by 1;   -- 16 rows
--   select slug, display_name, years_experience from public.guides where is_sample order by 1;                               -- 18 rows
--   select g.slug, count(p.*) from public.guides g left join public.guide_packages p on p.guide_id = g.id where g.is_sample group by 1 order by 1; -- every guide >= 1
--   select pr.business_name, l.title, l.price_note from public.listings l join public.providers pr on pr.id = l.provider_id where pr.is_sample;   -- 17 rows
--   select t.slug, g.slug from public.trip_guides tg join public.trips t on t.id = tg.trip_id join public.guides g on g.id = tg.guide_id order by 1, tg.position;
--   select count(*) from public.sample_media_credits;                                                                         -- 94
--
-- Gaps in the admin "Delete all samples" (apps/web/src/app/[lang]/admin/listings/actions.ts
-- deleteAllSamples), for frontend:
--   a. Storage files: nothing removes the files in 'sample-media'. Add a step that lists the bucket
--      (admins can list) and removes the files through the Storage API, or keep the bucket and empty it
--      by hand. Direct SQL deletes on storage.objects are blocked by Supabase.
--   b. sample_media_credits rows stay. Delete them in the same step (admins may delete), or keep them as
--      the licence record until the files are gone.
--   c. Shop items: listings rows go with their providers (cascade), but the report does not count them.
--      Count listings of sample providers before the providers are deleted (like packages) and add
--      n_listings to the report.
--   d. trip_guides rows go with the guides (cascade) and are not counted; fine, but worth one line.
--   e. revalidateTag: also revalidate 'trips' (tour pages read trip_guides; the web getTourGuides is
--      tagged 'guides', which is already revalidated, but check tour page caches).
--
-- Undo (as admin or in the SQL editor; deletes only rows this migration created):
--   -- 6. tour links
--   delete from public.trip_guides tg using public.guides g where g.id = tg.guide_id and g.is_sample;
--   -- 5. + 3. new businesses (their listings go by cascade)
--   delete from public.providers where is_sample and business_name in ('Mpera Court Hotel', 'Pwani Lantern Hotel',
--     'Mto Kijivu Tented Camp', 'Shamba la Ndizi Homestay', 'Mzunguko Bunk Hostel', 'Mnara Loft Apartments',
--     'Kinyago Lane Crafts', 'Zambarau Gem House', 'Mguu Imara Gear Hire', 'Mshale Shuttle & Transfers',
--     'Gurudumu Car Hire', 'Ukwaju Kitchen', 'Mvinje Calm Spa', 'Msuko Studio', 'Mwezi Rooftop Lounge',
--     'Mdalasini Cooking Class');
--   -- 2. the 24 old businesses: re-run the insert in 20261016000800_sample_business_listings.sql
--   --    (it is idempotent by name), then the Rafrika -> Kwetuly text rewrite from
--   --    20261025000000_brand_rename_kwetuly.sql section D if any old story said Rafrika.
--   -- 4. hosts and their packages (packages go by cascade)
--   delete from public.guides where is_sample and slug in ('nasra-mbaga', 'erasto-kitomari');
--   -- 4. the 11 added packages
--   delete from public.guide_packages p using public.guides g where g.id = p.guide_id and g.is_sample
--     and p.sort_order between 9 and 19;
--   -- 4. guide renames: reverse the mapping in section 4 (new slug -> old slug, old display name
--   --    '<First> (sample guide)', old headline/bio/years from 20261016001000), the 8 package summaries and
--   --    the 2 group trips from 20261016001000. Kept as text there; not repeated here.
--   -- 1. credits table and bucket (empty the bucket through the Storage API or dashboard first)
--   drop table if exists public.sample_media_credits;
--   drop policy if exists "Admins list sample media" on storage.objects;
--   drop policy if exists "Admins upload sample media" on storage.objects;
--   drop policy if exists "Admins replace sample media" on storage.objects;
--   drop policy if exists "Admins delete sample media" on storage.objects;
--   delete from storage.buckets where id = 'sample-media';

-- ---------------------------------------------------------------------------
-- 1. Bucket, storage policies and credits
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sample-media', 'sample-media', true, 2 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket: anyone loads a file through its public URL without a policy. A SELECT policy for
-- everyone would only add listing the whole bucket (the "public bucket allows listing" advisor), so
-- listing is admin-only. Admins need it to remove the files before launch.
drop policy if exists "Admins list sample media" on storage.objects;
create policy "Admins list sample media" on storage.objects
  for select to authenticated
  using (bucket_id = 'sample-media' and private.is_admin());
drop policy if exists "Admins upload sample media" on storage.objects;
create policy "Admins upload sample media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sample-media' and private.is_admin());
drop policy if exists "Admins replace sample media" on storage.objects;
create policy "Admins replace sample media" on storage.objects
  for update to authenticated
  using (bucket_id = 'sample-media' and private.is_admin())
  with check (bucket_id = 'sample-media' and private.is_admin());
drop policy if exists "Admins delete sample media" on storage.objects;
create policy "Admins delete sample media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sample-media' and private.is_admin());

-- One row per stock photo: the credit line to show under the photo or in "Photo credits", and the
-- licence record (source page). A small table instead of a jsonb column on five tables (providers,
-- guides, guide_packages, group_trips, listings): no change to those tables or their guard triggers
-- (guide_packages' guard compares a fixed column list), owners cannot edit credits, one place to read
-- and to clean up, and group trips (no photo column) still keep their credit. Lookup by path, which is
-- the end of every sample photo URL.
create table if not exists public.sample_media_credits (
  path text primary key check (path ~ '^sample/[a-z0-9/._-]+\.(webp|jpg|png)$'),
  credit text not null check (char_length(credit) between 5 and 300),
  source_url text not null check (source_url ~ '^https://'),
  licence text not null check (licence in ('CC0', 'CC BY 2.0', 'CC BY 2.5', 'CC BY 3.0', 'CC BY 4.0')),
  created_at timestamptz not null default now()
);

comment on table public.sample_media_credits is
  'Credit lines and licence records for the stock photos in the sample-media bucket (sample data only). Path = object name in the bucket.';

alter table public.sample_media_credits enable row level security;

drop policy if exists "Anyone reads sample media credits" on public.sample_media_credits;
create policy "Anyone reads sample media credits" on public.sample_media_credits
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage sample media credits" on public.sample_media_credits;
create policy "Admins manage sample media credits" on public.sample_media_credits
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

insert into public.sample_media_credits (path, credit, source_url, licence) values
  ('sample/business/mpera-court-hotel/cover.webp', 'Photo: Stig Nygaard from Copenhagen, Denmark, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kilimanjaro_Moshi.jpg', 'CC BY 2.0'),
  ('sample/business/mpera-court-hotel/photo-1.webp', 'Photo: Tony Webster from Minneapolis, Minnesota, United States, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Hotel_Pillow_and_Bedding_(39935420303).jpg', 'CC BY 2.0'),
  ('sample/business/mpera-court-hotel/photo-2.webp', 'Photo: 999real, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Guava_on_tree_portrait.jpg', 'CC0'),
  ('sample/business/pwani-lantern-hotel/cover.webp', 'Photo: Fanny Schertzer, CC BY 2.5, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Dar_es_Salaam-3.jpg', 'CC BY 2.5'),
  ('sample/business/pwani-lantern-hotel/photo-1.webp', 'Photo: Kurt Kaiser, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Bed_in_hotel_room_2.jpg', 'CC0'),
  ('sample/business/pwani-lantern-hotel/photo-2.webp', 'Photo: PagesAndPathsPH, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Boho_Tiered_Hanging_Lanterns.jpg', 'CC0'),
  ('sample/business/mto-kijivu-tented-camp/cover.webp', 'Photo: Shixart1985, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:A_spacious_canvas_tent_stands_on_a_wooden_deck,_basking_in_the_warm_glow_of_the_golden_hour.jpg', 'CC BY 2.0'),
  ('sample/business/mto-kijivu-tented-camp/photo-1.webp', 'Photo: Cindy Chen, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Glamping_(Unsplash).jpg', 'CC0'),
  ('sample/business/mto-kijivu-tented-camp/photo-2.webp', 'Photo: lecucurbitacee, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Rizi%C3%A8res_Mto_Wa_Mbu.jpg', 'CC BY 2.0'),
  ('sample/business/mto-kijivu-tented-camp/photo-3.webp', 'Photo: benmacaskill, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Campfire_at_sunset.jpg', 'CC BY 2.0'),
  ('sample/business/shamba-la-ndizi-homestay/cover.webp', 'Photo: Nina R from Africa, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Karatu,_Tanzania_(51489132851).jpg', 'CC BY 2.0'),
  ('sample/business/shamba-la-ndizi-homestay/photo-1.webp', 'Photo: Baba Bless, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Banana_tree_from_Arusha_Tanzania.jpg', 'CC0'),
  ('sample/business/shamba-la-ndizi-homestay/photo-2.webp', 'Photo: Nina R from Africa, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Karatu,_Tanzania_(51489134076).jpg', 'CC BY 2.0'),
  ('sample/business/mzunguko-bunk-hostel/cover.webp', 'Photo: Barnacles Budget Accommodation from Ireland, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Qsh_dorm_bunk_beds_(10943035686).jpg', 'CC BY 2.0'),
  ('sample/business/mzunguko-bunk-hostel/photo-1.webp', 'Photo: Mx. Granger, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kitchen_at_Destino26_hostel_in_Montevideo.jpg', 'CC0'),
  ('sample/business/mzunguko-bunk-hostel/photo-2.webp', 'Photo: Sylwia Bartyzel, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Tea_cup_(Unsplash).jpg', 'CC0'),
  ('sample/business/mnara-loft-apartments/cover.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Stone_Town,_Zanzibar_(6)_(28491128533).jpg', 'CC BY 2.0'),
  ('sample/business/mnara-loft-apartments/photo-1.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Carved_wooden_door,_Stone_Town,_Zanzibar_(21)_(28817507760).jpg', 'CC BY 2.0'),
  ('sample/business/mnara-loft-apartments/photo-2.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Stone_Town,_Zanzibar_(24)_(29075202056).jpg', 'CC BY 2.0'),
  ('sample/business/kinyago-lane-crafts/cover.webp', 'Photo: Agness Abubakar Saidi, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Traditional_Beaded_Jewelry_Market_Stall.jpg', 'CC0'),
  ('sample/business/kinyago-lane-crafts/photo-1.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Stone_Town,_Zanzibar_(10)_(29109157085).jpg', 'CC BY 2.0'),
  ('sample/business/kinyago-lane-crafts/photo-2.webp', 'Photo: Jidda3711, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Africa_woven_craft_IMG.jpg', 'CC0'),
  ('sample/business/zambarau-gem-house/cover.webp', 'Photo: gemteck1 from Seattle, Washington, USA, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Deep_blue_tanzanite_and_yellow_gold.jpg', 'CC BY 2.0'),
  ('sample/business/zambarau-gem-house/photo-1.webp', 'Photo: W.carter, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Metal_gemstone_holder_with_garnet.jpg', 'CC BY 4.0'),
  ('sample/business/zambarau-gem-house/photo-2.webp', 'Photo: W.carter, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Fancy_cut_rutile_quartz_gemstone_1.jpg', 'CC BY 4.0'),
  ('sample/business/mguu-imara-gear-hire/cover.webp', 'Photo: Andrew Ly, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Hiking_Gear_Cypress_Falls_(Unsplash).jpg', 'CC0'),
  ('sample/business/mguu-imara-gear-hire/photo-1.webp', 'Photo: Joshua Reddekopp, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Hiking_Boots_(Unsplash).jpg', 'CC0'),
  ('sample/business/mguu-imara-gear-hire/photo-2.webp', 'Photo: adore chang, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Tent_(Unsplash).jpg', 'CC0'),
  ('sample/business/mshale-shuttle-transfers/cover.webp', 'Photo: R Boed, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Mount_Kilimanjaro_at_Sunset_(Explored).jpg', 'CC BY 2.0'),
  ('sample/business/mshale-shuttle-transfers/photo-1.webp', 'Photo: Jorge Láscar from Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lascar_Kilimanjaro_peak_from_the_airplane_(3408924395).jpg', 'CC BY 2.0'),
  ('sample/business/mshale-shuttle-transfers/photo-2.webp', 'Photo: Jonathan Gill, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kilimanjaro_Airport.jpg', 'CC BY 2.0'),
  ('sample/business/gurudumu-car-hire/cover.webp', 'Photo: Jalil Arfaoui, CC BY 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Road_In_Savannah_(92789501).jpeg', 'CC BY 3.0'),
  ('sample/business/gurudumu-car-hire/photo-1.webp', 'Photo: @kaboompics, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Someone_handing_a_key_over.jpg', 'CC0'),
  ('sample/business/gurudumu-car-hire/photo-2.webp', 'Photo: Shixart1985, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Close_view_of_car_interior_showing_steering_wheel_and_dashboard_with_missing_parts_in_a_workshop_setting.jpg', 'CC BY 2.0'),
  ('sample/business/ukwaju-kitchen/cover.webp', 'Photo: Isack Alexander, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Wali_Maharage.jpg', 'CC0'),
  ('sample/business/ukwaju-kitchen/photo-1.webp', 'Photo: safaritravelplus, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Nyama_choma_barbeque.jpg', 'CC0'),
  ('sample/business/ukwaju-kitchen/photo-2.webp', 'Photo: Kaizen Nguyễn, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Cocktails_juice_(Unsplash).jpg', 'CC0'),
  ('sample/business/mvinje-calm-spa/cover.webp', 'Photo: Jang Woo Lee, CC BY 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:The_Spice_Tour,Zanzibar_-_panoramio.jpg', 'CC BY 3.0'),
  ('sample/business/mvinje-calm-spa/photo-1.webp', 'Photo: Tim Reckmann from Hamm, Deutschland, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Handt%C3%BCcher_im_Spa_(53404561087).jpg', 'CC BY 2.0'),
  ('sample/business/mvinje-calm-spa/photo-2.webp', 'Photo: Fumikas Sagisavas, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Dried_clove_sticks.jpg', 'CC0'),
  ('sample/business/mvinje-calm-spa/photo-3.webp', 'Photo: Alexander Mils, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Coconut_Drink_(Unsplash).jpg', 'CC0'),
  ('sample/business/msuko-studio/cover.webp', 'Photo: Clem Onojeghuo, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Cornrow_style_(Unsplash).jpg', 'CC0'),
  ('sample/business/msuko-studio/photo-1.webp', 'Photo: Shixart1985, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Scissors_and_comb_placed_on_a_wooden_surface_in_a_grooming_area_in_a_salon_during_the_day.jpg', 'CC BY 2.0'),
  ('sample/business/mwezi-rooftop-lounge/cover.webp', 'Photo: Jez Timms, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Cocktail_beverage_juice_(Unsplash).jpg', 'CC0'),
  ('sample/business/mwezi-rooftop-lounge/photo-1.webp', 'Photo: Dan Stark, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:DJ_turntable_in_close-up_(Unsplash).jpg', 'CC0'),
  ('sample/business/mwezi-rooftop-lounge/photo-2.webp', 'Photo: safaritravelplus, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Sunset_Zanzibar.jpg', 'CC0'),
  ('sample/business/mdalasini-cooking-class/cover.webp', 'Photo: safaritravelplus, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Chapati_kenya.jpg', 'CC0'),
  ('sample/business/mdalasini-cooking-class/photo-1.webp', 'Photo: Fumikas Sagisavas, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Cinnamon_sticks_(1).jpg', 'CC0'),
  ('sample/business/mdalasini-cooking-class/photo-2.webp', 'Photo: FunkyMonkey MP, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Cloves_on_wood_surface.jpg', 'CC0'),
  ('sample/item/kinyago-lane-crafts/tingatinga-painting.webp', 'Photo: Gary Todd from Xinzheng, China, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Tinga_Tinga_Painting,_Tanzania_Noah%27s_Ark%3F_(12521283835).jpg', 'CC0'),
  ('sample/item/kinyago-lane-crafts/maasai-beaded-bracelet.webp', 'Photo: Francis Akuka for the Wikimedia Foundation, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kenyan_Necklace_Beads.jpg', 'CC0'),
  ('sample/item/kinyago-lane-crafts/kanga.webp', 'Photo: Flickr user Lall, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kangas_drying_in_Zanzibar.jpg', 'CC BY 2.0'),
  ('sample/item/kinyago-lane-crafts/kikapu-basket.webp', 'Photo: Michaelgregez, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Hand-crafted_basket_holding_raw_groundnuts,_Arusha,_Tanzania.jpg', 'CC0'),
  ('sample/item/kinyago-lane-crafts/wood-carving.webp', 'Photo: Enda012, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Hand-Carved_Wooden_Animal_Plaque.jpg', 'CC BY 4.0'),
  ('sample/item/zambarau-gem-house/tanzanite-aaa-0-8-to-1-25ct.webp', 'Photo: Didier Descouens, CC BY 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Zo%C3%AFsite_(Tanzanite).jpg', 'CC BY 3.0'),
  ('sample/item/zambarau-gem-house/rhodolite-garnet.webp', 'Photo: W.carter, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Four_round_faceted_garnet_gemstones_2.jpg', 'CC BY 4.0'),
  ('sample/item/mguu-imara-gear-hire/sleeping-bag.webp', 'Photo: Steve Bittinger, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Tent,_sleeping_bag,_and_backpack.jpg', 'CC BY 2.0'),
  ('sample/item/mguu-imara-gear-hire/trekking-poles.webp', 'Photo: W.carter, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Woman_walking_along_the_Myrstigen_trail.jpg', 'CC BY 4.0'),
  ('sample/item/mguu-imara-gear-hire/rain-jacket-and-trousers.webp', 'Photo: ROBERT ALEXANDER WILSON, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Hiker_standing_on_a_log_at_the_Alouette_Lake_near_Maple_Ridge,_British_Columbia_surrounded_by_mist_and_precipitation._Photo_by_Robert_Alexander_Wilson,_2017_(Unsplash).jpg', 'CC0'),
  ('sample/item/mguu-imara-gear-hire/gaiters.webp', 'Photo: JaredMcKenzie, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Snake-proof_gaiters.jpg', 'CC0'),
  ('sample/guide/baraka-urio.webp', 'Photo: Stig Nygaard from Copenhagen, Denmark, CC BY 2.5, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Senecio_kilimanjari_Tanzania.jpg', 'CC BY 2.5'),
  ('sample/guide/neema-lyimo.webp', 'Photo: Jorge Láscar from Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lascar_Amazing_landscape_-_Descending_from_the_summit_(4468190865).jpg', 'CC BY 2.0'),
  ('sample/guide/joseph-nnko.webp', 'Photo: Stig Nygaard from Copenhagen, Denmark, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lions,_Serengeti.jpg', 'CC BY 2.0'),
  ('sample/guide/rehema-qamara.webp', 'Photo: Maximilian Staub, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Baobab_Tree_in_Tarangire_National_Park.jpg', 'CC BY 4.0'),
  ('sample/guide/amani-swai.webp', 'Photo: Nina R from Africa, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Karatu,_Tanzania_(51490065530).jpg', 'CC BY 2.0'),
  ('sample/guide/zawadi-bakari.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Stone_Town,_Zanzibar_(16)_(28490056873).jpg', 'CC BY 2.0'),
  ('sample/guide/hamisi-mfaume.webp', 'Photo: Ali Damji, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Dar_es_Salaam_(Aerial).jpg', 'CC BY 2.0'),
  ('sample/guide/asha-suleiman.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Stone_Town,_Zanzibar_(15)_(29076208416).jpg', 'CC BY 2.0'),
  ('sample/guide/elia-mwakalinga.webp', 'Photo: Hobbyfotowiki, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lilac-breasted_roller_(Coracias_caudatus).jpg', 'CC0'),
  ('sample/guide/mwanaisha-rajabu.webp', 'Photo: Neil Strickland, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Halcyon_senegaloides_Saadani_NP,_Tanzania_1.jpg', 'CC BY 2.0'),
  ('sample/guide/salim-mzee.webp', 'Photo: safaritravelplus, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Zanzibar_Dhow.jpg', 'CC0'),
  ('sample/guide/riziki-makame.webp', 'Photo: lazyweaver, CC BY 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Sandbank_near_Prison_Island_-_panoramio.jpg', 'CC BY 3.0'),
  ('sample/guide/peter-masanja.webp', 'Photo: Maximilian Staub, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Group_of_Zebras_in_Tanzania_Serengeti_at_Sunrise.jpg', 'CC BY 4.0'),
  ('sample/guide/grace-kimaro.webp', 'Photo: Lebu Ayiga, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Moshi,Tanzania.jpg', 'CC BY 4.0'),
  ('sample/guide/daudi-ndosi.webp', 'Photo: Ray in Manila, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kibo_Summit,_Mount_Kilimanjaro,_Tanzania_(30819102678).jpg', 'CC BY 2.0'),
  ('sample/guide/witness-mallya.webp', 'Photo: Brian Harries, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kakombe_Waterfall_2014.jpg', 'CC BY 2.0'),
  ('sample/package/coffee-bean-to-cup.webp', 'Photo: Mark Daynes, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Coffee_beans_(Unsplash).jpg', 'CC0'),
  ('sample/package/kilimanjaro-training-day.webp', 'Photo: Jorge Láscar from Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lascar_Muddy_trail_and_dense_vegetation_-_Montane_rainforests_biome_(4460834130).jpg', 'CC BY 2.0'),
  ('sample/package/chemka-hot-springs.webp', 'Photo: Jorge Láscar from Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lascar_A_natural_spring_(4464683582).jpg', 'CC BY 2.0'),
  ('sample/package/tarangire-ngorongoro-3-days.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Elephants,_Tarangire_National_Park_(12)_(28417034820).jpg', 'CC BY 2.0'),
  ('sample/package/stone-town-food-walk.webp', 'Photo: Willem van der Horst, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Forodhani_Park,_2010.jpg', 'CC BY 2.0'),
  ('sample/package/dar-es-salaam-morning.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Tuna,_Stone_Town,_Zanzibar_(2)_(29075065356).jpg', 'CC BY 2.0'),
  ('sample/package/lake-manyara-birding.webp', 'Photo: Fanny Schertzer, CC BY 2.5, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lake_Manyara_north.jpg', 'CC BY 2.5'),
  ('sample/package/sunset-dhow-trip.webp', 'Photo: safaritravelplus, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Zanzibar_Sunset_Boat.jpg', 'CC0'),
  ('sample/package/kilimanjaro-rainforest-hike.webp', 'Photo: Jorge Láscar from Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lascar_Montane_rainforests_biome_(4465641227).jpg', 'CC BY 2.0'),
  ('sample/package/tarangire-family-pace.webp', 'Photo: Jorge Láscar from Melbourne, Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Baobab_in_Tarangire_NP.jpg', 'CC BY 2.0'),
  ('sample/package/stone-town-spice-farm.webp', 'Photo: Irene, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Spice_farm,_Zanzibar.jpg', 'CC BY 2.0'),
  ('sample/package/bagamoyo-shore-birds.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Mangrove_forests_on_Kilwa_Kisiwani_(28457669383).jpg', 'CC BY 2.0'),
  ('sample/package/first-snorkel-sandbank.webp', 'Photo: Jakob Owens, CC0, via Wikimedia Commons (originally on Unsplash)', 'https://commons.wikimedia.org/wiki/File:Bahamas_Snorkel_(Unsplash).jpg', 'CC0'),
  ('sample/package/ngorongoro-photo-day.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Ngorongoro_Crater_(3)_(28637841896).jpg', 'CC BY 2.0'),
  ('sample/package/moshi-market-photo-walk.webp', 'Photo: lecucurbitacee, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:L%C3%A9gumes_et_friture_Mto_Wa_Mbu.jpg', 'CC BY 2.0'),
  ('sample/package/materuni-waterfall-walk.webp', 'Photo: Jorge Láscar from Australia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Lascar_Exuberant_vegetation_(Montane_rainforests_biome)_(4460864208).jpg', 'CC BY 2.0'),
  ('sample/group-trip/machame-february.webp', 'Photo: Stig Nygaard, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Kilimanjaro_vegetation.jpg', 'CC BY 2.0'),
  ('sample/group-trip/serengeti-ngorongoro-4-days.webp', 'Photo: Richard Mortel from Riyadh, Saudi Arabia, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Serengeti_landscape_(5)_(28631238305).jpg', 'CC BY 2.0')
on conflict (path) do nothing;

-- Public URL of a chosen sample photo, or null when the slot has no photo (not found yet). Session-only
-- helper (pg_temp), gone when the migration's connection closes. The project URL is the one in
-- apps/web/next.config.ts (not a secret); set kwetuly.sample_media_base before running to point
-- elsewhere (e.g. a local stack).
create or replace function pg_temp.sample_photo(p_path text)
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('kwetuly.sample_media_base', true), ''),
                  'https://zsymxfommlxqqfywekuy.supabase.co/storage/v1/object/public/sample-media/') || c.path
  from public.sample_media_credits c
  where c.path = p_path;
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove the 24 sample businesses with real names (20261016000800)
-- ---------------------------------------------------------------------------
drop table if exists pg_temp.old_sample_businesses;
create temporary table old_sample_businesses as
select p.id
from public.providers p
where p.is_sample
  and p.business_name in (
    'Arusha Coffee Lodge', 'The African Tulip', 'Honey Badger Lodge', 'Kilimanjaro Backpackers Hotel',
    'Climbers Home', 'Emerson Spice', 'Zanzibar Coffee House', 'Drifters Backpackers', 'Your Zanzibar Place',
    'Tanzanite Serviced Apartment (TSA Masaki)', 'Hyatt Regency Dar es Salaam, The Kilimanjaro',
    'Cultural Heritage Centre', 'Tanzanite Experience', 'Tingatinga Arts Cooperative Society',
    'Gladiola Adventure', 'Union Café', 'Fig & Olive', 'Via Via', 'Club AQ', 'Level 8', 'Q Bar',
    'Samaki Samaki', 'Forodhani Gardens night food market', 'The Post');

do $$
declare
  v_found bigint;
  v_sales bigint;
  v_quotes bigint;
  v_leads bigint;
begin
  select count(*) into v_found from old_sample_businesses;
  select count(*) into v_sales from public.referral_sales s where s.provider_id in (select id from old_sample_businesses);
  v_quotes := 0; -- there is no quotes table
  if v_sales + v_quotes > 0 then
    raise exception 'realistic_samples: % referral sale(s) and % quote(s) point at old sample businesses; look at them before deleting', v_sales, v_quotes;
  end if;
  select count(*) into v_leads from public.leads l where l.provider_id in (select id from old_sample_businesses);
  raise notice 'realistic_samples: removing % of 24 old sample businesses; % enquiry row(s) keep their text with provider_id set to null', v_found, v_leads;
end;
$$;

delete from public.providers p using old_sample_businesses o where p.id = o.id;

drop table old_sample_businesses;

-- ---------------------------------------------------------------------------
-- 3. The 16 invented businesses
-- base_region uses the site's region list (packages/shared/src/guides.ts REGIONS): Moshi town -> 'Moshi',
-- Kilimanjaro slopes and the airport -> 'Kilimanjaro', both Zanzibar entries -> 'Zanzibar'.
-- ---------------------------------------------------------------------------
insert into public.providers (owner_id, business_name, business_type, base_region, location, story, website, source_url,
  languages, photo_url, photos, verification_status, verified_at, is_sample, badge_checks, badge_checked_at,
  badge_valid_until, has_referral_agreement)
select a.id, s.name, s.type, s.region, s.location, s.story, null, null, s.languages,
  pg_temp.sample_photo('sample/business/' || s.key || '/cover.webp'),
  array_remove(array[
    pg_temp.sample_photo('sample/business/' || s.key || '/photo-1.webp'),
    pg_temp.sample_photo('sample/business/' || s.key || '/photo-2.webp'),
    pg_temp.sample_photo('sample/business/' || s.key || '/photo-3.webp')], null),
  'approved', now(), true, '{}', null, null, false
from (select id from public.profiles where role = 'admin' order by created_at limit 1) a
cross join (values
  ('mpera-court-hotel', 'Mpera Court Hotel', 'hotel', 'Moshi',
   'A quiet side street a short drive from Moshi town centre, with a view of Kibo on clear mornings',
   'A small family-run hotel built around an old guava tree in the courtyard. Climbers often stay the night before and after the mountain, and the staff can store bags while guests are on the trek. Breakfast is served under the tree. Hours: reception open 24 hours; breakfast 6:30 to 10:00.',
   array['en', 'sw']),
  ('pwani-lantern-hotel', 'Pwani Lantern Hotel', 'hotel', 'Dar es Salaam',
   'Near the ocean road, a few minutes from the city centre and the Zanzibar ferry terminal',
   'A mid-size city hotel for people passing through Dar on the way to Zanzibar or the south. Rooms are simple and quiet, and the lobby has paper lanterns made by a local craft group. Staff can help book ferry tickets at the official counter. Hours: reception open 24 hours; check-in from 14:00, check-out by 11:00.',
   array['en', 'sw', 'fr']),
  ('mto-kijivu-tented-camp', 'Mto Kijivu Tented Camp', 'lodge', 'Arusha',
   'On the edge of farmland between Mto wa Mbu and Karatu, on the way to Lake Manyara and Ngorongoro',
   'Twelve canvas tents on raised wooden floors beside a seasonal river. The camp is a stop for guests heading to Ngorongoro, with early breakfast for crater departures. Evenings are spent around the fire. Hours: open all year; early breakfast from 5:30 on request.',
   array['en', 'sw', 'de']),
  ('shamba-la-ndizi-homestay', 'Shamba la Ndizi Homestay', 'homestay', 'Kilimanjaro',
   'A village on the lower slopes of Kilimanjaro, above Moshi, among banana and coffee plots',
   'A Chagga family hosts up to four guests in two rooms of their home. Guests can join the day''s work in the shamba, learn to cook mtori (banana soup) and walk to a nearby waterfall with a local guide. Meals are eaten with the family. Hours: arrivals between 9:00 and 18:00; dinner at about 19:30.',
   array['sw', 'en']),
  ('mzunguko-bunk-hostel', 'Mzunguko Bunk Hostel', 'hostel', 'Arusha',
   'A walkable street near Arusha town centre and the clock tower',
   'A backpacker hostel with dorm bunks and a few private rooms, popular with people joining group safaris. The kitchen is shared, there is a board where travellers look for others to share a safari, and coffee from nearby farms is on all day. Hours: reception 7:00 to 23:00; late arrivals by message ahead.',
   array['en', 'sw', 'es']),
  ('mnara-loft-apartments', 'Mnara Loft Apartments', 'rental', 'Zanzibar',
   'Inside Stone Town, a short walk from the seafront and the old market',
   'Two self-catering apartments on the top floors of an old coral-stone house, with carved wooden doors and a shared roof terrace. Each has a small kitchen, so guests can cook what they buy at the market. The host lives nearby and meets guests at the door. Hours: self check-in from 14:00 by arrangement; host reachable 8:00 to 21:00.',
   array['en', 'sw', 'it']),
  ('kinyago-lane-crafts', 'Kinyago Lane Crafts', 'curio_shop', 'Arusha',
   'A small shop in Arusha town, a few streets from the Maasai market',
   'A small shop that sells work from carvers, painters and beaders in and around Arusha. Each piece has a tag with the maker''s first name and where they work. The shop can wrap pieces for flying and deliver to hotels in town. Hours: Monday to Saturday 9:00 to 18:30; Sunday 10:00 to 15:00.',
   array['en', 'sw']),
  ('zambarau-gem-house', 'Zambarau Gem House', 'gem_shop', 'Arusha',
   'Arusha town centre, on a main shopping street',
   'A small gem shop selling loose tanzanite and other East African stones, plus silver and gold settings. Staff explain colour, cut and size before any sale. Zambarau is the Kiswahili name for the purple java plum. Hours: Monday to Saturday 9:00 to 18:00; closed Sunday.',
   array['en', 'sw', 'de']),
  ('mguu-imara-gear-hire', 'Mguu Imara Gear Hire', 'gear_rental', 'Moshi',
   'Moshi town, near the main road to the Kilimanjaro park gates',
   'A rental shop for Kilimanjaro and Meru climbers who don''t want to fly with heavy kit. All gear is washed and checked between climbs, and sizes can be tried on in the shop the day before the trek. Mguu imara means "strong leg". Hours: every day 8:00 to 19:00; gear returns until 21:00 by arrangement.',
   array['en', 'sw']),
  ('mshale-shuttle-transfers', 'Mshale Shuttle & Transfers', 'transport', 'Kilimanjaro',
   'Based near Kilimanjaro International Airport (JRO); runs to Moshi and Arusha',
   'A small fleet of minivans for airport pickups and town-to-town rides between Moshi and Arusha. Drivers wait with a name sign and track flight delays. Mshale means "arrow". Hours: pickups for every scheduled JRO flight; bookings by message 6:00 to 22:00.',
   array['en', 'sw']),
  ('gurudumu-car-hire', 'Gurudumu Car Hire', 'car_hire', 'Dar es Salaam',
   'Office near the airport road, with handover at the airport or a hotel in the city',
   'Saloon cars and 4x4s with or without a driver, for city trips and drives south. Every car is shown to the customer on handover, with photos taken together. Gurudumu means "wheel". Hours: office Monday to Saturday 8:00 to 18:00; airport handovers any time by booking.',
   array['en', 'sw']),
  ('ukwaju-kitchen', 'Ukwaju Kitchen', 'restaurant', 'Moshi',
   'Moshi town, on a street with other cafes, a few minutes from the bus stand',
   'A small restaurant cooking everyday Tanzanian dishes: pilau, wali na maharage, nyama choma on Fridays, and fresh juice with tamarind (ukwaju). The kitchen is open to view, and there is always a vegetarian plate. Hours: Monday to Saturday 7:00 to 22:00; Sunday 12:00 to 21:00.',
   array['sw', 'en']),
  ('mvinje-calm-spa', 'Mvinje Calm Spa', 'spa', 'Zanzibar',
   'A short walk from the beach in a south-east coast village, shaded by casuarina trees (mvinje)',
   'A small spa with three treatment rooms, offering massages with coconut oil and clove-scented scrubs. Booking ahead is best in high season. Therapists ask about health conditions before every treatment. Hours: every day 9:00 to 20:00.',
   array['en', 'sw', 'it']),
  ('msuko-studio', 'Msuko Studio', 'salon', 'Arusha',
   'Arusha town, upstairs from a row of shops',
   'A hair studio for braids (msuko), cornrows, twists and short cuts, with a barber''s chair for beard trims. Long braiding styles take a few hours, so staff give a time estimate before starting. Travellers are welcome without an appointment on weekdays. Hours: Monday to Saturday 8:30 to 20:00; Sunday 11:00 to 18:00.',
   array['sw', 'en']),
  ('mwezi-rooftop-lounge', 'Mwezi Rooftop Lounge', 'nightlife', 'Dar es Salaam',
   'On the roof of a building in a busy evening area of the city, with a view towards the ocean',
   'A rooftop bar with bongo flava and amapiano DJs at weekends and a quieter acoustic night midweek. There are light snacks and soft drinks as well as a bar. Mwezi means "moon". Hours: Wednesday to Sunday 17:00 to late; closed Monday and Tuesday.',
   array['en', 'sw']),
  ('mdalasini-cooking-class', 'Mdalasini Cooking Class', 'other', 'Zanzibar',
   'A family home on the edge of Stone Town; the class starts with a walk through the market',
   'A half-day class for small groups that starts by buying spices and fish at the market and ends with lunch the guests have cooked. Dishes change with the season, for example pilau, coconut fish curry and chapati. Mdalasini means "cinnamon". Hours: classes at 9:00 and 14:00, Monday to Saturday.',
   array['en', 'sw', 'fr'])
) as s(key, name, type, region, location, story, languages)
where not exists (select 1 from public.providers p where p.business_name = s.name);

-- ---------------------------------------------------------------------------
-- 4a. Rename the 16 sample guides
-- Regions, specialties, expertise, languages, group size, female_guide and open_to_partners stay as in
-- 20261016001000. Skips a row when the new slug is already taken (NOTICE below).
-- ---------------------------------------------------------------------------
update public.guides g
set slug = m.new_slug,
    display_name = m.name,
    headline = m.headline,
    bio = m.bio,
    photo_url = pg_temp.sample_photo('sample/guide/' || m.new_slug || '.webp'),
    years_experience = null,
    summits = null,
    certifications = '{}',
    association = null,
    identity_checked_at = null,
    licence_checked_at = null,
    first_aid_checked_at = null,
    first_aid_valid_until = null
from (values
  ('sample-baraka-kilimanjaro', 'baraka-urio', 'Baraka Urio', 'Kilimanjaro and Meru mountain guide',
   'I grew up on the slopes of Kilimanjaro and now guide climbers on Kilimanjaro and Mount Meru. I set a slow, steady pace, check how every climber feels morning and evening, and explain each day''s plan before we start. I also guide charity groups who climb together.'),
  ('sample-neema-kilimanjaro', 'neema-lyimo', 'Neema Lyimo', 'Mountain guide for first-time climbers and women travelling alone',
   'Many of the people I guide have never climbed a mountain before. I help with kit, pace and food so the first big climb feels manageable. Women travelling alone and student groups often ask for me, and I am happy to answer questions before you book.'),
  ('sample-joseph-safari', 'joseph-nnko', 'Joseph Nnko', 'Northern circuit safari guide',
   'I guide safaris in Tarangire, Lake Manyara, Ngorongoro and the Serengeti. I like to take time at sightings and explain what the animals are doing. Families and older travellers are welcome; we plan short drives and rest stops when needed.'),
  ('sample-rehema-safari', 'rehema-qamara', 'Rehema Qamara', 'Safari guide for families and slow travel',
   'I come from the Karatu side of the Ngorongoro highlands. I plan unhurried safaris with fewer hours in the vehicle and more time to watch. I can adjust the days for travellers who use a wheelchair or need easy steps; tell me what you need and I will say honestly what is possible.'),
  ('sample-amani-culture', 'amani-swai', 'Amani Swai', 'Cultural tours, coffee farms and village walks',
   'I take visitors to Chagga villages on the slopes of Kilimanjaro to see how families grow coffee and bananas and how daily life works. I agree each visit with the family first, and part of what you pay goes to them. Good for students and families.'),
  ('sample-zawadi-culture', 'zawadi-bakari', 'Zawadi Bakari', 'Swahili culture and food walks',
   'I was born in Stone Town. I share Swahili food, history and daily life, at a calm pace and with respect for the neighbourhood. Women travelling alone and Muslim travellers are very welcome; I know where to pray, eat halal and rest.'),
  ('sample-hamisi-city', 'hamisi-mfaume', 'Hamisi Mfaume', 'Dar es Salaam city, markets and history',
   'I show visitors the Dar es Salaam I know: the fish market at dawn, Kariakoo, the old buildings of the centre and day trips to Bagamoyo. I keep walks short with shade and seats for older travellers.'),
  ('sample-asha-city', 'asha-suleiman', 'Asha Suleiman', 'Stone Town walks and spice tours',
   'I guide walks through the lanes of Stone Town and half days on spice farms outside town. Couples and Muslim travellers often travel with me. I explain what we see, and when to ask before taking a photo.'),
  ('sample-elia-birds', 'elia-mwakalinga', 'Elia Mwakalinga', 'Birding guide, forests and lakes',
   'I come from Mbeya and moved north for the birds. I guide birding mornings around Arusha, Lake Manyara and Tarangire, with binoculars and a list of what we saw at the end. Older travellers and keen beginners are both welcome.'),
  ('sample-mwanaisha-birds', 'mwanaisha-rajabu', 'Mwanaisha Rajabu', 'Coastal and wetland birding',
   'I guide birding along the coast near Dar es Salaam and Bagamoyo, and trips towards Nyerere National Park. I welcome deaf travellers: I plan with written notes and simple signs, and agree them with you before we start.'),
  ('sample-salim-marine', 'salim-mzee', 'Salim Mzee', 'Snorkelling, dhow trips and sandbanks',
   'I grew up by the sea in Zanzibar. I take families and couples snorkelling, to sandbanks and out on traditional dhows. Life jackets for everyone, and we only go out when the weather is right.'),
  ('sample-fatma-marine', 'riziki-makame', 'Riziki Makame', 'Ocean days for families and beginners',
   'I help people who are new to the sea feel safe in it: calm spots, short swims and plenty of time. I also welcome blind and partially sighted travellers; I describe what is around us and plan each step together.'),
  ('sample-peter-photo', 'peter-masanja', 'Peter Masanja', 'Photography safaris with time at sightings',
   'I am from Mwanza and now guide from Arusha. My trips are for photographers: small groups, early starts for the best light and patience at sightings. We agree the plan for each day so everyone gets the photos they came for.'),
  ('sample-grace-photo', 'grace-kimaro', 'Grace Kimaro', 'Landscape and people photography, with consent',
   'I guide photo walks around Moshi and on the Kilimanjaro slopes: landscapes, markets and people. We always ask before photographing anyone and respect a no. Women travelling alone are welcome.'),
  ('sample-daudi-daytrips', 'daudi-ndosi', 'Daudi Ndosi', 'Day trips around Arusha and Moshi',
   'I guide day trips from Arusha and Moshi: hot springs, waterfalls, coffee villages and short walks. Families are welcome, and I plan routes with easy access for travellers who need it.'),
  ('sample-upendo-daytrips', 'witness-mallya', 'Witness Mallya', 'Hot springs, waterfalls and short walks',
   'I guide short walks and day trips around Moshi: waterfalls, forest paths on the lower slopes of Kilimanjaro and village lunches. Student groups often travel with me.')
) as m(old_slug, new_slug, name, headline, bio)
where g.slug = m.old_slug
  and g.is_sample
  and not exists (select 1 from public.guides x where x.slug = m.new_slug);

-- ---------------------------------------------------------------------------
-- 4b. The two sample hosts (docs/guides/bike-village-hosts-2026-10-31.md section 3)
-- specialties stay empty on purpose: tour pages auto-match guides by specialty, and a host is not a
-- tour guide. expertise: 'vip' for Nasra (exists); there is no 'investors' value yet, so Erasto has none.
-- No photo in the picture sheet for the hosts.
-- ---------------------------------------------------------------------------
insert into public.guides (slug, display_name, headline, bio, base_region, regions, specialties, expertise, languages,
  max_group_size, years_experience, summits, certifications, association, female_guide, open_to_partners, visibility,
  verification_status, verified_at, is_sample)
select h.slug, h.name, h.headline, h.bio, h.region, h.regions, '{}'::public.guide_specialty[], h.expertise, h.languages,
  h.max_group, null, null, '{}', null, h.female, false, 'link_only', 'approved', now(), true
from (values
  ('nasra-mbaga', 'Nasra Mbaga', 'Personal trip host for private, quiet visits',
   'I plan and go along on private trips for visitors who want one person to look after the details: the plan for each day, introductions to guides on Kwetuly, markets, meals and quiet time when you need it. I keep your plans and personal details private and share them only with the people your trip needs. I do not drive, and I do not offer security or bodyguard work. If you need either, I tell you so before you book.',
   'Arusha', array['Arusha', 'Moshi'], array['vip'], array['en', 'sw', 'fr'], 4, true),
  ('erasto-kitomari', 'Erasto Kitomari', 'Visit days for people exploring business in Tanzania',
   'I help visitors who come to look at business in Tanzania plan their days: a schedule around the meetings you set up, getting around the city, Kiswahili and English on the day, and introductions to places such as markets, business areas and guides on Kwetuly. For anything official I point you to government websites only. I do not give investment, legal or tax advice. I do not promise permits, approvals or speed, and I never handle payments to officials or anyone else for you. For advice, please use your own advocate or adviser.',
   'Dar es Salaam', array['Dar es Salaam'], '{}'::text[], array['en', 'sw'], 3, false)
) as h(slug, name, headline, bio, region, regions, expertise, languages, max_group, female)
where not exists (select 1 from public.guides g where g.slug = h.slug);

-- ---------------------------------------------------------------------------
-- 4c. The 8 existing packages: summaries without "sample", plus photos. Matched by guide and title.
-- ---------------------------------------------------------------------------
update public.guide_packages p
set summary = m.summary,
    photo_url = pg_temp.sample_photo('sample/package/' || m.photo || '.webp')
from (values
  ('amani-swai', 'Coffee from bean to cup with a Chagga family', 'coffee-bean-to-cup',
   'Walk through banana and coffee farms on Kilimanjaro, then pick, roast and grind coffee by hand with a local family. Pick-up in Moshi and a home-cooked lunch. 6 hours, up to 8 people.'),
  ('neema-lyimo', 'One-on-one Kilimanjaro training day', 'kilimanjaro-training-day',
   'A private day hike with your own guide to practise pace, layering and breathing before your climb. Kit check and all your questions answered. 7 hours, just you and the guide.'),
  ('daudi-ndosi', 'Chemka hot springs and village lunch', 'chemka-hot-springs',
   'A relaxed day at clear, warm springs between Moshi and Arusha, with lunch in a farming village. Back by evening. 8 hours, up to 10 people.'),
  ('joseph-nnko', 'Three days: Tarangire and Ngorongoro', 'tarangire-ngorongoro-3-days',
   'Day 1 elephants and baobabs in Tarangire, day 2 Karatu and a village walk, day 3 a full day in the Ngorongoro Crater and back to Arusha. Up to 6 people.'),
  ('zawadi-bakari', 'Swahili food walk in Stone Town', 'stone-town-food-walk',
   'An evening walk through the lanes to Forodhani Gardens, tasting street food, spices and coffee, with stories about Swahili cooking. 3 hours, up to 8 people.'),
  ('hamisi-mfaume', 'Dar es Salaam in a morning', 'dar-es-salaam-morning',
   'Start early at Kivukoni fish market, walk through the centre and Kariakoo, and finish at the National Museum. 4 hours, up to 10 people.'),
  ('elia-mwakalinga', 'Birding morning at Lake Manyara', 'lake-manyara-birding',
   'An early start on the lake shore and in the groundwater forest. Binoculars provided and a list of what you saw. 5 hours, up to 6 people, meet in Mto wa Mbu.'),
  ('salim-mzee', 'Sunset dhow trip', 'sunset-dhow-trip',
   'About two hours on a traditional dhow along the Stone Town seafront at sunset, with fruit and drinks. Up to 10 people.')
) as m(slug, title, photo, summary)
join public.guides g on g.slug = m.slug and g.is_sample
where p.guide_id = g.id
  and p.title = m.title
  and p.summary is distinct from m.summary;

-- ---------------------------------------------------------------------------
-- 4d. New packages: one for each remaining guide (sort 9-16), the 3 bike/village packages (17-19) and
-- the 2 host packages (20-21). Prices empty (on request). Durations and group sizes as written in the
-- drafts. includes is left empty: the drafts do not list inclusions, and an empty list promises nothing.
-- meeting_point only where the draft names the place.
-- ---------------------------------------------------------------------------
insert into public.guide_packages (guide_id, kind, title, summary, details, duration_hours, duration_days, price_usd,
  max_group, includes, meeting_point, photo_url, status, reviewed_at, sort_order)
select g.id, p.kind, p.title, p.summary, p.details, p.hours, p.days, null, p.max_group, '{}', p.meeting,
  case when p.photo is null then null else pg_temp.sample_photo('sample/package/' || p.photo || '.webp') end,
  'approved', now(), p.sort
from (values
  ('baraka-urio', 'day_trip', 'Kilimanjaro day hike in the rainforest',
   'Walk the forest trail on the lower slopes of Kilimanjaro with a mountain guide and look for colobus monkeys. Park fees are paid separately at the gate. About 8 hours, up to 12 people.',
   null, 8, null, 12, null, 'kilimanjaro-rainforest-hike', 9),
  ('rehema-qamara', 'day_trip', 'Tarangire at a family pace',
   'A day in Tarangire with short drives, a long picnic lunch and time to watch elephants. Easy steps in and out of the vehicle. About 10 hours from Arusha, up to 6 people.',
   null, 10, null, 6, 'Arusha', 'tarangire-family-pace', 10),
  ('asha-suleiman', 'city', 'Stone Town lanes and a spice farm',
   'A morning walk through Stone Town, then a spice farm outside town to smell and taste cloves, cinnamon and vanilla. About 5 hours, up to 8 people.',
   null, 5, null, 8, 'Stone Town', 'stone-town-spice-farm', 11),
  ('mwanaisha-rajabu', 'nature', 'Shore birds and mangroves near Bagamoyo',
   'A morning on the coast near Bagamoyo looking for waders, kingfishers and other shore birds, with notes written as we go. About 6 hours from Dar es Salaam, up to 6 people.',
   null, 6, null, 6, 'Dar es Salaam', 'bagamoyo-shore-birds', 12),
  ('riziki-makame', 'day_trip', 'First snorkel at a sandbank',
   'A short boat ride to a sandbank off Stone Town, a calm swim with a life jacket and help in the water for beginners. About 4 hours, up to 8 people.',
   null, 4, null, 8, 'Stone Town', 'first-snorkel-sandbank', 13),
  ('peter-masanja', 'one_on_one', 'Private photo day in the Ngorongoro Crater',
   'One photographer, one guide, one vehicle: an early descent for the first light and as long at each sighting as you want. About 10 hours from Karatu.',
   null, 10, null, 1, 'Karatu', 'ngorongoro-photo-day', 14),
  ('grace-kimaro', 'cultural', 'Moshi market and portraits with consent',
   'A morning photo walk through Moshi market and nearby streets, learning how to ask, show the picture and respect a no. About 3 hours, up to 4 people.',
   null, 3, null, 4, 'Moshi market', 'moshi-market-photo-walk', 15),
  ('witness-mallya', 'day_trip', 'Materuni waterfall walk and lunch',
   'Walk through Chagga farms to the Materuni waterfall on the slopes of Kilimanjaro, then lunch in the village. Village fees are paid on the day. About 6 hours from Moshi, up to 10 people.',
   null, 6, null, 10, 'Moshi', 'materuni-waterfall-walk', 16),
  -- Bike and village (no photos chosen yet)
  ('rehema-qamara', 'cultural', 'Mto wa Mbu by bike, at an easy pace',
   'Rehema meets you in Karatu or Mto wa Mbu and introduces you to a guide from the village cultural tourism group, who leads the ride through banana farms, rice fields and the market. Rehema rides or walks along with you, keeps the pace easy and helps with questions. Lunch is with a local family. You can walk instead of riding at any time. About 5 hours, up to 6 people.',
   'Village fees are paid on the day to the group. Ask Rehema before booking about bike sizes, child seats and helmets. You can add an afternoon in Lake Manyara National Park; park fees are paid separately at the gate.',
   5, null, 6, 'Karatu or Mto wa Mbu', null, 17),
  ('elia-mwakalinga', 'nature', 'Morning ride and birds around Mto wa Mbu',
   'An early ride with a guide from the Mto wa Mbu village cultural tourism group, along farm paths, streams and rice fields at the foot of the Rift Valley escarpment. Elia comes with you, brings binoculars and helps you spot and name the birds; you get a list of what you saw at the end. Stops are short and often. About 4 hours, up to 4 people, meet in Mto wa Mbu.',
   'Village fees are paid on the day to the group. Ask Elia before booking about bike sizes and helmets.',
   4, null, 4, 'Mto wa Mbu', null, 18),
  ('daudi-ndosi', 'cultural', 'Half a day in Ng''iresi village from Arusha',
   'Daudi picks you up in Arusha and drives a short way up the slopes of Mount Meru to Ng''iresi. A local guide from the village programme leads the walk past coffee, banana and vegetable farms and explains how families farm the steep slopes. Daudi stays with you the whole time. Lunch is home-cooked with a family. About 5 hours, up to 8 people.',
   'The village fee is paid on the day at the village; Daudi tells you before booking if it is part of the agreed price.',
   5, null, 8, 'Arusha', null, 19),
  -- Hosts
  ('nasra-mbaga', 'personal_host', 'A day planned around you',
   'We agree the day before you arrive: who you meet, where you go and when you rest. I go along all day and introduce you to the guides you book on Kwetuly. Entry fees are paid on the day. Up to 4 people.',
   null, null, null, 4, null, null, 20),
  ('erasto-kitomari', 'investment_visit', 'Two visit days in Dar es Salaam',
   'You send me the meetings you have arranged and I plan the two days around them, with time to see the city in between. I go along, help with Kiswahili and keep the day on time. This is logistics only, not advice. Up to 3 people.',
   null, null, 2, 3, 'Dar es Salaam', null, 21)
) as p(slug, kind, title, summary, details, hours, days, max_group, meeting, photo, sort)
join public.guides g on g.slug = p.slug and g.is_sample
where not exists (select 1 from public.guide_packages x where x.guide_id = g.id and x.title = p.title);

-- ---------------------------------------------------------------------------
-- 4e. The 2 group trips: titles and descriptions without "sample". Price stays 0 (column is
-- "integer not null"); frontend shows "Price on request" for 0 on a sample. Status stays approved (the
-- guard leaves trusted callers alone).
-- ---------------------------------------------------------------------------
update public.group_trips t
set title = m.title,
    description = m.description
from (values
  ('Sample group: 7-day Machame climb', 'baraka-urio', '7-day Machame climb in February',
   'A small group on the Machame route, 10 to 16 February 2027, starting and ending in Moshi. Between 2 and 8 climbers. Guide team, park fees, tents and meals included. Ask the guide for the price and the kit list.'),
  ('Sample group: 4-day Serengeti and Ngorongoro', 'joseph-nnko', '4-day Serengeti and Ngorongoro, three places left',
   'Three friends are going from 5 to 8 March 2027 and are looking for three more people to share the vehicle. Starts and ends in Arusha. Guide, safari vehicle and park fees included. Ask the guide for the price per person.')
) as m(old_title, slug, title, description)
join public.guides g on g.slug = m.slug and g.is_sample
where t.guide_id = g.id
  and t.title = m.old_title;

-- ---------------------------------------------------------------------------
-- 5. Shop items (public.listings) for the curio, gem and gear shops
-- Typical price ranges from the published sources in docs/business/sample-listings-2026-10-31.md (read
-- 2026-10-31), never a price set by a shop. Gem ranges are international dealers' retail guides; no
-- certificate or export paperwork is suggested. Wood carving has no current source, so no figure.
-- ---------------------------------------------------------------------------
insert into public.listings (provider_id, pillar, category, title, description, region, price_from_usd, price_note,
  photos, is_published)
select pr.id, i.pillar::public.pillar, pr.business_type, i.title, i.description, pr.base_region, null, i.price_note,
  array_remove(array[pg_temp.sample_photo('sample/item/' || i.shop_key || '/' || i.photo || '.webp')], null), true
from (values
  -- Kinyago Lane Crafts
  ('Kinyago Lane Crafts', 'kinyago-lane-crafts', 'culture', 'tingatinga-painting', 'Tingatinga painting',
   'A bright painting in the Tingatinga style.',
   'Typical price: US$10 to 50 (published range for Tanzania, checked 2026-10-31)'),
  ('Kinyago Lane Crafts', 'kinyago-lane-crafts', 'culture', 'maasai-beaded-bracelet', 'Maasai beaded bracelet',
   'A hand-beaded bracelet in Maasai colours.',
   'Typical price: US$3 to 10 for a simple one, US$20 or more for an elaborate one (published ranges, checked 2026-10-31)'),
  ('Kinyago Lane Crafts', 'kinyago-lane-crafts', 'culture', 'kanga', 'Kanga or shuka cloth',
   'A printed kanga or a checked shuka cloth.',
   'Typical price: US$10 to 25 (published East Africa range, checked 2026-10-31)'),
  ('Kinyago Lane Crafts', 'kinyago-lane-crafts', 'culture', 'kikapu-basket', 'Woven basket (kikapu), medium',
   'A medium hand-woven kikapu basket.',
   'Typical price: US$20 to 80 (published East Africa range, checked 2026-10-31)'),
  ('Kinyago Lane Crafts', 'kinyago-lane-crafts', 'culture', 'wood-carving', 'Wood carving (Makonde style)',
   'A carving in the Makonde style. Size and wood make a big difference to the price.',
   'Typical price: varies widely with size and wood; no current published range'),
  -- Zambarau Gem House
  ('Zambarau Gem House', 'zambarau-gem-house', 'culture', 'tanzanite-aaa-0-8-to-1-25ct', 'Loose tanzanite, AAA, 0.80 to 1.25 ct',
   'A loose cut tanzanite. Grades (AAA, AA, A) are not the same between dealers.',
   'Typical price: US$300 per carat (international dealers'' guides, checked 2026-10-31)'),
  ('Zambarau Gem House', 'zambarau-gem-house', 'culture', 'tanzanite-aaa-0-8-to-1-25ct', 'Loose tanzanite, AA, 0.80 to 1.25 ct',
   'A loose cut tanzanite. Grades (AAA, AA, A) are not the same between dealers.',
   'Typical price: US$220 per carat (international dealers'' guides, checked 2026-10-31)'),
  ('Zambarau Gem House', 'zambarau-gem-house', 'culture', 'tanzanite-aaa-0-8-to-1-25ct', 'Loose tanzanite, A or pale, 0.80 to 1.25 ct',
   'A loose cut tanzanite in a lighter colour. Grades are not the same between dealers.',
   'Typical price: US$100 to 150 per carat (international dealers'' guides, checked 2026-10-31)'),
  ('Zambarau Gem House', 'zambarau-gem-house', 'culture', 'tanzanite-aaa-0-8-to-1-25ct', 'Loose tanzanite, AAA, 2.00 to 2.99 ct',
   'A larger loose cut tanzanite. Grades are not the same between dealers.',
   'Typical price: US$550 per carat (international dealers'' guides, checked 2026-10-31)'),
  ('Zambarau Gem House', 'zambarau-gem-house', 'culture', 'rhodolite-garnet', 'Rhodolite garnet',
   'A cut rhodolite garnet, a red to purple stone found in East Africa.',
   'Typical price: US$30 to 100 per carat, US$100 to 300 for good quality (dealer guide, checked 2026-10-31)'),
  ('Zambarau Gem House', 'zambarau-gem-house', 'culture', 'tsavorite-garnet', 'Tsavorite garnet, below 1 ct',
   'A small cut tsavorite, a green garnet found in East Africa.',
   'Typical price: US$200 to 1,000 per carat (dealer guide, checked 2026-10-31)'),
  -- Mguu Imara Gear Hire (per climb)
  ('Mguu Imara Gear Hire', 'mguu-imara-gear-hire', 'kilimanjaro', 'sleeping-bag', 'Sleeping bag (cold-rated)',
   'A cold-rated sleeping bag for the mountain, washed between climbs.',
   'Typical price: US$45 to 50 per climb (Moshi operators'' published prices, checked 2026-10-31)'),
  ('Mguu Imara Gear Hire', 'mguu-imara-gear-hire', 'kilimanjaro', 'trekking-poles', 'Trekking poles (pair)',
   'A pair of adjustable trekking poles.',
   'Typical price: US$20 to 35 per climb (Moshi operators'' published prices, checked 2026-10-31)'),
  ('Mguu Imara Gear Hire', 'mguu-imara-gear-hire', 'kilimanjaro', 'warm-jacket', 'Warm jacket',
   'A warm insulated jacket for summit night.',
   'Typical price: US$45 to 60 per climb (Moshi operators'' published prices, checked 2026-10-31)'),
  ('Mguu Imara Gear Hire', 'mguu-imara-gear-hire', 'kilimanjaro', 'rain-jacket-and-trousers', 'Rain jacket and rain trousers',
   'A rain jacket and rain trousers for the forest days.',
   'Typical price: US$15 for the jacket, US$10 for the trousers, per climb (published price, checked 2026-10-31)'),
  ('Mguu Imara Gear Hire', 'mguu-imara-gear-hire', 'kilimanjaro', 'gaiters', 'Gaiters (pair)',
   'A pair of gaiters to keep dust, mud and scree out of your boots.',
   'Typical price: US$10 per climb (published price, checked 2026-10-31)'),
  ('Mguu Imara Gear Hire', 'mguu-imara-gear-hire', 'kilimanjaro', 'head-torch', 'Head torch with spare batteries',
   'A head torch with spare batteries for summit night.',
   'Typical price: US$10 per climb (published price, checked 2026-10-31)')
) as i(shop, shop_key, pillar, photo, title, description, price_note)
join public.providers pr on pr.business_name = i.shop and pr.is_sample
where not exists (select 1 from public.listings l where l.provider_id = pr.id and l.title = i.title);

-- ---------------------------------------------------------------------------
-- 6. "Meet your guides" links (docs/guides/bike-village-hosts-2026-10-31.md section 1).
-- On community-run tours the guide plans the day and goes along; the village group's guide leads.
-- Lushoto (lushoto-irente-viewpoint-walk) is left empty on purpose.
-- ---------------------------------------------------------------------------
insert into public.trip_guides (trip_id, guide_id, position)
select t.id, g.id, l.position
from (values
  ('mto-wa-mbu-village-bike', 'rehema-qamara', 0),
  ('mto-wa-mbu-village-bike', 'elia-mwakalinga', 1),
  ('ngiresi-village-arusha', 'daudi-ndosi', 0),
  ('materuni-waterfalls-coffee', 'witness-mallya', 0),
  ('materuni-waterfalls-coffee', 'amani-swai', 1),
  ('moshi-chagga-town-tour', 'amani-swai', 0),
  ('moshi-chagga-town-tour', 'grace-kimaro', 1)
) as l(trip_slug, guide_slug, position)
join public.trips t on t.slug = l.trip_slug
join public.guides g on g.slug = l.guide_slug and g.is_sample
on conflict (trip_id, guide_id) do nothing;

-- ---------------------------------------------------------------------------
-- Report (counts only, no names or contacts)
-- ---------------------------------------------------------------------------
do $$
declare
  v_providers bigint;
  v_guides bigint;
  v_unrenamed bigint;
  v_no_package bigint;
  v_items bigint;
  v_links bigint;
  v_missing_files bigint;
begin
  select count(*) into v_providers from public.providers where is_sample;
  select count(*) into v_guides from public.guides where is_sample;
  select count(*) into v_unrenamed from public.guides where is_sample and slug like 'sample-%';
  select count(*) into v_no_package from public.guides g
    where g.is_sample and not exists (select 1 from public.guide_packages p where p.guide_id = g.id);
  select count(*) into v_items from public.listings l join public.providers pr on pr.id = l.provider_id where pr.is_sample;
  select count(*) into v_links from public.trip_guides tg join public.guides g on g.id = tg.guide_id where g.is_sample;
  select count(*) into v_missing_files from public.sample_media_credits c
    where not exists (select 1 from storage.objects o where o.bucket_id = 'sample-media' and o.name = c.path);
  raise notice 'realistic_samples: % sample businesses (expect 16), % sample guides (expect 18), % still with an old sample- slug (expect 0), % without a package (expect 0), % shop items (expect 17), % tour links (expect 7), % of 94 photo files not uploaded yet',
    v_providers, v_guides, v_unrenamed, v_no_package, v_items, v_links, v_missing_files;
end;
$$;
