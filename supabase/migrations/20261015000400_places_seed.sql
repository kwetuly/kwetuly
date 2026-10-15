-- Place guides for the parks and sites in the starter tours. Summaries are Rafrika's own words.
-- Figures (area, year, UNESCO listing, highest point) come from the linked official page,
-- checked on 2026-10-15. Places without a source carry no figures.

insert into public.places
  (slug, name, kind, region, lat, lng, summary, known_for, wildlife, activities, area_km2, established, unesco_year, highest_point, managed_by, source_name, source_url, source_checked_at)
values
('serengeti-national-park', 'Serengeti National Park', 'national_park', 'Northern circuit', -2.3333, 34.8333,
 'Tanzania''s best-known park and the heart of the Serengeti–Mara ecosystem that Tanzania shares with Kenya. Open grass plains, rocky kopjes, rivers and woodland carry the Great Migration of wildebeest, zebra and gazelle around the year, with the big cats that follow them.',
 '{"The Great Migration: over 1.5 million wildebeest with zebras, gazelles and elands","One of the highest concentrations of large carnivores in Africa","More than 540 bird species","Rock paintings and sites of the Maasai, Ikoma and other peoples","UNESCO World Heritage Site"}',
 '{Wildebeest,Zebra,Thomson''s gazelle,Lion,Leopard,Cheetah,Spotted hyena,Elephant,Buffalo,Giraffe,Hippo,Black rhino}',
 '{Game drives,Hot-air balloon flights,Walking safaris,Bush meals,Birdwatching,Cultural visits}',
 14763, 1959, 1981, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/Serengeti', '2026-10-15'),

('ngorongoro-conservation-area', 'Ngorongoro Conservation Area', 'conservation_area', 'Northern circuit', -3.1750, 35.5650,
 'Highland plains, savanna and forest where wildlife lives alongside Maasai herders, who still graze their cattle here. Its centrepiece is the Ngorongoro Crater, a huge collapsed volcano whose floor holds lions, buffalo, hippos and black rhinos. The area also takes in the Ndutu plains, where the migration calves early in the year.',
 '{"Ngorongoro Crater, described by UNESCO as the world''s largest caldera","Multiple land use: wildlife and Maasai pastoralists side by side","Ndutu plains in the migration''s calving season","UNESCO World Heritage Site"}',
 '{Lion,Black rhino,Buffalo,Elephant,Hippo,Wildebeest,Zebra,Spotted hyena,Flamingo}',
 '{Crater game drives,Crater rim viewpoints,Maasai village visits,Highland walks}',
 8094.4, 1959, 1979, null, 'Ngorongoro Conservation Area Authority (NCAA)', 'UNESCO World Heritage Centre', 'https://whc.unesco.org/en/list/39/', '2026-10-15'),

('kilimanjaro-national-park', 'Kilimanjaro National Park', 'national_park', 'Kilimanjaro', -3.0758, 37.3533,
 'Africa''s highest mountain, rising alone above the plains. A climb passes through five climate zones, from montane forest through heath and moorland to alpine desert and the ice of the summit, so the trail feels like walking from the tropics to the Arctic in a few days.',
 '{"Kibo''s Uhuru Peak, the highest point in Africa","Three volcanic cones: Kibo, Mawenzi (5,149 m) and Shira (3,962 m)","Five eco-climatic zones, with montane forest between 1,800 m and 2,800 m","The endemic Kilimanjaro impatiens flower","Sacred to the Chagga people, especially along the Marangu route","UNESCO World Heritage Site"}',
 '{Black-and-white colobus,Blue monkey,Elephant,Buffalo,Eland,More than 179 bird species}',
 '{Multi-day summit climbs,Day hikes to the forest and first camps,Cultural visits in Chagga villages}',
 1712, 1973, 1987, 'Kibo (Uhuru Peak), 5,895 m', 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/kilimanjaro', '2026-10-15'),

('tarangire-national-park', 'Tarangire National Park', 'national_park', 'Northern circuit', -3.9500, 36.0500,
 'Known as the elephant park. In the dry season the Tarangire River is the only water for miles, so large herds gather along it among ancient baobab trees. Tarangire is also one of the few northern parks that allows night game drives.',
 '{"Large elephant herds along the Tarangire River in the dry season","Ancient baobab trees and old termite mounds","More than 550 bird species, including the yellow-collared lovebird and ashy starling","Day and night game drives"}',
 '{Elephant,Giraffe,Zebra,Buffalo,Lion,Cheetah,Leopard,Dwarf mongoose,Yellow-collared lovebird}',
 '{Game drives,Night game drives,Walking safaris,Hot-air balloon flights,Birdwatching}',
 2850, 1970, null, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/Tarangire', '2026-10-15'),

('lake-manyara-national-park', 'Lake Manyara National Park', 'national_park', 'Northern circuit', -3.5500, 35.8000,
 'A narrow park between the Rift Valley wall and a shallow soda lake. Groundwater forest at the entrance gives way to woodland, hot springs and the lake shore, where flamingos feed. It is famous for lions that rest in trees.',
 '{"Tree-climbing lions","Lesser flamingos feeding on the lake","Hot springs","A 470 m treetop canopy walkway","More than 400 bird species","UNESCO Man and Biosphere Reserve since 1981"}',
 '{Lion,Elephant,Buffalo,Giraffe,Blue monkey,Baboon,Lesser flamingo,Silvery-cheeked hornbill}',
 '{Game drives,Night game drives,Canopy walkway,Canoeing,Walking safaris}',
 648.7, 1960, null, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/lake-manyara', '2026-10-15'),

('arusha-national-park', 'Arusha National Park', 'national_park', 'Northern circuit', -3.2445, 36.7500,
 'A small, varied park on the edge of Arusha, from the forest slopes of Mount Meru to open grassland and the Momella Lakes. It is the base for climbing Meru, which many people do to acclimatise before Kilimanjaro.',
 '{"Mount Meru, Tanzania''s second-highest peak","Ngurdoto Crater, the ''Little Ngorongoro''","Momella Lakes with flamingos","Black-and-white colobus monkeys","More than 400 bird species"}',
 '{Giraffe,Zebra,Buffalo,Black-and-white colobus,Flamingo}',
 '{Mount Meru climbs,Walking safaris,Canoeing on Momella Lakes,Game drives,Horseback riding}',
 322, null, null, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/arusha', '2026-10-15'),

('ruaha-national-park', 'Ruaha National Park', 'national_park', 'Southern circuit', -7.7300, 34.9300,
 'Tanzania''s second-largest national park: rugged hills, baobab plains and the Great Ruaha River, far from the crowds of the north. It is known for big predators, large elephant herds and rare birds first described here.',
 '{"Second-largest national park in Tanzania","Large populations of elephants, lions and African wild dogs","More than 570 bird species, including the Ruaha red-billed hornbill"}',
 '{Elephant,Lion,Leopard,Cheetah,African wild dog,Greater kudu,Ruaha red-billed hornbill}',
 '{Game drives,Walking safaris,Birdwatching}',
 19822, 1964, null, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/ruaha', '2026-10-15'),

('nyerere-national-park', 'Nyerere National Park', 'national_park', 'Southern circuit', -7.8000, 38.1000,
 'A vast wilderness built around the Rufiji River, with channels, oxbow lakes and sandbanks. You can explore it by boat as well as by vehicle and on foot. It is reached by road from Dar es Salaam or by light aircraft.',
 '{"Africa''s largest national park, according to TANAPA","Boat safaris on the Rufiji River","Rare antelopes such as sable, roan and Lichtenstein''s hartebeest","More than 440 bird species, including Pel''s fishing owl"}',
 '{Elephant,Lion,Leopard,Buffalo,African wild dog,Hippo,Crocodile,Sable antelope}',
 '{Boat safaris,Game drives,Walking safaris,Birdwatching}',
 30893, null, null, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/nyerere', '2026-10-15'),

('mikumi-national-park', 'Mikumi National Park', 'national_park', 'Southern circuit', -7.3000, 37.1000,
 'The easiest big park to reach from Dar es Salaam, on the main road to Iringa. Its Mkata floodplain is open, wildlife-rich country that is good for a short safari.',
 '{"The Mkata floodplain","Four of the Big Five: elephant, buffalo, lion and leopard","More than 400 bird species, such as the lilac-breasted roller","Easy road access from Dar es Salaam"}',
 '{Elephant,Buffalo,Lion,Leopard,Giraffe,Eland,Sable antelope,Lilac-breasted roller}',
 '{Game drives,Night game drives,Walking safaris,Birdwatching,Cultural visits}',
 3230, 1964, null, null, 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/mikumi', '2026-10-15'),

('mahale-mountains-national-park', 'Mahale Mountains National Park', 'national_park', 'Western circuit', -6.1000, 29.7400,
 'Forested mountains rising straight out of Lake Tanganyika, created to protect wild chimpanzees studied here since the 1960s. There are no roads: you arrive by plane and boat, then track the chimps on foot.',
 '{"The largest chimpanzee population in Tanzania","Clear water of Lake Tanganyika for swimming and snorkelling","Mount Kungwe (2,462 m)"}',
 '{Chimpanzee,Red colobus,Red-tailed monkey,Blue monkey,Hippo,Otter}',
 '{Chimpanzee trekking,Forest walks,Snorkelling and kayaking,Hiking Mount Kungwe}',
 1613, 1985, null, 'Mount Kungwe, 2,462 m', 'Tanzania National Parks (TANAPA)', 'Tanzania National Parks', 'https://www.tanzaniaparks.go.tz/nationalparks/mahale', '2026-10-15'),

('stone-town', 'Stone Town of Zanzibar', 'heritage_site', 'Zanzibar', -6.1630, 39.1890,
 'The old trading town of Zanzibar City: narrow lanes, carved wooden doors, markets and mosques. Over many centuries it mixed African, Arab, Indian and European cultures into the Swahili coast''s own style.',
 '{"A Swahili trading town kept almost intact","Buildings that blend African, Arab, Indian and European influences","Forodhani evening food market","UNESCO World Heritage Site"}',
 '{}',
 '{Guided heritage walks,Market visits,Food tours,Sunset dhow trips}',
 0.96, null, 2000, null, null, 'UNESCO World Heritage Centre', 'https://whc.unesco.org/en/list/173/', '2026-10-15'),

('kilwa-kisiwani', 'Kilwa Kisiwani', 'heritage_site', 'Southern coast', -8.9600, 39.5100,
 'Ruins of one of the great medieval ports of the East African coast, on a small island reached by boat from Kilwa Masoko. Between the 13th and 16th centuries its merchants traded gold, silver, pearls, Persian pottery and Chinese porcelain across the Indian Ocean.',
 '{"Medieval Swahili port ruins: palace, mosques and fort","Indian Ocean trade from the 13th to the 16th century","UNESCO World Heritage Site, with Songo Mnara"}',
 '{}',
 '{Guided walks through the ruins,Boat trips}',
 null, null, 1981, null, null, 'UNESCO World Heritage Centre', 'https://whc.unesco.org/en/list/144/', '2026-10-15'),

('lake-natron', 'Lake Natron', 'lake', 'Northern Tanzania', -2.3500, 35.9100,
 'A hot, shallow soda lake in the Rift Valley below Ol Doinyo Lengai. In good years it is where most of East Africa''s lesser flamingos breed. The surrounding Maasai land offers waterfall walks and wide desert views.',
 '{"The only regular breeding site of lesser flamingos in East Africa","Ramsar Wetland of International Importance (Lake Natron Basin, 2001)","Views of Ol Doinyo Lengai"}',
 '{Lesser flamingo,Greater flamingo}',
 '{Flamingo walks,Waterfall hikes,Maasai cultural visits,Ol Doinyo Lengai night climb}',
 null, null, null, null, null, 'Ramsar Sites Information Service', 'https://rsis.ramsar.org/ris/1080', '2026-10-15'),

('ol-doinyo-lengai', 'Ol Doinyo Lengai', 'mountain', 'Northern Tanzania', -2.7640, 35.9140,
 'The Maasai''s "Mountain of God", an active volcano above Lake Natron. It is the only volcano on Earth known to erupt natrocarbonatite lava, which is cooler than ordinary lava and turns white as it cools. Climbs start around midnight to avoid the heat.',
 '{"The only active volcano known to erupt natrocarbonatite lava","A steep night climb with sunrise over the Rift Valley"}',
 '{}',
 '{Guided night climb}',
 null, null, null, null, null, 'European Space Agency', 'https://www.esa.int/Applications/Observing_the_Earth/Earth_from_Space_Cool_lava_in_Africa_s_Great_Rift_Valley', '2026-10-15'),

('lake-eyasi', 'Lake Eyasi', 'lake', 'Northern Tanzania', -3.5800, 35.3500,
 'A seasonal soda lake below the Ngorongoro highlands, home to the Hadzabe, among the last hunter-gatherers in Africa, and to Datoga blacksmiths. Visits are early-morning walks with community guides.',
 '{"Hadzabe hunter-gatherer communities","Datoga blacksmiths","Onion farms and lake views"}',
 '{}',
 '{Morning walk with Hadzabe hunters,Visit to Datoga blacksmiths}',
 null, null, null, null, null, null, null, null),

('materuni', 'Materuni village', 'village', 'Kilimanjaro', -3.2560, 37.3850,
 'A Chagga village on the green lower slopes of Kilimanjaro above Moshi, with a tall waterfall and family coffee farms where you can roast and grind your own cup.',
 '{"Materuni waterfall","Chagga coffee from bean to cup","Banana and coffee farms on the mountain''s slopes"}',
 '{}',
 '{Waterfall hike,Coffee tour,Chagga lunch}',
 null, null, null, null, null, null, null, null),

('chemka-hot-springs', 'Chemka hot springs', 'village', 'Kilimanjaro', -3.4400, 37.1900,
 'Warm, clear spring water under fig trees in the dry plains south of Kilimanjaro, also called Kikuletwa. A popular place to swim and relax.',
 '{"Clear, warm spring water","Shade of large fig trees"}',
 '{}',
 '{Swimming,Picnic}',
 null, null, null, null, null, null, null, null),

('mto-wa-mbu', 'Mto wa Mbu', 'village', 'Northern circuit', -3.3550, 35.8550,
 'A busy market town at the foot of the Rift Valley wall near Lake Manyara, where people from many Tanzanian communities live and farm. Cycling tours visit banana plantations, artists and local kitchens.',
 '{"A town of many Tanzanian communities","Banana farms and markets","Village cycling tours"}',
 '{}',
 '{Village cycling tour,Market visit,Local lunch}',
 null, null, null, null, null, null, null, null),

('marangu', 'Marangu', 'village', 'Kilimanjaro', -3.2700, 37.5200,
 'A Chagga area on Kilimanjaro''s south-eastern slopes and the start of the Marangu route. Village walks show traditional homes, caves and local brewing.',
 '{"Chagga history and homesteads","Start of the Marangu route"}',
 '{}',
 '{Village walk,Waterfall visit}',
 null, null, null, null, null, null, null, null),

('mnemba-atoll', 'Mnemba Atoll', 'marine_area', 'Zanzibar', -5.8200, 39.3800,
 'A coral reef ring off Zanzibar''s north-east coast with clear, shallow water, well known for snorkelling and diving trips from the nearby beaches.',
 '{"Snorkelling and diving on coral reef","Clear, shallow water"}',
 '{Green turtle,Reef fish,Dolphin}',
 '{Snorkelling,Diving,Boat trips}',
 null, null, null, null, null, null, null, null),

('bagamoyo', 'Bagamoyo', 'town', 'Coast', -6.4430, 38.9040,
 'A historic coastal town north of Dar es Salaam, once the end of the caravan route from the interior. It has old German and Arab-era buildings, the Kaole ruins and a lively arts scene.',
 '{"Caravan-trade and colonial-era history","Kaole ruins","Arts and music"}',
 '{}',
 '{Heritage walk,Kaole ruins visit}',
 null, null, null, null, null, null, null, null)
on conflict (slug) do nothing;

-- Link the starter tours' map stops to their place guides.
update public.trip_stops s set place_id = p.id
from public.places p
join (values
  ('Central Serengeti (Seronera)', 'serengeti-national-park'),
  ('Ngorongoro Crater', 'ngorongoro-conservation-area'),
  ('Ngorongoro Crater rim', 'ngorongoro-conservation-area'),
  ('Ngorongoro highlands', 'ngorongoro-conservation-area'),
  ('Ndutu plains', 'ngorongoro-conservation-area'),
  ('Tarangire National Park', 'tarangire-national-park'),
  ('Lake Manyara National Park', 'lake-manyara-national-park'),
  ('Arusha National Park (Momella)', 'arusha-national-park'),
  ('Momella Gate', 'arusha-national-park'),
  ('Miriakamba Hut', 'arusha-national-park'),
  ('Saddle Hut', 'arusha-national-park'),
  ('Socialist Peak', 'arusha-national-park'),
  ('Machame Gate', 'kilimanjaro-national-park'),
  ('Machame Camp', 'kilimanjaro-national-park'),
  ('Shira Cave Camp', 'kilimanjaro-national-park'),
  ('Barranco Camp', 'kilimanjaro-national-park'),
  ('Karanga Camp', 'kilimanjaro-national-park'),
  ('Barafu Camp', 'kilimanjaro-national-park'),
  ('Uhuru Peak', 'kilimanjaro-national-park'),
  ('Mweka Gate', 'kilimanjaro-national-park'),
  ('Londorossi Gate', 'kilimanjaro-national-park'),
  ('Mti Mkubwa Camp', 'kilimanjaro-national-park'),
  ('Shira 1 Camp', 'kilimanjaro-national-park'),
  ('Shira 2 Camp', 'kilimanjaro-national-park'),
  ('Marangu Gate', 'kilimanjaro-national-park'),
  ('Mandara Hut', 'kilimanjaro-national-park'),
  ('Horombo Hut', 'kilimanjaro-national-park'),
  ('Kibo Hut', 'kilimanjaro-national-park'),
  ('Kilimanjaro (Uhuru Peak)', 'kilimanjaro-national-park'),
  ('Ruaha National Park', 'ruaha-national-park'),
  ('Nyerere National Park (Rufiji river)', 'nyerere-national-park'),
  ('Mikumi National Park', 'mikumi-national-park'),
  ('Mahale Mountains National Park', 'mahale-mountains-national-park'),
  ('Stone Town', 'stone-town'),
  ('Kilwa Kisiwani ruins', 'kilwa-kisiwani'),
  ('Lake Natron (Engaresero)', 'lake-natron'),
  ('Ol Doinyo Lengai', 'ol-doinyo-lengai'),
  ('Lake Eyasi', 'lake-eyasi'),
  ('Materuni village', 'materuni'),
  ('Chemka hot springs', 'chemka-hot-springs'),
  ('Mto wa Mbu', 'mto-wa-mbu'),
  ('Marangu', 'marangu'),
  ('Mnemba Atoll', 'mnemba-atoll'),
  ('Bagamoyo', 'bagamoyo')
) as m (stop_name, place_slug) on m.place_slug = p.slug
where s.name = m.stop_name;

-- Practical notes for each kind of tour (general guidance, no prices).
update public.trips set good_to_know = '{"Most visitors need a visa: apply only on the official Tanzania Immigration site, visa.immigration.go.tz.","Park entry permits are paid to the park authority (TANAPA, or NCAA for Ngorongoro); your operator usually arranges them.","Ask your doctor about malaria prevention and vaccinations before you travel.","Drones need a permit in national parks: do not bring one without arranging it first."}'
  where 'safari' = any (categories) or 'chimpanzee' = any (categories);
update public.trips set good_to_know = '{"Most visitors need a visa: apply only on the official Tanzania Immigration site, visa.immigration.go.tz.","Altitude sickness can affect anyone, however fit. Walk slowly, drink plenty and tell your guide about headaches or nausea at once.","Get travel insurance that covers high-altitude trekking and helicopter evacuation.","Climbs are led by licensed guides with registered porters; Kilimanjaro National Park permits are arranged by your operator.","Train with long walks on hills in the months before your climb."}'
  where 'mountain' = any (categories);
update public.trips set good_to_know = '{"Most visitors need a visa: apply only on the official Tanzania Immigration site, visa.immigration.go.tz.","Zanzibar is largely Muslim: cover shoulders and knees in Stone Town and villages, and swimwear only at the beach.","Use reef-safe sunscreen and do not touch coral or turtles when snorkelling.","Ask before photographing people."}'
  where ('beach' = any (categories) or 'marine' = any (categories)) and good_to_know = '{}';
update public.trips set good_to_know = '{"Most visitors need a visa: apply only on the official Tanzania Immigration site, visa.immigration.go.tz.","Ask before photographing people, and follow your guide''s advice on greetings and gifts.","Dress modestly when visiting villages and religious sites.","Carry small notes in Tanzanian shillings for crafts and community fees."}'
  where good_to_know = '{}';
