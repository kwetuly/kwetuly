# Trip fact fixes, 2026-10-31

What the draft migration `supabase/migrations/20261031000100_trip_facts_fixes.sql` changes in the 35 draft tours. **It has not been applied.** It does not publish anything and leaves `needs_review` on. Publishing comes later as a separate step, after review and Walter's OK.

Source for every change: `docs/marketing/trip-library-facts.md` (checked 2026-10-30). The grade is shown as OFFICIAL, OFFICIAL-SECONDHAND or OPERATOR. The live rows were read on 2026-10-31 with read-only queries. They match the seed migrations.

Rule for altitudes: if TANAPA gives a figure, we use it. Where only operators give figures, we store the low end of the range in the facts doc as an approximate value. Tour pages already show altitudes with "≈". The admin-only stop note records the source and says to confirm from a dated signboard photo.

## Per trip

### kilimanjaro-machame-7-days
| What | Old | New | Source |
|---|---|---|---|
| Machame Camp altitude | 2,589 m | 2,835 m (approx.) | OPERATOR, A1 #1 |
| Shira Cave Camp altitude | 2,991 m | 3,750 m (approx.) | OPERATOR, A1 #1 |
| Barranco Camp altitude | 4,053 m | 3,976 m (approx.) | OPERATOR, A1 #1 |
| Karanga Camp altitude | 4,468 m | 3,995 m (approx.) | OPERATOR, A1 #1 |
| Barafu Camp altitude | 4,580 m | 4,673 m (approx.) | OPERATOR, A1 #1 |
| Mweka Gate altitude | 1,560 m | 1,640 m (approx.) | OPERATOR, A1 #1 |
| New stop: Lava Tower, day 3 | none | 4,630 m (approx.) | OPERATOR, A1 #6, B1 |
| New stop: Stella Point, day 6 | none | no altitude (none in facts doc) | A1 #6 |
| New stop: Mweka Camp, day 6 | none | 3,068 m (approx.) | OPERATOR, A1 #6 |
| Day 6 text | "...to Uhuru Peak, descend to Mweka Camp." | "...to Uhuru Peak via Stella Point, descend to Mweka Camp." | B1 |

### kilimanjaro-lemosho-8-days
| What | Old | New | Source |
|---|---|---|---|
| Londorossi Gate altitude | 1,380 m | 2,250 m (approx.) | OPERATOR, A1 #1 |
| Shira 1 Camp altitude | 3,767 m | 3,505 m (approx.) | OPERATOR, A1 #2 (the profile no longer goes down) |
| Shira 2 Camp altitude | 3,676 m | 3,810 m (approx.) | OPERATOR, A1 #2 |
| Barranco, Karanga, Barafu, Mweka Gate | as Machame | as Machame | OPERATOR, A1 #1 |
| New stops: Lava Tower (day 4), Stella Point and Mweka Camp (day 7) | none | as Machame | A1 #6 |
| Day 7 text | "...descend to Mweka." | "...via Stella Point, descend to Mweka Camp." | B1 |

### kilimanjaro-marangu-6-days
| What | Old | New | Source |
|---|---|---|---|
| Horombo Hut altitude | 3,903 m | **3,720 m** | **OFFICIAL, TANAPA** |
| Mandara Hut altitude | 2,317 m | 2,700 m (approx.) | OPERATOR, A1 #1 |
| Kibo Hut altitude | 4,517 m | 4,703 m (approx.) | OPERATOR, A1 #1 |
| New stop: Mawenzi ridge (acclimatisation walk), day 3 | none | 4,389 m (approx.) | OPERATOR, A1 #8 |
| New stop: Gilman's Point, day 5 | none | 5,669 m (approx.; sources give 5,669 to 5,685) | OPERATOR, A1 #8 |

### mount-meru-4-days
| What | Old | New | Source |
|---|---|---|---|
| Highlight | "Socialist Peak at 4,566 m" | "Socialist Peak, about 4,560 m" | A1 #3: sources give 4,562 to 4,566; TANAPA not reachable |
| Socialist Peak stop altitude | 4,510 m | 4,560 m (approx.) | A1 #3: one figure everywhere |
| Miriakamba Hut altitude | 2,412 m | 2,503 m (approx.) | OPERATOR, A1 #4 |
| Saddle Hut altitude | 3,163 m | 3,500 m (approx.) | OPERATOR, A1 #4 |
| Good to know | "...Kilimanjaro National Park permits..." | "...Arusha National Park permits..." | B2: Meru is in Arusha National Park (TANAPA) |

### ol-doinyo-lengai-natron-3-days
| What | Old | New | Source |
|---|---|---|---|
| Good to know | "...Kilimanjaro National Park permits are arranged by your operator." | "Climbs are led by licensed guides; your operator arranges any permits and local fees." | B7: not a national park and not NCAA; no official authority found, so none is named |
| Good to know, new safety line | none | "Ol Doinyo Lengai is an active volcano. Your guide checks the latest volcanic activity before every climb and will cancel or turn back if it is not safe." | B7 (activity reported in 2026) |

### chemka-hot-springs (Chemka and Kikuletwa duplicate)
| What | Old | New | Source |
|---|---|---|---|
| title_en | Chemka Hot Springs | Chemka (Kikuletwa) Hot Springs | A1 #11: same springs |
| title_sw | Chemchemi za Maji Moto Chemka | Chemchemi za Maji Moto Chemka (Kikuletwa) | A1 #11 (place name only) |
| Stop name | Chemka hot springs | Chemka (Kikuletwa) hot springs | A1 #11 |

**Duplicate:** there is no separate Kikuletwa trip in `public.trips`, so nothing is merged or archived. The one other trip that visits the springs, `signature-guides-day-off`, is already archived. The sample guide package "Chemka hot springs and village lunch" is a guide package, not a trip, so it was left alone.

### migration-calving-safari-6-days
| What | Old | New | Source |
|---|---|---|---|
| best_time_note | empty | "Calving usually runs from about late January to March, peaking around February, and the herds are often on the southern plains from about December. Timing shifts with the rains, so nobody can guarantee it." | OPERATOR consensus, A1 #14, B3 |
| best_months | {1,2,3} | unchanged | Adding December is optional in the facts doc; left for Walter |

### zanzibar-beach-mnemba-4-days and safari-zanzibar-9-days
| What | Old | New | Source |
|---|---|---|---|
| Good to know, new line | no fee mentioned | Mnemba conservation area fee from 1 September 2025: US$25 per adult and US$10 per child (non-EAC); US$10 / US$5 (EAC), with the source named and "check the current fee" | OFFICIAL-SECONDHAND (Ministry of Blue Economy and Fisheries via The Citizen), A1 #17 |

### Unproven claims removed (Walter, 2026-10-31: cautious path)
| Trip | What | Old | New |
|---|---|---|---|
| nyerere-boat-walking-4-days | summary_en | "Africa's largest national park: boat safaris..." | "A big wilderness park in southern Tanzania: boat safaris..." |
| nyerere-boat-walking-4-days | summary_sw | "Hifadhi kubwa zaidi Afrika: ..." | "Hifadhi kubwa ya porini kusini mwa Tanzania: ..." |
| mount-meru-4-days | highlight | "Armed ranger escort past giraffe and buffalo" | removed |
| mount-meru-4-days | day 1 text (English only) | "Walk through wildlife areas with a ranger." | "Walk up through the forest and open glades of the lower slopes." |
| signature-walk-with-a-kili-guide | highlight | "Stories from 300+ summits" | removed |
| signature-walk-with-a-kili-guide | summary_en | "...with a guide who has stood on the summit hundreds of times..." | "...with a licensed Kilimanjaro guide..." |
| signature-walk-with-a-kili-guide | summary_sw | "...mwongozaji aliyefika kileleni mamia ya mara..." | "...mwongozaji mwenye leseni..." |

Each WHERE clause matches the live text exactly (checked with read-only SELECTs on 2026-10-31). If someone edits the text first, the row is left alone. Meru has no ranger claim in its Kiswahili columns. Localization should check the two new Kiswahili summaries.

The other 24 draft trips need no change.

## Publish step (separate draft)
`supabase/migrations/20261031000200_publish_tours.sql` sets status to `published` (the enum is draft, published, archived) and `needs_review` to false. It touches exactly the 35 draft slugs and only while they are still draft. If the count is not 35, it fails and changes nothing. The two archived trips are not touched. Apply it only after the fixes migration has been applied and checked, and only with Walter's OK.

## Counts
- 11 of the 35 draft trips changed: Machame, Lemosho, Marangu, Meru, Lengai, Chemka, calving safari, Zanzibar beach + Mnemba, Safari + Zanzibar, Nyerere, Signature Kili walk. 24 are unchanged.
- 3 unproven claims removed (Nyerere superlative, Meru armed ranger escort, "300+ summits"), in English and Kiswahili where present.
- 19 stop altitudes corrected (1 OFFICIAL, 18 approximate OPERATOR).
- 7 new stops (Lava Tower ×2, Stella Point ×2, Mweka Camp ×2, Mawenzi ridge, Gilman's Point).
- 1 title corrected in English and Kiswahili. 0 trips archived (there is no duplicate trip). 0 deletions.
- 4 new or replaced good-to-know lines (Meru park, Lengai fees, Lengai volcano safety, Mnemba fee ×2 trips).

## For localization
Trips only have `_en` and `_sw` columns for title and summary. Highlights, itinerary and good-to-know are English only. No Kiswahili column had a wrong number. These new English lines need translating once the 7-language model for trip text exists:
- Lengai volcano safety line, and the Lengai permits line
- Mnemba fee line
- Calving best-time note
- "Socialist Peak, about 4,560 m" and the two summit-day texts that now say "via Stella Point"

## Not verified, so left unchanged (flagged)
1. **Map pins of the 7 new stops** are rough positions between the existing pins. The facts doc has no coordinates. qa-tester or an admin should check them in /admin/trips.
2. **Shira 1 and Shira 2 pins.** The facts doc says to move them but gives no coordinates. Only the altitudes were fixed.
3. **Ol Doinyo Lengai altitude.** It stays at 2,921 m (terrain data). The facts doc says to use 2,962 m only after reading the GVP page directly, and that page returned 403.
4. **Machame Gate** (1,860 m) and **Momella Gate** (1,525 m), **Marangu Gate** (1,881 m), **Mti Mkubwa** (2,643 m): already within or close to the operator ranges, or sources disagree (Machame Gate 1,640 vs 1,800). Left as they are.
5. **Stella Point altitude**: the facts doc gives none, so it is left empty. The climb profile skips stops that have no altitude.
6. Meru ranger, Nyerere superlative, "300+ summits": now removed (see above).
7. **Similar claims not in scope this round**, left as they are:
   - Arusha NP day summary says "Walking safari with an armed ranger".
   - Nyerere highlight says "Walking safari with an armed ranger".
   - Tarangire summary says "some of the largest elephant herds in northern Tanzania".
   - The Signature walk title says "Kilimanjaro Veteran" (Kiswahili "Mkongwe"), and its promo says "Our founder's favourite way to prepare climbers".
   Walter decides whether they get the same cautious treatment before publishing.
9. **Lake Chala safety line**: no Lake Chala trip exists among the 35, so there is nothing to change. The "no swimming" line must go into the new Lake Chala draft if Walter decides to list it.
10. **Places, not trips**: the Ngorongoro area (NCAA 8,292 km² vs UNESCO 8,094.4 km², waiting for Walter's choice) and the caldera wording (A1 #9, #10) are in `public.places`, not these trips. They are left for a separate places fix.
11. **Lemosho Moir Hut variant, Marangu return night at Horombo, Meru Little Meru and Rhino Point**: these are optional or not marked as errors in the facts doc. No stops added for them.
12. **Camp altitudes in general** are operator figures. The facts doc recommends dated signboard photos from our guides, which needs Walter's OK to contact guides.
