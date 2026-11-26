// Ways in to host sign-up (board slice W1-3, 2026-11-26): the menu and footer links, the "Become a
// concierge or VIP host" option next to the account types on sign-up, and the concierge explainer on
// /hosts and the app's hosts screen.
// Links and the sign-up option are seen by travellers too, so they are in all 7 languages. The
// explainer and notes are host texts: English and Kiswahili, other languages show English.
// Wording follows docs/legal/vip-and-investment-hosts.md (draft for a Tanzanian advocate): no
// security, protection or bodyguard work; "VIP" describes the style of service only; no investment,
// legal or tax advice. The Kiswahili and the other languages are drafts for native-speaker review.
import { L, type Label, type Locale } from '../locales';

/** Traveller-facing: shown to everyone, in all 7 languages. */
export const HOSTS_ENTRY_LINKS: {
  concierge: { label: Label; blurb: Label };
  investment: { label: Label; blurb: Label };
  /** The sign-up option next to Traveller, Guide and Business (concierge sign-up open). */
  join: { title: Label; body: Label };
  /** The same option when only investment visit host sign-up is open. */
  joinInvestment: { title: Label; body: Label };
  /** The app's hosts screen when both switches are off. */
  closed: Label;
} = {
  concierge: {
    label: L(
      'Become a concierge or VIP host',
      'Kuwa concierge au mwenyeji wa VIP',
      'Devenir concierge ou hôte VIP',
      'Diventa concierge o host VIP',
      'Concierge oder VIP-Gastgeber werden',
      'Zostań konsjerżem lub opiekunem VIP',
      '成为礼宾或 VIP 陪同',
    ),
    blurb: L(
      'Look after VIP guests during their stay, approved one by one',
      'Hudumia wageni wa VIP wakati wa safari yao; kila mwombaji anaidhinishwa',
      'Accompagner des invités VIP pendant leur séjour, sur validation individuelle',
      'Segui ospiti VIP durante il soggiorno, con approvazione individuale',
      'VIP-Gäste während ihres Aufenthalts betreuen, einzeln freigegeben',
      'Opiekuj się gośćmi VIP podczas pobytu, każda osoba zatwierdzana osobno',
      '在贵宾旅途中照顾他们，逐一审核',
    ),
  },
  investment: {
    label: L(
      'Become an investment visit host',
      'Kuwa mwenyeji wa ziara za uwekezaji',
      'Devenir hôte de visites d’investissement',
      'Diventa host per visite d’investimento',
      'Gastgeber für Investitionsbesuche werden',
      'Zostań opiekunem wizyt inwestycyjnych',
      '成为投资考察陪同',
    ),
    blurb: L(
      'Plan visits and introductions for business visitors, with no advice',
      'Panga ziara na utambulisho kwa wageni wa biashara, bila kutoa ushauri',
      'Organiser visites et mises en relation pour des visiteurs d’affaires, sans conseil',
      'Organizza visite e presentazioni per visitatori d’affari, senza consulenza',
      'Besuche und Kontakte für Geschäftsreisende planen, ohne Beratung',
      'Planuj wizyty i spotkania dla gości biznesowych, bez doradztwa',
      '为商务访客安排行程与引荐，不提供咨询',
    ),
  },
  join: {
    title: L(
      'Become a concierge or VIP host',
      'Kuwa concierge au mwenyeji wa VIP',
      'Devenir concierge ou hôte VIP',
      'Diventa concierge o host VIP',
      'Concierge oder VIP-Gastgeber werden',
      'Zostań konsjerżem lub opiekunem VIP',
      '成为礼宾或 VIP 陪同',
    ),
    body: L(
      'For registered tour guides who look after VIP guests or business visitors. Please read what the work is first.',
      'Kwa waongozaji wa watalii waliosajiliwa wanaohudumia wageni wa VIP au wageni wa biashara. Tafadhali soma kwanza kazi hii ni ipi.',
      'Pour les guides enregistrés qui accompagnent des invités VIP ou des visiteurs d’affaires. Merci de lire d’abord en quoi consiste ce travail.',
      'Per guide registrate che seguono ospiti VIP o visitatori d’affari. Leggi prima in cosa consiste il lavoro.',
      'Für registrierte Guides, die VIP-Gäste oder Geschäftsreisende betreuen. Bitte lesen Sie zuerst, worum es bei der Arbeit geht.',
      'Dla zarejestrowanych przewodników, którzy opiekują się gośćmi VIP lub gośćmi biznesowymi. Najpierw przeczytaj, na czym polega ta praca.',
      '面向已注册的导游，照顾贵宾或商务访客。请先了解这份工作的内容。',
    ),
  },
  joinInvestment: {
    title: L(
      'Become an investment visit host',
      'Kuwa mwenyeji wa ziara za uwekezaji',
      'Devenir hôte de visites d’investissement',
      'Diventa host per visite d’investimento',
      'Gastgeber für Investitionsbesuche werden',
      'Zostań opiekunem wizyt inwestycyjnych',
      '成为投资考察陪同',
    ),
    body: L(
      'For registered tour guides who help business visitors with plans and introductions. Please read what the work is first.',
      'Kwa waongozaji wa watalii waliosajiliwa wanaowasaidia wageni wa biashara kwa mipango na utambulisho. Tafadhali soma kwanza kazi hii ni ipi.',
      'Pour les guides enregistrés qui aident des visiteurs d’affaires à organiser leur programme et leurs rencontres. Merci de lire d’abord en quoi consiste ce travail.',
      'Per guide registrate che aiutano i visitatori d’affari con programmi e presentazioni. Leggi prima in cosa consiste il lavoro.',
      'Für registrierte Guides, die Geschäftsreisenden bei Planung und Kontakten helfen. Bitte lesen Sie zuerst, worum es bei der Arbeit geht.',
      'Dla zarejestrowanych przewodników, którzy pomagają gościom biznesowym w planach i spotkaniach. Najpierw przeczytaj, na czym polega ta praca.',
      '面向已注册的导游，协助商务访客安排行程与引荐。请先了解这份工作的内容。',
    ),
  },
  closed: L(
    'Sorry, host sign-up is not open at the moment.',
    'Samahani, usajili wa wenyeji haujafunguliwa kwa sasa.',
    'Désolé, l’inscription des hôtes n’est pas ouverte pour le moment.',
    'Ci dispiace, l’iscrizione degli host non è aperta al momento.',
    'Entschuldigung, die Anmeldung für Gastgeber ist gerade nicht geöffnet.',
    'Przepraszamy, rejestracja opiekunów jest obecnie zamknięta.',
    '抱歉，陪同人员注册目前尚未开放。',
  ),
};

/** Host texts: English and Kiswahili. */
export type HostsEntryText = {
  /** Heading of the kinds list when only one kind of host is open. */
  oneKindTitle: string;
  conciergeTitle: string;
  conciergeDoes: string[];
  conciergeNot: string;
  serviceNote: string;
  joinIntent: string;
  notGuide: string;
  continueGuide: string;
  /** Next step for a signed-in traveller or business account: ask Kwetuly to get in touch. */
  askContact: string;
  askContactSent: string;
};

const en: HostsEntryText = {
  oneKindTitle: 'Host work open now',
  conciergeTitle: 'What a concierge or VIP host does',
  conciergeDoes: [
    'You look after VIP guests during their stay and are their one point of contact, from arrival to departure.',
    'You plan each day with the guest and go along, explaining the places you visit.',
    'You book restaurants and activities in the guest’s own name. The guest pays each business directly.',
    'You bring in licensed guides and businesses on Kwetuly when the guest needs them.',
    'You keep the guest’s name, plans and whereabouts private.',
  ],
  conciergeNot: 'A concierge is not a bodyguard. Security, protection and escort work are not part of this service.',
  serviceNote: 'After approval, Kwetuly will ask you which host service you would like to add: "Personal trip host" or "Investment visit host". Kwetuly checks each service before it appears.',
  joinIntent:
    'Karibu. You are applying to be a host. Please create a guide account below and complete the guide steps. After approval, Kwetuly will ask you which host service you would like to add.',
  notGuide: 'Hosts apply with a guide account. You are signed in with another account type. Would you like Kwetuly to contact you about it?',
  continueGuide: 'Continue your guide profile',
  askContact: 'Please contact me',
  askContactSent: 'Thank you. Kwetuly will contact you using the details on your account.',
};

const sw: HostsEntryText = {
  oneKindTitle: 'Kazi ya mwenyeji iliyo wazi sasa',
  conciergeTitle: 'Concierge au mwenyeji wa VIP anafanya nini',
  conciergeDoes: [
    'Unawahudumia wageni wa VIP wakati wa safari yao, na wewe ndiye mtu wao mmoja wa kuwasiliana naye tangu wanapowasili hadi wanapoondoka.',
    'Unapanga kila siku pamoja na mgeni na kuongozana naye, ukieleza maeneo mnayotembelea.',
    'Unaweka nafasi za migahawa na shughuli kwa jina la mgeni mwenyewe. Mgeni analipa kila biashara moja kwa moja.',
    'Unawaleta waongozaji na biashara zenye leseni walio kwenye Kwetuly mgeni anapowahitaji.',
    'Unatunza siri ya jina la mgeni, mipango yake na mahali alipo.',
  ],
  conciergeNot: 'Concierge si mlinzi binafsi. Kazi ya ulinzi, usalama au kusindikiza kwa usalama si sehemu ya huduma hii.',
  serviceNote: 'Baada ya kuidhinishwa, Kwetuly itakuuliza ni huduma ipi ya mwenyeji ungependa kuongeza: "Mwenyeji wa safari binafsi" au "Mwenyeji wa ziara za uwekezaji". Kwetuly inakagua kila huduma kabla haijaonekana.',
  joinIntent:
    'Karibu. Unaomba kuwa mwenyeji. Tafadhali fungua akaunti ya mwongozaji hapa chini na ukamilishe hatua za mwongozaji. Baada ya kuidhinishwa, Kwetuly itakuuliza ni huduma ipi ya mwenyeji ungependa kuongeza.',
  notGuide: 'Wenyeji wanaomba kwa akaunti ya mwongozaji. Umeingia kwa aina nyingine ya akaunti. Ungependa Kwetuly ikuwasiliane kuhusu hili?',
  continueGuide: 'Endelea na wasifu wako wa mwongozaji',
  askContact: 'Tafadhali niwasiliane',
  askContactSent: 'Asante. Kwetuly itawasiliana nawe kwa taarifa zilizo kwenye akaunti yako.',
};

export const HOSTS_ENTRY_TEXT: Partial<Record<Locale, HostsEntryText>> & { en: HostsEntryText } = { en, sw };

export const hostsEntryText = (locale: Locale | string): HostsEntryText => HOSTS_ENTRY_TEXT[locale as Locale] ?? en;
