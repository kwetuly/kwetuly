# Kwetuly trip library: facts and gaps

Prepared by marketing on 2026-10-30, so guides can link trips to their profiles. Nobody was contacted. Everything is written in our own words, with facts and figures only. No text or pictures were copied from operators.

## How to read this file

Each fact carries a source grade:

| Grade | Meaning | Use |
|---|---|---|
| **OFFICIAL** | TANAPA, NCAA, a Tanzanian or Zanzibar ministry, or UNESCO / Ramsar | Can go into seeds and pages, with the source and date |
| **OFFICIAL-SECONDHAND** | An official fact reported by a newspaper, not read on the authority's own page | Usable with care; re-check on the official page when possible |
| **OPERATOR** | Figures from major operators, used only as a cross-check because no official figure was reachable | Approximate. Write "about" on pages; never present it as official |
| **TO VERIFY** | No reliable source found | Do not publish |

All web sources were checked on **2026-10-30**.

**Limits on official sources:**
- The TANAPA park pages (`tanzaniaparks.go.tz/nationalparks/kilimanjaro`, `/arusha`) load without their text when fetched; we only got site navigation. TANAPA's own exhibit on Google Arts & Culture was readable, so it is the official Kilimanjaro source here.
- UNESCO pages and the Smithsonian volcano page refused access (HTTP 403).
- No official camp-by-camp altitude list for Kilimanjaro or Meru was found. **Camp altitudes below are OPERATOR figures.** Before they go into the database, the best fix is dated photos of camp signboards from our own guides (see "Waiting for Walter").

Sources used:
1. TANAPA exhibit "Kilimanjaro National Park", Google Arts & Culture: https://artsandculture.google.com/story/kilimanjaro-national-park/qgLiYqJPo7G5Ig (OFFICIAL)
2. NCAA home page: https://www.ncaa.go.tz/ (OFFICIAL)
3. The Citizen, "Zanzibar revises marine conservation entry fees": https://www.thecitizen.co.tz/tanzania/zanzibar/zanzibar-revises-marine-conservation-entry-fees-5177588 (OFFICIAL-SECONDHAND: Ministry of Blue Economy and Fisheries fees from 1 September 2025)
4. Ngorongoro crater rules as summarised at https://ngorongorocrater.org/regulations.html. This is **not** an NCAA domain, so treat it as TO VERIFY with NCAA's own Visitor Guidelines page.
5. Cross-check operator pages (figures only): Ultimate Kilimanjaro route pages for Machame, Lemosho, Marangu, Rongai, Northern Circuit, Umbwe and Shira (`https://www.ultimatekilimanjaro.com/<route>-route/`); Freeingo Safari and Petit Futé itineraries on SafariBookings and petitfute.com (Machame Gate and Shira Cave); Asilia (migration camp seasons).
6. Background, cross-check only: Wikipedia ("Mount Kilimanjaro climbing routes", "Lake Chala", "Changuu", "Nyerere National Park"), Africa Geographic (Nyerere), a GVP mirror at volcanodb.com (Ol Doinyo Lengai height), and vulkane.net (Lengai activity in 2026).

---

## Part A. Our seeds today: conflicts and gaps

These were checked against `supabase/seed/trips.sql` and the migrations `20261015000000_tours.sql`, `20261015000100_tour_details_seed.sql`, `20261015000200_tour_places.sql`, `20261015000300_tour_stop_elevations.sql`, `20261015000400_places_seed.sql` and `20261016000700_content_cultural_trips_places_news.sql`.

### A1. Conflicts to fix

| # | Where | What we have | What sources say | Fix |
|---|---|---|---|---|
| 1 | `tour_stop_elevations`: Kilimanjaro camps | Terrain-model altitudes read at approximate pins | Many are far off. Shira Cave 2,991 vs about 3,750 to 3,845 (OPERATOR). Karanga 4,468 vs about 3,995. Kibo Hut 4,517 vs about 4,703. Mandara 2,317 vs about 2,700. Londorossi Gate 1,380 vs about 2,250 to 2,360. Barranco 4,053 vs about 3,960 to 3,976. Barafu 4,580 vs about 4,673. Machame Camp 2,589 vs about 2,835 to 2,850. Mweka Gate 1,560 vs about 1,640. **Horombo is stored at 3,903 m, but TANAPA gives 3,720 m (OFFICIAL).** | A new migration: set Horombo to 3,720 (OFFICIAL) now. Set the other camps from signboard photos, or from OPERATOR figures marked approximate. Re-check the pins. |
| 2 | Lemosho pins | Shira 1 is stored at 3,767 m and Shira 2 at 3,676 m, so the profile goes *down* | Shira 1 about 3,505; Shira 2 about 3,810 to 3,850 (OPERATOR) | Move the pins and fix the altitudes |
| 3 | Mount Meru | The trip highlight says Socialist Peak is 4,566 m; the stop altitude stored is 4,510 m | Sources give 4,562 to 4,566 m, and 4,566 m is most repeated. **No TANAPA page was reachable.** | Use one figure everywhere once TANAPA confirms it. Until then show "about 4,560 m" or keep the highlight only. |
| 4 | Meru huts | Miriakamba 2,412; Saddle 3,163 (terrain) | Miriakamba about 2,503 to 2,515; Saddle about 3,500 to 3,570 (OPERATOR) | As in #1 |
| 5 | Ol Doinyo Lengai | 2,921 m (terrain) | 2,962 m (GVP figure via a mirror; the GVP page itself returned 403) | Use 2,962 m with "GVP" as the source once read directly |
| 6 | Machame 7-day and Lemosho 8-day stops | Uhuru Peak goes straight to Mweka Gate | The itinerary text and all operators descend to **Mweka Camp** (about 3,068 to 3,100). Lava Tower (about 4,630) and Stella Point are not stops. | Add the Mweka Camp, Lava Tower and Stella Point stops |
| 7 | Lemosho 8-day itinerary | Londorossi, Mti Mkubwa, Shira 1, Shira 2, Lava Tower/Barranco, Karanga, Barafu, summit, gate | Ultimate Kilimanjaro's 8-day version goes Shira 1, then **Moir Hut**, then Lava Tower; other operators use Shira 2 as ours does. Both versions exist. | No error. Optionally offer the Moir Hut variant as a 9-day option. |
| 8 | Marangu 6-day | Day 3 acclimatisation and Gilman's Point are not stops | Day 3 goes up towards Mawenzi ridge (about 4,389) and back. Gilman's Point is about 5,669 to 5,685 (OPERATOR). | Add the stops |
| 9 | `ngorongoro-conservation-area` place `area_km2` | 8,094.4 (UNESCO) | **NCAA home page says 8,292 km² for the NCA and 12,000 km² for the geopark (OFFICIAL).** | Decide which to show. I recommend the NCAA figure with "NCAA, checked 2026-10-30", because NCAA is the managing authority. |
| 10 | Ngorongoro place summary | "described by UNESCO as the world's largest caldera" | NCAA says "world's largest unbroken caldera" | Use NCAA's exact claim and credit it ("NCAA describes it as…") |
| 11 | Chemka vs Kikuletwa | One trip `chemka-hot-springs` (with "Kikuletwa" in the text) | These are the same springs | Keep one trip and title it "Chemka (Kikuletwa) Hot Springs" for search. Do not add a duplicate. |
| 12 | Places sourced only from Wikipedia | Jozani-Chwaka Bay, Usambara, Changuu, Dar es Salaam, Arusha | No official page found for Jozani or Changuu | Keep them, but add no figures. Look for Zanzibar government pages later. |
| 13 | Lake Natron / Lengai `managed_by` | Empty | Operators list an Engaresero gate charge, a Lengai climbing fee and a TAWA wildlife-management fee. None of this is from an official source. **Not NCAA.** | Leave empty until the district or TAWA confirms |
| 14 | Calving safari best months {1,2,3} | Jan to Mar | Calving is usually about late January to March, peaking around February. Herds are in the south from about December (Asilia runs its southern migration camp from December to March). | Optionally add 12 and write a `best_time_note`: "timing shifts with the rains; no one can guarantee it" |
| 15 | Lake Chala (missing trip) | — | **2002: a visitor was killed by a crocodile while swimming at night** (Wikipedia, citing news reports). One site says kayaking and the lodge are being renovated (undated). | Any Lake Chala page must say "no swimming", and the guide must confirm kayaking is running |
| 16 | Changuu trip `excludes` "Island entry fee" | No figure (correct) | Sources range from US$4 to US$12+ (none official, none dated 2025) | Keep "fee paid on the island"; publish no figure |
| 17 | Zanzibar Mnemba trips | No fee mentioned | Mnemba special area: US$25 per adult and US$10 per child for non-East Africans; EAC citizens US$10 / US$5 (OFFICIAL-SECONDHAND, from 1 September 2025) | Add to `good_to_know` with the source and date |

### A2. Already in the seeds (keep)

Machame 7 days; Lemosho 8 days; Marangu 6 days; Mount Meru 4 days; Ol Doinyo Lengai and Natron 3 days; Serengeti and Ngorongoro 4 days; northern circuit 7 days; calving safari 6 days; Tarangire day; Arusha NP day; Nyerere 4 days; Ruaha 5 days; Mikumi 2 days; Stone Town and spice farm; Zanzibar beach and Mnemba 4 days; Jozani; Changuu; Materuni; Chemka; Moshi Chagga tour; Mto wa Mbu; Lake Eyasi 2 days; Ng'iresi; Arusha town; Lushoto; Kondoa; three combos.

### A3. Missing (new drafts to add, `needs_review`, no prices)

**Kilimanjaro routes**
- Rongai (6 and 7 days)
- Northern Circuit (8 and 9 days)
- Umbwe (6 and 7 days)
- Shira (7 and 8 days)
- Machame 6 days
- Lemosho 7 and 9 days
- Marangu 5 days

**Mount Meru**
- 3 days

**Northern safaris**
- 1 day: Lake Manyara; Ngorongoro Crater
- 2 days: Tarangire + Ngorongoro
- 3 days: Tarangire, Manyara, Ngorongoro
- 5 days: Tarangire, Serengeti ×2, Ngorongoro
- 6 days (not calving): Tarangire, Manyara, Serengeti ×2, Ngorongoro
- 8 days: + Lake Eyasi or Natron
- 9 to 10 days: + northern Serengeti (July to October)

**Southern parks**
- Mikumi day trip
- Nyerere 2 to 3 days (including fly-in from Zanzibar)
- Ruaha + Nyerere fly-in

**Zanzibar**
- Mnemba snorkelling day
- Prison Island + Nakupenda sandbank half day
- Beach info pages: Nungwi/Kendwa, Matemwe, Paje/Jambiani, Kizimkazi

**Cultural and day trips**
- Lake Chala
- Marangu waterfalls and Chagga caves (standalone)
- Kilimanjaro day hike to Mandara
- Lake Duluti
- Coffee farm (Machame/Kibosho)
- Lake Natron 2 days without the climb
- Lengai night climb from Natron

**Places missing from `places`**
Lake Chala, Lake Duluti, Olduvai Gorge, Ndutu, Empakaai, Ngurdoto Crater, Engaresero, Nakupenda sandbank, Kizimkazi, Nungwi/Kendwa, Paje.

---

## Part B. Trip library

### B1. Kilimanjaro: authority TANAPA (Kilimanjaro National Park, KINAPA)

**Official facts (TANAPA exhibit, checked 2026-10-30):**
- Kibo summit (Uhuru Peak) is 5,895 m. Mawenzi is 5,149 m; one photo caption in the same exhibit says 5,419 m, so use the body text figure. Shira is 3,962 m.
- Horombo Huts are at 3,720 m.
- Five vegetation zones: lower slopes, montane forest (1,800 to 2,800 m), heath and moorland, alpine desert, and summit.
- Climbs take "5, 6, 7 or more days" depending on route. TANAPA recommends an extra day at any station above 3,000 m to acclimatise.
- Six trails lead to the summit. The exhibit names Marangu and Rongai, and mentions a Kilema route used by cyclists.

**Route list:** Machame, Lemosho (Londorossi), Marangu, Rongai, Northern Circuit, Umbwe, Shira, with Mweka for descent only (Wikipedia, citing KINAPA; TO VERIFY with KINAPA). Marangu is the only route that comes down the same way. Rongai descends by the Marangu route (OPERATOR).

**Season:** climbs run all year. The months usually given as best are January to early March and June to October, with the long rains about April to May and short rains about November (OPERATOR consensus; no TANAPA statement found).

Camp altitudes below are **OPERATOR** figures in metres. Most are from Ultimate Kilimanjaro, converted from feet; others are noted.

**Machame**: 6 or 7 days.

| Day (7-day) | Stops | m |
|---|---|---|
| 1 | Machame Gate, then Machame Camp | gate about 1,800 (Freeingo; Ultimate Kilimanjaro gives 1,640, the same as its Mweka Gate, so treat that figure as doubtful); camp about 2,835 to 2,850 |
| 2 | Shira 2 / Shira Cave Camp | about 3,810 to 3,845 |
| 3 | Lava Tower (lunch), then Barranco Camp | 4,630; then about 3,976 |
| 4 | Barranco Wall, then Karanga Camp | about 3,995 |
| 5 | Barafu Camp | about 4,673 |
| 6 | Uhuru Peak (via Stella Point), then Mweka Camp | 5,895 (OFFICIAL); then about 3,068 |
| 7 | Mweka Gate | about 1,640 |

The 6-day version goes Barranco to Barafu in one day, with no night at Karanga.

**Lemosho**: 7, 8 or 9 days.
- Londorossi Gate is about 2,250 to 2,360 m
- 8-day route:
  - Mti Mkubwa (about 2,650 to 2,895)
  - Shira 1 (about 3,505)
  - Shira 2 (about 3,810) or Moir Hut (about 4,206)
  - Lava Tower (4,630), then Barranco (3,976)
  - Karanga (3,995)
  - Barafu (4,673)
  - Uhuru (5,895), then Mweka Camp (3,068)
  - Mweka Gate (1,640)
- 7-day version: skips one acclimatisation night
- 9-day version: adds a night (Shira 2 + Moir), or a daytime summit with descent to Barafu
- A Crater Camp option (about 5,750) exists only by special request; check KINAPA rules before offering it

**Marangu**: 5 or 6 days, in huts; up and down by the same route.

| Day (6-day) | Stops | m |
|---|---|---|
| 1 | Marangu Gate, then Mandara Hut | gate about 1,843 to 1,880; hut about 2,700 to 2,720 |
| 2 | Horombo Hut | **3,720 (OFFICIAL)** |
| 3 | Acclimatisation walk to Mawenzi ridge / Zebra Rocks, back to Horombo | ridge about 4,389 |
| 4 | Kibo Hut | about 4,703 |
| 5 | Gilman's Point, Uhuru Peak, then down to Horombo | Gilman's about 5,669 to 5,685; Uhuru 5,895 |
| 6 | Marangu Gate | about 1,843 |

The 5-day version drops day 3.

**Rongai**: 6 or 7 days, from the north.

| Day (7-day) | Stops | m |
|---|---|---|
| 1 | Rongai (Nale Moru) Gate, then Rongai Cave / Simba Camp | gate about 1,950 to 2,020; camp about 2,635 to 2,835 |
| 2 | Second Cave, then Kikelewa Cave | about 3,445; about 3,600 |
| 3 | Mawenzi Tarn | about 4,316 to 4,330 |
| 4 | Acclimatisation day at Mawenzi Tarn | — |
| 5 | Kibo Hut | about 4,703 |
| 6 | Gilman's Point, Uhuru, then Horombo | 5,895; 3,720 (OFFICIAL) |
| 7 | Marangu Gate | about 1,843 |

The 6-day version drops day 4.

**Northern Circuit**: 8, 9 or 10 days.

| Day (9-day) | Stops | m |
|---|---|---|
| 1 | Londorossi Gate, then Mti Mkubwa | about 2,360; about 2,895 |
| 2 | Shira 1 | about 3,505 |
| 3 | Shira 2 | about 3,810 |
| 4 | Lava Tower, then Moir Hut | 4,630; about 4,206 |
| 5 | Buffalo Camp | about 4,023 |
| 6 | Third Cave | about 3,871 |
| 7 | School Hut | about 4,755 |
| 8 | Uhuru Peak, then Mweka Camp | 5,895; about 3,068 |
| 9 | Mweka Gate | about 1,640 |

The 8-day version goes Shira 1 straight to Moir Hut. The 10-day version adds a daytime summit with a night at Barafu.

**Umbwe**: 6 or 7 days, steep and direct.
- Umbwe Gate (about 1,600)
- Umbwe Camp (about 2,900)
- Barranco (3,976); the 7-day version spends an acclimatisation day here
- Karanga (3,995)
- Barafu (4,673)
- Uhuru (5,895), then Mweka Camp (3,068)
- Mweka Gate (1,640)

**Shira**: 7 or 8 days.
- Drive to Shira Gate (about 3,500 to 3,600), so you start high with little acclimatisation; say so on the page
- Simba Camp (about 3,600)
- Shira 2 (about 3,810)
- 8-day version: Moir Hut (about 4,206)
- Lava Tower, then Barranco
- Karanga
- Barafu
- Uhuru, then Mweka Camp
- Mweka Gate

### B2. Mount Meru: authority TANAPA (Arusha National Park)

- **Options:** 3 or 4 days. The 3-day version summits on night 2 and goes all the way down on day 3.
- **4-day plan:**
  - Day 1: Momella Gate (about 1,500) to Miriakamba Hut (about 2,503 to 2,515)
  - Day 2: Saddle Hut (about 3,500 to 3,570), with optional Little Meru (about 3,800)
  - Day 3: Rhino Point, then Socialist Peak (4,562 to 4,566; 4,566 most cited, TO VERIFY with TANAPA), then down to Miriakamba or Saddle Hut
  - Day 4: Momella Gate
- All altitudes are OPERATOR figures.
- **Rangers:** an armed ranger escort is standard practice on Meru (OPERATOR; TO VERIFY as a TANAPA rule).
- **Season:** like Kilimanjaro, about June to October and late December to February (OPERATOR).

### B3. Northern circuit safaris

| Area | Authority | Facts | Season |
|---|---|---|---|
| Serengeti | TANAPA | Area, year founded and UNESCO year are already in seeds (TANAPA, checked 2026-10-15) | All year. The herds move around the year (OPERATOR consensus): southern plains and Ndutu about December to March, with calving peaking around February; western corridor (Grumeti) about June to July; northern Serengeti and Mara crossings about July to October, peaking August to September. Never promise a crossing. |
| Ngorongoro Crater, Ndutu, Olduvai, Empakaai | **NCAA** | NCAA: NCA area 8,292 km²; geopark 12,000 km²; "world's largest unbroken caldera"; Olduvai with the new Olduvai Gorge Museum and the Dr Mary Leakey Living Museum; Ndutu Plains listed as an NCAA attraction (OFFICIAL) | All year. Crater rules (TO VERIFY with NCAA): gates open 06:00 and close 18:00; the descent gate closes 16:00; Seneto road is descent-only and Lerai ascent-only; vehicles out by 18:00; a licensed guide is required. |
| Tarangire | TANAPA | In seeds | Best in the dry season, about June to October |
| Lake Manyara | TANAPA | In seeds | All year |
| Arusha NP | TANAPA | In seeds | All year |

Common combinations, all from Arusha:
- **1 day:** Tarangire*, Arusha NP*, Lake Manyara, Ngorongoro Crater
- **2 days:** Tarangire + Ngorongoro; or Manyara + Ngorongoro (night in Karatu)
- **3 days:** Tarangire, Manyara, Ngorongoro
- **4 days:** Serengeti ×2 + Ngorongoro*
- **5 days:** Tarangire, Serengeti ×2, Ngorongoro
- **6 days:** Tarangire, Manyara, Serengeti ×2, Ngorongoro; or the Ndutu calving version*
- **7 days:** in seeds*
- **8 days:** 7 days + Lake Eyasi or Lake Natron
- **9 to 10 days:** add northern Serengeti (Kogatende area, July to October), often flying back to Arusha

\* already in seeds. Publish no driving times without a source.

### B4. Southern parks: authority TANAPA

| Park | Options | Facts | Season (OPERATOR) |
|---|---|---|---|
| Nyerere | 2 to 4 days, by road or light aircraft from Dar es Salaam or Zanzibar. Activities: boat safari on the Rufiji, game drives, walks. | Created from the Selous Game Reserve in 2019; 30,893 km² (already in seeds from TANAPA). The rest of the Selous Game Reserve still exists (Africa Geographic gives about 20,155 km²); its authority is TO VERIFY (likely TAWA). | June to October; some camps close in the long rains |
| Ruaha | 3 to 5 days, fly-in or by road via Iringa; combines with Nyerere by air | In seeds (TANAPA) | June to October |
| Mikumi | 1 to 2 days from Dar es Salaam | In seeds (TANAPA) | June to October; open all year |

### B5. Zanzibar

| Trip | Duration | Stops | Authority | Facts and season |
|---|---|---|---|---|
| Stone Town walk | half or full day | Old Fort, seafront, Darajani market, former slave market and cathedral, Forodhani | Stone Town Conservation and Development Authority (TO VERIFY); UNESCO 2000 (in seeds) | All year; long rains about April to May |
| Prison Island (Changuu) | half day | boat from Stone Town, giant tortoises, old quarantine buildings; often with Nakupenda sandbank | Government-owned island; entry fee US$4 to 12+ in unofficial sources | Tortoises: Wikipedia and others say the Seychelles governor gave 4 in 1919 (TO VERIFY). All year. |
| Jozani forest | half day | forest trail, Zanzibar red colobus, mangrove boardwalk | Jozani-Chwaka Bay NP, Department of Forestry (TO VERIFY) | All year |
| Spice tour | half day | private spice farm outside Stone Town | private farms | All year |
| Mnemba snorkelling | half or full day | boat from Matemwe or Nungwi to the reef; the island itself is private | **Mnemba Island Marine Conservation Area, Ministry of Blue Economy and Fisheries.** Fees from 1 September 2025: special area US$25 adult / US$10 child (non-EAC), US$10 / US$5 (EAC) (OFFICIAL-SECONDHAND) | Sea conditions vary; check with the boat crew |
| Beaches | stays | north (Nungwi, Kendwa), north-east (Matemwe), east (Paje, Jambiani: big tides), south-west (Kizimkazi: dolphin trips; we must say "do not chase, touch or swim with the dolphins") | Zanzibar Commission for Tourism | Driest about June to October and December to February (OPERATOR) |

### B6. Cultural and day trips around Arusha and Moshi

| Trip | Duration | Stops | Authority | Notes |
|---|---|---|---|---|
| Materuni waterfall and coffee* | 1 day | Moshi, Materuni, waterfall, coffee with a family | village group | Trails are slippery in the rains |
| Chemka (Kikuletwa) hot springs* | 1 day | spring pool south of Moshi | owner or manager TO VERIFY | All year |
| Lake Chala | 1 day | crater lake on the Tanzania–Kenya border in Rombo district; rim walk; kayaking if it is running | TO VERIFY | About 880 m altitude (Wikipedia). **No swimming: a fatal crocodile attack in 2002.** One site says kayaking is under renovation; confirm before listing. |
| Marangu waterfalls and Chagga caves | 1 day | Marangu village, caves, waterfalls | community groups | Already part of the Moshi tour; could be its own trip |
| Kilimanjaro day hike | 1 day | Marangu Gate to Mandara Hut (about 2,700) and Maundi Crater | TANAPA (day permit) | Overlaps with Signature "Walk with a Kili guide" |
| Lake Duluti | half day | forest walk and canoe near Arusha | TO VERIFY | — |

\* already in seeds.

### B7. Ol Doinyo Lengai and Lake Natron

- **Options:**
  - 2 days: Natron only, with waterfall and flamingo walks
  - 3 days (in seeds): adds the Lengai night climb, starting around midnight to reach the top near sunrise
- **Stops:**
  - Arusha, Mto wa Mbu, then Engaresero / Lake Natron
  - Ngare Sero waterfall
  - Flamingo shore
  - Ol Doinyo Lengai summit: **2,962 m** (GVP figure via a mirror; read the GVP page directly before publishing)
- **Authority:** no official source found. Operators list an Engaresero gate charge, a separate Lengai climbing fee and a TAWA wildlife-management fee. Lake Natron Basin is a Ramsar site (in seeds). **Do not label it NCAA.**
- **Activity:** a volcano blog reports renewed activity in 2026, including a lava overflow inside the crater in late May (vulkane.net; not official). Every Lengai page needs a line saying the guide checks current volcanic activity before the climb. Before each season, check the GVP weekly reports.
- **Season:** dry months, about June to October and December to February (OPERATOR). Flamingo breeding varies by year.

---

## Plan, cost and approvals

**Plan**
1. `backend-engineer`: a new migration (do not edit old ones) for conflicts A1 #1 to #6 and #8:
   - set Horombo to 3,720 m now (OFFICIAL)
   - add the Mweka Camp, Lava Tower, Stella Point and Gilman's Point stops
   - fix the Shira 1 and Shira 2 pins
   - mark the other camp altitudes approximate until signboard photos arrive
   - `qa-tester` then checks the climb profiles
2. Marketing writes the A3 trips as drafts flagged `needs_review`, in our own words, with no prices. `localization` handles the 7 languages after Walter approves the English.
3. Fix the place facts: the NCA area and caldera wording (#9, #10), the Lake Chala safety line, and the Mnemba fee note with its source and date.
4. Re-check every TO VERIFY item directly with official pages (UNESCO, GVP, NCAA Visitor Guidelines, KINAPA).

**Cost:** staff time only. No paid tools, ads or travel.

**Waiting for Walter**
- Approve the seed fixes in plan step 1 (they change public trip pages).
- Choose the NCA area figure: NCAA's 8,292 km² or UNESCO's 8,094.4 km².
- Approve asking our guides, through `guide-success`, for dated photos of Kilimanjaro and Meru camp signboards. This means contacting real people, so it needs your OK.
- Decide whether to list Lake Chala and the Lengai climb at all, given the crocodile and volcano risks. If yes, they go out with the safety lines above.
