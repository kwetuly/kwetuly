# Bike and village tours, sample hosts and "Become a host" (draft)

Prepared by guide-success on 2026-10-31 for the board item "2026-10-31 Bike, village and concierge samples", step 1 (c). Paper only: nothing has been changed in the database or on the site, and nobody has been contacted. Walter approves these texts before backend-engineer adds them to the realistic-samples seed draft (new migration only).

Sources: `docs/guides/sample-guides-2026-10-31.md` (the 16 sample guides) and the tour texts in `supabase/migrations/20261016000700_content_cultural_trips_places_news.sql` and `20261015000100_tour_details_seed.sql`.

Same ground rules as the sample-guides draft: every person is invented and keeps the sample label on every card and page; no years of experience, ratings, licences or other achievement claims; no prices (guides and hosts set their own; samples show "Price on request"); no real businesses named; fees are "paid on the day" without amounts.

## 1. Tour-to-sample-guide table

How the tours describe who leads them, which the links must not contradict:

- Mto wa Mbu (`mto-wa-mbu-village-bike`): "The walk or bike tour is run through the village cultural tourism group."
- Ng'iresi (`ngiresi-village-arusha`): "through the Cultural Tourism Programme"; includes a village development fee.
- Lushoto (`lushoto-irente-viewpoint-walk`): "Guided by a local cultural tourism group."
- Materuni and Moshi Chagga: "your local guide" and a Chagga family; no group named.

So on the community-run tours, the sample guide is shown as the person who **plans the day, picks you up and goes along with you**. The village walk or ride itself is led by a guide from the village group. The package texts below say this plainly.

| Tour | Sample guide(s) | Reason |
| --- | --- | --- |
| Mto wa Mbu village and bike (`mto-wa-mbu-village-bike`) | Rehema Qamara | From the Karatu side, close to Mto wa Mbu. Her family-pace safaris fit the tour's note "Easy to combine with a Lake Manyara game drive". She plans the day and goes along; the ride is led by the village group's guide. |
| | Elia Mwakalinga | His birding package already meets in Mto wa Mbu and covers Lake Manyara. He adds birds along the farms and rice fields; the village group's guide leads the route. |
| Ng'iresi village (`ngiresi-village-arusha`) | Daudi Ndosi | Arusha-based day-trip and cultural guide. The tour excludes "Transport from Arusha unless agreed", so he brings guests up from town and goes along; the village programme's local guide leads the farm walk. |
| Materuni waterfall and coffee (`materuni-waterfalls-coffee`) | Witness Mallya | Moshi day-trip guide; her optional package is already the Materuni waterfall walk. |
| | Amani Swai | His bio and package are the Chagga coffee visit with a family on Kilimanjaro, which is the midday part of this tour. |
| Moshi town and Chagga culture (`moshi-chagga-town-tour`) | Amani Swai | Chagga village visits on the lower slopes, which is the afternoon part (Marangu stop). |
| | Grace Kimaro | Moshi market photo walk with consent, which matches the morning town and market walk. |
| Lushoto and Irente (`lushoto-irente-viewpoint-walk`) | None | No sample guide is based in Tanga region, and the tour says a local cultural tourism group guides it. Leave it empty and do not invent one. |

Notes for the build:
- Amani Swai is on two tours. That is fine because both are Moshi day tours.
- "Meet your guides" must show the sample label on every linked sample guide, on web and in the app (frontend-engineer, already on the board).
- Ng'iresi: the tour's "includes" list has the village development fee, while the package below says fees are paid on the day. Walter asked for "paid on the day", so the package says "paid on the day at the village; your guide tells you before booking if it is part of the agreed price". Marketing or whoever re-checks the tour facts should keep the two consistent.

## 2. Bike and village sample packages (3)

No prices (Price on request). Durations and group sizes are typical, not promises.

### A. Rehema Qamara, kind `cultural`
- Title: Mto wa Mbu by bike, at an easy pace
- Summary: Rehema meets you in Karatu or Mto wa Mbu and introduces you to a guide from the village cultural tourism group, who leads the ride through banana farms, rice fields and the market. Rehema rides or walks along with you, keeps the pace easy and helps with questions. Lunch is with a local family. You can walk instead of riding at any time. Village fees are paid on the day to the group. Ask Rehema before booking about bike sizes, child seats and helmets. About 5 hours, up to 6 people. You can add an afternoon in Lake Manyara National Park; park fees are paid separately at the gate.
- Kiswahili summary: Rehema anakutana nawe Karatu au Mto wa Mbu na kukutambulisha kwa mwongozaji wa kikundi cha utalii wa kitamaduni cha kijiji, ambaye anaongoza safari ya baiskeli kupitia mashamba ya migomba, mashamba ya mpunga na sokoni. Rehema anaendesha baiskeli au anatembea pamoja nawe, kwa mwendo wa taratibu. Chakula cha mchana ni na familia ya hapo. Unaweza kutembea badala ya kuendesha baiskeli wakati wowote. Ada za kijiji zinalipwa siku hiyo kwa kikundi. Muulize Rehema kabla ya kuweka nafasi kuhusu ukubwa wa baiskeli, viti vya watoto na kofia ngumu. Takriban saa 5, hadi watu 6.

### B. Elia Mwakalinga, kind `nature`
- Title: Morning ride and birds around Mto wa Mbu
- Summary: An early ride with a guide from the Mto wa Mbu village cultural tourism group, along farm paths, streams and rice fields at the foot of the Rift Valley escarpment. Elia comes with you, brings binoculars and helps you spot and name the birds; you get a list of what you saw at the end. Stops are short and often. Village fees are paid on the day to the group. Ask Elia before booking about bike sizes and helmets. About 4 hours, up to 4 people, meet in Mto wa Mbu.
- Kiswahili summary: Safari ya baiskeli ya asubuhi na mwongozaji wa kikundi cha utalii wa kitamaduni cha kijiji cha Mto wa Mbu, kupitia njia za mashambani, vijito na mashamba ya mpunga chini ya ukuta wa Bonde la Ufa. Elia anaongozana nawe, analeta darubini na anakusaidia kuona na kutaja ndege; mwishoni unapata orodha ya ndege mliowaona. Ada za kijiji zinalipwa siku hiyo kwa kikundi. Takriban saa 4, hadi watu 4, mnakutana Mto wa Mbu.

### C. Daudi Ndosi, kind `cultural`
- Title: Half a day in Ng'iresi village from Arusha
- Summary: Daudi picks you up in Arusha and drives a short way up the slopes of Mount Meru to Ng'iresi. A local guide from the village programme leads the walk past coffee, banana and vegetable farms and explains how families farm the steep slopes. Daudi stays with you the whole time. Lunch is home-cooked with a family. The village fee is paid on the day at the village; Daudi tells you before booking if it is part of the agreed price. About 5 hours, up to 8 people.
- Kiswahili summary: Daudi anakuchukua Arusha na mnapanda kidogo mlima Meru hadi Ng'iresi. Mwongozaji wa ndani wa programu ya kijiji anaongoza matembezi kupitia mashamba ya kahawa, migomba na mbogamboga, na anaeleza jinsi familia zinavyolima kwenye miteremko. Daudi yuko nawe muda wote. Chakula cha mchana kinapikwa nyumbani na familia. Ada ya kijiji inalipwa siku hiyo kijijini; Daudi atakuambia kabla ya kuweka nafasi kama imo kwenye bei mliyokubaliana. Takriban saa 5, hadi watu 8.

Daudi drives in text C. That is an existing day trip with a guide, not a host transfer service. If legal decides that guide driving also needs checking, change it to "meets you in Arusha".

## 3. Two sample hosts (invented)

Service type values are proposals (`personal_trip_host`, `investment_visit_host`). tech-lead decides how they fit the planned guide service types (P-a). Same nulls as the sample guides: no years, certifications, association or check dates, and no "verified" wording.

### Name checks (web search, 2026-10-31)

| Name | Result | Note |
| --- | --- | --- |
| Nasra Mbaga | No full-name match | A student named Nasra (surname not given) appears on a charity page; no travel business called Mbaga or Nasra found. "Halima Kisanga" dropped: Kisanga is the surname of a well-known late judge. |
| Erasto Kitomari | No full-name match | No business called Kitomari found (a different company, "Kitano Tours", came up). "Erasto Kileo" dropped: a former regional commissioner and other public figures carry the Kileo name. Avoided "Erasto Mollel": a real safari guide uses that name. |

### Host 1: Nasra Mbaga (woman, Arusha and Moshi), personal trip host
- Headline: Personal trip host for private, quiet visits
- Bio: I plan and go along on private trips for visitors who want one person to look after the details: the plan for each day, introductions to guides on Kwetuly, markets, meals and quiet time when you need it. I keep your plans and personal details private and share them only with the people your trip needs. I do not drive, and I do not offer security or bodyguard work. If you need either, I tell you so before you book.
- Kiswahili bio: Ninapanga na kuongozana na wageni wanaotaka safari ya faragha, wanaohitaji mtu mmoja wa kushughulikia mambo yote: ratiba ya kila siku, kuwatambulisha kwa waongozaji walio kwenye Kwetuly, masoko, milo na muda wa kupumzika. Ninatunza siri ya mipango na taarifa zako binafsi, na ninazishirikisha tu kwa watu wanaohitajika kwa safari yako. Siendeshi gari na sitoi huduma ya ulinzi au mlinzi binafsi. Ukihitaji mojawapo, nitakuambia kabla ya kuweka nafasi.
- Languages: en, sw, fr
- Sample package (kind `other`): "A day planned around you". We agree the day before you arrive: who you meet, where you go and when you rest. I go along all day and introduce you to the guides you book on Kwetuly. Entry fees are paid on the day. Up to 4 people.

### Host 2: Erasto Kitomari (man, Dar es Salaam), investment visit host
- Headline: Visit days for people exploring business in Tanzania
- Bio: I help visitors who come to look at business in Tanzania plan their days: a schedule around the meetings you set up, getting around the city, Kiswahili and English on the day, and introductions to places such as markets, business areas and guides on Kwetuly. For anything official I point you to government websites only. I do not give investment, legal or tax advice. I do not promise permits, approvals or speed, and I never handle payments to officials or anyone else for you. For advice, please use your own advocate or adviser.
- Kiswahili bio: Ninawasaidia wageni wanaokuja kuangalia biashara Tanzania kupanga siku zao: ratiba kulingana na mikutano wanayoipanga wenyewe, kuzunguka mjini, Kiswahili na Kiingereza siku hiyo, na kuwatambulisha kwa maeneo kama masoko, maeneo ya biashara na waongozaji walio kwenye Kwetuly. Kwa mambo yote ya kiserikali, ninawaelekeza kwenye tovuti rasmi za serikali tu. Sitoi ushauri wa uwekezaji, sheria wala kodi. Siahidi vibali, idhini wala kasi, na sishughulikii malipo kwa maafisa au mtu yeyote kwa niaba yako. Kwa ushauri, tumia wakili au mshauri wako mwenyewe.
- Languages: en, sw
- Official links shown with this profile (legal to confirm each before use): TISEZA, Tanzania Investment and Special Economic Zones Authority (tiseza.go.tz, formed in 2025 from TIC and EPZA); BRELA (brela.go.tz); Immigration (immigration.go.tz); TRA (tra.go.tz).
- Sample package (kind `other`): "Two visit days in Dar es Salaam". You send me the meetings you have arranged and I plan the two days around them, with time to see the city in between. I go along, help with Kiswahili and keep the day on time. This is logistics only, not advice. Up to 3 people.

## 4. "Become a host" page draft

Button colour is brand green, no arrows, no all caps. Points marked [legal] or [hr] wait for those agents' step 1 answers.

### English

# Become a host with Kwetuly

Some visitors want one trusted person to plan their days and introduce them to the right people. As a Kwetuly host, you do that work at the price you set yourself.

## Two kinds of host
- **Personal trip host**: you plan and go along on private, quiet trips. You plan each day, introduce visitors to guides on Kwetuly and keep their personal details private.
- **Investment visit host**: you help visitors who come to look at business in Tanzania with schedules, getting around, language and introductions. You point them to official government websites only. You do not give investment, legal or tax advice, and you never promise permits, approvals or speed.

## What Kwetuly does not offer
- Security, close protection or bodyguard work is not offered through Kwetuly. Please do not list it on your profile.
- For now, driving and transfers are not part of the host service. [legal]
- No payments to officials and no promised results, ever.

## How it works
1. Sign up in the same five steps as our guides: About you, What you do, Documents, Story and links, Prep calls.
2. Kwetuly reviews and approves each applicant one by one. Not every application is accepted.
3. Once approved, you add your services. Kwetuly approves each one before it appears.
4. You set your own price. Kwetuly's share is explained clearly before you agree.

## Good to know
- We do not promise income or a number of bookings.
- Upload documents only in the secure Documents step. Never send ID or documents by WhatsApp, email or message.
- Hosts follow the Kwetuly code of conduct: keep visitors' details private, no gifts that create obligations and no side deals. [hr]
- Some host work may need a licence. We tell you what we check and when. [legal]

Button: Apply to become a host

### Kiswahili

# Kuwa mwenyeji wa Kwetuly

Baadhi ya wageni wanataka mtu mmoja wa kuaminika wa kupanga siku zao na kuwatambulisha kwa watu sahihi. Ukiwa mwenyeji wa Kwetuly, unafanya kazi hiyo kwa bei unayoiweka mwenyewe.

## Aina mbili za wenyeji
- **Mwenyeji wa safari binafsi**: unapanga na kuongozana na wageni katika safari za faragha na tulivu. Unapanga kila siku, unawatambulisha kwa waongozaji walio kwenye Kwetuly na unatunza siri ya taarifa zao binafsi.
- **Mwenyeji wa ziara za uwekezaji**: unawasaidia wageni wanaokuja kuangalia biashara Tanzania kwa ratiba, kuzunguka, lugha na kuwatambulisha. Unawaelekeza kwenye tovuti rasmi za serikali tu. Hutoi ushauri wa uwekezaji, sheria wala kodi, na huahidi kamwe vibali, idhini wala kasi.

## Kile ambacho Kwetuly haitoi
- Kazi ya ulinzi au mlinzi binafsi haitolewi kupitia Kwetuly. Tafadhali usiiweke kwenye wasifu wako.
- Kwa sasa, kuendesha gari na kusafirisha wageni si sehemu ya huduma ya mwenyeji. [legal]
- Hakuna malipo kwa maafisa, na hakuna ahadi ya matokeo, kamwe.

## Jinsi inavyofanya kazi
1. Jisajili kwa hatua tano zile zile za waongozaji: Kuhusu wewe, Unachofanya, Nyaraka, Hadithi na viungo, Simu za maandalizi.
2. Kwetuly inakagua na kuidhinisha kila mwombaji mmoja mmoja. Si kila ombi linakubaliwa.
3. Ukikubaliwa, unaongeza huduma zako. Kwetuly inaidhinisha kila huduma kabla haijaonekana.
4. Unaweka bei yako mwenyewe. Sehemu ya Kwetuly inaelezwa wazi kabla hujakubali.

## Ni vizuri kujua
- Hatuahidi kipato wala idadi ya wageni.
- Pakia nyaraka kwenye hatua salama ya Nyaraka tu. Usitume kamwe kitambulisho au nyaraka kwa WhatsApp, barua pepe au ujumbe.
- Wenyeji wanafuata kanuni za maadili za Kwetuly: kutunza siri za wageni, kutopokea zawadi zinazoleta deni la fadhila, na kutofanya makubaliano ya pembeni. [hr]
- Baadhi ya kazi za mwenyeji zinaweza kuhitaji leseni. Tutakuambia tunachokagua na lini. [legal]

Kitufe: Omba kuwa mwenyeji

The Kiswahili step names should match the app dictionary. "Simu za maandalizi" is confirmed in `packages/shared/src/menu.ts`; localization checks the other four.

## What Walter should approve

1. The tour-to-guide table, including Lushoto left empty and the "guide goes along, village group leads" wording.
2. Packages A, B and C. Also choose how the Ng'iresi fee is described: "paid on the day" against the tour's "includes" list.
3. The two invented hosts (Nasra Mbaga, Erasto Kitomari): names, bios and the two host sample packages.
4. The "Become a host" page in English and Kiswahili, to be finished after legal and hr fill in the marked points.

Nothing needs to be sent to anyone. After approval, the texts go to backend-engineer (seed draft) and frontend-engineer (page).
