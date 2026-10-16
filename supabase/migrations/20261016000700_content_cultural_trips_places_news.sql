-- Content for testing the site as if live. Walter reviews and edits everything in /admin.
-- Facts are general and checkable; no prices or ratings are invented (prices stay "on request").
-- Every trip added or rewritten here is flagged needs_review so it shows in the admin review list.

-- ---------------------------------------------------------------------------
-- New places
-- ---------------------------------------------------------------------------
insert into public.places (slug, name, kind, region, summary, known_for, wildlife, activities, unesco_year, managed_by, lat, lng, source_name, source_url, source_checked_at, status)
values
  ('kondoa-rock-art-sites', 'Kondoa Rock-Art Sites', 'heritage_site', 'Dodoma',
   'Painted rock shelters on the eastern slopes of the Masai escarpment, at the edge of the Great Rift Valley. The paintings span at least two thousand years and show the change from hunter-gatherer life to farming and herding. Some shelters still have ritual meaning for nearby communities.',
   array['Over 150 painted rock shelters', 'Paintings spanning at least two thousand years', 'Living ritual traditions'],
   array[]::text[], array['Guided rock-art walk', 'Village visit', 'Photography (no flash on paintings)'],
   2006, 'Antiquities Division', -4.73, 35.83,
   'UNESCO World Heritage Centre', 'https://whc.unesco.org/en/list/1183', '2026-10-16', 'published'),
  ('jozani-chwaka-bay', 'Jozani-Chwaka Bay National Park', 'national_park', 'Zanzibar',
   'Zanzibar''s only national park, in the south-centre of Unguja island. Shady groundwater forest, mangroves and coral rag thicket are home to the Zanzibar red colobus monkey, found nowhere else on earth.',
   array['Zanzibar red colobus monkeys', 'Mangrove boardwalk', 'Groundwater forest'],
   array['Zanzibar red colobus', 'Sykes'' monkey', 'Aders'' duiker', 'Many forest birds'],
   array['Guided forest walk', 'Mangrove boardwalk', 'Colobus viewing'],
   null, 'Zanzibar Department of Forestry', -6.25, 39.41,
   'Wikipedia: Jozani Chwaka Bay National Park', 'https://en.wikipedia.org/wiki/Jozani_Chwaka_Bay_National_Park', '2026-10-16', 'published'),
  ('usambara-mountains-lushoto', 'Lushoto and the Usambara Mountains', 'mountain', 'Tanga',
   'Cool green mountains in north-east Tanzania with farming villages, forest and viewpoints. Lushoto is the main town and the start of guided walks run by local cultural tourism groups. The Irente viewpoint looks down more than a thousand metres onto the plains.',
   array['Irente viewpoint', 'Village walks with local guides', 'Cool mountain climate'],
   array['Chameleons', 'Forest birds', 'Black-and-white colobus'],
   array['Day hikes', 'Village and farm visits', 'Multi-day hut-to-village treks'],
   null, null, -4.78, 38.29,
   'Wikipedia: Usambara Mountains', 'https://en.wikipedia.org/wiki/Usambara_Mountains', '2026-10-16', 'published'),
  ('changuu-island', 'Changuu (Prison) Island', 'island', 'Zanzibar',
   'A small island a short boat ride from Stone Town. It never held prisoners in the end and later served as a quarantine station. Today visitors come for the giant Aldabra tortoises, the old buildings and snorkelling.',
   array['Giant Aldabra tortoises', 'Old quarantine buildings', 'Snorkelling off the beach'],
   array['Aldabra giant tortoises'], array['Boat trip from Stone Town', 'Tortoise sanctuary', 'Snorkelling'],
   null, null, -6.12, 39.17,
   'Wikipedia: Changuu', 'https://en.wikipedia.org/wiki/Changuu', '2026-10-16', 'published'),
  ('dar-es-salaam', 'Dar es Salaam', 'town', 'Dar es Salaam',
   'Tanzania''s largest city and main port, on the Indian Ocean. Busy markets, the National Museum, the fish market at Kivukoni and the beaches of the Msasani peninsula.',
   array['Kariakoo market', 'National Museum and House of Culture', 'Kivukoni fish market'],
   array[]::text[], array['City walk', 'Market visits', 'Food tasting', 'Boat to nearby islands'],
   null, null, -6.8161, 39.2803,
   'Wikipedia: Dar es Salaam', 'https://en.wikipedia.org/wiki/Dar_es_Salaam', '2026-10-16', 'published'),
  ('arusha', 'Arusha', 'town', 'Arusha',
   'The starting point for northern safaris, at the foot of Mount Meru. Markets, coffee farms, craft and gem shops, and cultural tourism villages on the mountain''s slopes.',
   array['Gateway to the northern parks', 'Mount Meru views', 'Craft and tanzanite shops'],
   array[]::text[], array['Town walk', 'Market visit', 'Coffee farm visit', 'Cultural village tours'],
   null, null, -3.3869, 36.6830,
   'Wikipedia: Arusha', 'https://en.wikipedia.org/wiki/Arusha', '2026-10-16', 'published')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Detailed day plans for the existing cultural day trips
-- ---------------------------------------------------------------------------
update public.trips set
  itinerary = '[
    {"day":1,"title":"Morning: up the mountain from Moshi","body":"Pick-up in Moshi and a drive of about an hour up the slopes of Kilimanjaro to Materuni, a Chagga village among banana and coffee farms. Your local guide explains how families farm on the mountain."},
    {"day":1,"title":"Walk to Materuni waterfall","body":"A walk through farms and forest to the waterfall, with some steep and slippery parts. Swim in the cold pool if you like, or rest and take photos."},
    {"day":1,"title":"Midday: coffee from bean to cup","body":"Back in the village, a family shows the whole coffee process: picking, peeling, roasting over a fire and grinding by hand while singing. Then you drink the coffee you made."},
    {"day":1,"title":"Afternoon: lunch and the drive back","body":"A home-cooked local lunch, time to buy coffee from the family, and the drive back to Moshi in the afternoon."}
  ]'::jsonb,
  highlights = array['Materuni waterfall in the Kilimanjaro forest', 'Roast and grind coffee with a Chagga family', 'Home-cooked local lunch', 'Views over the plains on a clear day'],
  needs_review = true, status = 'published'
where slug = 'materuni-waterfalls-coffee';

update public.trips set
  itinerary = '[
    {"day":1,"title":"Morning: meet your village guide","body":"Start in Mto wa Mbu, a market town between Lake Manyara and the Rift Valley escarpment where people from many Tanzanian communities live side by side. The walk or bike tour is run through the village cultural tourism group."},
    {"day":1,"title":"Farms, irrigation and markets","body":"Ride or walk through banana farms and rice fields watered by streams from the escarpment, and visit the busy market and fruit stalls."},
    {"day":1,"title":"Midday: local lunch","body":"Lunch cooked by a local family. You may taste banana beer, a local drink."},
    {"day":1,"title":"Afternoon: artisans and the escarpment view","body":"Meet woodcarvers and painters at work, then finish with a view of the Rift Valley wall. Easy to combine with a Lake Manyara game drive."}
  ]'::jsonb,
  needs_review = true, status = 'published'
where slug = 'mto-wa-mbu-village-bike';

update public.trips set
  itinerary = '[
    {"day":1,"title":"Morning: Moshi town walk","body":"Walk the centre of Moshi with a local guide: the clock tower, the central market with spices and fresh produce, and the old railway station area."},
    {"day":1,"title":"Coffee and the cooperative story","body":"Learn how Chagga farmers organised coffee cooperatives on Kilimanjaro, and stop for a cup of local coffee in town."},
    {"day":1,"title":"Midday: local food","body":"Lunch at a local restaurant: try ndizi (cooked green banana), nyama choma (grilled meat) or a vegetarian plate."},
    {"day":1,"title":"Afternoon: Chagga culture","body":"Visit a Chagga family or village on the lower slopes to hear about traditional homes, farming and history. Back in Moshi by late afternoon."}
  ]'::jsonb,
  needs_review = true, status = 'published'
where slug = 'moshi-chagga-town-tour';

update public.trips set
  itinerary = '[
    {"day":1,"title":"Morning: drive to the springs","body":"Leave Moshi or Arusha and drive across farmland towards Chemka (Kikuletwa) hot springs, a clear, warm spring-fed pool shaded by fig trees."},
    {"day":1,"title":"Swim and relax","body":"Swim in the clear blue water, use the rope swing, and look for small fish in the shallows. There is shade for a picnic."},
    {"day":1,"title":"Midday: lunch","body":"Packed or local lunch at the springs."},
    {"day":1,"title":"Afternoon: back to town","body":"Return drive through villages, back in time for dinner. A good rest day after a climb or safari."}
  ]'::jsonb,
  needs_review = true, status = 'published'
where slug = 'chemka-hot-springs';

update public.trips set
  itinerary = '[
    {"day":1,"title":"Morning: Dar es Salaam to Bagamoyo","body":"Drive north along the coast from Dar es Salaam, about two hours depending on traffic."},
    {"day":1,"title":"Kaole ruins","body":"Visit the Kaole ruins south of town: old mosques and tombs from the time of the early Swahili coast trading towns."},
    {"day":1,"title":"Midday: old Bagamoyo","body":"Walk the old town with its carved doors, the old fort and the German-era buildings. Lunch in town, often fresh fish."},
    {"day":1,"title":"Afternoon: mission museum and the beach","body":"See the Catholic mission museum, which tells the story of the caravan trade and its end, and walk on the beach where the dhows come in. Drive back to Dar es Salaam."}
  ]'::jsonb,
  needs_review = true, status = 'published'
where slug = 'bagamoyo-history-day';

update public.trips set
  itinerary = '[
    {"day":1,"title":"Morning: spice farm","body":"Drive out of Stone Town to a spice farm. Your guide shows cloves, nutmeg, cinnamon, vanilla, pepper and fruit growing, and you taste as you walk."},
    {"day":1,"title":"Midday: Swahili lunch","body":"Lunch cooked with the spices you have just seen, usually pilau or a coconut curry."},
    {"day":1,"title":"Afternoon: Stone Town walk","body":"Back in Stone Town, walk the narrow lanes with a local guide: carved doors, the Darajani market, the Old Fort, the House of Wonders seafront and the site of the old slave market with its memorial and cathedral."},
    {"day":1,"title":"Evening: Forodhani Gardens","body":"Finish at sunset on the seafront at Forodhani Gardens, where food stalls sell grilled seafood and Zanzibar pizza."}
  ]'::jsonb,
  needs_review = true, status = 'published'
where slug = 'zanzibar-stone-town-spice';

-- Publish the other drafts so the site can be tested as if live (prices stay "on request").
update public.trips set status = 'published', needs_review = true where status = 'draft';

-- ---------------------------------------------------------------------------
-- New cultural day trips
-- ---------------------------------------------------------------------------
insert into public.trips (slug, title_en, title_sw, summary_en, summary_sw, circuit, kind, categories, days, nights, destinations, start_from, end_at,
  highlights, itinerary, includes, excludes, best_months, travel_styles, fitness, packing, good_to_know, tour_type, operated_by, status, needs_review, sort_order)
values
  ('lushoto-irente-viewpoint-walk', 'Lushoto Village Walk & Irente Viewpoint', 'Matembezi ya Lushoto na Mandhari ya Irente',
   'A day in the cool Usambara Mountains: farms, villages and a cliff-edge view more than a thousand metres above the plains, with a local guide.',
   'Siku moja katika milima ya Usambara: mashamba, vijiji na mandhari ya juu ya mwamba, pamoja na mwongozaji wa ndani.',
   'northern', 'day_trip', '{cultural,walking}', 1, 0, array['Lushoto', 'Irente', 'Usambara Mountains'], 'Lushoto', 'Lushoto',
   array['Irente viewpoint over the Maasai plains', 'Village farms and terraces', 'Cool mountain air and forest', 'Guided by a local cultural tourism group'],
   '[
     {"day":1,"title":"Morning: Lushoto town","body":"Meet your guide in Lushoto, a small mountain town that was a hill station in colonial times. Walk past the market and out into the farms."},
     {"day":1,"title":"Villages and farms","body":"Walk through villages where families grow vegetables, fruit and tea on terraced slopes. Your guide explains Shambaa culture and how people farm in the mountains."},
     {"day":1,"title":"Midday: Irente viewpoint","body":"Reach the Irente viewpoint, where the mountains drop away more than a thousand metres to the plains below. Picnic or lunch nearby."},
     {"day":1,"title":"Afternoon: walk back","body":"Return by a different path through forest and farms, back in Lushoto by late afternoon. Fair fitness is enough; some uphill sections."}
   ]'::jsonb,
   array['Local guide', 'Village and community fees'], array['Transport to Lushoto', 'Lunch unless agreed', 'Tips'],
   array[1,2,6,7,8,9,10,12], array['family'], 'moderate',
   array['Good walking shoes', 'Warm layer for the morning', 'Rain jacket', 'Water and sunscreen'],
   array['Lushoto is about a six-hour drive from Arusha or Dar es Salaam; most people stay one or more nights.', 'Ask before photographing people.', 'Carry small notes in Tanzanian shillings.'],
   'operator', 'partner', 'published', true, 40),

  ('ngiresi-village-arusha', 'Ng''iresi Village on the Slopes of Mount Meru', 'Kijiji cha Ng''iresi Mlimani Meru',
   'Half a day with a Wa-Arusha farming community above Arusha town: farm walks, home cooking and stories, through the Cultural Tourism Programme.',
   'Nusu siku na jamii ya wakulima wa Kiarusha juu ya mji wa Arusha: mashamba, chakula cha nyumbani na hadithi.',
   'northern', 'day_trip', '{cultural,walking}', 1, 0, array['Ng''iresi', 'Mount Meru', 'Arusha'], 'Arusha', 'Arusha',
   array['Wa-Arusha farming families', 'Farm and village walk', 'Home-cooked lunch', 'Views of Mount Meru'],
   '[
     {"day":1,"title":"Morning: up from Arusha","body":"A short drive north of Arusha town to Ng''iresi village on the lower slopes of Mount Meru."},
     {"day":1,"title":"Farm and village walk","body":"Walk with a local guide past farms of coffee, bananas and vegetables, and hear how families farm and look after the soil on the steep slopes."},
     {"day":1,"title":"Views of Meru and Arusha","body":"Continue to viewpoints over Arusha town and up towards Mount Meru. Your guide may add a longer walk if you ask."},
     {"day":1,"title":"Lunch with a family","body":"A home-cooked lunch and time to talk about Wa-Arusha culture and daily life. Back in Arusha by mid-afternoon."}
   ]'::jsonb,
   array['Local guide', 'Village development fee', 'Lunch'], array['Transport from Arusha unless agreed', 'Tips'],
   array[1,2,6,7,8,9,10,11,12], array['family'], 'easy',
   array['Walking shoes', 'Hat and sunscreen', 'Small cash'],
   array['Part of the Tanzania Tourist Board Cultural Tourism Programme; fees support the village.', 'Ask before photographing people.'],
   'operator', 'partner', 'published', true, 41),

  ('arusha-town-culture-tanzanite', 'Arusha Town, Markets & Tanzanite', 'Mji wa Arusha, Masoko na Tanzanite',
   'A guided day in Arusha: the busy central market, the Maasai craft market, the Tanzanite Experience museum and the Cultural Heritage Centre art gallery.',
   'Siku ya kuongozwa Arusha: soko kuu, soko la sanaa la Kimasai, makumbusho ya Tanzanite na kituo cha Cultural Heritage.',
   'northern', 'day_trip', '{cultural,historical}', 1, 0, array['Arusha'], 'Arusha', 'Arusha',
   array['Central market and spice stalls', 'Learn how tanzanite is mined and graded', 'Large African art gallery', 'Lunch at a local restaurant'],
   '[
     {"day":1,"title":"Morning: central market","body":"Walk through Arusha''s central market with your guide: fruit, vegetables, spices, fabrics and household goods, and how traders work."},
     {"day":1,"title":"Tanzanite Experience","body":"Visit the tanzanite museum to learn how the stone, found only in Tanzania, is mined and graded. Buying is optional; ask for a certificate if you do."},
     {"day":1,"title":"Midday: local lunch","body":"Lunch at a local restaurant, with Tanzanian dishes or international food."},
     {"day":1,"title":"Afternoon: crafts and art","body":"Browse the Maasai craft market (be ready to bargain) and the Cultural Heritage Centre with its art gallery and carvings, where prices are marked."}
   ]'::jsonb,
   array['Local guide', 'Transport in Arusha'], array['Lunch', 'Purchases', 'Tips'],
   array[1,2,3,4,5,6,7,8,9,10,11,12], array['family'], 'easy',
   array['Comfortable shoes', 'Small cash for the markets'],
   array['Keep bags in front of you in busy markets.', 'Never buy gems on the street; buy from licensed dealers with a certificate.'],
   'operator', 'partner', 'published', true, 42),

  ('jozani-forest-red-colobus', 'Jozani Forest & Red Colobus Monkeys', 'Msitu wa Jozani na Kima Punju',
   'See the Zanzibar red colobus, found only on Zanzibar, on a guided walk in Jozani-Chwaka Bay National Park, then walk the mangrove boardwalk.',
   'Ona kima punju wa Zanzibar, wanaopatikana Zanzibar pekee, katika Hifadhi ya Taifa ya Jozani-Chwaka Bay.',
   'coast', 'day_trip', '{cultural}', 1, 0, array['Jozani-Chwaka Bay National Park', 'Zanzibar'], 'Stone Town', 'Stone Town',
   array['Zanzibar red colobus monkeys', 'Shady groundwater forest', 'Mangrove boardwalk', 'Easy to combine with the south-east beaches'],
   '[
     {"day":1,"title":"Morning: drive to Jozani","body":"About an hour from Stone Town, or less from Paje and the south-east coast."},
     {"day":1,"title":"Forest walk with a park guide","body":"Walk shady trails with a park guide to find groups of red colobus monkeys feeding in the trees. Keep a few metres away and do not feed them."},
     {"day":1,"title":"Mangrove boardwalk","body":"Walk the raised boardwalk through the mangroves and learn why they matter for fish, crabs and the coast."},
     {"day":1,"title":"Midday: lunch and onward","body":"Lunch nearby, then return to Stone Town or continue to the beach."}
   ]'::jsonb,
   array['Park guide', 'Transport'], array['Park entry fee unless agreed', 'Lunch', 'Tips'],
   array[1,2,6,7,8,9,10,12], array['family'], 'easy',
   array['Insect repellent', 'Walking shoes', 'Light long sleeves'],
   array['Zanzibar requires its own inbound travel insurance; see Visa & insurance.', 'Do not touch or feed the monkeys.'],
   'operator', 'partner', 'published', true, 43),

  ('changuu-prison-island-tortoises', 'Changuu (Prison) Island & Giant Tortoises', 'Kisiwa cha Changuu na Kobe Wakubwa',
   'A short boat trip from Stone Town to see giant tortoises, old quarantine buildings and clear water for snorkelling.',
   'Safari fupi ya boti kutoka Mji Mkongwe kuona kobe wakubwa, majengo ya zamani na kuogelea.',
   'coast', 'day_trip', '{historical,marine,beach}', 1, 0, array['Changuu Island', 'Stone Town'], 'Stone Town', 'Stone Town',
   array['Giant Aldabra tortoises', 'The island''s history', 'Snorkelling and beach time'],
   '[
     {"day":1,"title":"Boat from Stone Town","body":"Board a small boat on the Stone Town beach for the ride of about half an hour to Changuu Island."},
     {"day":1,"title":"Tortoise sanctuary","body":"Meet the giant Aldabra tortoises, some of them very old, and hear how they came to the island."},
     {"day":1,"title":"History walk","body":"See the old buildings: the island was meant to be a prison but became a quarantine station instead."},
     {"day":1,"title":"Snorkel and back","body":"Swim or snorkel off the beach or a nearby sandbank, then return to Stone Town."}
   ]'::jsonb,
   array['Boat with crew', 'Snorkel gear'], array['Island entry fee unless agreed', 'Tips'],
   array[1,2,3,6,7,8,9,10,11,12], array['family'], 'easy',
   array['Swimwear and towel', 'Sunscreen', 'Water'],
   array['Zanzibar requires its own inbound travel insurance; see Visa & insurance.', 'Choose boats with life jackets.'],
   'operator', 'partner', 'published', true, 44),

  ('dar-es-salaam-city-markets', 'Dar es Salaam City, Markets & Museum', 'Jiji la Dar es Salaam, Masoko na Makumbusho',
   'The real Dar es Salaam in a day: the morning fish market, Kariakoo, the National Museum, a local lunch and the Mwenge carvers'' market.',
   'Dar es Salaam halisi kwa siku moja: soko la samaki, Kariakoo, Makumbusho ya Taifa, chakula cha mtaani na soko la wachongaji Mwenge.',
   'coast', 'day_trip', '{cultural,historical}', 1, 0, array['Dar es Salaam'], 'Dar es Salaam', 'Dar es Salaam',
   array['Kivukoni fish market in the morning', 'Kariakoo, East Africa''s busiest market area', 'National Museum', 'Mwenge woodcarvers'],
   '[
     {"day":1,"title":"Early morning: fish market","body":"Start at the Kivukoni fish market by the harbour, when the night''s catch is auctioned and cooked on the spot."},
     {"day":1,"title":"City centre and Kariakoo","body":"Walk past the harbour front and old buildings, then dive into Kariakoo, a huge market area of shops and stalls."},
     {"day":1,"title":"Midday: National Museum and lunch","body":"See the National Museum''s history and culture galleries, then lunch at a local restaurant."},
     {"day":1,"title":"Afternoon: Mwenge carvers","body":"Watch woodcarvers at work at the Mwenge market and buy directly from them. Back to your hotel by late afternoon."}
   ]'::jsonb,
   array['Local guide', 'Transport in the city'], array['Museum entry unless agreed', 'Lunch', 'Purchases', 'Tips'],
   array[1,2,6,7,8,9,10,11,12], array['family'], 'easy',
   array['Light clothes', 'Hat and water', 'Small cash'],
   array['Traffic is heavy; start early.', 'Keep phones and bags close in Kariakoo.', 'Ask before photographing people.'],
   'operator', 'partner', 'published', true, 45),

  ('kondoa-rock-art-2-days', 'Kondoa Rock Art', 'Michoro ya Miambani Kondoa',
   'Two days to see ancient paintings in rock shelters at Kondoa, a UNESCO World Heritage Site, with a local guide.',
   'Siku mbili kuona michoro ya kale kwenye mapango ya Kondoa, Urithi wa Dunia wa UNESCO, pamoja na mwongozaji.',
   'nationwide', 'multi_day', '{cultural,historical,walking}', 2, 1, array['Kondoa', 'Kolo'], 'Arusha', 'Arusha',
   array['Rock paintings at least two thousand years old', 'UNESCO World Heritage Site', 'Quiet hills off the usual safari route'],
   '[
     {"day":1,"title":"Arusha to Kondoa","body":"A long drive south through Maasai and farming country to Kondoa. Afternoon visit to the antiquities office at Kolo to arrange your guide and walk to a first group of shelters."},
     {"day":2,"title":"Rock-art shelters","body":"Walk with your guide to the main painted shelters, with people, animals and patterns in red and other colours. Learn what the paintings may mean and how communities still use some sites. Drive back to Arusha in the afternoon."}
   ]'::jsonb,
   array['Local guide', 'Site entry', 'Transport', 'One night''s simple accommodation'], array['Meals unless agreed', 'Tips'],
   array[1,2,6,7,8,9,10,12], array[]::text[], 'moderate',
   array['Walking shoes', 'Hat and water', 'Torch for shelters'],
   array['Never touch the paintings or splash water on them.', 'Roads to some shelters are rough; a 4x4 helps.'],
   'operator', 'partner', 'published', true, 46)
on conflict (slug) do nothing;

-- Stops (map pins) for the new trips, linked to their place guides.
insert into public.trip_stops (trip_id, position, day, name, kind, lat, lng, place_id)
select t.id, s.position, s.day, s.name, s.kind::public.stop_kind, s.lat, s.lng, p.id
from (values
  ('lushoto-irente-viewpoint-walk', 1, 1, 'Lushoto', 'town', -4.78, 38.29, 'usambara-mountains-lushoto'),
  ('ngiresi-village-arusha', 1, 1, 'Arusha', 'town', -3.3869, 36.6830, 'arusha'),
  ('arusha-town-culture-tanzanite', 1, 1, 'Arusha', 'town', -3.3869, 36.6830, 'arusha'),
  ('jozani-forest-red-colobus', 1, 1, 'Jozani-Chwaka Bay National Park', 'park', -6.25, 39.41, 'jozani-chwaka-bay'),
  ('changuu-prison-island-tortoises', 1, 1, 'Stone Town', 'town', -6.1622, 39.1921, 'stone-town'),
  ('changuu-prison-island-tortoises', 2, 1, 'Changuu Island', 'island', -6.12, 39.17, 'changuu-island'),
  ('dar-es-salaam-city-markets', 1, 1, 'Dar es Salaam', 'town', -6.8161, 39.2803, 'dar-es-salaam'),
  ('kondoa-rock-art-2-days', 1, 1, 'Arusha', 'town', -3.3869, 36.6830, 'arusha'),
  ('kondoa-rock-art-2-days', 2, 2, 'Kondoa rock-art sites', 'cultural', -4.73, 35.83, 'kondoa-rock-art-sites')
) as s(slug, position, day, name, kind, lat, lng, place_slug)
join public.trips t on t.slug = s.slug
left join public.places p on p.slug = s.place_slug
where not exists (select 1 from public.trip_stops x where x.trip_id = t.id);

-- ---------------------------------------------------------------------------
-- Travel news for travellers (facts checked 2026-10-15/16 on the official sites)
-- ---------------------------------------------------------------------------
insert into public.travel_news (title, body, region, source_name, source_url, published_on)
values
  ('Travel insurance is now required for mainland Tanzania',
   'Since 1 October 2026 visitors to mainland Tanzania must have inbound travel insurance from the National Insurance Corporation (NIC). Buy it online before you fly and keep the certificate on your phone. Residents of EAC and SADC countries are exempt on the mainland. One policy covers both the mainland and Zanzibar when bought from the insurer where you land first.',
   null, 'National Insurance Corporation', 'https://inbound.nicinsurance.co.tz', '2026-10-01'),
  ('Zanzibar: inbound travel insurance still required',
   'Zanzibar has required inbound travel insurance from the Zanzibar Insurance Corporation (ZIC) since 2024. If you land in Zanzibar first, buy the ZIC policy before you travel. It also covers the mainland.',
   'Zanzibar', 'Zanzibar Insurance Corporation', 'https://inbound.visitzanzibar.go.tz', '2026-10-02'),
  ('Apply for your visa only on the official site',
   'Many websites look official but charge extra fees. Apply for a Tanzanian e-visa only at visa.immigration.go.tz, the Tanzania Immigration Department site. Rafrika never applies for visas on your behalf.',
   null, 'Tanzania Immigration Department', 'https://visa.immigration.go.tz', '2026-10-03');
