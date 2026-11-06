# Plan for Walter's new ideas (2026-11-06)

Prepared by chief-of-staff from Walter's notes of 2026-11-06. This is paper only. Nobody has been contacted and nothing has been built. Walter decides every point marked **Waiting for Walter**.

## Muhtasari kwa Kiswahili

Mawazo yako yote yamepangwa katika makundi saba. Kwanza tunamaliza uzinduzi (launch). Kabla ya uzinduzi tunafanya kazi za karatasi tu: mpango wa kupata wanachama, hadithi za kuwashawishi maguide na wasafiri, barua pepe za kampuni, programu inayowekwa kwenye simu na kompyuta, na maelezo kuhusu TTB, TATO, KGA na vyama vya maguide (wewe ndiye utakayewasiliana nao). Baada ya uzinduzi tunaongeza maporter, wapishi, wapiga picha, maguide wa rekodi na documentary, wanamuziki, masomo ya Kiswahili, chakula cha Kichaga, hadithi za wasafiri na programu ya kusimamia safari. Mambo ya pesa (kupokea pesa kimataifa, misaada, foundation, rambi rambi, umiliki wa jamii) yanasubiri usajili wa kampuni na ushauri wa wakili, kwa sababu yanahitaji leseni. Visa na pasipoti, vibali, hospitali na wageni wa kujitolea (volunteers) ni hatari zaidi: tunaanza na ushauri wa kisheria tu. Jina ni Kwetuly, imeamuliwa. Waimbaji wa wagumu (maporter) watakuwa kitengo chao, na vifaa vinavyotolewa kwenye collection points vitapewa maporter (vitu tu, si pesa), huenda kwa kushirikiana na KGA. Wadhamini, baba Agata na mtu wa mama Axel ni kazi zako binafsi; timu haitawasiliana nao. (Maandishi haya ya Kiswahili yakaguliwe na localization.)

## Summary in English

- Launch first. Nothing below should delay the soft launch.
- **Now (before or at launch, paper and small things):** member acquisition plan, convincing stories for guides and travellers, our own email addresses, an installable website (phone and desktop), username web addresses, native-quality language tools, short briefs on TTB, TATO, KGA and guide associations (Walter makes every contact), and a grants research note.
- **Next (months 1 to 3 after launch):** porters and cooks signing up themselves, Kiswahili lessons, creative guides (photography, recording, documentary), musicians and singers, Chagga food experiences, traveller stories, the first version of trip management, agent portal improvements.
- **Later (after company registration and the advocate):** international payments and a financial partner, sponsors with honest labels, laundry pickup, permit helpers, volunteers, hospital and special care information, Tanzanians travelling abroad.
- **Park:** visa and passport processing by Kwetuly, holding fundraising or condolence money, community ownership and a guide-owned company, the swipe idea until conversion tests it. The name is closed: Kwetuly stays (2026-11-07).
- **Porters (answered 2026-11-07):** porter singing groups become their own unit after crew self-sign-up; donated gear and clothing for porters is planned on paper now, goods only, pilot after registration and legal.

## Existing rules this plan keeps

- Business model (2026-10): free listings, paid yearly "Checked by Kwetuly" badge (says what was checked and when), per-agreement commission disclosed to travellers, single-price offers. The tiered Regular/Premium/VIP model and escrow were rejected on 2026-10-13 and stay out.
- No charging before company registration and a legal way to take money (Selcom after registration; the advocate answers whether holding travellers' money needs Bank of Tanzania approval).
- Apple and Google store accounts as an organisation come after registration and the D-U-N-S number, so the store apps wait; the website is the launch product.
- Visa and insurance: link only to official sites. Kwetuly never applies for anyone.
- Crew (porters, cooks) never pay a fee to be listed with a lead guide; the verification fees Walter set on 2026-10-30 (guide US$10, chef US$7, porter US$5) start only after registration and payments.
- Sample data is always labelled. No invented partners, prices, ratings or facts. Anything not checked is marked "to verify".

Effort: S = days, M = 1 to 3 weeks, L = a month or more, XL = a new product.

---

## Theme 1. Growth: getting guides and travellers in

| # | Idea (plain English) | First step owner | First step produces | Depends on | Effort | Fit or conflict | When |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | **Member acquisition plan**: how we get people in, which tools, plugins and connectors we need | marketing (lead), with guide-success (guides), conversion (sign-up drop-off), data-analyst (tracking) | One plan: channels for guides and for travellers, a tool list with current prices marked "checked on [date]" or "to verify", what connects to what (PostHog, Resend, WhatsApp, Google), first 90-day targets as counts, not forecasts | PostHog account (Walter), launch date | M (paper) | Fits. Uses the existing invite and referral code tables | Now |
| 1.2 | **Convincing stories for guides and travellers** | marketing, with guide-success | A story kit: why a guide joins (in English and Kiswahili), why a traveller books a guide directly, using only true facts about Kwetuly; a list of real stories to collect later with consent | Real guides approved; media consent text (legal, exists in docs/legal/group-chat-media-consent.md) | S | Fits. No invented testimonials; samples never shown as real stories | Now |
| 1.3 | **TTB partnership** (Tanzania Tourist Board) | partnerships | One-page brief: what TTB is and does (official sources only), what Kwetuly could ask for and offer, what we must have first (company registration, real guides) | Company registration, probably | S | Fits | Paper now; Walter contacts, after registration |
| 1.4 | **TATO** (Tanzania Association of Tour Operators) | partnerships | Same one-page brief; note that operators may see Kwetuly as a competitor or a sales channel | As above | S | Fits the "Kwetuly introduces, the operator sells" rule | Paper now; Walter contacts |
| 1.5 | **Guide associations, to register guides in bulk** | guide-success | List of guide associations from official or public sources (name, who they represent, public contact page only), and a draft of what we would offer their members | Real-guide onboarding working | S | Fits: guides are the core customers | Paper now; Walter contacts |
| 1.6 | **KGA support**: help them coordinate condolence contributions (rambi rambi), keep a member database, run training; we give them tools | guide-success (offer), legal (money and data), tech-lead (fit) | A note: what a "tool for an association" could be (member list, training calendar, announcements) and what is not allowed for us (holding or moving condolence money) | KGA = Kilimanjaro Guides Association (confirmed by Walter 2026-11-07); legal on collecting money; PDPA for member data | M to L | New: an "association" account type. Holding money conflicts with "no holding funds" until the advocate answers | Paper now; build later; any money part parked |

## Theme 2. Product and platform

| # | Idea | First step owner | First step produces | Depends on | Effort | Fit or conflict | When |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.1 | **Mobile app first, and downloadable on desktop and phone** | tech-lead, then frontend-engineer | Note: make the website installable (a web app that can be added to the phone home screen and desktop; no manifest file exists in apps/web today), while the store apps wait for D-U-N-S | Nothing for the installable website; store apps need company, D-U-N-S, Apple and Google accounts, `eas init` | S (installable site), store apps already built and waiting | Fits. Does not change the plan: the website is the launch product | Now (installable site); store apps after D-U-N-S |
| 2.2 | **Username in the web address** (kwetuly.com/@name or similar) | tech-lead | Note: guides already have /guides/[slug]; who chooses the slug today, rules for changing it, reserved and offensive words, whether travellers and businesses get public pages at all | Privacy: travellers have no public profile today | S to M | Fits. Must not let people take a real business's name | Next (small, after launch) |
| 2.3 | **Our own professional email addresses** | devops, with business-manager for prices | Options and prices ("checked on [date]"): today any @kwetuly.com address forwards to kwetuly@gmail.com (ImprovMX) and alerts send through Resend; sending as yourself needs a mailbox service (for example Google Workspace or Zoho Mail, prices to verify) | Walter does every sign-up and DNS click | S | Fits | Now |
| 2.4 | **Trip management software**: day by day what is happening, trip progress, trip report, dietary needs, insurance details, transfers | tech-lead (data design), then designer | Data design draft: one "trip file" shared by the traveller and the guide, built from an accepted package or trip request: day-by-day plan, status of each day, dietary needs, link to the official insurance portals and the traveller's own policy number (optional), end-of-trip report | Health and dietary data are sensitive personal data (legal and security-reviewer before any build); transfers stay off until the advocate answers | L | Fits guide-first. Strong reason for guides to use Kwetuly every day. Must not become a booking-escrow system | Paper now; build month 2 to 4 |
| 2.5 | **Community of travellers and stories on profiles** (good and bad experiences, information) | tech-lead (fit), legal (defamation and moderation), customer-care (moderation rules) | Note: reviews exist (only after a real trip); "Guide stories" is planned in the menu; a traveller story feed needs reporting, moderation, and a rule that bad experiences name facts, not insults | Moderation capacity (operations-manager); legal on defamation | M | Fits, if honest: no fake stories, samples never shown as real | Next |
| 2.6 | **Swipe left and right, like dating apps** | conversion (test design), designer | One page: where swiping could help (for example browsing guides or packages quickly, saving favourites), where it must not be used (people choosing people by photo, ranking guides by looks), how to test it honestly | Enough real guides and packages (dozens) for swiping to make sense | M | Risk: it can turn guides into "rate my face", which conflicts with the no-ranking and honesty rules. Not a dating feature | Park until after launch; then test small |
| 2.7 | **Agent portal, international**, for agents looking for local partners | tech-lead, partnerships | Note: /partners/agents exists today; what an agent portal adds (an agent account, browsing guides and operators, enquiries); licence rules from docs/legal/travel-agent-and-transfers.md | Tour operator and travel agent accounts (board item P-c), legal licence check | M to L | Fits "Kwetuly introduces, the operator sells". No individual travel agents | Next to later |
| 2.8 | **Native-quality language**: find tools that help | localization | Research note: tools for checking the 7 languages (with prices "checked on [date]"), and why a native-speaker review is still needed (already a launch item) | None | S | Fits | Now |
| 2.9 | **Our own professional plan** | Walter to clarify | If it means a business plan document: business-manager updates docs/business/soft-launch-business-plan.md into one professional plan. If it means a paid "Pro" membership: this was retired on 2026-10-30 and conflicts with the rejected tiers | Walter's answer | S | See left | Waiting for Walter |

## Theme 3. New service categories on the guide and business side

All of these use the existing pieces: one guide profile with many services (decided 2026-10-30), guide package kinds, business types, and the jobs hub. No new account types unless stated.

| # | Idea | First step owner | First step produces | Depends on | Effort | Fit or conflict | When |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 | **Porters and cooks sign up themselves**, so a new company or a guide who gets a job suddenly can find a team; all trip roles in one place | tech-lead (fit with crews plan P-d), guide-success (sign-up texts), hr (code of conduct) | Note: move crew self-sign-up earlier; each crew member has their own profile approved by Walter; operators see contact details only after paying (Walter's 2026-10-30 decision) | Minimum wage and porter rules (docs/legal/paid-checks-operators-crews.md, much still "unverified"); verification fees only after registration | M | Fits the 2026-10-30 decisions. Kwetuly does not employ crew | Next (first after launch) |
| 3.2 | **Kiswahili lessons as income** | already planned (online lessons, Phase 3 of the 2026-10-29 plan) | Nothing new: teacher profile on the guide profile, prep-call booking with a video link; marketing note on who learns Kiswahili online | Paid calls need payments | M | Fits | Next |
| 3.3 | **Photographer guides in the bush and on the mountain** | guide-success, legal | A photography service type (a "photography" filter exists on /guides today); holiday photo walks only; drones and commercial filming excluded until legal (TCAA drone permit, Tanzania Film Board rules, park permits, as already noted in docs/business/hosts-and-new-services-2026-10-31.md) | Legal on permits | S to M | Fits | Next |
| 3.4 | **Recording guides** (help people who make music or sound recordings) and **documentary guides** (help documentary makers) | legal first, then business-manager | Note: these are "fixers"; professional filming needs permits; the 2026-10-31 view was "no-go for professional film fixing until month 12, registered fixer companies only, Kwetuly never applies for permits" | Legal; company registration | M | Fits as business listings with permits seen, not as individual guides doing permits | Later |
| 3.5 | **Musicians, guitar players and similar performers** | business-manager (model), legal (performer and event rules) | One page: a "performers" category (for events, hotels, private evenings): business type or guide service? Pricing set by the performer | Whether performers need a permit or a COSOTA (copyright) matter, **to verify** | M | New category: **Waiting for Walter** | Next to later |
| 3.6 | **Porter singers as their own category** ("wagumu" = porters, Walter 2026-11-07): porter singing groups, for example the songs Kilimanjaro porters sing, get their own unit so travellers and hotels can book a performance | guide-success (who and how), business-manager (who pays, porters keep their pay), legal (performer and copyright questions, **to verify**) | One page: a "porter singers" group profile linked to the crew profiles (each member approved by Walter), booked for camp evenings, hotel or welcome events; the group sets its own price and keeps it; consent before any recording or video is posted | Crew self-sign-up (3.1); media consent; payments only after registration | S to M | Fits porter welfare and the crew plan. Must not become unpaid entertainment demanded on climbs; singing is always optional and paid | Next, right after crew self-sign-up; **Waiting for Walter** (new category) |
| 3.7 | **Chagga food** (chakula cha Kichaga) | guide-success, marketing | A Chagga food experience as a guide package (cooking lesson or a home meal), with facts from public sources only; a sample, labelled | Cooking lessons service type (planned) | S | Fits (the moshi-chagga-town-tour and materuni tours already exist) | Next |
| 3.8 | **Laundry with pickup and return** of travellers' bags | business-manager, operations-manager, legal | One page: laundry as a business type (the laundry business collects and returns; the traveller pays the laundry), never Kwetuly carrying bags; liability for lost items stays with the business | Business per-type forms (board item P-b) | S to M | Fits the shop rule "the business delivers and sets its own charge" | Later (small) |
| 3.9 | **Permit helper** ("mtu wa kushughulikia permit kuikata", someone who gets permits; "kuchanganya nke" is unclear) | legal | Note: who may buy park and climbing permits for others (likely only licensed operators, **to verify**); Kwetuly never applies for permits | Legal; company registration | M | Risky: permits are regulated | Later; **Waiting for Walter** |
| 3.10 | **Volunteers**: people abroad who want to volunteer create profiles; organisations post needs | legal, hr | Legal note: what permit a foreign volunteer needs in Tanzania (**to verify** with official immigration sources), child-protection risks (no orphanage volunteering), vetting by hr; business-manager on whether it fits at all | Legal; registration; vetting process | L | Risky and outside the guide-first core: **Waiting for Walter** | Later or park |
| 3.11 | **Hospital and special care for visitors** | legal, partnerships | Note: an information page of official health links and hospitals' own public information only; no medical advice, no "best hospital", no handling of health data; any listed clinic shows its licence seen and the date | Legal (health data, medical rules) | M | Fits only as information or a listing with documents; anything more is **Waiting for Walter** | Later |

## Theme 4. Tanzanians travelling abroad (China, Dubai and others)

| # | Idea | First step owner | First step produces | Depends on | Effort | Fit or conflict | When |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | **Agents abroad who receive Tanzanian travellers**, help with the visa process and the passport process | legal (first), business-manager | Legal note: travel agent licence classes (MNRT), what helping with visas or passports means legally, fraud and data risks; business view: a new market (outbound), a different customer, a different supply | Company registration, travel agent licence, legal | XL | Conflicts with the current focus (inbound to Tanzania, guide-first). Visa and passport: we only link official sites, never apply. **Waiting for Walter** | Park; paper only for now |

## Theme 5. Money: receiving payments, partners, grants, sponsors

| # | Idea | First step owner | First step produces | Depends on | Effort | Fit or conflict | When |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.1 | **A very good system to receive money internationally, with several options** | payments-engineer (research exists: docs/business/payments-research-2026-10-30.md) | Update only: Selcom main, Flutterwave backup; no new research until the advocate answers the three open questions (card surcharge ban online, shilling rule, holding funds) | Company registration, Selcom merchant account, advocate | L | Fits. Not escrow. Crypto stays parked | After registration |
| 5.2 | **Partnership with financial institutions for the long term**, "because we already have people" | business-manager | One page: what a partnership could mean (business account, merchant account, mobile-money collection, payouts, a co-branded offer for guides such as savings or loans), what a bank would ask for (registration, figures), and the rule that guide data is never shared without consent | Company registration, real user numbers (we have none to show yet: no real guides approved) | M | Fits later. Do not promise user numbers we do not have. Nobody contacts a bank | Paper next; Walter contacts after registration |
| 5.3 | **Grants research** (Tanzania, Africa, YouTube videos) | business-manager, with accounting | Research note: grant programmes for tourism or digital businesses in Tanzania and Africa from official programme pages (not YouTube claims), eligibility (most need a registered company), deadlines, effort | Company registration for most grants | M | Fits | Now (paper) |
| 5.4 | **Sponsors**: big shop owners as sponsors; painters and sponsors get a place to advertise | business-manager (packages), legal (advertising rules) | One page: sponsor packages that stay honest: labelled "Sponsored", never change how guides are ranked, never look like the badge; painters as shop listings (art category exists) | Company registration to invoice | M | Possible conflict: paid placement next to the honest badge. Must be clearly separate | Paper next; selling after registration |
| 5.5 | **Sponsors written in Walter's notebook** | Walter | Walter's own follow-up. business-manager can draft one generic sponsor proposal template (no names) once 5.4 is approved | 5.4 | S | | Walter's task |

## Theme 6. Giving: foundation, donations, fundraising, ownership

All of these handle other people's money or goods, or ownership of the company. They need the company registered and a Tanzanian advocate first.

| # | Idea | First step owner | First step produces | Depends on | Effort | Fit or conflict | When |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6.1 | **Kwetuly Foundation** | legal | Note for the advocate: which registration a foundation, trust or NGO needs in Tanzania (law and registrar **to verify**), separate bank account and books, how it must stay separate from the company | Company registration, advocate, accounting | L | New entity: **Waiting for Walter** | Later |
| 6.2 | **Donated goods for porters** ("wagumu" = porters, Walter 2026-11-07): travellers leave gear and clothing (boots, jackets, gloves and similar) at Kwetuly collection points, and Kwetuly passes them to porters | operations-manager (process), guide-success (link with KGA and porter welfare), legal (liability) | One page: goods only, never money; where items are collected (to be decided by Walter), a simple log (item, date, condition, who received it, no personal data in shared files), fair sharing rule so it is not favouritism, how it could run with KGA or an existing porter-welfare programme (only after Walter makes the contact); public wording stays factual, no claims of impact we cannot show | Walter decides collection points; KGA contact by Walter; advocate on liability (lost or damaged items, customs on goods sent from abroad, used-goods rules **to verify**); may later sit under the foundation (6.1) | M | Fits porter welfare and the crew plan. Risks: theft or loss at the point, items unfit to use, claims of misuse, looking like a charity before any registration. Kwetuly holds no money | Paper now; small pilot after registration and legal; **Waiting for Walter** |
| 6.3 | **Fundraising** ("kuratibu fund raising") | legal | Part of the 6.1 note: rules for collecting money from the public in Tanzania, **to verify** | 6.1 | L | Holding money conflicts with the "no holding funds" rule until the advocate answers | Park |
| 6.4 | **Condolence contributions (rambi rambi) for KGA** | legal (with 1.6) | Part of the 6.1 note: Kwetuly gives tools only; the association collects and holds its own money | Advocate | M | Same as 6.3 | Tools later; money part park |
| 6.5 | **Community ownership** | legal, business-manager | Note for the advocate: options (shares for guides, a cooperative, profit share), what each needs (company registration first; offering shares to many people may be regulated, **to verify**), effect on investors later | Company registration, advocate | L | Big decision: **Waiting for Walter** | Park until registration |
| 6.6 | **"We set up a company and the guides recommend the company"** (Walter's last line; meaning not clear) | Walter to clarify | Question for Walter: does this mean guides become part-owners, or guides recommend Kwetuly to others, or a separate company for guides? | Answer | S | Links to 6.5 | Waiting for Walter |

## Theme 7. Name

| # | Idea | Note |
| --- | --- | --- |
| 7.1 | **Name: Rafrikaly, Poaly or Jamboly** | **Closed, DECIDED 2026-11-07: Walter keeps Kwetuly.** No checks of the other names. |

## Walter's own follow-ups (the team does not plan any contact)

- Sponsors written in his notebook: check them and decide who gets a proposal (template from business-manager on request, without names).
- "Baba Agata" as a possible sponsor.
- "The person of mama Axel".
- Any contact with TTB, TATO, KGA, guide associations, banks, grant bodies or sponsors: Walter only, after the briefs.
- Company registration and finding the Tanzanian advocate (already on the board); most money and giving ideas wait for these.

## Questions for Walter (we are not sure what these mean)

Answered 2026-11-07: "wagumu" = porters (see 3.6 and 6.2); KGA = Kilimanjaro Guides Association.

1. "Kuchanganya nke" (permits): what does this mean?
2. "Mbele": a dish, a place, or a note meaning "next"?
3. "We should have our very own professional plan": a business plan document, or a paid membership plan?
4. "Tunaweka kampuni alafu maguide ndoa wanapendekeza kampuni": see 6.6.
5. "Ndoa" in "vyama vya maguide huku ndoa tutapata maguide": we read it as "ndio" (that is where we will find guides). Correct?

## Licences and risks in Tanzania (red flags)

| Area | Why it is risky | Who checks first |
| --- | --- | --- |
| Receiving money internationally, holding it, paying out | Payment services and holding money for others may need Bank of Tanzania approval; foreign currency and shilling rules; card surcharge ban | legal and the advocate; payments-engineer |
| Visa and passport help, outbound agents | Immigration rules; travel agent licence (reported as for Tanzanian-owned companies); fraud and identity-document data | legal and the advocate |
| Park and climbing permits | Likely only licensed operators may buy them for others (to verify) | legal |
| Filming, recording, drones | Film permits, TCAA drone permits, park permits | legal |
| Hospital and special care | Medical advice, health data (sensitive personal data under the PDPA 2022) | legal, security-reviewer |
| Foundation, donations, fundraising, condolence money | Registration of the entity, public fundraising rules, customs on donated goods, misuse claims | legal and the advocate, accounting |
| Volunteers from abroad | Immigration permits for volunteers (to verify), child protection, vetting | legal, hr |
| Community ownership | Company law; offering shares widely may be regulated (to verify) | legal and the advocate |
| Sponsors and advertising | Consumer law; paid placement must not look like the badge or a recommendation | legal |
| Trip management with dietary and insurance details | Sensitive personal data, storage and access rules | legal, security-reviewer |

## Recommended order

**Now (paper, in parallel, does not delay launch)**
1. marketing with guide-success, conversion, data-analyst: member acquisition plan and story kit (1.1, 1.2).
2. partnerships and guide-success: briefs on TTB, TATO, guide associations and KGA (1.3 to 1.6).
3. tech-lead: fit note for 2.1, 2.2, 2.4, 2.5, 2.7, 3.1, and new service types (3.3, 3.5, 3.7, 3.8).
4. devops with business-manager: email options (2.3).
5. localization: language tools note (2.8).
6. business-manager with accounting: grants note (5.3), financial partner page (5.2), sponsor packages (5.4), business view of new categories (3.5, 3.8, 3.10).
7. legal: one risk memo with questions for the advocate covering every red flag above.

**Small build at launch, after Walter approves:** installable website (2.1), then qa-tester.

**Next (months 1 to 3 after launch):** crew self-sign-up (3.1), then porter singers (3.6), username addresses (2.2), Kiswahili lessons (3.2), photography service and Chagga food package (3.3, 3.7), traveller stories (2.5), trip management version 1 (2.4), each through security-reviewer and qa-tester.

**Later (after company registration and the advocate):** payments and a financial partner (5.1, 5.2), sponsors (5.4), other performers (3.5), donated gear for porters pilot (6.2), laundry (3.8), agent portal (2.7), recording and documentary fixers (3.4), permit helper (3.9), hospital information (3.11), KGA tools (1.6), foundation (6.1).

**Park:** outbound travel with visa and passport help (4.1), fundraising and condolence money (6.3, 6.4), community ownership (6.5), volunteers (3.10) until legal answers, swipe (2.6) until there is enough real supply. Name (7.1) closed: Kwetuly stays.

## Decisions for Walter

1. **Order.** Recommendation: launch first; only paper work and the installable website before launch; the rest in the order above.
2. **Name.** DECIDED 2026-11-07: keep Kwetuly. Closed.
3. **New categories** (porters and cooks self-sign-up, porter singers, photographers, recording and documentary guides, musicians, laundry, volunteers, hospital care, permit helpers). Recommendation: yes now to porters and cooks (first after launch), then porter singers as a group linked to crew profiles, photography walks and Chagga food; other performers and laundry after a business view; recording and documentary, permits, volunteers and hospital only after legal.
4. **Money handling** (international payments, financial partner). Recommendation: no new provider work until company registration and the advocate's answer on holding funds; business-manager drafts the partner page now; you make every bank contact.
5. **Sponsors and advertising.** Recommendation: allowed only as clearly labelled "Sponsored", never affecting guide order, never looking like the badge; nothing sold before registration.
6. **Foundation, fundraising, condolence money.** Recommendation: park until the company is registered; legal prepares advocate questions now; Kwetuly holds no money.
6b. **Donated gear and clothing for porters.** Recommendation: operations-manager and guide-success write the process on paper now (goods only, log, fair sharing, possible tie-in with KGA and porter welfare, which you would contact); you choose collection points; a small pilot only after registration and the advocate's answer on liability.
7. **Community ownership and a guide-backed company.** Recommendation: park until registration; legal and business-manager prepare options for the advocate; please answer question 6.6 first.
8. **Swipe idea.** Recommendation: park until there are enough real guides; then conversion tests it on packages or saving favourites, never on choosing people by face.
9. **Trip management.** Recommendation: yes, paper design now (tech-lead), build months 2 to 4, with dietary and insurance details only after legal and security-reviewer.
10. **Tanzanians travelling abroad.** Recommendation: park; legal note only; Kwetuly never handles visas or passports.
11. **Installable website and username addresses.** Recommendation: installable website at launch (small); username addresses after launch, guides first, travellers stay private.
12. **Our own email.** Recommendation: yes; devops lists options and prices, you sign up and make the DNS clicks.
13. **Partner briefs (TTB, TATO, KGA, guide associations).** Recommendation: briefs now; you make contact only after company registration and with real guides on the site.
14. **Professional plan.** Recommendation: if you mean a business plan, business-manager updates the existing plan; a paid Pro membership stays retired.
15. **The 5 open questions above.** Please answer when you can; those items wait.
