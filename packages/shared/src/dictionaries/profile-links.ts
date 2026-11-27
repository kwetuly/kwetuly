// Profile links (slice S5): Google Business Profile, YouTube, the guide's own website, and the
// Instagram, Facebook and TikTok links a guide or business adds.
// - `profileLinksShownText`: what travellers see on a guide page, in all 7 languages.
// - `profileLinksText`: the links page for guides and business owners, English and Kiswahili
//   (Kiswahili for 'sw', English for every other language, like linkTexts).
// Drafts: localization and Walter check the Kiswahili and the other languages.
import type { Locale } from '../locales';
import { PROFILE_LINK_EXAMPLES, PROFILE_LINK_NAMES, type LinkFailure, type ProfileLinkKind } from '../links';

// ---------------------------------------------------------------------------
// Traveller texts (7 languages)
// ---------------------------------------------------------------------------

const shownEn = {
  /** Heading of the links block in the About part of a guide page. {name} = the guide's name. */
  title: 'Find {name} online',
  /** Under the heading: Kwetuly does not run these sites. */
  note: 'These links go to sites that Kwetuly does not run or check.',
  /** The guide's own website, shown below the "Ask {name}" box (the design's "Ask to book"). */
  website: '{name}\'s own website',
  /** Label for the website in the links block. */
  websiteLabel: 'Website',
  /** The Google Business Profile link, named for travellers. */
  google: 'Google Maps',
  /** Read out after each link for screen readers. */
  newTab: '(opens in a new tab)',
  /** Next to a host written in punycode (xn--), so a lookalike address is noticed. */
  punycode: '(address with non-Latin letters)',
};

export type ProfileLinksShownText = typeof shownEn;

const SHOWN: Record<Locale, ProfileLinksShownText> = {
  en: shownEn,
  sw: {
    title: 'Mpate {name} mtandaoni',
    note: 'Viungo hivi vinakupeleka kwenye tovuti ambazo Kwetuly haiendeshi wala haizikagui.',
    website: 'Tovuti ya {name}',
    websiteLabel: 'Tovuti',
    google: 'Google Maps',
    newTab: '(inafunguka kwenye kichupo kipya)',
    punycode: '(anwani yenye herufi zisizo za Kilatini)',
  },
  fr: {
    title: 'Retrouver {name} en ligne',
    note: 'Ces liens mènent vers des sites que Kwetuly ne gère pas et ne vérifie pas.',
    website: 'Le site de {name}',
    websiteLabel: 'Site web',
    google: 'Google Maps',
    newTab: '(s’ouvre dans un nouvel onglet)',
    punycode: '(adresse avec des lettres non latines)',
  },
  it: {
    title: 'Trova {name} online',
    note: 'Questi link portano a siti che Kwetuly non gestisce né controlla.',
    website: 'Il sito di {name}',
    websiteLabel: 'Sito web',
    google: 'Google Maps',
    newTab: '(si apre in una nuova scheda)',
    punycode: '(indirizzo con lettere non latine)',
  },
  de: {
    title: '{name} im Internet',
    note: 'Diese Links führen zu Seiten, die Kwetuly weder betreibt noch prüft.',
    website: 'Website von {name}',
    websiteLabel: 'Website',
    google: 'Google Maps',
    newTab: '(öffnet in einem neuen Tab)',
    punycode: '(Adresse mit nicht lateinischen Buchstaben)',
  },
  pl: {
    title: '{name} w internecie',
    note: 'Te linki prowadzą do stron, których Kwetuly nie prowadzi ani nie sprawdza.',
    website: 'Strona internetowa: {name}',
    websiteLabel: 'Strona internetowa',
    google: 'Mapy Google',
    newTab: '(otwiera się w nowej karcie)',
    punycode: '(adres z literami spoza alfabetu łacińskiego)',
  },
  zh: {
    title: '在网上找到 {name}',
    note: '这些链接指向并非由 Kwetuly 运营或审核的网站。',
    website: '{name} 的网站',
    websiteLabel: '网站',
    google: 'Google 地图',
    newTab: '（在新标签页打开）',
    punycode: '（含非拉丁字母的网址）',
  },
};

/** Traveller texts for the links on a guide page; unknown locales get English. */
export const profileLinksShownText = (locale: Locale | string): ProfileLinksShownText => SHOWN[locale as Locale] ?? shownEn;

/** The visible name of a link: the platform name, or the translated "Google Maps" / "Website". */
export function profileLinkLabel(kind: ProfileLinkKind, locale: Locale | string): string {
  const t = profileLinksShownText(locale);
  if (kind === 'website') return t.websiteLabel;
  if (kind === 'google') return t.google;
  return PROFILE_LINK_NAMES[kind];
}

// ---------------------------------------------------------------------------
// Guide and owner texts (English and Kiswahili)
// ---------------------------------------------------------------------------

const en = {
  title: 'Your profile links',
  /** Dashboard entry line and the "Your page" sign-up step (guides). */
  entry: 'Profile links',
  entryNote: 'You are welcome to add your website, Google, YouTube, Instagram, Facebook and TikTok, so travellers can see more of your work.',
  /** Dashboard entry line for business owners. */
  businessEntryNote: 'You are welcome to add your Google, YouTube, Instagram, Facebook and TikTok links.',
  intro: 'Add the places where travellers can see more of your work. Each link is checked before it is saved, and every link on Kwetuly is marked as added by you.',
  guideHeading: 'On your guide page',
  businessHeading: 'On the page of {business}',
  websiteLabel: 'Your own website',
  websiteHint: 'Shown on your page below the box where travellers ask you about a trip. Chat links, link-in-bio pages, short links and phone numbers cannot be used here: travellers reach you through Kwetuly first.',
  googleLabel: 'Google Business Profile',
  googleHint: 'Open your profile on Google Maps, press Share and paste the link. It starts with https://maps.app.goo.gl/ or https://g.page/.',
  youtubeLabel: 'YouTube channel',
  youtubeHint: 'Paste the link to your channel, or just type your @name.',
  socialHint: 'Paste the link to your profile, or just type your @name.',
  businessWebsiteNote: 'Your business website stays in the business form on your dashboard.',
  save: 'Save links',
  saved: 'Your links are saved.',
  clearNote: 'Leave a field empty to remove that link.',
  notMember: 'This page is for guides and business owners.',
  switchedOff: 'Website, Google and YouTube links are switched off for now. Your Instagram, Facebook and TikTok links still show.',
  businessSwitchedOff: 'Business links are switched off for now.',
  loadError: 'Your links could not be loaded. Please try again.',
  retry: 'Try again',
  saveError: 'Your links were not saved. Please try again.',
  dashboard: 'Dashboard',
  /** {label} = the field's name, {example} = an example link. */
  invalid: 'Your {label} link was not saved. Paste the link to your own page, for example {example}.',
  websiteInvalid: 'Your website was not saved. Use the full address of your own site, for example https://www.yourname.co.tz.',
  websiteBlocked: 'This website is not allowed. Chat links (WhatsApp, Telegram, Messenger, Discord), link-in-bio pages (such as Linktree), short links (such as bit.ly), Facebook, Instagram, Google, YouTube or TikTok pages, and links with a phone number in them cannot be used as a website. Facebook, Instagram, Google, YouTube and TikTok have their own fields.',
  googleInvalid: 'Your Google link was not saved. Open your profile on Google Maps, press Share and paste that link, for example https://maps.app.goo.gl/AbCd1234.',
  youtubeInvalid: 'Your YouTube link was not saved. Paste the link to your channel, for example https://www.youtube.com/@yourname, or type your @name. Links to single videos cannot be used.',
  /** Shown as soon as a field is left with a link that would be refused. */
  check: 'This is not a link to your {label}. For example {example}.',
};

export type ProfileLinksText = typeof en;

const sw: ProfileLinksText = {
  title: 'Viungo vya wasifu wako',
  entry: 'Viungo vya wasifu',
  entryNote: 'Karibu uongeze tovuti yako, Google, YouTube, Instagram, Facebook na TikTok, ili wasafiri waone zaidi kazi yako.',
  businessEntryNote: 'Karibu uongeze viungo vyako vya Google, YouTube, Instagram, Facebook na TikTok.',
  intro: 'Ongeza sehemu ambazo wasafiri wanaweza kuona zaidi kazi yako. Kila kiungo kinakaguliwa kabla ya kuhifadhiwa, na kila kiungo kwenye Kwetuly kinaonyeshwa kuwa umekiongeza wewe.',
  guideHeading: 'Kwenye ukurasa wako wa mwongozaji',
  businessHeading: 'Kwenye ukurasa wa {business}',
  websiteLabel: 'Tovuti yako mwenyewe',
  websiteHint: 'Inaonyeshwa kwenye ukurasa wako chini ya sehemu ambapo wasafiri wanakuuliza kuhusu safari. Viungo vya mazungumzo, kurasa za viungo, viungo vifupi na namba za simu havitumiki hapa: wasafiri wanakufikia kupitia Kwetuly kwanza.',
  googleLabel: 'Wasifu wa Biashara wa Google',
  googleHint: 'Fungua wasifu wako kwenye Google Maps, bonyeza Shiriki (Share) na ubandike kiungo. Kinaanza na https://maps.app.goo.gl/ au https://g.page/.',
  youtubeLabel: 'Chaneli ya YouTube',
  youtubeHint: 'Bandika kiungo cha chaneli yako, au andika tu @jina lako.',
  socialHint: 'Bandika kiungo cha wasifu wako, au andika tu @jina lako.',
  businessWebsiteNote: 'Tovuti ya biashara yako inabaki kwenye fomu ya biashara kwenye dashibodi yako.',
  save: 'Hifadhi viungo',
  saved: 'Viungo vyako vimehifadhiwa.',
  clearNote: 'Acha sehemu ikiwa tupu ili kuondoa kiungo hicho.',
  notMember: 'Ukurasa huu ni kwa waongozaji na wamiliki wa biashara.',
  switchedOff: 'Viungo vya tovuti, Google na YouTube vimezimwa kwa sasa. Viungo vyako vya Instagram, Facebook na TikTok bado vinaonekana.',
  businessSwitchedOff: 'Viungo vya biashara vimezimwa kwa sasa.',
  loadError: 'Viungo vyako havikuweza kupakiwa. Tafadhali jaribu tena.',
  retry: 'Jaribu tena',
  saveError: 'Viungo vyako havikuhifadhiwa. Tafadhali jaribu tena.',
  dashboard: 'Dashibodi',
  invalid: 'Kiungo chako cha {label} hakikuhifadhiwa. Bandika kiungo cha ukurasa wako mwenyewe, kwa mfano {example}.',
  websiteInvalid: 'Tovuti yako haikuhifadhiwa. Tumia anwani kamili ya tovuti yako, kwa mfano https://www.jinalako.co.tz.',
  websiteBlocked: 'Tovuti hii hairuhusiwi. Viungo vya mazungumzo (WhatsApp, Telegram, Messenger, Discord), kurasa za viungo (kama Linktree), viungo vifupi (kama bit.ly), kurasa za Facebook, Instagram, Google, YouTube au TikTok, na viungo vyenye namba ya simu haviwezi kutumika kama tovuti. Facebook, Instagram, Google, YouTube na TikTok zina sehemu zake.',
  googleInvalid: 'Kiungo chako cha Google hakikuhifadhiwa. Fungua wasifu wako kwenye Google Maps, bonyeza Shiriki (Share) na ubandike kiungo hicho, kwa mfano https://maps.app.goo.gl/AbCd1234.',
  youtubeInvalid: 'Kiungo chako cha YouTube hakikuhifadhiwa. Bandika kiungo cha chaneli yako, kwa mfano https://www.youtube.com/@jinalako, au andika @jina lako. Viungo vya video moja haviwezi kutumika.',
  check: 'Hiki si kiungo cha {label} chako. Kwa mfano {example}.',
};

export const PROFILE_LINKS_TEXT: Record<'en' | 'sw', ProfileLinksText> = { en, sw };

/** Guide and owner texts: Kiswahili for 'sw', English for every other language. */
export const profileLinksText = (locale: Locale | string): ProfileLinksText => (locale === 'sw' ? sw : en);

/** The field label on the links page. */
export function profileLinkFieldLabel(kind: ProfileLinkKind, locale: Locale | string): string {
  const t = profileLinksText(locale);
  if (kind === 'website') return t.websiteLabel;
  if (kind === 'google') return t.googleLabel;
  if (kind === 'youtube') return t.youtubeLabel;
  return PROFILE_LINK_NAMES[kind];
}

/** The hint under a field on the links page. */
export function profileLinkHint(kind: ProfileLinkKind, locale: Locale | string): string {
  const t = profileLinksText(locale);
  if (kind === 'website') return t.websiteHint;
  if (kind === 'google') return t.googleHint;
  if (kind === 'youtube') return t.youtubeHint;
  return t.socialHint;
}

/** Error codes the links page uses: "pl_<kind>" for a refused link, "pl_website_blocked" for a chat or short link. */
export type ProfileLinkErrorCode = `pl_${ProfileLinkKind}` | 'pl_website_blocked' | 'pl_save' | 'pl_off';

/** The error code for a refused link of this kind. */
export const profileLinkErrorCode = (kind: ProfileLinkKind, reason: LinkFailure): ProfileLinkErrorCode =>
  kind === 'website' && reason === 'blocked' ? 'pl_website_blocked' : `pl_${kind}`;

/** The message for a links page error code, or null when the code is not one. */
export function profileLinkErrorMessage(code: unknown, locale: Locale | string): string | null {
  const t = profileLinksText(locale);
  switch (code) {
    case 'pl_website':
      return t.websiteInvalid;
    case 'pl_website_blocked':
      return t.websiteBlocked;
    case 'pl_google':
      return t.googleInvalid;
    case 'pl_youtube':
      return t.youtubeInvalid;
    case 'pl_save':
      return t.saveError;
    case 'pl_off':
      return t.switchedOff;
    case 'pl_instagram':
    case 'pl_facebook':
    case 'pl_tiktok': {
      const kind = code.slice(3) as 'instagram' | 'facebook' | 'tiktok';
      return t.invalid.replace('{label}', PROFILE_LINK_NAMES[kind]).replace('{example}', PROFILE_LINK_EXAMPLES[kind]);
    }
    default:
      return null;
  }
}

/** The live check message shown when a field is left with a link that would be refused. */
export function profileLinkCheckMessage(kind: ProfileLinkKind, reason: LinkFailure | null, locale: Locale | string): string {
  const t = profileLinksText(locale);
  if (kind === 'website') return reason === 'blocked' ? t.websiteBlocked : t.websiteInvalid;
  return t.check.replace('{label}', profileLinkFieldLabel(kind, locale)).replace('{example}', PROFILE_LINK_EXAMPLES[kind]);
}
