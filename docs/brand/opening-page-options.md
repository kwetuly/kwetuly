# Opening page: wording options

Status: draft by marketing, 2026-11-08. Nothing here is live. Walter chooses one option, and Walter checks every Kiswahili line. After that, localization writes the other 5 languages and frontend changes the dictionaries. This document does not change `en.ts`, `sw.ts` or `extras.ts`.

Follows `docs/brand/voice.md`. All three options:
- lead with local people
- invite rather than order
- avoid "best" and other hype
- name no service that is switched off (drivers appear as people, and transfers are not offered)
- add no facts, numbers, partners or reviews
- use no all caps and no arrows on buttons

Phone fit (375px hero): the target is a headline of about 40 characters or fewer and a sub-line of about 130 characters or fewer. Counts below are approximate. Designer confirms on a real 375px screen.

## Option A: "Travel with the people of Tanzania" (local people in the headline, guide as the way in)

| Part | English | Kiswahili (draft) |
| --- | --- | --- |
| Eyebrow | Karibu Tanzania | Karibu Tanzania |
| Headline | Travel with the people of Tanzania. (35) | Karibu usafiri na watu wa Tanzania. (36) |
| Sub-line | Local guides, porters, cooks, hosts and shop owners. Start with your guide: meet them first, then decide. (~104) | Waongozaji, wapagazi, wapishi, wenyeji na wenye maduka wa hapa. Karibu uanze na mwongozaji wako: mfahamu kwanza, kisha uamue. (~125) |
| Button | Meet your guide | Mfahamu mwongozaji wako |
| Tagline (app intro, footer) | Travel with the people of Tanzania | Safari pamoja na watu wa Tanzania |

Why: the headline is about local people, as Walter asked. The guide is still the first step and the main button, so the product and the slogan do not change.

## Option B: "Karibu kwetu" (warm welcome, guide as the way in)

| Part | English | Kiswahili (draft) |
| --- | --- | --- |
| Eyebrow | Karibu Tanzania | Karibu Tanzania |
| Headline | Karibu kwetu. You are our guest. (32) | Karibu kwetu. Wewe ni mgeni wetu. (33) |
| Sub-line | Local guides, porters, cooks, hosts and shop owners welcome you. Meet your guide first, then decide. (~100) | Waongozaji, wapagazi, wapishi, wenyeji na wenye maduka wanakukaribisha. Mfahamu mwongozaji wako kwanza, kisha uamue. (~115) |
| Button | Meet your guide | Mfahamu mwongozaji wako |
| Tagline (app intro, footer) | Local people welcoming you | Wenyeji wanakukaribisha |

Why: this option is the most polite and the most Tanzanian. "Karibu kwetu" means "welcome to our place", and it echoes the name Kwetuly. The risk is that first-time visitors may not know what the site does until they read the sub-line.

## Option C: keep the slogan, put local people in the sub-line (guide-first headline)

| Part | English | Kiswahili (draft) |
| --- | --- | --- |
| Eyebrow | Karibu Tanzania | Karibu Tanzania |
| Headline | Tanzania is only as good as your guide. So choose yours. (56, current) | Safari yako inategemea mwongozaji wako. Karibu umchague. (~57; current is "Safari yako ni nzuri kama mwongozaji wako. Basi chagua wako.") |
| Sub-line | Your guide leads, and local porters, cooks, drivers and hosts make the trip. Meet your guide first, then decide. (~112) | Mwongozaji wako anakuongoza, na wapagazi, wapishi, madereva na wenyeji wa hapa wanafanikisha safari. Mfahamu kwanza, kisha uamue. (~129) |
| Button | Meet your guide | Mfahamu mwongozaji wako |
| Tagline (app intro, footer) | Local guides first. Local people always. | Waongozaji wa hapa kwanza, wenyeji siku zote. |

Why: this option keeps the positioning that is already approved, and it changes the least. The headline is long on a 375px phone (about 3 to 4 lines), and it is not locals-first.

## "Who we are for" lines (same in every option)

These would be new lines under the hero, so frontend needs new keys for them.

| For | English | Kiswahili (draft) |
| --- | --- | --- |
| Travellers | For guests who would like to meet the people behind their trip. | Kwa wageni ambao wangependa kuwafahamu watu wanaowezesha safari yao. |
| Guides | For Tanzanian guides building their own name. Karibu. | Kwa waongozaji wa Tanzania wanaojenga jina lao wenyewe. Karibuni. |
| Porters and cooks | Porters and cooks: we name you and thank you on every trip. | Wapagazi na wapishi: tunawataja kwa majina na kuwashukuru katika kila safari. |
| Hosts and shop owners | For local hotel, homestay, apartment and shop owners. Listing is free. | Kwa wenye hoteli, nyumba za wageni, apartments na maduka wa hapa. Kuweka tangazo ni bure. |

Notes:
- Porters and cooks cannot open accounts today. They appear in guides' job posts only. Their line therefore promises respect, not a service. Walter chooses between "wapagazi" and "wagumu".
- Drivers have no "who we are for" line, because transfers are switched off. Add one only when Walter switches transport on.
- "Listing is free" comes from Walter's approved business model of 2026-10-15. The paid badge is separate and is not mentioned here.
- Kiswahili for "apartment" needs Walter's word: "apartments" as used in Tanzania, or "nyumba za kupangisha".

## Every current line each option replaces

Current text is from `packages/shared/src/dictionaries/en.ts` and `sw.ts`. "Keep" means the line stays as it is today.

| Key | Current EN | Current SW | Option A | Option B | Option C |
| --- | --- | --- | --- | --- | --- |
| `home.eyebrow` | Karibu Tanzania | Karibu Tanzania | Keep | Keep | Keep |
| `home.title` | Tanzania is only as good as your guide. So choose yours. | Safari yako ni nzuri kama mwongozaji wako. Basi chagua wako. | A headline | B headline | Keep |
| `home.subtitle` | Every safari, climb and day trip comes down to one person. Meet that person first: see what Kwetuly checked and read real reviews, ask them anything, then decide. | Kila safari, kupanda mlima na matembezi ya siku hutegemea mtu mmoja. Mfahamu kwanza: angalia Kwetuly ilichokagua na maoni halisi, muulize chochote, kisha uamue. | A sub-line | B sub-line | C sub-line |
| `home.search` | Meet your guide | Mfahamu mwongozaji wako | Keep | Keep | Keep |
| `home.forGuidesTitle` | Are you a guide? | Je, wewe ni mwongozaji? | Are you a guide? Karibu. / Je, wewe ni mwongozaji? Karibu. | same as A | same as A |
| `home.forGuidesBody` | Your reviews should follow you, not your employer. ... Basic membership is free for approved guides. | Maoni yako yanapaswa kukufuata wewe, ... | Keep | Keep | Keep |
| `home.forGuidesCta` | Start building your name | Anza kujenga jina lako | Keep | Keep | Keep |
| `home.whyTitle` | Why Kwetuly | Kwa nini Kwetuly | Keep | Keep | Keep |
| `home.hook` | Most travellers book a company. The best trips are made by a guide. | Wasafiri wengi huchagua kampuni. Safari bora hufanywa na mwongozaji. | Most travellers book a company. But a trip is made by a guide and a local team. / Wasafiri wengi huchagua kampuni, lakini safari hutegemea mwongozaji na timu yake ya wenyeji. | same as A | same as A |
| `home.story` | Most travellers meet their guide on the first morning... | Wasafiri wengi hukutana na mwongozaji wao... | Keep | Keep | Keep |
| `home.why` (4 items) | Meet your guide before you pay; See what Kwetuly checked; Reviews that belong to the guide; Speak your language | (sw equivalents) | Keep | Keep | Keep |
| `home.afconBody` | Match-day transfers, city tours and day trips with local guides. Coming soon. | Usafiri wa siku za mechi, ziara za mji na safari za siku moja na waongozaji wa ndani. Inakuja hivi karibuni. | City tours and day trips with local guides. Coming soon. / Ziara za mjini na safari za siku moja pamoja na waongozaji wa hapa. Huduma hii inakuja hivi karibuni. | same as A | same as A |
| `home.afconTitle`, `home.afconDates` | AFCON 2027 is coming to Tanzania; 19 June – 17 July 2027 | (sw equivalents) | Keep (data-analyst or marketing re-checks the dates against the official CAF source before launch) | Keep | Keep |
| New: "who we are for" (4 lines) | none | none | Add | Add | Add |
| `intro.welcome` | Karibu! Welcome to | Karibu | Keep | Keep | Keep |
| `intro.tagline` | The home of Tanzanian guides | Nyumbani kwa waongozaji wa Tanzania | A tagline | B tagline | C tagline |
| `intro.s3Body` | ...safe deposits with mobile money or card... | ...amana salama kwa pesa za simu au kadi... | Keep only if deposits are on at launch. If not, remove the deposits part. | same as A | same as A |
| `footer.tagline` | The home of Tanzanian guides. | Nyumbani kwa waongozaji wa Tanzania. | A tagline, with a full stop | B tagline, with a full stop | C tagline |
| `auth.welcomeTitle` | Welcome to Kwetuly! | Karibu Kwetuly! | Karibu Kwetuly! (EN too) / Karibu Kwetuly! | same as A | same as A |
| `auth.welcomeBody` | One last step: tell us how you will use Kwetuly and how we can reach you. | Hatua ya mwisho: tuambie utakavyotumia Kwetuly na jinsi ya kukufikia. | Thank you for joining. One last step, please: tell us how you will use Kwetuly and how we can reach you. / Asante kwa kujiunga. Imebaki hatua moja tu: tafadhali tueleze utakavyotumia Kwetuly na jinsi tunavyoweza kuwasiliana nawe. | same as A | same as A |

## Marketing's recommendation

**Option A.** It does what Walter asked, because the first words are about the people of Tanzania. It keeps guide-first as the way in, it is the shortest on a phone, and it keeps the slogan for campaigns. Option B is the warmest, and it could be the tagline under A if Walter likes "Karibu kwetu".

## How we will know it works

These PostHog events already exist. Compare the 2 weeks before the change with the 2 weeks after:
- home visits to `guideViewed` (are people still taking the guide way in?)
- `guideViewed` to `enquiryStarted`
- `signupStarted`

Traffic is small, so treat this as a direction, not proof. There is no A/B test at this stage.

## Cost

Nothing to buy. The work is time from localization (5 more languages), frontend (dictionary edits, plus new keys for the "who we are for" lines) and designer (check the 375px hero).

## Waiting for Walter

1. Choose option A, B or C, or a mix.
2. Check and correct every Kiswahili line.
3. Choose "wapagazi" or "wagumu", and the Kiswahili word for "apartment".
4. Approve the voice guide (`docs/brand/voice.md`).
5. Approve the fixes for lines that break the rules today: `home.afconBody` (transfers), `home.hook` ("best"), and `intro.s3Body` (deposits).

## Conversion review

By conversion, 2026-11-08. English only; Kiswahili is reviewed separately. Recommendations only; nothing has been changed in code or dictionaries.

The 5-second test asks: on a phone, from the eyebrow, headline, sub-line and button alone, does a first-time traveller know (1) what Kwetuly is and (2) that the next step is to meet and choose a guide? Two things on the page help every option. The hero form already has "specialty" and "language" choices next to the button (`apps/web/src/components/guide-search.tsx`), and those choices say "guides" on their own. Also, the button `home.search` "Meet your guide" stays the same in A, B and C.

One thing to know before choosing: `home.title` and `home.subtitle` are also the page title and search/share description (`apps/web/src/app/[lang]/page.tsx` line 23, `apps/web/src/app/[lang]/layout.tsx` line 30, and the `/guides` page description in `apps/web/src/app/[lang]/guides/page.tsx` line 16). Whatever headline and sub-line Walter picks will also be what people see in Google and in WhatsApp link previews. That matters more for B, and for any sub-line that does not say "guide".

### Option A: "Travel with the people of Tanzania."

- 5 seconds: mostly yes. The headline says who, not what, so a visitor could read it as a tour company or a culture-tour site. The sub-line and button fix that within one more line: "Start with your guide" plus "Meet your guide".
- Drop-off risk: low to medium. The sub-line opens with five roles, so the first thing a visitor reads under the headline is a list, and "meet them first" is unclear about who "them" is. Listing porters and shop owners so near the button could also suggest you can book them here. Porters cannot open accounts, so that would be a promise we cannot keep.
- Proof lost: the current sub-line says "see what Kwetuly checked and read real reviews, ask them anything". This is the only trust line above the fold, and A drops it. Keep at least "see what Kwetuly checked". It answers the main worry ("can I trust a guide I found online?") right next to the decision.
- Headline and button: they fit. "Travel with the people" leads to "Meet your guide" if the sub-line names the guide first.

### Option B: "Karibu kwetu. You are our guest."

- 5 seconds: no, for most first-time visitors. The headline has no product word (no guide, no trip, no Tanzania), and two of its words are Kiswahili that many visitors will not know yet. The eyebrow is already "Karibu Tanzania", so the page says "Karibu" twice before saying anything about what it does. "You are our guest" could also be read as a hotel or homestay.
- Drop-off risk: highest of the three, and worst in search results and link previews, where "Kwetuly — Karibu kwetu. You are our guest." tells a stranger nothing.
- Headline and button: they do not match. Going from "You are our guest" to "Meet your guide" asks the visitor to make the link.
- Best use: as a warm line somewhere else, for example `auth.welcomeTitle`, the app intro, or under the "who we are for" lines. Not as the headline.

### Option C: keep "Tanzania is only as good as your guide. So choose yours."

- 5 seconds: yes, the clearest of the three. "Choose yours" and "Meet your guide" are the same idea, so headline and button match best.
- Drop-off risk: low for understanding. The cost is length: 3 to 4 lines on a 375px phone, which pushes the form and button down on small screens. It also does not do what Walter asked, because local people only appear in the sub-line.
- Note: the C sub-line names drivers next to "make the trip". Drivers are people, not a service here, and the line is fine, but keep it that way and do not say "book".

### Recommendation: Option A, with one sub-line change

I agree with marketing on A. It meets Walter's request, has the shortest headline on a phone, and keeps the button the same. Make one change so the guide comes first and the trust line comes back:

| Part | Marketing's A | Suggested |
| --- | --- | --- |
| Headline | Travel with the people of Tanzania. | No change |
| Sub-line | Local guides, porters, cooks, hosts and shop owners. Start with your guide: meet them first, then decide. | Meet a local guide first: see what Kwetuly checked, ask anything, then decide. Porters, cooks and hosts welcome you too. (~120) |
| Button | Meet your guide | No change |

Why: the first words under the headline are now the action the button repeats ("Meet a local guide" leads to "Meet your guide"). "See what Kwetuly checked" brings back proof next to the decision. Local people are still named, as people who welcome the guest, not as services to book. Shop owners already have their own "who we are for" line just below. If Walter wants them in the hero too: "...Porters, cooks, hosts and shop owners welcome you too." (~133, slightly over the 130 target; designer checks it at 375px).

Smaller notes:
- Use B's "Karibu kwetu" only outside the hero, as marketing suggests. Do not join it to A's headline, because that brings back B's problem.
- The tagline "Travel with the people of Tanzania" (app intro, footer) is fine. It sits on screens where the visitor already knows what Kwetuly is.
- No A/B test, as asked. Marketing's before/after check is enough at this traffic. Add one guardrail: the share of home visits that use the hero form (submit to `/guides`), so we can see whether the new headline loses people before the first click. Expected effect on home-to-`guideViewed`: roughly neutral, between a few percent down and a few percent up. With current traffic we will not be able to tell which. The real risk to watch for is a clear drop, which would point to the headline being too vague.

## Kiswahili review

By localization, 2026-11-08, against `docs/brand/voice-politeness-notes.md`. All lines above are still drafts: Walter checks every one. "Walter" marks the ones I am least sure of. Character counts are approximate.

### Was → now, why

- A headline: "Safiri na watu wa Tanzania." → "Karibu usafiri na watu wa Tanzania." Bare command in a heading; "Karibu" + subjunctive makes it an invitation. Walter: with the eyebrow "Karibu Tanzania" the page says "Karibu" twice. If that feels like too much, keep "Safiri na watu wa Tanzania." as a slogan-style headline.
- A sub-line: "...Anza na mwongozaji wako: mfahamu kwanza, kisha uamue." → "...Karibu uanze na mwongozaji wako: mfahamu kwanza, kisha uamue." (~125) Three commands in a row read as orders; "Karibu uanze" invites. Singular kept throughout ("wako", "mfahamu", "uamue").
- A tagline: "Safiri na watu wa Tanzania" → "Safari pamoja na watu wa Tanzania". The tagline sits right after "Karibu Kwetuly" in the app intro and in the footer, where a noun phrase reads better than a command. It now differs slightly from the headline on purpose. Walter
- B headline and sub-line: no change. Natural and polite; singular "wanakukaribisha" and "mfahamu" are consistent.
- B tagline: "Wenyeji wanaokukaribisha" → "Wenyeji wanakukaribisha". The relative form ("locals who welcome you") reads as half a sentence; the plain form ("locals welcome you") is a complete, warm line.
- C headline: "Safari yako ni nzuri kama mwongozaji wako. Basi chagua wako." → "Safari yako inategemea mwongozaji wako. Karibu umchague." (~57, shorter than the current 61) The current line is a translation of "only as good as", and "Basi chagua wako" is abrupt with "wako" left without a noun. The longer option in the politeness notes ("Uzuri wa safari yako unategemea mwongozaji wako. Karibu umchague mwenyewe.", ~74) is closer to "only as good as" and "yours" but is too long for 375px. Walter
- C sub-line: "Mwongozaji wako anaongoza, ... wanakamilisha safari." → "Mwongozaji wako anakuongoza, ... wanafanikisha safari." (~129) "Mwongozaji anaongoza" repeats itself (the guide guides); "anakuongoza" (guides you) speaks to the guest. "Wanakamilisha" (complete) is stiff; "wanafanikisha" (make it succeed) is how people say it.
- C tagline: no change. "Siku zote" is natural Tanzanian usage. Walter, if a shorter slogan is wanted: "wenyeji daima".
- Travellers line: "Kwa wageni wanaopenda kuwafahamu watu wanaoandaa safari yao." → "Kwa wageni ambao wangependa kuwafahamu watu wanaowezesha safari yao." "Would like" is the courteous "-nge-". "Wanaoandaa" (who prepare) does not fit porters and cooks; "wanaowezesha" (who make it possible) matches "behind their trip".
- Guides line: "...wanaojenga jina lao. Karibu." → "...wanaojenga jina lao wenyewe. Karibuni." "Wenyewe" keeps "their own". The line speaks to guides as a group, so plural "Karibuni" matches. Walter: keep "Karibu" if you prefer it as the fixed brand word.
- Porters and cooks line: "...tunawataja na kuwashukuru kila safari." → "...tunawataja kwa majina na kuwashukuru katika kila safari." "Tunawataja" alone means "we mention you"; "kwa majina" says we name you. "Katika kila safari" reads more naturally. Note for marketing: this line is a promise (named and thanked on every trip); check the product actually does it.
- Hosts and shop owners line: "Kujiorodhesha ni bure." → "Kuweka tangazo ni bure." "Kujiorodhesha" is a coined, stiff word; "tangazo" is already the word for "listing" in `voice.md`. Price meaning (listing is free) unchanged. Walter: "nyumba za wageni" means guest houses, not quite homestays; and the word for "apartment" is still open.
- `home.hook`: "Wasafiri wengi huchagua kampuni. Lakini safari hufanywa na mwongozaji na timu ya wenyeji." → "Wasafiri wengi huchagua kampuni, lakini safari hutegemea mwongozaji na timu yake ya wenyeji." "Hufanywa na" is a translated passive; one sentence with "lakini" flows. Same fix as in the politeness notes.
- `home.afconBody`: "Ziara za mji na safari za siku moja na waongozaji wa hapa. Inakuja hivi karibuni." → "Ziara za mjini na safari za siku moja pamoja na waongozaji wa hapa. Huduma hii inakuja hivi karibuni." Two "na" in a row could read as "day trips and local guides"; "pamoja na" fixes it. "Ziara za mjini" is the usual phrase. "Inakuja" needs a subject.
- `auth.welcomeBody`: "...Hatua moja ya mwisho, tafadhali: tuambie ... jinsi tunavyoweza kukufikia." → "Asante kwa kujiunga. Imebaki hatua moja tu: tafadhali tueleze utakavyotumia Kwetuly na jinsi tunavyoweza kuwasiliana nawe." "Hatua moja ya mwisho, tafadhali:" follows English word order; "kukufikia" is a literal "reach you"; "kuwasiliana nawe" is natural.
- No change: eyebrows "Karibu Tanzania", button "Mfahamu mwongozaji wako", "Je, wewe ni mwongozaji? Karibu.", "Karibu Kwetuly!". The "Current SW" column is a quote of today's text and was not edited.

### Conversion's suggested sub-line for option A

English: "Meet a local guide first: see what Kwetuly checked, ask anything, then decide. Porters, cooks and hosts welcome you too."

- Kiswahili: "Kwanza mfahamu mwongozaji wa hapa: angalia Kwetuly imekagua nini, muulize chochote, kisha uamue. Wapagazi, wapishi na wenyeji nao wanakukaribisha." (~146)
- With shop owners: "Kwanza mfahamu mwongozaji wa hapa: angalia Kwetuly imekagua nini, muulize chochote, kisha uamue. Wapagazi, wapishi, wenyeji na wenye maduka nao wanakukaribisha." (~160)

Notes:
- Both are over the ~130 target; Kiswahili runs about 20% longer than English. Shorter fallback without "wa hapa" (the headline already says "watu wa Tanzania"): "Kwanza mfahamu mwongozaji: ..." (~138 and ~152). Designer checks at 375px.
- I did not open with "Karibu" here, because with option A the eyebrow and headline already say it. "Kisha uamue" keeps the commands from reading as orders. "Angalia" (not "Ona") and "Kwetuly imekagua nini" (not "ilichokagua") follow the politeness notes.
- "Nao" = "they too", the natural way to say "welcome you too". Singular "-ku-" and "mfahamu/muulize" match the rest of the page.
- Walter: if the headline goes back to "Safiri na watu wa Tanzania.", the sub-line can open "Karibu umfahamu mwongozaji wa hapa kwanza: ..." (about 6 characters longer).
