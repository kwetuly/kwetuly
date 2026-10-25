import { DEFAULT_LOCALE, LOCALES, type Locale } from '@kwetuly/shared';

export { LOCALE_NAMES, LOCALE_TAGS } from '@kwetuly/shared';
export type { Locale };
export const locales = LOCALES;
export const defaultLocale: Locale = DEFAULT_LOCALE;

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

// Matches the locale prefix of a path, e.g. "/fr" in "/fr/guides".
export const localePrefix = new RegExp(`^/(${locales.join('|')})(?=/|$)`);
