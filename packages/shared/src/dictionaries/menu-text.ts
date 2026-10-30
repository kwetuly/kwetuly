// Texts for the desktop section menu. When the sections do not fit on one row (narrower screens,
// longer languages), the ones at the end move under "More".
import type { Locale } from '../locales';

export type MenuText = { more: string };

export const MENU_TEXT: Record<Locale, MenuText> = {
  en: { more: 'More' },
  sw: { more: 'Zaidi' },
  fr: { more: 'Plus' },
  it: { more: 'Altro' },
  de: { more: 'Mehr' },
  pl: { more: 'Więcej' },
  zh: { more: '更多' },
};
