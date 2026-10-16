-- Sample guides (two or more for every kind of trip), sample packages for every package type and
-- sample group trips, so every page and flow can be tried before real guides join.
-- They are invented people: no photos, no ratings or reviews, and every page says "Sample guide".
-- Enquiries to them reach Rafrika's admin inbox. Delete them all in /admin/listings before launch.

alter table public.guides add column is_sample boolean not null default false;
alter table public.guides alter column owner_id drop not null;
alter table public.guides add constraint guides_owner_or_sample check (owner_id is not null or is_sample);

-- Only Rafrika can mark a guide as a sample.
create or replace function public.guard_guide_sample()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() then
    new.is_sample := case when tg_op = 'INSERT' then false else old.is_sample end;
  end if;
  return new;
end;
$$;

create trigger guides_sample_guard
  before insert or update on public.guides
  for each row execute function public.guard_guide_sample();

insert into public.guides (slug, display_name, headline, bio, base_region, regions, specialties, expertise, languages, max_group_size,
  years_experience, female_guide, open_to_partners, visibility, verification_status, verified_at, is_sample)
values
  ('sample-baraka-kilimanjaro', 'Baraka (sample guide)', 'Kilimanjaro and Meru mountain guide',
   'Sample guide profile for testing Rafrika. Baraka is not a real person. A real profile would describe climbs led, routes known and how the guide keeps climbers safe.',
   'Moshi', array['Moshi', 'Kilimanjaro', 'Arusha'], array['mountain']::public.guide_specialty[], array['record_climbs', 'charity_climbs'], array['en', 'sw'], 12, 9, false, true, 'public', 'approved', now(), true),
  ('sample-neema-kilimanjaro', 'Neema (sample guide)', 'Mountain guide for first-time climbers and women',
   'Sample guide profile for testing Rafrika. Neema is not a real person. A real profile would show the guide''s experience, licence and first-aid training.',
   'Moshi', array['Moshi', 'Kilimanjaro'], array['mountain', 'day_trips']::public.guide_specialty[], array['solo_women', 'students'], array['en', 'sw', 'de'], 8, 6, true, false, 'public', 'approved', now(), true),
  ('sample-joseph-safari', 'Joseph (sample guide)', 'Northern circuit safari guide',
   'Sample guide profile for testing Rafrika. Joseph is not a real person. A real profile would list the parks the guide knows best and the vehicle used.',
   'Arusha', array['Arusha', 'Serengeti', 'Ngorongoro', 'Tarangire', 'Manyara'], array['safari', 'photography']::public.guide_specialty[], array['families', 'seniors'], array['en', 'sw', 'fr'], 6, 12, false, true, 'public', 'approved', now(), true),
  ('sample-rehema-safari', 'Rehema (sample guide)', 'Safari guide for families and slow travel',
   'Sample guide profile for testing Rafrika. Rehema is not a real person.',
   'Arusha', array['Arusha', 'Tarangire', 'Manyara', 'Ngorongoro'], array['safari', 'birding']::public.guide_specialty[], array['families', 'mobility'], array['en', 'sw', 'it'], 6, 7, true, false, 'public', 'approved', now(), true),
  ('sample-amani-culture', 'Amani (sample guide)', 'Cultural tours, coffee farms and village walks',
   'Sample guide profile for testing Rafrika. Amani is not a real person. A real profile would describe the communities the guide works with.',
   'Moshi', array['Moshi', 'Kilimanjaro'], array['cultural', 'day_trips']::public.guide_specialty[], array['students', 'families'], array['en', 'sw'], 10, 5, false, true, 'public', 'approved', now(), true),
  ('sample-zawadi-culture', 'Zawadi (sample guide)', 'Swahili culture and food walks',
   'Sample guide profile for testing Rafrika. Zawadi is not a real person.',
   'Zanzibar', array['Zanzibar'], array['cultural', 'city']::public.guide_specialty[], array['solo_women', 'muslim_friendly'], array['en', 'sw', 'fr'], 8, 8, true, false, 'public', 'approved', now(), true),
  ('sample-hamisi-city', 'Hamisi (sample guide)', 'Dar es Salaam city, markets and history',
   'Sample guide profile for testing Rafrika. Hamisi is not a real person.',
   'Dar es Salaam', array['Dar es Salaam', 'Bagamoyo'], array['city', 'cultural']::public.guide_specialty[], array['seniors'], array['en', 'sw'], 10, 10, false, true, 'public', 'approved', now(), true),
  ('sample-asha-city', 'Asha (sample guide)', 'Stone Town walks and spice tours',
   'Sample guide profile for testing Rafrika. Asha is not a real person.',
   'Zanzibar', array['Zanzibar'], array['city', 'day_trips']::public.guide_specialty[], array['honeymoon', 'muslim_friendly'], array['en', 'sw', 'it'], 8, 4, true, false, 'public', 'approved', now(), true),
  ('sample-elia-birds', 'Elia (sample guide)', 'Birding guide, forests and lakes',
   'Sample guide profile for testing Rafrika. Elia is not a real person.',
   'Arusha', array['Arusha', 'Manyara', 'Tarangire'], array['birding', 'safari']::public.guide_specialty[], array['seniors'], array['en', 'sw', 'de'], 6, 15, false, true, 'public', 'approved', now(), true),
  ('sample-mwanaisha-birds', 'Mwanaisha (sample guide)', 'Coastal and wetland birding',
   'Sample guide profile for testing Rafrika. Mwanaisha is not a real person.',
   'Dar es Salaam', array['Dar es Salaam', 'Bagamoyo', 'Nyerere (Selous)'], array['birding', 'marine']::public.guide_specialty[], array['deaf'], array['en', 'sw'], 6, 6, true, false, 'public', 'approved', now(), true),
  ('sample-salim-marine', 'Salim (sample guide)', 'Snorkelling, dhow trips and sandbanks',
   'Sample guide profile for testing Rafrika. Salim is not a real person.',
   'Zanzibar', array['Zanzibar'], array['marine', 'day_trips']::public.guide_specialty[], array['families', 'honeymoon'], array['en', 'sw'], 10, 9, false, true, 'public', 'approved', now(), true),
  ('sample-fatma-marine', 'Fatma (sample guide)', 'Ocean days for families and beginners',
   'Sample guide profile for testing Rafrika. Fatma is not a real person.',
   'Zanzibar', array['Zanzibar'], array['marine', 'cultural']::public.guide_specialty[], array['families', 'blind'], array['en', 'sw', 'de'], 8, 5, true, false, 'public', 'approved', now(), true),
  ('sample-peter-photo', 'Peter (sample guide)', 'Photography safaris with time at sightings',
   'Sample guide profile for testing Rafrika. Peter is not a real person.',
   'Arusha', array['Arusha', 'Serengeti', 'Ngorongoro'], array['photography', 'safari']::public.guide_specialty[], array['vip'], array['en', 'sw', 'zh'], 4, 11, false, true, 'public', 'approved', now(), true),
  ('sample-grace-photo', 'Grace (sample guide)', 'Landscape and people photography, with consent',
   'Sample guide profile for testing Rafrika. Grace is not a real person.',
   'Moshi', array['Moshi', 'Kilimanjaro', 'Arusha'], array['photography', 'cultural']::public.guide_specialty[], array['solo_women'], array['en', 'sw', 'pl'], 4, 7, true, false, 'public', 'approved', now(), true),
  ('sample-daudi-daytrips', 'Daudi (sample guide)', 'Day trips around Arusha and Moshi',
   'Sample guide profile for testing Rafrika. Daudi is not a real person.',
   'Arusha', array['Arusha', 'Moshi'], array['day_trips', 'cultural']::public.guide_specialty[], array['mobility', 'families'], array['en', 'sw', 'fr'], 12, 8, false, true, 'public', 'approved', now(), true),
  ('sample-upendo-daytrips', 'Upendo (sample guide)', 'Hot springs, waterfalls and short walks',
   'Sample guide profile for testing Rafrika. Upendo is not a real person.',
   'Moshi', array['Moshi', 'Kilimanjaro'], array['day_trips', 'mountain']::public.guide_specialty[], array['students'], array['en', 'sw'], 10, 3, true, false, 'public', 'approved', now(), true)
on conflict (slug) do nothing;

-- One package of every type, from the matching sample guides. Prices stay empty (on request).
insert into public.guide_packages (guide_id, kind, title, summary, details, duration_hours, duration_days, max_group, includes, meeting_point, status, reviewed_at, sort_order)
select g.id, p.kind, p.title, p.summary, p.details, p.hours, p.days, p.max_group, p.includes, p.meeting, 'approved', now(), p.sort
from (values
  ('sample-amani-culture', 'cultural', 'Coffee from bean to cup with a Chagga family',
   'Sample package. Walk through banana and coffee farms on Kilimanjaro, then roast and grind coffee with a family.',
   'Pick-up in Moshi, a farm walk, the coffee process by hand, and a home-cooked lunch.', 6, null, 8, array['Guide', 'Coffee experience', 'Lunch'], 'Moshi clock tower', 1),
  ('sample-neema-kilimanjaro', 'one_on_one', 'One-on-one Kilimanjaro training day',
   'Sample package. A private day hike with your own guide to practise pace, layering and breathing before the climb.',
   'A gentle hike on the lower slopes, kit check and questions answered. Just you and the guide.', 7, null, 1, array['Private guide', 'Kit check'], 'Your hotel in Moshi', 2),
  ('sample-daudi-daytrips', 'day_trip', 'Chemka hot springs and village lunch',
   'Sample package. A relaxed day at clear warm springs with a stop in a farming village.',
   'Drive from Arusha or Moshi, swim, lunch in a village and back by evening.', 8, null, 10, array['Guide', 'Transport', 'Lunch'], 'Arusha or Moshi hotel', 3),
  ('sample-joseph-safari', 'multi_day', 'Three days: Tarangire and Ngorongoro',
   'Sample package. Elephants and baobabs in Tarangire, then a full day in the Ngorongoro Crater.',
   'Day 1 Tarangire, day 2 Karatu and a village walk, day 3 Ngorongoro Crater and back to Arusha.', null, 3, 6, array['Guide', 'Safari vehicle'], 'Arusha', 4),
  ('sample-zawadi-culture', 'food', 'Swahili food walk in Stone Town',
   'Sample package. Taste street food, spices and coffee with someone who grew up in Stone Town.',
   'An evening walk through the lanes and Forodhani Gardens, with stories about Swahili cooking.', 3, null, 8, array['Guide', 'Tastings'], 'Old Fort, Stone Town', 5),
  ('sample-hamisi-city', 'city', 'Dar es Salaam in a morning',
   'Sample package. Fish market, Kariakoo and the National Museum with a local guide.',
   'Start early at Kivukoni fish market, walk the centre and finish at the museum.', 4, null, 10, array['Guide'], 'Kivukoni fish market', 6),
  ('sample-elia-birds', 'nature', 'Birding morning at Lake Manyara',
   'Sample package. A morning for birdwatchers on the lake shore and in the groundwater forest.',
   'Early start, binoculars provided, a checklist of what you saw.', 5, null, 6, array['Guide', 'Binoculars'], 'Mto wa Mbu', 7),
  ('sample-salim-marine', 'other', 'Sunset dhow trip',
   'Sample package. Sail on a traditional dhow along the Stone Town seafront at sunset.',
   'About two hours on the water with fruit and drinks.', 2, null, 10, array['Boat and crew', 'Fruit and drinks'], 'Stone Town beach', 8)
) as p(slug, kind, title, summary, details, hours, days, max_group, includes, meeting, sort)
join public.guides g on g.slug = p.slug
where not exists (select 1 from public.guide_packages x where x.guide_id = g.id and x.title = p.title);

-- Sample group trips: one started by a guide and one "complete your group" by a traveller.
insert into public.group_trips (organizer_id, guide_id, company_name, title, description, specialty, region, meeting_point, start_date, end_date,
  price_per_person_usd, min_people, max_people, languages, includes, status, already_going)
select a.id, g.id, null, s.title, s.description, s.specialty::public.guide_specialty, s.region, s.meeting, s.start_date::date, s.end_date::date,
  0, s.min_people, s.max_people, array['en', 'sw'], s.includes, 'approved', s.going
from (select id from public.profiles where role = 'admin' order by created_at limit 1) a
cross join (values
  ('sample-baraka-kilimanjaro', 'Sample group: 7-day Machame climb',
   'Sample group trip for testing. Join a small group on the Machame route with a sample guide. Price shows as 0 because this is not a real departure.',
   'mountain', 'Kilimanjaro', 'Moshi', '2027-02-10', '2027-02-16', 2, 8, 'Guide team, park fees, tents, meals', 0),
  ('sample-joseph-safari', 'Sample group: 4-day Serengeti and Ngorongoro',
   'Sample group trip for testing. Three friends are already going and are looking for three more people. Price shows as 0 because this is not a real departure.',
   'safari', 'Serengeti', 'Arusha', '2027-03-05', '2027-03-08', 4, 6, 'Guide, safari vehicle, park fees', 3)
) as s(slug, title, description, specialty, region, meeting, start_date, end_date, min_people, max_people, includes, going)
join public.guides g on g.slug = s.slug
where not exists (select 1 from public.group_trips x where x.title = s.title);
