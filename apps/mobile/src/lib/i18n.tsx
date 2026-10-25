import { createContext, use, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { DEFAULT_LOCALE, DICTIONARIES, LOCALES, type Dictionary, type Locale } from '@kwetuly/shared';

const STORAGE_KEY = 'kwetuly.locale';

const isLocale = (value: string | null | undefined): value is Locale => !!value && (LOCALES as readonly string[]).includes(value);

// Saved choice first, then the phone's preferred languages, then English.
export function initialLocale(): Locale {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (isLocale(saved)) return saved;
  const device = getLocales().map((l) => l.languageCode).find(isLocale);
  return device ?? DEFAULT_LOCALE;
}

type I18n = { locale: Locale; t: Dictionary; setLocale: (locale: Locale) => void };

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = (next: Locale) => {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  };
  return <I18nContext value={{ locale, t: DICTIONARIES[locale], setLocale }}>{children}</I18nContext>;
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
