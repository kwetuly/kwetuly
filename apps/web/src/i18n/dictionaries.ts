import { lang } from 'next/root-params';
import { notFound } from 'next/navigation';
import { hasLocale, type Locale } from './config';
import { en, type Dictionary } from './locales/en';
import { sw } from './locales/sw';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { de } from './locales/de';
import { pl } from './locales/pl';
import { zh } from './locales/zh';

export type { Dictionary };

// Every translation except English is a first draft: have a native speaker review it before launch.
const dictionaries: Record<Locale, Dictionary> = { en, sw, fr, it, de, pl, zh };

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
