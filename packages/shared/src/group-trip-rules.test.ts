import { describe, expect, it } from 'vitest';
import { tanzaniaToday } from './group-trip-rules';
import { groupPriceOnRequest } from './money';

describe('tanzaniaToday', () => {
  it('is already the next day in Tanzania from 21:00 UTC', () => {
    expect(tanzaniaToday(new Date('2026-11-08T20:59:59Z'))).toBe('2026-11-08');
    expect(tanzaniaToday(new Date('2026-11-08T21:00:00Z'))).toBe('2026-11-09');
  });

  it('crosses months and years', () => {
    expect(tanzaniaToday(new Date('2026-12-31T22:30:00Z'))).toBe('2027-01-01');
    expect(tanzaniaToday(new Date('2027-02-28T21:15:00Z'))).toBe('2027-03-01');
  });

  it('matches the UTC date during the Tanzanian day', () => {
    expect(tanzaniaToday(new Date('2026-11-08T00:00:00Z'))).toBe('2026-11-08');
    expect(tanzaniaToday(new Date('2026-11-08T12:00:00Z'))).toBe('2026-11-08');
  });
});

describe('groupPriceOnRequest', () => {
  it('shows "price on request" instead of $0 or a missing price', () => {
    expect(groupPriceOnRequest({ price_per_person_usd: 0 })).toBe(true);
    expect(groupPriceOnRequest({ price_per_person_usd: 0, guides: { is_sample: true } })).toBe(true);
    expect(groupPriceOnRequest({ price_per_person_usd: null })).toBe(true);
    expect(groupPriceOnRequest({ price_per_person_usd: undefined })).toBe(true);
  });

  it('shows a real price', () => {
    expect(groupPriceOnRequest({ price_per_person_usd: 450 })).toBe(false);
    expect(groupPriceOnRequest({ price_per_person_usd: 450, guides: { is_sample: true } })).toBe(false);
  });
});
