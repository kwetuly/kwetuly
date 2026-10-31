// Shown in the browser and the app as soon as a profile link or website is left, before saving.
// Guide and owner texts, so English and Kiswahili. {platform} and {example} as in links.ts.
import type { Locale } from '../locales';

const en = {
  socialCheck: 'This is not a link to your {platform} profile. Paste the link to your own profile, for example {example}, or just type your @name.',
  websiteCheck: 'This is not a website address. Use the full address of your own site, for example https://www.yourbusiness.co.tz.',
};

export type LinkCheckText = typeof en;

const sw: LinkCheckText = {
  socialCheck: 'Hiki si kiungo cha wasifu wa {platform}. Bandika kiungo cha wasifu wako mwenyewe, kwa mfano {example}, au andika tu @jina lako.',
  websiteCheck: 'Hii si anwani ya tovuti. Tumia anwani kamili ya tovuti yako, kwa mfano https://www.biasharayako.co.tz.',
};

/** Kiswahili for 'sw', English for every other language. */
export const linkCheckText = (locale: Locale | string): LinkCheckText => (locale === 'sw' ? sw : en);
