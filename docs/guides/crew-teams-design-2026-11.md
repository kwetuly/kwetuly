# Crew teams: wapagazi, cooks and drivers (design, paper only)

Prepared by guide-success on 2026-11-08 for Walter. Task 2a of `docs/product/ideas-2026-11-08.md`, rows C1 to C7.

- Paper only. Nothing is built, priced, sent or announced, and nobody has been contacted.
- Inputs: `docs/product/ideas-2026-11-08.md` (C1 to C7, D1), `docs/legal/paid-checks-operators-crews.md` (section 3 and 4.3), `docs/brand/voice.md`, `docs/business/paid-guide-check-and-team-seats.md` (section 4), `docs/business/phone-sign-in-costs-2026-10-30.md`, the jobs table in `supabase/migrations/20261012000500_calls_jobs_hub.sql`.
- tech-lead (2b) does the data design and hr with legal (2c) do the fairness and law. This file says how it should work for the people; where it touches their work, it says so.
- All Kiswahili is a draft. Walter and localization check every line before use.
- Words: "mpagazi / wapagazi" for porters (Walter, 2026-11-08). `docs/brand/voice.md` sections 1 and 4 still say "Walter chooses"; marketing should update them.

---

## 0. Principles (apply to every part below)

1. **The crew member decides.** Nobody is listed, named or shown without their own yes, given from their own phone or confirmed by Kwetuly with them directly. A guide's word is not consent.
2. **Crew never pay Kwetuly, and no guide or operator may charge them** for joining a team, a profile, a check, a review, a job or a course listing.
3. **No check is ever needed** to have a profile, join a team, be named in a review, or apply for a job.
4. **Crew belong to themselves, not to a team.** One person can be in many teams. Leaving is one tap. The profile, credits and course records stay with the person.
5. **Crew are not bookable** on their own, and Kwetuly sets no pay, gives no directions and shortlists nobody (legal note 3.6 and 4.3). Crew appear as people and as members of a guide's or operator's team.
6. **Private by default.** First name and role are the only things public by default. No public phone numbers. No ID numbers or documents in chat, ever.
7. **No star ratings of people.** Words and simple tags only, approved by the crew member before they are public.
8. **18 or over.** Assistant guides must be registered Tanzanian guides and use the normal guide sign-up.
9. **Drivers are people, not a service.** Transfers are off, so no "book a driver" and no driving or vehicle claims.

---

## 1. Who signs up, and how (C1)

### 1.1 Roles

| Role | Kiswahili | Sign-up route | Note |
| --- | --- | --- | --- |
| Porter | mpagazi | Crew sign-up (this file) | Most will join through a guide first |
| Cook | mpishi | Crew sign-up | Also links to B2 cooking classes later |
| Driver | dereva | Crew sign-up | Person only; no vehicle, licence or "transfer" fields while transfers are off |
| Assistant guide | mwongozaji msaidizi | **Guide sign-up** (5 steps) | Guiding needs registration; GN 487A reportedly bars non-citizens |
| Other (for example camp helper, singer) | mengineyo | Crew sign-up, role "other" | Porter singers become a group later (2026-11-06 plan 3.6) |

The jobs table already has these roles (`job_role`: guide, assistant_guide, cook, porter, driver, other), so jobs and crew can share one list.

### 1.2 What is realistic for basic phones

| Route | How it works | Realistic now? | Why |
| --- | --- | --- | --- |
| **A. Guide-assisted, crew confirms** | The guide enters the person's first name, role and phone number. The guide sends the invitation from his own WhatsApp or SMS (M1). The person confirms on a one-page Kiswahili screen, or, with a basic phone, by a short phone call from Kwetuly (M3) | **Yes. Recommended first route** | Costs Kwetuly nothing to send (the guide sends from his own phone, to someone he already works with). A call is cheap while numbers are small (pilot only, staff time) |
| **B. Self sign-up on the website** | One-page form, Kiswahili first, then a sign-in | Partly | Today sign-in is email, Google or Apple only; phone sign-in is a no-go at launch (phone sign-in note). Many wapagazi may have smartphones, but the share is unknown: do not assume either way |
| **C. WhatsApp to a Kwetuly number** | The person sends "JIUNGE" and gets a link and a one-time code | Later | Needs the Meta WhatsApp Business sender, which Walter has not set up and likely needs the registered company. Then about US$0.009 per code (to verify) |
| **D. SMS code** | Code by SMS as backup to WhatsApp | Later, backup only | About US$0.43 per SMS to Tanzania (Twilio, checked 2026-10-30); needs a spending cap |
| **E. USSD (*xxx#)** | Menu on any phone | **No, park** | Needs a shortcode through a licensed aggregator and TCRA (to verify), likely a registered company, set-up and monthly fees (not quoted). Too heavy for a pilot |
| **F. Paper forms at meetings or gates** | Association or school helps fill in | Later, only through partners Walter contacts | Paper with phone numbers is personal data that is easy to lose; needs a data process first |

**Recommendation:** start with route A only, with consent confirmed by the person (screen or call). Add B for smartphone users. Add C and D after the company and the WhatsApp sender exist. Park E and F.

### 1.3 The crew sign-up form (one screen, Kiswahili first)

Asked:
1. First name (jina la kwanza). Surname optional and private.
2. Role or roles (mpagazi, mpishi, dereva, mengineyo).
3. Phone number (private, used only for Kwetuly messages and, with consent, shared with someone who offers work).
4. "I am 18 or older" (yes or no). No date of birth.
5. Where you usually work (for example Kilimanjaro, Meru, Ngorongoro, Arusha, Zanzibar): pick from a list.
6. Languages you speak: pick from a list. Shown as "stated", in grey.
7. Optional: photo (with the photo rules in 3.3), years of work (stated), a short line about yourself (up to 200 characters, checked by Kwetuly before it shows).
8. The consent choices (M2), each a separate tick.

Not asked: NIDA or any ID number, ID images, date of birth, home village, health, family, pay, religion, tribe. If a paid check is done later, the ID is seen on a call (2.4), never sent in chat or uploaded at sign-up.

Approval: Kwetuly approves each crew profile, as with guides. The approval confirms only that a real person said yes (screen or call) and is 18 or over (stated). It is not a check of skill or identity, and the profile does not say it is.

Unclaimed invitations: a profile the guide started but the person has not confirmed is never public, and is deleted after 30 days (tech-lead and security-reviewer to confirm the period).

---

## 2. A guide builds his team (C2), and checks (C3)

### 2.1 Invitation and consent flow

1. **Guide (in the Hub, "Timu yangu / My team")** taps "Invite a team member", enters first name, role and phone. Text above the button: "Please invite only people who work with you, and ask them first."
2. **Kwetuly makes a personal link.** The guide sends it himself (M1) through WhatsApp or SMS from his own phone. Kwetuly sends nothing at this stage.
3. **The person opens the link** and sees the consent screen (M2), in Kiswahili first, with an English switch. Each choice is a separate tick. "Sikubali / No thanks" is as big as "Nakubali / I agree".
4. **Basic phone, no link:** the guide ticks "This person has no smartphone". Kwetuly (Walter or a staff member he names) phones the person, reads M3, and records "Consent confirmed by phone call, [date], by [staff]". Nothing shows publicly until then. The guide is not on the call.
5. **The person can also ask to join** a guide's team from the guide's profile; the guide accepts or declines.
6. **After joining:** the person gets M4, and appears on the guide's team list as first name, role and (if chosen) photo.

Rules:
- The guide cannot edit the person's profile after confirmation, cannot see the phone number unless he already entered it, and cannot see the person's other teams or private feedback.
- **Leaving:** the person can leave any team at any time (one tap, or by replying "TOKA" or calling Kwetuly). No reason is asked. The guide gets M5.
- **Removal:** a guide can remove a member. The person gets M5. No public reason; the profile, credits and courses stay with the person.
- **No exclusivity:** a team never limits who else the person works with (legal note 4.1, s. 61 factor (g)).
- **No fee for teams** at the start (paid-guide-check note option A). Never a fee to the crew.

### 2.2 Operators

A tour operator with a business account builds a team the same way. For climbs, only operators whose mountain-climbing licence Kwetuly has seen may list climbs (legal note 2.3), and their crew-welfare declaration (legal note 3.4) is shown on the team page as "declared by the operator".

### 2.3 Checks (C3)

Walter's recommendation 5 (2026-11-08) is used here. Built only after company registration.

| Rule | Why |
| --- | --- |
| The paid crew check is optional and adds one dated line, for example "Identity seen by Kwetuly on a video call, 12 Jan 2027" | Same honesty rule as the badge: what was checked and when, never "recommended" |
| The guide or operator may pay for his team, on one invoice to the company | Walter, 2026-10-30 and 2026-11-08 |
| **Nothing is charged before the company is registered** and can issue receipts | Walter, 2026-11-08 |
| The check belongs to the crew member and stays when he leaves the team | Paid-guide-check note section 4 |
| The fee may never be deducted from crew pay or tips; a breach removes that payer's checks | Paid-guide-check note section 4 |
| No check is needed to be in a team, be named in a review, or apply for a job; job posts may not ask for "checked" crew only | A requirement would turn an optional fee into a fee to work |
| No ranking, sorting or filter by check | Same as guide check |

**Conflict for Walter to settle:** row C3 says crew "pay for the check" (fees set 2026-10-30: guide US$10, cook US$7, porter US$5), while the 2026-10-30 board decision and the legal note 3.5 say crew never pay. The porter fee is close to a quarter of a porter's day pay at the reported TZS 20,000 to 25,000 a day (secondary sources). **Recommendation: crew never pay, not even by choice, at least for the first year; only the guide or operator pays.** Also, business-manager's per-member figure (TZS 15,000, about US$6) differs from Walter's US$5 porter / US$7 cook. business-manager should line these up; Walter sets the price.

### 2.4 How a check would be done (later)

Short video or phone call with the person, ID seen on camera, nothing copied, ID number not stored unless the advocate says it must be (legal note 1.2). Never in WhatsApp or chat. The record keeps: what was seen, the date, who checked.

---

## 3. What a crew profile shows, and keeps private

### 3.1 Public (only what the person chose)

| Item | Shown as |
| --- | --- |
| First name, and surname initial if chosen | "Baraka M." |
| Role or roles | "Mpagazi, mpishi" |
| Photo (optional) | See 3.3 |
| Areas worked | "Kilimanjaro, Meru (stated)" in grey |
| Languages | "Kiswahili, English (stated)" in grey |
| Years of work | "8 years (stated)" in grey |
| Short line about themselves | Checked by Kwetuly before it shows |
| Teams | "On the team of [guide name]", only where both agreed |
| Lead guide notes | Only notes the person approved (section 4) |
| Traveller credits | "Named in 6 trip reviews" and the short thanks the person chose to show (section 5) |
| Courses | "First-aid course, [provider], certificate seen [date]" or "(stated)" in grey |
| Paid check, if any | One dated line (2.3) |
| Sample label | If `is_sample`, labelled "Sample" and never shown with a check |

### 3.2 Private (never public)

Phone number, surname (unless chosen), ID numbers, age or date of birth (only "18 or over" is recorded), home village, pay, health, family, private feedback, removal or leaving reasons, reports, which other teams invited or removed them, and anything said on a Kwetuly call.

**Contact:** there is no public phone or "call" button. Someone who wants to offer work sends a request inside Kwetuly; the person sees who is asking and chooses "Share my number" or "No thanks". Walter's idea that operators pay to see contact details (2026-10-30) is held until the advocate answers whether that is an employment-agency fee (legal question 28). Even then, the number is shared only when the person says yes.

### 3.3 Photos

- The person's own choice, and only of themselves. Face clearly visible, plain background, no other people, no children.
- A guide may not upload a photo of a crew member. A group team photo needs each person's yes, and is a later feature.
- Kwetuly may decline a photo, with a polite reason, and the person may remove it at any time.

---

## 4. Lead guides review wapagazi (C4)

Fair to the porter first, because the guide holds the power to hire.

1. **Only after a real trip together:** both are on the trip crew list (D1), and the trip has ended. The window opens at the end of the trip and closes after 30 days.
2. **Words and tags, no stars.** The guide picks up to 3 tags and may add one short note (up to 300 characters). Draft tags (hr to review): "Fika kwa wakati / On time", "Hutunza mizigo vizuri / Careful with loads", "Husaidia kambini / Helpful in camp", "Huwasaidia wageni / Kind to guests", "Mpishi mzuri / Good cook", "Huongea Kiingereza / Speaks English". Tags are only positive or neutral facts about work.
3. **The person approves before anything is public** (M6): show, hide, or reply. Hidden notes stay private to the person. The guide is not told whether it was hidden.
4. **Problems go to Kwetuly privately, never to the profile.** Safety, theft, harassment or no-shows are reported to Kwetuly through the conduct process (hr), and the person is told what was said and may answer before Kwetuly decides anything.
5. **No trading.** A guide may not offer a note in exchange for anything, and may not threaten to withhold one. Breach goes through the conduct process.
6. **Removal:** the guide may withdraw his own note; he may not edit it after it is public.
7. **No ranking** of crew by number or content of notes.
8. **The porter's voice too:** every crew member can send private feedback about a trip (M10): pay late, load too heavy, food, gear, a fee demanded. Kwetuly reads every message. The name is never passed to the guide or operator without the person's yes. Patterns are raised only when several people report the same thing, so one person cannot be identified (hr and legal to set the number and the process).

---

## 5. Wapagazi named in a traveller's trip review get credit (C5)

1. At D1 crew check-in, the guide lists who is on the trip. Only people who agreed to be named appear by name; others show as a count ("and 3 more wapagazi").
2. In the review form, the traveller sees the list and may tick "Who helped you?" and write one short thanks. Text above: "Your guide's porters and cooks made this trip possible. You are welcome to thank them by name." The traveller cannot type a free name that links to a profile, so no wrong person is credited.
3. The person gets M7 and chooses to show or hide it. Shown thanks appear on their profile with the trip month, never the traveller's surname.
4. "I was not on this trip": the person can report a wrong listing; Kwetuly removes it.
5. No check is needed to be named. No stars per person. Credits never change search order.
6. Tips are never asked for, collected or shown through the review (legal note 3.5). Tips follow the operator's or guide's own procedure.
7. The count "Named in N trip reviews" counts only shown, non-sample reviews from real trips.

---

## 6. Job posts (C6)

The jobs board already exists (`jobs` table: role, title, description, location, dates, free-text pay, how to apply, Kwetuly approval). For crew jobs it needs more fields so that "Ninahitaji wapagazi 5" is clear and fair.

### 6.1 Fields

| Field | Required | Rule |
| --- | --- | --- |
| Posted by (guide or operator, shown by name) | Yes | Climbs: operator with a mountain-climbing licence seen by Kwetuly, or a guide posting on that operator's behalf with the operator named |
| Role | Yes | From `job_role` |
| How many people | Yes | "5" |
| Where (park, route, town) | Yes | From a list plus free text |
| Start date and number of days | Yes | |
| **Pay per day in TZS** | Yes, as a number | Must be at or above a floor set in admin. The floor comes from legal (legal questions 16 to 18), not from this file. "Negotiable" alone is not accepted |
| When and how pay is made | Yes | "Within [n] days after the trip, by pesa ya simu / bank / cash" |
| Type of work | Yes | Per trip, or ongoing |
| Provided | Yes, tick list | Food, tent, sleeping mat, cold-weather gear, transport to the gate |
| Porter load | Yes for porter jobs | Up to 20 kg client load (reported park rule, to verify) |
| Tips | Yes for climbs | How tips are shared |
| Languages and experience needed | Optional | No age (beyond 18+), gender, tribe, religion or "checked only" requirements |
| Closing date | Yes | Post closes itself |
| Declarations | Yes, ticked | "I charge no fee to anyone who applies or is hired", "Everyone hired is 18 or over", "Pay is at least the legal minimum" |

### 6.2 Not allowed (Kwetuly declines the post)

Any fee to apply or be hired, unpaid trial climbs, pay below the floor or missing, "only Kwetuly-checked crew", requests for ID copies in the post, non-citizen guides, and anything that asks applicants to pay for gear or transport to get the job.

### 6.3 Applying

- The person taps "Ninapenda kazi hii / I am interested". The poster sees first name, role and the public profile.
- The phone number is shared only if the person chooses to.
- Kwetuly does not shortlist, match, rank or place anyone, and pays nobody (legal 4.3). Whether a notice "new porter jobs in your area" counts as matching is for the advocate (question 28).
- After the trip, crew can report a job that was not as posted (M10). Credible reports remove the poster's jobs.

---

## 7. Course channel: from mpagazi to mpishi or mwongozaji (C7)

Information only at first. No course provider is named here: Walter contacts real providers, and partnerships records what was seen.

### 7.1 Paths (draft, for real people to confirm)

| From | To | Usually needed (to verify for each) |
| --- | --- | --- |
| Mpagazi | Mpishi wa kambi | A cooking or food-hygiene course, first aid, practice with a senior cook |
| Mpagazi or mpishi | Mwongozaji msaidizi | Reported for guide registration (GN 270 of 2015, unverified): Tanzanian citizen, 21 or over, secondary education, valid first-aid certificate, enlistment with a licensed company, TTGA or similar. A guide-school course |
| Mwongozaji msaidizi | Mwongozaji mkuu | Experience, specialist certificates (mountain, wilderness first aid), languages |
| Anyone | More languages | English and other traveller languages |
| Anyone | Working with Kwetuly | Short free guides by Kwetuly: your profile, photo with consent, your rights (pay, load, no fees), how to report a problem |

### 7.2 How each course is listed

Provider name, what it teaches, length, place or online, price set by the provider, whether a fee applies, and only what Kwetuly actually saw about accreditation ("registration with [body] seen, [date]"; which bodies count is to verify). Sponsored places say "Sponsored by [name]". Sponsors never affect checks, badges or job posts.

Never: "guaranteed job", "get your licence", "become a guide in 3 months", or any income figure.

### 7.3 Delivery

Light pages in the Hub ("Mafunzo / Courses"), short Kiswahili audio for people who prefer listening, and later the WhatsApp channel once Walter finishes K1 and sets up the Meta account. No adding anyone to groups without their yes.

---

## 8. Key messages (drafts; Walter and localization check every line)

Kwetuly sends nothing until the feature is built and Walter approves. M1 is sent by the guide himself.

**M1. Guide invites a team member (the guide sends it from his own phone)**

> SW: Habari ndugu [Jina]. Mimi ni [jina la mwongozaji], mwongozaji kwenye Kwetuly. Ningependa kukuweka kwenye timu yangu kama [mpagazi / mpishi / dereva]. Tafadhali fungua kiungo hiki, usome, kisha uamue mwenyewe: [kiungo]. Hutatozwa chochote. Ukiamua kutojiunga, hakuna tatizo. Asante.
>
> EN: Hello [Name]. I am [guide name], a guide on Kwetuly. I would like to add you to my team as a [porter / cook / driver]. Please open this link, read it, and decide for yourself: [link]. You will not be charged anything. If you decide not to join, that is fine. Thank you.

**M2. Consent screen**

> SW: Karibu Kwetuly, ndugu [Jina].
> [Mwongozaji] anaomba kukuweka kwenye timu yake kama [mpagazi].
> Ukikubali:
> - Jina lako la kwanza na kazi yako vitaonekana kwenye ukurasa wa timu yake.
> - Namba yako ya simu haitaonekana kwa mtu yeyote bila ruhusa yako.
> - Unaweza kuwa kwenye timu za waongozaji wengine pia.
> - Unaweza kujitoa wakati wowote.
> - Kwetuly haikutozi ada yoyote, na hakuna mwongozaji au kampuni yenye ruhusa ya kukutoza.
>
> Tafadhali chagua unachokubali:
> - Nakubali kuwa kwenye timu hii.
> - Nakubali jina langu la kwanza litajwe kwenye maoni ya wasafiri baada ya safari.
> - Nakubali picha yangu ionekane (ukipenda).
> - Ningependa kupokea taarifa za kazi na mafunzo (ukipenda).
> - Nina umri wa miaka 18 au zaidi.
>
> [Nakubali] [Sikubali]
>
> EN: Karibu to Kwetuly, [Name].
> [Guide] would like to add you to their team as a [porter].
> If you agree:
> - Your first name and your role will show on their team page.
> - Your phone number will not be shown to anyone without your permission.
> - You can be on other guides' teams too.
> - You can leave at any time.
> - Kwetuly charges you no fee, and no guide or company is allowed to charge you.
>
> Please choose what you agree to:
> - I agree to be on this team.
> - I agree that travellers may name me by my first name in trip reviews.
> - I agree that my photo may be shown (if you like).
> - I would like news about jobs and courses (if you like).
> - I am 18 or older.
>
> [I agree] [No thanks]

**M3. Consent call script (Kwetuly calls a person with a basic phone)**

> SW: Habari ndugu [Jina]. Naitwa [jina], napiga simu kutoka Kwetuly. Je, una nafasi ya dakika mbili? Asante. Mwongozaji [jina] ameomba kukuweka kwenye timu yake kama [mpagazi]. Tunataka kusikia kutoka kwako mwenyewe. Je, unakubali? Je, unakubali jina lako la kwanza litajwe kwenye maoni ya wasafiri? Je, una umri wa miaka 18 au zaidi? Hutatozwa chochote, na unaweza kujitoa wakati wowote kwa kutupigia simu. Hatutakuuliza namba ya kitambulisho kwenye simu hii. Asante sana kwa muda wako.
>
> EN: Hello [Name]. My name is [name], I am calling from Kwetuly. Do you have two minutes? Thank you. Guide [name] has asked to add you to their team as a [porter]. We would like to hear from you yourself. Do you agree? Do you agree that travellers may name you by your first name in trip reviews? Are you 18 or older? You will not be charged anything, and you can leave at any time by calling us. We will not ask for any ID number on this call. Thank you very much for your time.

**M4. Joined**

> SW: Asante, ndugu [Jina]. Sasa uko kwenye timu ya [mwongozaji]. Unaweza kubadilisha unachokubali au kujitoa wakati wowote: [kiungo].
>
> EN: Thank you, [Name]. You are now on [guide]'s team. You can change what you agreed to, or leave, at any time: [link].

**M5. Left or removed from a team**

> SW (to the person): Habari ndugu [Jina]. Hauko tena kwenye timu ya [mwongozaji]. Ukurasa wako, maoni uliyokubali na mafunzo yako yanabaki kuwa yako. Asante kwa kazi yako.
> SW (to the guide): Habari [mwongozaji]. [Jina] hayuko tena kwenye timu yako. Asante.
>
> EN (to the person): Hello [Name]. You are no longer on [guide]'s team. Your page, the notes you approved and your courses stay yours. Thank you for your work.
> EN (to the guide): Hello [guide]. [Name] is no longer on your team. Thank you.

**M6. A lead guide wrote a note**

> SW: Habari ndugu [Jina]. Mwongozaji [jina] ameandika kuhusu kazi yako kwenye safari ya [mwezi]: "[maneno]". Hayataonekana kwa umma mpaka wewe ukubali. Unaweza kuyaonyesha, kuyaficha au kujibu. Asante kwa kazi yako.
>
> EN: Hello [Name]. Guide [name] wrote about your work on the [month] trip: "[note]". It will not be public unless you agree. You can show it, hide it or reply. Thank you for your work.

**M7. Named in a traveller's review**

> SW: Hongera ndugu [Jina]. Mgeni [jina la kwanza] amekutaja kwenye maoni ya safari ya [mwezi]: "[maneno]". Ungependa yaonekane kwenye ukurasa wako? [Onyesha] [Ficha]. Asante kwa kazi yako.
>
> EN: Congratulations, [Name]. Your guest [first name] named you in a review of the [month] trip: "[thanks]". Would you like it to show on your page? [Show] [Hide]. Thank you for your work.

**M8. Job post, as a guide would write it (template; the guide fills in his own figures)**

> SW: Habari. Ninahitaji wapagazi 5 kwa safari ya Kilimanjaro, njia ya [njia], siku [n], kuanzia [tarehe]. Malipo: TZS [kiasi] kwa siku, yanalipwa ndani ya siku [n] baada ya safari kwa [pesa ya simu]. Tunatoa chakula, hema, godoro na nguo za baridi. Mzigo wa mgeni hauzidi kilo 20 kwa mtu. Bakshishi zinagawanywa [hivi]. Hakuna ada ya kuomba au kuajiriwa. Karibu, tafadhali bonyeza "Ninapenda kazi hii".
>
> EN: Hello. I need 5 porters for a Kilimanjaro climb, [route] route, [n] days, starting [date]. Pay: TZS [amount] a day, paid within [n] days after the trip by [mobile money]. We provide food, a tent, a sleeping mat and cold-weather clothes. Guest load is no more than 20 kg per person. Tips are shared [this way]. There is no fee to apply or to be hired. You are welcome to tap "I am interested".

**M9. Someone asks for your number**

> SW: Habari ndugu [Jina]. [Mwongozaji / kampuni] angependa kuwasiliana nawe kuhusu kazi ya [kazi]. Ungependa kumpa namba yako? [Ndiyo, mpe namba] [Hapana, asante]
>
> EN: Hello [Name]. [Guide / company] would like to contact you about a [role] job. Would you like to share your number? [Yes, share it] [No, thank you]

**M10. Private feedback route for crew**

> SW: Habari ndugu [Jina]. Kama kuna jambo halikwenda sawa kwenye safari, kwa mfano malipo yamechelewa, mzigo ulizidi, chakula au vifaa havikutosha, au uliombwa ada, tafadhali tuambie hapa. Tunasoma kila ujumbe. Hatutampa mwongozaji au kampuni jina lako bila ruhusa yako. Asante.
>
> EN: Hello [Name]. If something went wrong on a trip, for example late pay, a load that was too heavy, not enough food or gear, or being asked for a fee, please tell us here. We read every message. We will not give your name to the guide or company without your permission. Thank you.

**M11. About checks (on the crew profile page)**

> SW: Huhitaji ukaguzi wowote ili kuwa kwenye timu, kutajwa kwenye maoni ya wasafiri, au kuomba kazi. Kwetuly haikutozi ada yoyote.
>
> EN: You do not need any check to be on a team, to be named in travellers' reviews, or to apply for jobs. Kwetuly charges you no fee.

**M12. Course channel welcome**

> SW: Karibu kwenye Mafunzo, ndugu [Jina]. Hapa utaona kozi za upishi, huduma ya kwanza, lugha na uongozaji, na kile kinachohitajika kwa kila hatua. Kila kozi inaonyesha mtoaji, muda na gharama. Kozi haihakikishi kazi wala leseni. Asante kwa kujifunza nasi.
>
> EN: Karibu to Courses, [Name]. Here you can see courses in cooking, first aid, languages and guiding, and what each step usually needs. Each course shows the provider, length and cost. A course does not guarantee a job or a licence. Thank you for learning with us.

---

## 9. For other agents (no action taken)

- **tech-lead (2b):** consent stored per choice with date and method (screen or call, and who called); unclaimed invites deleted; crew can be in many teams; review notes hidden until approved; credits only from D1 crew lists; job pay as a number with an admin floor; contact sharing per request.
- **hr with legal (2c):** the tags in 4.2, the conduct process for reports about crew and from crew, the threshold in 4.8, the no-fee clause for guides and operators, the minimum-wage floor, whether job notices count as matching (question 28), and the minimum age (question 24).
- **security-reviewer:** consent records, call records, phone numbers, and the contact-sharing flow.
- **business-manager:** line up the crew check prices (2.3).
- **marketing:** update "wapagazi" in `docs/brand/voice.md`.
- **localization:** review all of section 8.

---

## Decisions for Walter

1. **Sign-up route.** Recommendation: start with guide-assisted invitations that the person confirms himself (screen, or a short call by Kwetuly for basic phones); add WhatsApp and SMS codes after the company and the WhatsApp sender exist; park USSD and paper forms.
2. **Crew never pay.** Row C3 says crew pay for checks; the 2026-10-30 decision says they never pay. Recommendation: crew never pay, not even by choice; only the guide or operator may pay, and only after company registration.
3. **Check prices.** Your US$5 porter / US$7 cook versus business-manager's TZS 15,000 per member. Recommendation: business-manager lines them up; you set the price later.
4. **No check required** for a team, a review mention or a job, and job posts may not ask for "checked only" crew. Recommendation: yes.
5. **Public profile.** Recommendation: first name, role, chosen photo, stated areas and languages in grey, teams, approved notes and credits; phone and everything in 3.2 private.
6. **Lead guide notes.** Recommendation: tags and a short note, no stars, the porter approves before it is public, problems go privately to Kwetuly with the porter's right to answer.
7. **Traveller credit.** Recommendation: travellers pick names only from the trip crew list; the person can show or hide each mention; no stars, no ranking.
8. **Jobs.** Recommendation: the fields in 6.1, pay as a number per day at or above a floor from legal, no fees, contact shared only when the person says yes; paying to see contact details waits for the advocate.
9. **Private feedback from crew** about pay, loads and fees. Recommendation: yes, with names never passed on without consent.
10. **Courses.** Recommendation: information only at first, no provider listed until you have contacted them, "Sponsored" labelled, no promise of a job or licence.
11. **Messages.** Approve the drafts in section 8 for localization review. None is sent until the feature is built and you approve it.
