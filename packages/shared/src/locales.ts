// Languages of the site and app, chosen from who actually visits Tanzania
// (NBS mainland arrivals and Zanzibar OCGS arrivals, 2024–2025):
// English (US, UK, Kenya, Zambia, India), Kiswahili (home + East Africa, Burundi, DRC),
// French (France, Burundi, DRC), Italian (no. 1 non-African market), German,
// Polish (no. 4 market in Zanzibar) and Chinese (top-10 mainland market).
export const LOCALES = ['en', 'sw', 'fr', 'it', 'de', 'pl', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

// Name of each language in that language, for the language picker.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  sw: 'Kiswahili',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  pl: 'Polski',
  zh: '中文',
};

// BCP 47 tags for <html lang> and Intl formatting.
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en',
  sw: 'sw',
  fr: 'fr',
  it: 'it',
  de: 'de',
  pl: 'pl',
  zh: 'zh-Hans',
};

export type Label = Record<Locale, string>;

// Builds a label in the fixed order: en, sw, fr, it, de, pl, zh.
export const L = (en: string, sw: string, fr: string, it: string, de: string, pl: string, zh: string): Label => ({
  en,
  sw,
  fr,
  it,
  de,
  pl,
  zh,
});
