-- Map stops and basic details for the starter tours (all still drafts).
-- Coordinates are approximate map positions for well-known places. No driving distances or
-- times are set: admins add them with a source in /admin/tours.

-- Nights, end point, fitness level and packing suggestions.
update public.trips set nights = greatest(days - 1, 0);
update public.trips set end_at = start_from;
update public.trips set end_at = 'Zanzibar' where slug in ('kili-safari-zanzibar-15-days', 'safari-zanzibar-9-days');

update public.trips set fitness = 'strenuous' where slug in ('kilimanjaro-machame-7-days', 'kilimanjaro-lemosho-8-days', 'kilimanjaro-marangu-6-days', 'ol-doinyo-lengai-natron-3-days', 'kili-safari-zanzibar-15-days', 'kili-cultural-immersion-10-days');
update public.trips set fitness = 'challenging' where slug = 'mount-meru-4-days';
update public.trips set fitness = 'moderate' where slug in ('signature-walk-with-a-kili-guide', 'materuni-waterfalls-coffee', 'mto-wa-mbu-village-bike', 'nyerere-boat-walking-4-days', 'mahale-chimpanzees-5-days', 'arusha-national-park-day', 'signature-guides-day-off');
update public.trips set fitness = 'easy' where fitness is null;

update public.trips set packing = '{Layered clothing for cold nights,Waterproof jacket and trousers,Broken-in hiking boots,Warm hat and gloves,Head torch,Sunglasses and high-factor sunscreen,Refillable water bottles}'
  where 'mountain' = any (categories);
update public.trips set packing = '{Neutral-coloured clothing,Light jacket for early drives,Wide-brimmed hat,Binoculars,Sunscreen and insect repellent,Camera with spare batteries}'
  where 'safari' = any (categories) and packing = '{}';
update public.trips set packing = '{Light breathable clothing,Swimwear,Reef-safe sunscreen,Sandals,Modest cover-up for Stone Town and villages}'
  where ('beach' = any (categories) or 'marine' = any (categories)) and packing = '{}';
update public.trips set packing = '{Comfortable walking shoes,Modest clothing that covers shoulders and knees,Hat and sunscreen,Small cash for crafts and tips}'
  where packing = '{}';

update public.trips set travel_styles = '{honeymoon}' where slug in ('signature-spice-stone-sea', 'zanzibar-beach-mnemba-4-days', 'safari-zanzibar-9-days');
update public.trips set travel_styles = '{family}' where slug in ('serengeti-ngorongoro-4-days', 'mikumi-2-days', 'materuni-waterfalls-coffee', 'chemka-hot-springs', 'zanzibar-stone-town-spice');

-- Route stops: (slug, position, day, name, kind, lat, lng)
insert into public.trip_stops (trip_id, position, day, name, kind, lat, lng)
select t.id, s.position, s.day, s.name, s.kind::public.stop_kind, s.lat, s.lng
from (values
  ('signature-guides-day-off', 1, 1, 'Moshi', 'town', -3.3349, 37.3404),
  ('signature-guides-day-off', 2, 1, 'Materuni village', 'cultural', -3.2560, 37.3850),
  ('signature-guides-day-off', 3, 1, 'Chemka hot springs', 'activity', -3.4400, 37.1900),

  ('signature-walk-with-a-kili-guide', 1, 1, 'Moshi', 'town', -3.3349, 37.3404),
  ('signature-walk-with-a-kili-guide', 2, 1, 'Marangu Gate', 'gate', -3.2410, 37.5190),

  ('signature-afcon-2027-fan-days', 1, 1, 'Dar es Salaam', 'town', -6.7924, 39.2083),
  ('signature-afcon-2027-fan-days', 2, 2, 'Mikumi National Park', 'park', -7.3000, 37.1000),
  ('signature-afcon-2027-fan-days', 3, 3, 'Dar es Salaam', 'town', -6.7924, 39.2083),

  ('signature-spice-stone-sea', 1, 1, 'Stone Town', 'cultural', -6.1630, 39.1890),
  ('signature-spice-stone-sea', 2, 2, 'Spice farm', 'activity', -6.1000, 39.2500),
  ('signature-spice-stone-sea', 3, 3, 'Sandbank by dhow', 'beach', -6.1300, 39.1500),

  ('serengeti-ngorongoro-4-days', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('serengeti-ngorongoro-4-days', 2, 1, 'Central Serengeti (Seronera)', 'park', -2.4333, 34.8167),
  ('serengeti-ngorongoro-4-days', 3, 3, 'Ngorongoro Crater rim', 'lodge', -3.2600, 35.5800),
  ('serengeti-ngorongoro-4-days', 4, 4, 'Ngorongoro Crater', 'park', -3.1750, 35.5650),
  ('serengeti-ngorongoro-4-days', 5, 4, 'Arusha', 'town', -3.3869, 36.6830),

  ('northern-circuit-7-days', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('northern-circuit-7-days', 2, 1, 'Tarangire National Park', 'park', -3.9500, 36.0500),
  ('northern-circuit-7-days', 3, 2, 'Lake Manyara National Park', 'park', -3.5500, 35.8000),
  ('northern-circuit-7-days', 4, 3, 'Central Serengeti (Seronera)', 'park', -2.4333, 34.8167),
  ('northern-circuit-7-days', 5, 6, 'Ngorongoro Crater rim', 'lodge', -3.2600, 35.5800),
  ('northern-circuit-7-days', 6, 7, 'Ngorongoro Crater', 'park', -3.1750, 35.5650),
  ('northern-circuit-7-days', 7, 7, 'Arusha', 'town', -3.3869, 36.6830),

  ('migration-calving-safari-6-days', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('migration-calving-safari-6-days', 2, 1, 'Ngorongoro highlands', 'lodge', -3.2600, 35.5800),
  ('migration-calving-safari-6-days', 3, 2, 'Ndutu plains', 'park', -3.0000, 34.9900),
  ('migration-calving-safari-6-days', 4, 5, 'Ngorongoro Crater', 'park', -3.1750, 35.5650),
  ('migration-calving-safari-6-days', 5, 6, 'Arusha', 'town', -3.3869, 36.6830),

  ('arusha-national-park-day', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('arusha-national-park-day', 2, 1, 'Arusha National Park (Momella)', 'park', -3.2200, 36.8700),

  ('tarangire-day-trip', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('tarangire-day-trip', 2, 1, 'Tarangire National Park', 'park', -3.9500, 36.0500),

  ('kilimanjaro-machame-7-days', 1, 1, 'Machame Gate', 'gate', -3.1700, 37.2440),
  ('kilimanjaro-machame-7-days', 2, 1, 'Machame Camp', 'camp', -3.1250, 37.2700),
  ('kilimanjaro-machame-7-days', 3, 2, 'Shira Cave Camp', 'camp', -3.0870, 37.2480),
  ('kilimanjaro-machame-7-days', 4, 3, 'Barranco Camp', 'camp', -3.0950, 37.3220),
  ('kilimanjaro-machame-7-days', 5, 4, 'Karanga Camp', 'camp', -3.0980, 37.3600),
  ('kilimanjaro-machame-7-days', 6, 5, 'Barafu Camp', 'camp', -3.0980, 37.3740),
  ('kilimanjaro-machame-7-days', 7, 6, 'Uhuru Peak', 'peak', -3.0758, 37.3533),
  ('kilimanjaro-machame-7-days', 8, 7, 'Mweka Gate', 'gate', -3.2230, 37.3360),

  ('kilimanjaro-lemosho-8-days', 1, 1, 'Londorossi Gate', 'gate', -3.0600, 37.0300),
  ('kilimanjaro-lemosho-8-days', 2, 1, 'Mti Mkubwa Camp', 'camp', -3.0500, 37.1700),
  ('kilimanjaro-lemosho-8-days', 3, 2, 'Shira 1 Camp', 'camp', -3.0300, 37.2100),
  ('kilimanjaro-lemosho-8-days', 4, 3, 'Shira 2 Camp', 'camp', -3.0500, 37.2500),
  ('kilimanjaro-lemosho-8-days', 5, 4, 'Barranco Camp', 'camp', -3.0950, 37.3220),
  ('kilimanjaro-lemosho-8-days', 6, 5, 'Karanga Camp', 'camp', -3.0980, 37.3600),
  ('kilimanjaro-lemosho-8-days', 7, 6, 'Barafu Camp', 'camp', -3.0980, 37.3740),
  ('kilimanjaro-lemosho-8-days', 8, 7, 'Uhuru Peak', 'peak', -3.0758, 37.3533),
  ('kilimanjaro-lemosho-8-days', 9, 8, 'Mweka Gate', 'gate', -3.2230, 37.3360),

  ('kilimanjaro-marangu-6-days', 1, 1, 'Marangu Gate', 'gate', -3.2410, 37.5190),
  ('kilimanjaro-marangu-6-days', 2, 1, 'Mandara Hut', 'camp', -3.2050, 37.5250),
  ('kilimanjaro-marangu-6-days', 3, 2, 'Horombo Hut', 'camp', -3.1270, 37.4700),
  ('kilimanjaro-marangu-6-days', 4, 4, 'Kibo Hut', 'camp', -3.0850, 37.4000),
  ('kilimanjaro-marangu-6-days', 5, 5, 'Uhuru Peak', 'peak', -3.0758, 37.3533),
  ('kilimanjaro-marangu-6-days', 6, 6, 'Marangu Gate', 'gate', -3.2410, 37.5190),

  ('mount-meru-4-days', 1, 1, 'Momella Gate', 'gate', -3.2200, 36.8700),
  ('mount-meru-4-days', 2, 1, 'Miriakamba Hut', 'camp', -3.2330, 36.8000),
  ('mount-meru-4-days', 3, 2, 'Saddle Hut', 'camp', -3.2400, 36.7700),
  ('mount-meru-4-days', 4, 3, 'Socialist Peak', 'peak', -3.2445, 36.7500),
  ('mount-meru-4-days', 5, 4, 'Momella Gate', 'gate', -3.2200, 36.8700),

  ('ol-doinyo-lengai-natron-3-days', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('ol-doinyo-lengai-natron-3-days', 2, 1, 'Lake Natron (Engaresero)', 'camp', -2.3500, 35.9100),
  ('ol-doinyo-lengai-natron-3-days', 3, 2, 'Ol Doinyo Lengai', 'peak', -2.7640, 35.9140),
  ('ol-doinyo-lengai-natron-3-days', 4, 3, 'Arusha', 'town', -3.3869, 36.6830),

  ('materuni-waterfalls-coffee', 1, 1, 'Moshi', 'town', -3.3349, 37.3404),
  ('materuni-waterfalls-coffee', 2, 1, 'Materuni village', 'cultural', -3.2560, 37.3850),

  ('chemka-hot-springs', 1, 1, 'Moshi', 'town', -3.3349, 37.3404),
  ('chemka-hot-springs', 2, 1, 'Chemka hot springs', 'activity', -3.4400, 37.1900),

  ('mto-wa-mbu-village-bike', 1, 1, 'Mto wa Mbu', 'cultural', -3.3550, 35.8550),

  ('lake-eyasi-hadzabe-2-days', 1, 1, 'Karatu', 'town', -3.3400, 35.6700),
  ('lake-eyasi-hadzabe-2-days', 2, 1, 'Lake Eyasi', 'cultural', -3.5800, 35.3500),

  ('moshi-chagga-town-tour', 1, 1, 'Moshi', 'town', -3.3349, 37.3404),
  ('moshi-chagga-town-tour', 2, 1, 'Marangu', 'cultural', -3.2700, 37.5200),

  ('nyerere-boat-walking-4-days', 1, 1, 'Dar es Salaam', 'town', -6.7924, 39.2083),
  ('nyerere-boat-walking-4-days', 2, 1, 'Nyerere National Park (Rufiji river)', 'park', -7.8000, 38.1000),
  ('nyerere-boat-walking-4-days', 3, 4, 'Dar es Salaam', 'town', -6.7924, 39.2083),

  ('ruaha-wilderness-5-days', 1, 1, 'Iringa', 'town', -7.7700, 35.6900),
  ('ruaha-wilderness-5-days', 2, 1, 'Ruaha National Park', 'park', -7.7300, 34.9300),

  ('mikumi-2-days', 1, 1, 'Dar es Salaam', 'town', -6.7924, 39.2083),
  ('mikumi-2-days', 2, 1, 'Mikumi National Park', 'park', -7.3000, 37.1000),
  ('mikumi-2-days', 3, 2, 'Dar es Salaam', 'town', -6.7924, 39.2083),

  ('mahale-chimpanzees-5-days', 1, 1, 'Arusha', 'airport', -3.3677, 36.6334),
  ('mahale-chimpanzees-5-days', 2, 1, 'Mahale Mountains National Park', 'park', -6.1000, 29.7400),

  ('zanzibar-stone-town-spice', 1, 1, 'Stone Town', 'cultural', -6.1630, 39.1890),
  ('zanzibar-stone-town-spice', 2, 1, 'Spice farm', 'activity', -6.1000, 39.2500),

  ('zanzibar-beach-mnemba-4-days', 1, 1, 'Zanzibar airport', 'airport', -6.2220, 39.2249),
  ('zanzibar-beach-mnemba-4-days', 2, 1, 'Matemwe beach', 'beach', -5.8700, 39.3600),
  ('zanzibar-beach-mnemba-4-days', 3, 2, 'Mnemba Atoll', 'island', -5.8200, 39.3800),
  ('zanzibar-beach-mnemba-4-days', 4, 4, 'Zanzibar airport', 'airport', -6.2220, 39.2249),

  ('bagamoyo-history-day', 1, 1, 'Dar es Salaam', 'town', -6.7924, 39.2083),
  ('bagamoyo-history-day', 2, 1, 'Bagamoyo', 'cultural', -6.4430, 38.9040),

  ('kilwa-kisiwani-3-days', 1, 1, 'Dar es Salaam', 'town', -6.7924, 39.2083),
  ('kilwa-kisiwani-3-days', 2, 1, 'Kilwa Masoko', 'town', -8.9200, 39.5100),
  ('kilwa-kisiwani-3-days', 3, 2, 'Kilwa Kisiwani ruins', 'cultural', -8.9600, 39.5100),
  ('kilwa-kisiwani-3-days', 4, 3, 'Dar es Salaam', 'town', -6.7924, 39.2083),

  ('kili-safari-zanzibar-15-days', 1, 1, 'Moshi', 'town', -3.3349, 37.3404),
  ('kili-safari-zanzibar-15-days', 2, 2, 'Kilimanjaro (Uhuru Peak)', 'peak', -3.0758, 37.3533),
  ('kili-safari-zanzibar-15-days', 3, 9, 'Arusha', 'town', -3.3869, 36.6830),
  ('kili-safari-zanzibar-15-days', 4, 10, 'Central Serengeti (Seronera)', 'park', -2.4333, 34.8167),
  ('kili-safari-zanzibar-15-days', 5, 13, 'Ngorongoro Crater', 'park', -3.1750, 35.5650),
  ('kili-safari-zanzibar-15-days', 6, 14, 'Stone Town', 'cultural', -6.1630, 39.1890),

  ('safari-zanzibar-9-days', 1, 1, 'Arusha', 'town', -3.3869, 36.6830),
  ('safari-zanzibar-9-days', 2, 1, 'Tarangire National Park', 'park', -3.9500, 36.0500),
  ('safari-zanzibar-9-days', 3, 2, 'Central Serengeti (Seronera)', 'park', -2.4333, 34.8167),
  ('safari-zanzibar-9-days', 4, 5, 'Ngorongoro Crater', 'park', -3.1750, 35.5650),
  ('safari-zanzibar-9-days', 5, 6, 'Zanzibar airport', 'airport', -6.2220, 39.2249),
  ('safari-zanzibar-9-days', 6, 7, 'Zanzibar beaches', 'beach', -5.8700, 39.3600),

  ('kili-cultural-immersion-10-days', 1, 1, 'Kilimanjaro (Uhuru Peak)', 'peak', -3.0758, 37.3533),
  ('kili-cultural-immersion-10-days', 2, 8, 'Materuni village', 'cultural', -3.2560, 37.3850),
  ('kili-cultural-immersion-10-days', 3, 9, 'Lake Eyasi', 'cultural', -3.5800, 35.3500)
) as s (slug, position, day, name, kind, lat, lng)
join public.trips t on t.slug = s.slug
on conflict (trip_id, position) do nothing;
