import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, TRIP_CATEGORIES, type Locale } from '@rafrika/shared';

export const specialtyName = (id: string, locale: Locale) => GUIDE_SPECIALTIES.find((s) => s.id === id)?.[locale] ?? id;
export const languageName = (code: string) => GUIDE_LANGUAGES.find((l) => l.code === code)?.name ?? code;
export const expertiseOf = (ids: string[]) => GUIDE_EXPERTISE.filter((e) => ids.includes(e.id));
export const categoryName = (id: string, locale: Locale) => TRIP_CATEGORIES.find((c) => c.id === id)?.[locale] ?? id;

export function formatDateRange(start: string, end: string, locale: Locale) {
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const a = format.format(new Date(start));
  return start === end ? a : `${a} – ${format.format(new Date(end))}`;
}

// Public display name: first name and initial only.
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}` : 'Traveller';
}
