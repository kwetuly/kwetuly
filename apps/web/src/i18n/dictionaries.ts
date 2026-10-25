import { lang } from 'next/root-params';
import { notFound } from 'next/navigation';
import { DICTIONARIES, type Dictionary } from '@kwetuly/shared';
import { hasLocale, type Locale } from './config';

// The text lives in @kwetuly/shared so the website and the mobile app use the same translations.
export type { Dictionary };

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

export async function getDictionary(): Promise<Dictionary> {
  return DICTIONARIES[await getLocale()];
}
