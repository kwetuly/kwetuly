import { DEFAULT_LOCALE, LOCALES, type Locale } from '@kwetuly/shared';

export { LOCALE_NAMES, LOCALE_TAGS } from '@kwetuly/shared';
export type { Locale };
export const locales = LOCALES;
export const defaultLocale: Locale = DEFAULT_LOCALE;

/** Open Graph locale (language_TERRITORY) for each site language, used in og:locale on shared links. */
export const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  sw: 'sw_TZ',
  fr: 'fr_FR',
  it: 'it_IT',
  de: 'de_DE',
  pl: 'pl_PL',
  zh: 'zh_CN',
};

/** og:locale for this language and og:locale:alternate for the other six. */
export function ogLocales(locale: Locale): { locale: string; alternateLocale: string[] } {
  return { locale: OG_LOCALES[locale], alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l]) };
}

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

// Matches the locale prefix of a path, e.g. "/fr" in "/fr/guides".
export const localePrefix = new RegExp(`^/(${locales.join('|')})(?=/|$)`);
