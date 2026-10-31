# Sample guides, packages and group trips: realistic names (draft)

Prepared by guide-success on 2026-10-31 for the "2026-10-31 Realistic samples" plan, step 1 (paper only). Nothing has been changed in the database. Walter approves these texts before backend-engineer puts them in a new migration (old migrations are never edited).

Source of the current data: `supabase/migrations/20261016001000_sample_guides_packages_groups.sql` (16 guides, 8 packages, 2 group trips).

## Ground rules used

- Every person here is invented. The sample label stays on every card and page (board decision 4); the texts themselves do not say "sample".
- No years of experience, summit counts, awards, ratings, reviews, licences or certificates in the texts. Bios describe what the guide does and how, not achievements.
- No prices. Guides set their own prices; samples stay "on request".
- No named real businesses (hotels, farms, boat companies) in packages. Only public places (parks, markets, museums, villages).
- Regions, genders, specialities, expertise tags, languages and group sizes follow the old seed. Two first names were changed (see the name checks).

## Name checks (web search, 2026-10-31)

Every full name was searched as `"<full name>" guide Tanzania` (or Zanzibar). None of the chosen full names matched a guide, a well-known person or a business. Common first names (Baraka, Joseph, Amani, Daudi, Peter) always bring up some guide with that first name and no surname; that is expected and not a clash.

| Name | Result | Note |
| --- | --- | --- |
| Baraka Urio | No full-name match | A guide called Baraka (no surname) works for an Arusha safari operator. Our Baraka is a mountain guide in Moshi. |
| Neema Lyimo | No full-name match | A tour planner called Neema (no surname) appears in reviews. Low risk. |
| Joseph Nnko | No full-name match | |
| Rehema Qamara | No full-name match | |
| Amani Swai | No full-name match | First idea "Amani Massawe" dropped: a tour company called Massawe Adventures exists. |
| Zawadi Bakari | No full-name match | Zawadi is also the name of a Zanzibar hotel; as a person's first name this is fine. |
| Hamisi Mfaume | No full-name match | |
| Asha Suleiman | No full-name match | |
| Elia Mwakalinga | No full-name match | |
| Mwanaisha Rajabu | No full-name match | |
| Salim Mzee | No full-name match | |
| Riziki Makame (was Fatma) | No full-name match | "Fatma Omar" dropped: a real Zanzibar guide named Fatma runs Stone Town walks and boat trips, too close to the old sample. "Riziki Vuai" dropped: Vuai is a guide recommended on travel forums. A Zanzibar guide called Makame (single name) exists; different first name and speciality, low risk. |
| Peter Masanja | No full-name match | |
| Grace Kimaro | No full-name match | |
| Daudi Ndosi | No full-name match | First ideas dropped: "Daudi Sumari" (Sumari is the surname of a known former MP), "Daudi Kaaya" (a well-known head guide is named Kaaya). |
| Witness Mallya (was Upendo) | No full-name match | "Upendo" dropped: a real female guide named Upendo works around Kilimanjaro, too close to the old sample. "Witness Urassa" dropped: a well-known safari guide is named Urassa. |

Also avoided on purpose: surnames of well-known politicians, athletes and musicians (for example Mrema, Mbowe, Kikwete, Samatta, Bayi, Mfinanga, Laizer).

## The 16 guides

Fields not listed stay as in the old seed (regions, specialities, expertise, languages, group size, female_guide, open_to_partners). Recommended changes for all 16, for backend-engineer:

- `years_experience` = null (the card hides it when empty). The old seed shows numbers such as "15 years", which reads as a real claim.
- `summits`, `certifications`, `association` = null; no check dates (`identity_checked_at`, `licence_checked_at`, `first_aid_checked_at`) set.
- Slug: the name in lower case, for example `baraka-urio`. Only `is_sample` marks them; tech-lead to confirm nothing relies on the `sample-` prefix.
- `verification_status` 'approved' and `verified_at` are needed so they show publicly; frontend should make sure no "verified" or "checked" wording appears on a sample profile.

### 1. Baraka Urio (man, Moshi, mountain)
- Headline: Kilimanjaro and Meru mountain guide
- Bio: I grew up on the slopes of Kilimanjaro and now guide climbers on Kilimanjaro and Mount Meru. I set a slow, steady pace, check how every climber feels morning and evening, and explain each day's plan before we start. I also guide charity groups who climb together.
- Languages: en, sw

### 2. Neema Lyimo (woman, Moshi, mountain and day trips)
- Headline: Mountain guide for first-time climbers and women travelling alone
- Bio: Many of the people I guide have never climbed a mountain before. I help with kit, pace and food so the first big climb feels manageable. Women travelling alone and student groups often ask for me, and I am happy to answer questions before you book.
- Languages: en, sw, de

### 3. Joseph Nnko (man, Arusha, safari and photography)
- Headline: Northern circuit safari guide
- Bio: I guide safaris in Tarangire, Lake Manyara, Ngorongoro and the Serengeti. I like to take time at sightings and explain what the animals are doing. Families and older travellers are welcome; we plan short drives and rest stops when needed.
- Languages: en, sw, fr

### 4. Rehema Qamara (woman, Arusha, safari and birding)
- Headline: Safari guide for families and slow travel
- Bio: I come from the Karatu side of the Ngorongoro highlands. I plan unhurried safaris with fewer hours in the vehicle and more time to watch. I can adjust the days for travellers who use a wheelchair or need easy steps; tell me what you need and I will say honestly what is possible.
- Languages: en, sw, it

### 5. Amani Swai (man, Moshi, cultural and day trips)
- Headline: Cultural tours, coffee farms and village walks
- Bio: I take visitors to Chagga villages on the slopes of Kilimanjaro to see how families grow coffee and bananas and how daily life works. I agree each visit with the family first, and part of what you pay goes to them. Good for students and families.
- Languages: en, sw

### 6. Zawadi Bakari (woman, Zanzibar, cultural and city)
- Headline: Swahili culture and food walks
- Bio: I was born in Stone Town. I share Swahili food, history and daily life, at a calm pace and with respect for the neighbourhood. Women travelling alone and Muslim travellers are very welcome; I know where to pray, eat halal and rest.
- Languages: en, sw, fr

### 7. Hamisi Mfaume (man, Dar es Salaam, city and cultural)
- Headline: Dar es Salaam city, markets and history
- Bio: I show visitors the Dar es Salaam I know: the fish market at dawn, Kariakoo, the old buildings of the centre and day trips to Bagamoyo. I keep walks short with shade and seats for older travellers.
- Languages: en, sw

### 8. Asha Suleiman (woman, Zanzibar, city and day trips)
- Headline: Stone Town walks and spice tours
- Bio: I guide walks through the lanes of Stone Town and half days on spice farms outside town. Couples and Muslim travellers often travel with me. I explain what we see, and when to ask before taking a photo.
- Languages: en, sw, it

### 9. Elia Mwakalinga (man, Arusha, birding and safari)
- Headline: Birding guide, forests and lakes
- Bio: I come from Mbeya and moved north for the birds. I guide birding mornings around Arusha, Lake Manyara and Tarangire, with binoculars and a list of what we saw at the end. Older travellers and keen beginners are both welcome.
- Languages: en, sw, de

### 10. Mwanaisha Rajabu (woman, Dar es Salaam, birding and marine)
- Headline: Coastal and wetland birding
- Bio: I guide birding along the coast near Dar es Salaam and Bagamoyo, and trips towards Nyerere National Park. I welcome deaf travellers: I plan with written notes and simple signs, and agree them with you before we start.
- Languages: en, sw

### 11. Salim Mzee (man, Zanzibar, marine and day trips)
- Headline: Snorkelling, dhow trips and sandbanks
- Bio: I grew up by the sea in Zanzibar. I take families and couples snorkelling, to sandbanks and out on traditional dhows. Life jackets for everyone, and we only go out when the weather is right.
- Languages: en, sw

### 12. Riziki Makame (woman, Zanzibar, marine and cultural)
- Headline: Ocean days for families and beginners
- Bio: I help people who are new to the sea feel safe in it: calm spots, short swims and plenty of time. I also welcome blind and partially sighted travellers; I describe what is around us and plan each step together.
- Languages: en, sw, de

### 13. Peter Masanja (man, Arusha, photography and safari)
- Headline: Photography safaris with time at sightings
- Bio: I am from Mwanza and now guide from Arusha. My trips are for photographers: small groups, early starts for the best light and patience at sightings. We agree the plan for each day so everyone gets the photos they came for.
- Languages: en, sw, zh

### 14. Grace Kimaro (woman, Moshi, photography and cultural)
- Headline: Landscape and people photography, with consent
- Bio: I guide photo walks around Moshi and on the Kilimanjaro slopes: landscapes, markets and people. We always ask before photographing anyone and respect a no. Women travelling alone are welcome.
- Languages: en, sw, pl

### 15. Daudi Ndosi (man, Arusha, day trips and cultural)
- Headline: Day trips around Arusha and Moshi
- Bio: I guide day trips from Arusha and Moshi: hot springs, waterfalls, coffee villages and short walks. Families are welcome, and I plan routes with easy access for travellers who need it.
- Languages: en, sw, fr

### 16. Witness Mallya (woman, Moshi, day trips and mountain)
- Headline: Hot springs, waterfalls and short walks
- Bio: I guide short walks and day trips around Moshi: waterfalls, forest paths on the lower slopes of Kilimanjaro and village lunches. Student groups often travel with me.
- Languages: en, sw

## Packages

The old seed had one package per kind (8). Below are the 8 rewritten, plus 8 optional ones so every sample guide has one package (Walter: "a sample product on every product"). Prices stay empty (on request). Durations, group sizes and inclusions are typical, not promises.

### The 8 from the old seed (rewritten)

| Guide | Kind | Title | Summary |
| --- | --- | --- | --- |
| Amani Swai | cultural | Coffee from bean to cup with a Chagga family | Walk through banana and coffee farms on Kilimanjaro, then pick, roast and grind coffee by hand with a local family. Pick-up in Moshi and a home-cooked lunch. 6 hours, up to 8 people. |
| Neema Lyimo | one_on_one | One-on-one Kilimanjaro training day | A private day hike with your own guide to practise pace, layering and breathing before your climb. Kit check and all your questions answered. 7 hours, just you and the guide. |
| Daudi Ndosi | day_trip | Chemka hot springs and village lunch | A relaxed day at clear, warm springs between Moshi and Arusha, with lunch in a farming village. Back by evening. 8 hours, up to 10 people. |
| Joseph Nnko | multi_day | Three days: Tarangire and Ngorongoro | Day 1 elephants and baobabs in Tarangire, day 2 Karatu and a village walk, day 3 a full day in the Ngorongoro Crater and back to Arusha. Up to 6 people. |
| Zawadi Bakari | food | Swahili food walk in Stone Town | An evening walk through the lanes to Forodhani Gardens, tasting street food, spices and coffee, with stories about Swahili cooking. 3 hours, up to 8 people. |
| Hamisi Mfaume | city | Dar es Salaam in a morning | Start early at Kivukoni fish market, walk through the centre and Kariakoo, and finish at the National Museum. 4 hours, up to 10 people. |
| Elia Mwakalinga | nature | Birding morning at Lake Manyara | An early start on the lake shore and in the groundwater forest. Binoculars provided and a list of what you saw. 5 hours, up to 6 people, meet in Mto wa Mbu. |
| Salim Mzee | other | Sunset dhow trip | About two hours on a traditional dhow along the Stone Town seafront at sunset, with fruit and drinks. Up to 10 people. |

### Optional: one for each remaining guide

| Guide | Kind | Title | Summary |
| --- | --- | --- | --- |
| Baraka Urio | day_trip | Kilimanjaro day hike in the rainforest | Walk the forest trail on the lower slopes of Kilimanjaro with a mountain guide and look for colobus monkeys. Park fees are paid separately at the gate. About 8 hours, up to 12 people. |
| Rehema Qamara | day_trip | Tarangire at a family pace | A day in Tarangire with short drives, a long picnic lunch and time to watch elephants. Easy steps in and out of the vehicle. About 10 hours from Arusha, up to 6 people. |
| Asha Suleiman | city | Stone Town lanes and a spice farm | A morning walk through Stone Town, then a spice farm outside town to smell and taste cloves, cinnamon and vanilla. About 5 hours, up to 8 people. |
| Mwanaisha Rajabu | nature | Shore birds and mangroves near Bagamoyo | A morning on the coast near Bagamoyo looking for waders, kingfishers and other shore birds, with notes written as we go. About 6 hours from Dar es Salaam, up to 6 people. |
| Riziki Makame | day_trip | First snorkel at a sandbank | A short boat ride to a sandbank off Stone Town, a calm swim with a life jacket and help in the water for beginners. About 4 hours, up to 8 people. |
| Peter Masanja | one_on_one | Private photo day in the Ngorongoro Crater | One photographer, one guide, one vehicle: an early descent for the first light and as long at each sighting as you want. About 10 hours from Karatu. |
| Grace Kimaro | cultural | Moshi market and portraits with consent | A morning photo walk through Moshi market and nearby streets, learning how to ask, show the picture and respect a no. About 3 hours, up to 4 people. |
| Witness Mallya | day_trip | Materuni waterfall walk and lunch | Walk through Chagga farms to the Materuni waterfall on the slopes of Kilimanjaro, then lunch in the village. Village fees are paid on the day. About 6 hours from Moshi, up to 10 people. |

Facts to re-check by whoever writes the migration: park and village fees change, so the texts only say they are paid separately, without amounts.

## Group trips

| Guide | Title | Description |
| --- | --- | --- |
| Baraka Urio | 7-day Machame climb in February | A small group on the Machame route, 10 to 16 February 2027, starting and ending in Moshi. Between 2 and 8 climbers. Guide team, park fees, tents and meals included. Ask the guide for the price and the kit list. |
| Joseph Nnko | 4-day Serengeti and Ngorongoro, three places left | Three friends are going from 5 to 8 March 2027 and are looking for three more people to share the vehicle. Starts and ends in Arusha. Guide, safari vehicle and park fees included. Ask the guide for the price per person. |

Price: the old seed stores `price_per_person_usd = 0`. Without the old "price shows as 0" sentence, "US$0" would look like a real offer. Please have frontend show "Price on request" when the price is 0 on a sample, or store null if the column allows it. Do not put an invented price in.

## Open points for other agents

- frontend-engineer: sample label on package and group trip cards and pages (already in the plan), "Price on request" for 0, and no "verified" wording on sample profiles.
- backend-engineer: null for years, summits, certifications and association; slugs without "sample-"; change only through a new migration.
- designer: guide photos without identifiable faces (board decision 5), for example hands, backs, boots on a trail, a dhow from a distance.

## What Walter should approve

1. The 16 names (including the two changed first names: Fatma to Riziki, Upendo to Witness).
2. The bios and headlines as written, with years of experience left empty.
3. Whether to add the 8 optional packages (one package for every guide) or keep only the 8 rewritten ones.
4. The two group trip texts, with "Price on request" instead of US$0.

Nothing needs to be sent to anyone. After approval, these texts go to backend-engineer for the migration draft.
