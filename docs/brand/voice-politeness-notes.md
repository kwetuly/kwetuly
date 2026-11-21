# Voice and politeness notes

Prepared by the localisation agent, 2026-11-08. Read only: no dictionary has been changed. Walter checks every Kiswahili suggestion before anything is edited.

Goal from Walter: "We Tanzanians are polite." Kwetuly should sound like a courteous Tanzanian host, with local people (guides, drivers, hosts) at the centre.

Source: `packages/shared/src/dictionaries/sw.ts` (`home`, `intro`, `footer`, `auth.welcomeTitle`, `auth.welcomeBody`). English meaning taken from `en.ts`.

Labels used below:
- **Stiff**: correct but sounds like a document or a translation.
- **Translated**: follows English word order or idiom (calque).
- **Not polite enough**: bare command or abrupt where a Tanzanian would invite or ask.
- **Meaning**: the Kiswahili says something different from the English.
- **Walter**: needs a native-speaker decision.

## 1. Kiswahili review

### home

| Key | Current | Suggested | Why |
| --- | --- | --- | --- |
| `eyebrow` | Karibu Tanzania | Keep. Option for banners to many people: Karibuni Tanzania | Fine. "Karibu" is the brand greeting and matches the singular "you" used everywhere else. Walter |
| `title` | Safari yako ni nzuri kama mwongozaji wako. Basi chagua wako. | Uzuri wa safari yako unategemea mwongozaji wako. Karibu umchague mwenyewe. | Translated ("only as good as"). "Basi chagua wako" is abrupt and "wako" hangs without a noun. "Karibu umchague" turns the command into an invitation. Walter |
| `subtitle` | Kila safari, kupanda mlima na matembezi ya siku hutegemea mtu mmoja. Mfahamu kwanza: angalia Kwetuly ilichokagua na maoni halisi, muulize chochote, kisha uamue. | Kila safari ya mbugani, kupanda mlima au ziara ya siku moja hutegemea mtu mmoja. Karibu umfahamu kwanza: angalia Kwetuly imekagua nini, soma maoni ya wasafiri wengine, muulize chochote, kisha uamue. | "Safari" alone means any trip, so "safari ya mbugani" makes the game-drive meaning clear. "Matembezi ya siku" sounds like a walk; "ziara ya siku moja" is a day trip. Four bare commands in a row read as orders; opening with "Karibu" softens it. |
| `search` | Mfahamu mwongozaji wako | Keep | Good, warm, short enough for a button. |
| `specialtyLabel` | Unataka kufanya nini? | Ungependa kufanya nini? | Not polite enough. "-nge-" (ungependa) is the courteous way to ask a guest what they would like; "unataka" is direct, closer to "what do you want?". |
| `anySpecialty` | Uzoefu wowote | Shughuli yoyote | Meaning. "Uzoefu" is work experience (years), but this filter is about the activity. Check it matches the specialty option labels. Walter |
| `forGuidesTitle` | Je, wewe ni mwongozaji? | Keep | Natural. |
| `forGuidesBody` | Maoni yako yanapaswa kukufuata wewe, si mwajiri wako. Kila safari unayoongoza kwenye Kwetuly inajenga jina lako mwenyewe, maisha yote. Uanachama wa msingi ni bure kwa waongozaji walioidhinishwa. | Maoni ya wasafiri kukuhusu yanapaswa kukufuata wewe, si mwajiri wako. Kila safari unayoongoza kupitia Kwetuly inajenga jina lako mwenyewe, daima. Waongozaji walioidhinishwa wanapata uanachama wa msingi bure. | Meaning: "maoni yako" means your own opinions, not reviews about you. "Maisha yote" is a literal "for life"; "daima" is more natural. Last sentence reworded only; the price meaning (basic membership free for approved guides) is unchanged. Flag: pricing wording, confirm with business-manager. |
| `forGuidesCta` | Anza kujenga jina lako | Jiunge, ujenge jina lako | Slightly translated ("start building"). The new version says what the button does (join). Same length. Walter |
| `whyTitle` | Kwa nini Kwetuly | Kwa nini uchague Kwetuly? | Stiff heading; the full question is how people say it. |
| `hook` | Wasafiri wengi huchagua kampuni. Safari bora hufanywa na mwongozaji. | Wasafiri wengi huchagua kampuni, lakini safari bora hutegemea mwongozaji. | "Hufanywa na" is a translated passive. One sentence with "lakini" flows better. |
| `story` | ...Kwenye Kwetuly unakutana naye kwanza. Unasoma wasafiri wengine walisema nini kumhusu yeye, si kuhusu kampuni, na unauliza maswali kwa lugha yako. Ukifika, anakusubiri mtu unayemfahamu tayari. | ...Kwenye Kwetuly mnafahamiana mapema. Unasoma maoni ya wasafiri wengine kumhusu yeye mwenyewe, si kampuni, na unamuuliza maswali kwa lugha yako. Ukifika, unapokelewa na mtu unayemfahamu tayari. | "Walisema nini kumhusu" follows English word order. "Mnafahamiana" (you get to know each other) is warmer and respects the guide as an equal. "Unapokelewa" (you are welcomed) brings in Tanzanian hospitality. |
| `why[0]` | Mfahamu mwongozaji kabla ya kulipa / Uliza maswali na mkubaliane mpango moja kwa moja na mwongozaji. Kuuliza ni bure. | Keep | Natural. "Mkubaliane" correctly uses the plural (you and the guide). |
| `why[1].title` | Ona Kwetuly ilichokagua | Angalia Kwetuly imekagua nini | "Ona" as a heading is curt; "angalia" is the normal invitation to look. |
| `why[1].body` | ...Kama bado hatujakagua hati, wasifu unasema hivyo. | ...Kama bado hatujakagua hati fulani, wasifu unaeleza wazi. | "Unasema hivyo" is a literal "says so". "Unaeleza wazi" (explains clearly) supports the honesty point. |
| `why[2].title` | Maoni ni mali ya mwongozaji | Maoni yanabaki kwa mwongozaji | "Mali" (property) sounds legal and stiff. Walter |
| `why[3].title` | Ongea lugha yako | Ongea kwa lugha yako | Without "kwa" it reads as a command to speak your language. |
| `why[3].body` | Chagua kwa lugha: Kiswahili, ... | Tafuta mwongozaji anayezungumza lugha yako: Kiswahili, ... | "Chagua kwa lugha" is a calque of "filter by language". |
| `afconBody` | ...Inakuja hivi karibuni. | ...Huduma hii inakuja hivi karibuni. | Minor: "inakuja" needs a subject to read naturally. |

Consistency notes for `home`:
- The site uses both "kukagua" (guides, home) and "kuhakiki" (`checks` section) for "check". Suggest one word, "kukagua", to match "Checked by Kwetuly" and the badge rules. Walter
- `home.title` uses "Basi chagua wako" while `intro.s1Title` uses "Mjue" and `home.search` uses "Mfahamu". Suggest "Mfahamu" everywhere: it is softer and more respectful than "Mjue".

### intro (app first screens)

| Key | Current | Suggested | Why |
| --- | --- | --- | --- |
| `welcome` | Karibu | Keep (shown before the brand name: "Karibu Kwetuly") | Correct. Option: "Karibu sana" if space allows. |
| `tagline` | Nyumbani kwa waongozaji wa Tanzania | Kwetu, kwa waongozaji wa Tanzania (or: Mahali pa waongozaji wa Tanzania) | Translated ("the home of"). "Nyumbani kwa" sounds like a physical house. "Kwetu" plays on the brand name (kwetu = our home). Walter |
| `s1Title` | Mjue mwongozaji wako kabla ya safari | Mfahamu mwongozaji wako kabla ya safari | Same meaning, softer, matches `home`. |
| `s1Body` | Waongozaji wa ndani kwa Kilimanjaro, safari, Zanzibar na utamaduni. Ona Kwetuly ilikagua nini, soma maoni, ongea nao na panga simu ya maandalizi. | Waongozaji wa ndani wa Kilimanjaro, safari za mbugani, Zanzibar na utamaduni. Angalia Kwetuly imekagua nini, soma maoni, zungumza nao, kisha mpange simu ya maandalizi. | "Kwa Kilimanjaro" is translated ("for"). Four bare commands with "Ona" sound like orders; "kisha mpange" (then you two arrange) is natural. |
| `s2Title` | Tuambie safari ya ndoto yako | Tuambie safari unayoitamani | "Safari ya ndoto" is a calque of "dream trip". "Unayoitamani" (the trip you long for) is how a Tanzanian would say it. Walter |
| `s2Body` | Weka ombi la safari na waongozaji walioidhinishwa watakutumia ofa. Au jiunge na kundi mgawane gharama. | Weka ombi la safari, na waongozaji walioidhinishwa watakutumia ofa. Au jiunge na safari ya kikundi ili mchangie gharama pamoja. | "Jiunge na kundi mgawane" skips "ili" and reads as clipped. "Safari ya kikundi" matches the group-trip feature name. |
| `s3Title` | Safirini pamoja, wasiliana | Safirini pamoja, endeleeni kuwasiliana | Mixes plural "Safirini" with singular "wasiliana". Both should be plural (the whole group). |
| `s3Body` | Mazungumzo ya kikundi yenye picha na video, amana salama kwa pesa za simu au kadi, na taarifa kwenye simu yako. | Mazungumzo ya kikundi yenye picha na video, malipo ya awali salama kwa pesa ya simu au kadi, na taarifa kwenye simu yako. | "Amana" is a banking word (trust deposit); most travellers and guides say "malipo ya awali". Flag: this is payment wording, so check with payments-engineer and legal that "deposit" keeps the same meaning before changing. Walter |
| `getStarted` | Fungua akaunti yangu | Keep | Natural. |
| `haveAccount` | Tayari nina akaunti | Keep | Natural. |
| `explore` | Angalia kwanza | Keep | Natural. |
| `next` | Endelea | Keep | Normal for a button. |

### footer

| Key | Current | Suggested | Why |
| --- | --- | --- | --- |
| `tagline` | Nyumbani kwa waongozaji wa Tanzania. | Same as `intro.tagline` once Walter chooses | Keep both identical. |
| `rights` | Haki zote zimehifadhiwa. | Keep | Standard legal formula; do not change. |

### Onboarding (`auth`)

| Key | Current | Suggested | Why |
| --- | --- | --- | --- |
| `welcomeTitle` | Karibu Kwetuly! | Keep (option: Karibu sana Kwetuly!) | Warm and correct. |
| `welcomeBody` | Hatua ya mwisho: tuambie utakavyotumia Kwetuly na jinsi ya kukufikia. | Hatua moja tu imebaki. Tafadhali tueleze utakavyotumia Kwetuly na jinsi tunavyoweza kuwasiliana nawe. | Not polite enough: we are asking for personal details, so "tafadhali" belongs here. "Kukufikia" is a literal "reach you"; "kuwasiliana nawe" is natural. "Hatua moja tu imebaki" (just one step left) is friendlier than "hatua ya mwisho". |

### Seen while reviewing (outside the four sections)

- `nav.soon` is "Karibuni" for English "Soon". Most Tanzanians will read "Karibuni" as "Welcome (all)", not "soon". Suggest "Hivi karibuni" (check it fits the menu badge on a 375px screen) or "Inakuja". Meaning issue. Walter
- `auth.signInTitle` is the bare "Ingia". A heading could be "Karibu tena" with the button staying "Ingia".

## 2. Politeness in each language

### Kiswahili (Tanzania)

Greetings and welcome
- **Karibu** to one person, **Karibuni** to several. Screens talk to one user, so use "Karibu". Use "Karibuni" only for messages clearly meant for a group (group trip chat, banners, social posts to everyone). "Karibu sana" is warmer still.
- Reply to thanks: "Asante" (also spelled "Ahsante"; both are used in Tanzania; pick one and keep it). Thanks to many: "Asanteni".
- Thank people after they act: "Asante! Ombi lako limetumwa." rather than only "Ombi limetumwa."
- Do not use "Shikamoo" in the app: it is for elders and we do not know the user's age. "Habari" or "Karibu" are safe for everyone.
- "Samahani" before errors and refusals ("Samahani, kuna tatizo."). "Pole" for sympathy ("Pole kwa usumbufu", "Pole, safari imeahirishwa").

Requests and commands
- Short buttons may use the plain command: Ingia, Tuma, Endelea, Hifadhi. This is normal UI Kiswahili and not rude, and "Tafadhali" would make buttons too long for a 375px screen.
- Headings, body text, errors and anything asking for personal data or money should be requests, not commands:
  - "Tafadhali ingia" / "Tafadhali weka namba yako" (polite request)
  - "Karibu ujiunge" / "Karibu umchague" (invitation with the subjunctive)
  - "Ungependa...?" / "Tungependa kujua..." (conditional -nge-, the courteous question)
  - "Tunaomba uthibitishe barua pepe yako" (we kindly ask), from the company voice
- Avoid chains of bare commands in body text ("Ona..., soma..., ongea..., panga..."). Put "Karibu" or "kisha" in to make it flow.
- Avoid "lazima" and "unapaswa" toward users; prefer "tafadhali hakikisha".

Singular and plural address
- Default: singular (wewe, -ako, u-). This is what the dictionaries already do.
- Plural (ninyi, -enu, m-/mu-, verb ending -ni) only when speaking to a whole group, and keep it the same within one sentence (see `intro.s3Title`).
- "Mkubaliane" / "mpange" (you and the guide together) is correct plural use and shows respect to the guide as an equal partner.

Tanzanian wording (already used, keep it)
- "namba" (not Kenyan "nambari"), "barua pepe", "pesa ya simu", "mwongozaji/waongozaji". No Sheng.
- Talk about guides, drivers and hosts with respect: "waongozaji wa ndani", "wenyeji", never in a way that makes them sound like a product.

### French (vous)

- Current: the dictionaries use **vous** throughout (for example "dites-nous comment vous utiliserez Kwetuly", "Construisez votre nom"). Keep it; "tu" would feel too familiar for a booking service.
- Buttons use the infinitive ("Se connecter", "Envoyer", "Créer mon compte"). Keep that pattern.
- Requests in errors: "Veuillez vérifier..." or "Merci de vérifier...".
- Keep the space before ! ? : ; as already used ("Bienvenue sur Kwetuly !").

### German (Sie)

- Current: **Sie** throughout, no "du" found. Keep it and always capitalise Sie, Ihr, Ihnen.
- Buttons use the infinitive ("Anmelden", "Senden", "Konto erstellen"). Keep.
- "Bitte" in errors and requests ("Bitte prüfen Sie...").

### Italian (tu)

- Current: informal **tu** ("dicci come userai Kwetuly", "il tuo nome"). This is normal for Italian apps and travel brands; "Lei" would sound like a bank letter. Keep tu, but stay warm ("per favore" in errors, "grazie" after actions).
- Issue: "Benvenuto su Kwetuly!" assumes a man. Gender-neutral and polite: "Ti diamo il benvenuto su Kwetuly!" (same for `intro.welcome`, "Karibu! Benvenuto su"). Walter, as this is a traveller text in it.ts.
- Buttons use the tu imperative ("Accedi", "Invia"). Keep.

### Polish (Ty with capital letter)

- Current: Ty forms with capitalised pronouns ("się z Tobą kontaktować"), and the neutral "Witamy w Kwetuly!" (we welcome). This is the usual courteous app style; Pan/Pani is avoided because we do not know the user's gender. Keep it.
- Inconsistency: three places use lowercase. `auth.inviteHint` and `auth.inviteError` ("która cię zaprosiła") and a profile field `bio: 'O tobie'` in pl.ts. Suggest "Cię" and "O Tobie" to match.
- Buttons use the imperative ("Zaloguj się", "Wyślij"). Keep.

### Chinese (你 or 您)

- Current: traveller texts use **你** (about 80 times in zh.ts, for example "告诉我们你如何使用 Kwetuly"). Only legal.ts uses **您** (2 times: "删除您的数据").
- 您 is the polite "you" that Chinese travel and booking services normally use, especially around payments and personal data. A consistent switch to 您 for traveller texts would match Walter's politeness goal, but mixing the two is worse than either. Decision for Walter; if yes, change all traveller strings at once.
- Use 请 for requests ("请输入..."), 谢谢 after actions, 欢迎 for welcome (already: "欢迎来到 Kwetuly！").
- Small wording item: `home.forGuidesCta` "开始建立你的名字" is literal ("start building your name"). Something like "建立你的个人口碑" reads more naturally. Native check needed.

## Decisions for Walter

1. Approve or adjust each Kiswahili suggestion above (marked Walter where most unsure).
2. Tagline: "Kwetu, kwa waongozaji wa Tanzania", "Mahali pa waongozaji wa Tanzania", or keep "Nyumbani kwa...".
3. One verb for "check": "kukagua" everywhere (recommended) or "kuhakiki".
4. "Amana" or "malipo ya awali" for deposit (also needs payments-engineer and legal).
5. `nav.soon`: replace "Karibuni".
6. Chinese: switch traveller texts to 您, yes or no.
7. Italian: "Ti diamo il benvenuto" instead of "Benvenuto".
