import { describe, expect, it } from 'vitest';
import { safeProps } from './analytics';
import { hasValidBadge } from './businesses';
import { DICTIONARIES, UX_TEXT } from './dictionaries';
import { filterTours, formatPrice, readTourFilters, verifiedPrice, type Tour } from './tours';

describe('analytics', () => {
  it('drops properties that could hold personal details', () => {
    expect(safeProps({ guide: 'amani', email: 'a@b.c', phone_number: '+255', full_name: 'X', message: 'hi', locale: 'en', skip: undefined })).toEqual({
      guide: 'amani',
      locale: 'en',
    });
  });
});

describe('dictionaries', () => {
  // Every language must have every key English has, so no screen ever shows a blank.
  const keysOf = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`))
      : [prefix.slice(0, -1)];
  const english = keysOf(DICTIONARIES.en);

  for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
    it(`${locale} has every English key`, () => {
      const own = new Set(keysOf(dictionary));
      expect(english.filter((k) => !own.has(k))).toEqual([]);
    });
  }

  it('error-page texts exist in every language', () => {
    for (const texts of Object.values(UX_TEXT)) expect(Object.keys(texts).sort()).toEqual(Object.keys(UX_TEXT.en).sort());
  });
});

describe('tour prices', () => {
  const today = new Date('2026-10-15');
  const base = { price_from: 2450, price_currency: 'USD', price_verified_at: '2026-10-01', price_valid_until: '2026-12-31' };

  it('shows a verified, unexpired price', () => {
    expect(verifiedPrice(base, today)).toEqual({ amount: 2450, currency: 'USD' });
  });
  it('hides a price nobody verified', () => {
    expect(verifiedPrice({ ...base, price_verified_at: null }, today)).toBeNull();
  });
  it('hides an expired price', () => {
    expect(verifiedPrice({ ...base, price_valid_until: '2026-09-30' }, today)).toBeNull();
  });
  it('formats currencies', () => {
    expect(formatPrice(2450, 'USD')).toBe('$2,450');
    expect(formatPrice(450000, 'TZS')).toBe('TSh 450,000');
  });
});

describe('tour filters', () => {
  it('ignores unknown URL values and keeps old links working', () => {
    const params = new URLSearchParams('theme=nonsense&category=beach&signature=1&month=13&q=  serengeti ');
    expect(readTourFilters((k) => params.get(k) ?? undefined)).toMatchObject({ theme: 'coast', type: 'signature', month: undefined, q: '  serengeti ' });
  });

  const tour = (over: Partial<Tour>) =>
    ({
      title_en: 'Tour',
      title_sw: null,
      summary_en: '',
      start_from: 'Arusha',
      end_at: null,
      tour_operators: null,
      destinations: [],
      highlights: [],
      categories: ['safari'],
      kind: 'circuit',
      circuit: 'northern',
      tour_type: 'signature',
      travel_styles: [],
      accommodation: null,
      group_type: 'private',
      days: 5,
      best_months: [],
      ...over,
    }) as unknown as Tour;

  it('matches search words, theme and duration', () => {
    const tours = [tour({ title_en: 'Serengeti migration', days: 6 }), tour({ title_en: 'Kilimanjaro Machame', categories: ['mountain'], days: 7 })];
    expect(filterTours(tours, { q: 'serengeti' }).map((t) => t.title_en)).toEqual(['Serengeti migration']);
    expect(filterTours(tours, { theme: 'mountain' }).map((t) => t.title_en)).toEqual(['Kilimanjaro Machame']);
    expect(filterTours(tours, { duration: 'day' })).toEqual([]);
  });
});

describe('business badge', () => {
  it('shows only while valid and when something was checked', () => {
    expect(hasValidBadge({ badge_checks: ['licence'], badge_valid_until: '2027-10-15' }, '2026-10-15')).toBe(true);
    expect(hasValidBadge({ badge_checks: ['licence'], badge_valid_until: '2026-10-14' }, '2026-10-15')).toBe(false);
    expect(hasValidBadge({ badge_checks: [], badge_valid_until: '2027-10-15' }, '2026-10-15')).toBe(false);
    expect(hasValidBadge({ badge_checks: ['photos'], badge_valid_until: null }, '2026-10-15')).toBe(false);
  });
});
