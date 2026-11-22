/** A YYYY-MM-DD or timestamp as a short date in the page's language, Tanzanian time. */
export function formatDay(iso: string | null | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : 'Africa/Dar_es_Salaam' });
}
