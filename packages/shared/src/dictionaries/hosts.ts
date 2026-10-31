// "Become a host" page (/[lang]/hosts). Host texts are guide/owner texts: English and Kiswahili.
// Other languages fall back to English. Source: docs/guides/bike-village-hosts-2026-10-31.md section 4,
// with the [legal] and [hr] points filled from docs/legal/vip-and-investment-hosts.md and
// docs/team/host-vetting-and-conduct.md. Both are drafts for a Tanzanian advocate; the Kiswahili
// text is a draft for native-speaker review.
import type { Locale } from '../locales';

export type HostsText = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  intro: string;
  kindsTitle: string;
  kinds: { name: string; body: string }[];
  notOfferedTitle: string;
  notOffered: string[];
  howTitle: string;
  how: string[];
  goodTitle: string;
  good: string[];
  conductTitle: string;
  conduct: string[];
  draftNote: string;
  apply: string;
  applyNote: string;
};

const en: HostsText = {
  metaTitle: 'Become a host',
  metaDescription: 'Personal trip hosts and investment visit hosts on Kwetuly: what the work is, what is not offered and how Kwetuly approves each applicant.',
  title: 'Become a host with Kwetuly',
  intro:
    'Some visitors want one trusted person to plan their days and introduce them to the right people. As a Kwetuly host, you do that work at the price you set yourself.',
  kindsTitle: 'Two kinds of host',
  kinds: [
    {
      name: 'Personal trip host',
      body: 'You plan and go along on private, quiet trips. You plan each day, introduce visitors to guides on Kwetuly and keep their personal details private.',
    },
    {
      name: 'Investment visit host',
      body: 'You help visitors who come to look at business in Tanzania with schedules, getting around, language and introductions. You point them to official government websites only. You do not give investment, legal or tax advice, and you never promise permits, approvals or speed.',
    },
  ],
  notOfferedTitle: 'What Kwetuly does not offer',
  notOffered: [
    'Security, close protection or bodyguard work is not offered through Kwetuly. Please do not list it on your profile, and do not use words such as "security", "protection" or "safe escort".',
    'For now, driving and transfers are not part of the host service. If a visitor needs a car, they book a licensed transport company themselves.',
    'No investment, legal or tax advice. Hosts never file, sign or act for a visitor before TISEZA, BRELA or any other office, and never hold or move a visitor’s money.',
    'No payments to officials and no promised results, ever.',
  ],
  howTitle: 'How it works',
  how: [
    'Sign up in the same five steps as our guides: About you, What you do, Documents, Story and links, Prep calls.',
    'Kwetuly reviews and approves each applicant one by one. Not every application is accepted.',
    'Once approved, you add your services. Kwetuly approves each one before it appears.',
    'You set your own price. Kwetuly’s share is explained clearly before you agree.',
  ],
  goodTitle: 'Good to know',
  good: [
    'We do not promise income or a number of bookings.',
    'We understand that host work counts as tour guiding, which Tanzanian rules reserve for registered Tanzanian citizens. Our advocate is confirming this; until then we only accept applicants with a tour guide registration. We tell you what we check and when.',
    'Upload documents only in the secure Documents step. Never send ID or documents by WhatsApp, email or message.',
    'We ask only for what we need to review your application.',
  ],
  conductTitle: 'The host code of conduct',
  conduct: [
    'Keep everything about a visitor private: who they are, where they stay, their plans, meetings and documents. Do not post or photograph them without their written consent, during or after the trip.',
    'No gifts that create an obligation. A small, voluntary thank-you given openly is fine; anything more is declined and reported to Kwetuly.',
    'No hidden commissions and no side deals. If a hotel, shop or anyone else pays you for sending a visitor, Kwetuly must approve it and the visitor must be told in writing first.',
    'Offering or paying a bribe, sharing a visitor’s details, giving investment advice or acting as security leads to immediate suspension.',
  ],
  draftNote: 'These rules are being reviewed by a Tanzanian advocate and may change before hosts go live. Approved hosts accept the final version before their services appear.',
  apply: 'Apply to become a host',
  applyNote: 'You will create a guide account first. Tell us in your story that you want to be a host.',
};

const sw: HostsText = {
  metaTitle: 'Kuwa mwenyeji',
  metaDescription: 'Wenyeji wa safari binafsi na wa ziara za uwekezaji kwenye Kwetuly: kazi ni ipi, nini hakitolewi na jinsi Kwetuly inavyoidhinisha kila mwombaji.',
  title: 'Kuwa mwenyeji wa Kwetuly',
  intro:
    'Baadhi ya wageni wanataka mtu mmoja wa kuaminika wa kupanga siku zao na kuwatambulisha kwa watu sahihi. Ukiwa mwenyeji wa Kwetuly, unafanya kazi hiyo kwa bei unayoiweka mwenyewe.',
  kindsTitle: 'Aina mbili za wenyeji',
  kinds: [
    {
      name: 'Mwenyeji wa safari binafsi',
      body: 'Unapanga na kuongozana na wageni katika safari za faragha na tulivu. Unapanga kila siku, unawatambulisha kwa waongozaji walio kwenye Kwetuly na unatunza siri ya taarifa zao binafsi.',
    },
    {
      name: 'Mwenyeji wa ziara za uwekezaji',
      body: 'Unawasaidia wageni wanaokuja kuangalia biashara Tanzania kwa ratiba, kuzunguka, lugha na kuwatambulisha. Unawaelekeza kwenye tovuti rasmi za serikali tu. Hutoi ushauri wa uwekezaji, sheria wala kodi, na huahidi kamwe vibali, idhini wala kasi.',
    },
  ],
  notOfferedTitle: 'Kile ambacho Kwetuly haitoi',
  notOffered: [
    'Kazi ya ulinzi au mlinzi binafsi haitolewi kupitia Kwetuly. Tafadhali usiiweke kwenye wasifu wako, na usitumie maneno kama "ulinzi", "usalama" au "kusindikiza kwa usalama".',
    'Kwa sasa, kuendesha gari na kusafirisha wageni si sehemu ya huduma ya mwenyeji. Mgeni akihitaji gari, anaweka nafasi mwenyewe kwa kampuni ya usafiri yenye leseni.',
    'Hakuna ushauri wa uwekezaji, sheria wala kodi. Wenyeji hawajazi, hawasaini wala hawamwakilishi mgeni mbele ya TISEZA, BRELA au ofisi nyingine yoyote, na hawashiki wala kuhamisha pesa za mgeni.',
    'Hakuna malipo kwa maafisa, na hakuna ahadi ya matokeo, kamwe.',
  ],
  howTitle: 'Jinsi inavyofanya kazi',
  how: [
    'Jisajili kwa hatua tano zile zile za waongozaji: Kuhusu wewe, Unachofanya, Nyaraka, Hadithi na viungo, Simu za maandalizi.',
    'Kwetuly inakagua na kuidhinisha kila mwombaji mmoja mmoja. Si kila ombi linakubaliwa.',
    'Ukikubaliwa, unaongeza huduma zako. Kwetuly inaidhinisha kila huduma kabla haijaonekana.',
    'Unaweka bei yako mwenyewe. Sehemu ya Kwetuly inaelezwa wazi kabla hujakubali.',
  ],
  goodTitle: 'Ni vizuri kujua',
  good: [
    'Hatuahidi kipato wala idadi ya wageni.',
    'Tunavyoelewa, kazi ya mwenyeji inahesabika kama kuongoza watalii, ambayo kanuni za Tanzania zimewawekea raia wa Tanzania waliosajiliwa. Wakili wetu anathibitisha hili; hadi hapo tunapokea waombaji wenye usajili wa mwongozaji wa watalii tu. Tutakuambia tunachokagua na lini.',
    'Pakia nyaraka kwenye hatua salama ya Nyaraka tu. Usitume kamwe kitambulisho au nyaraka kwa WhatsApp, barua pepe au ujumbe.',
    'Tunaomba tu kile tunachohitaji kukagua ombi lako.',
  ],
  conductTitle: 'Kanuni za maadili za wenyeji',
  conduct: [
    'Tunza siri ya kila kitu kuhusu mgeni: yeye ni nani, anakaa wapi, mipango yake, mikutano na nyaraka. Usimweke mtandaoni wala kumpiga picha bila idhini yake ya maandishi, wakati wa safari au baadaye.',
    'Hakuna zawadi zinazoleta deni la fadhila. Shukrani ndogo ya hiari inayotolewa wazi ni sawa; zaidi ya hapo unaikataa na kuiripoti kwa Kwetuly.',
    'Hakuna kamisheni za siri wala makubaliano ya pembeni. Hoteli, duka au mtu yeyote akikulipa kwa kumpeleka mgeni, Kwetuly lazima iidhinishe na mgeni aambiwe kwa maandishi kwanza.',
    'Kutoa au kulipa rushwa, kutoa taarifa za mgeni, kutoa ushauri wa uwekezaji au kufanya kazi ya ulinzi kunasababisha kusimamishwa mara moja.',
  ],
  draftNote: 'Kanuni hizi zinakaguliwa na wakili wa Tanzania na zinaweza kubadilika kabla wenyeji hawajaanza. Wenyeji walioidhinishwa wanakubali toleo la mwisho kabla huduma zao hazijaonekana.',
  apply: 'Omba kuwa mwenyeji',
  applyNote: 'Utafungua akaunti ya mwongozaji kwanza. Tuambie kwenye hadithi yako kuwa unataka kuwa mwenyeji.',
};

export const HOSTS_TEXT: Partial<Record<Locale, HostsText>> & { en: HostsText } = { en, sw };

export const hostsText = (locale: Locale | string): HostsText => HOSTS_TEXT[locale as Locale] ?? en;
