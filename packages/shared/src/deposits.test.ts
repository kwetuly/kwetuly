import { describe, expect, it } from 'vitest';
import { billingCountries, checkBilling, depositClosed, depositLastDay, tanzaniaDate, tripStarted } from './deposits';

// 2026-11-07 22:30 UTC is already 2026-11-08 01:30 in Tanzania.
const lateEvening = Date.parse('2026-11-07T22:30:00Z');

describe('deposit dates', () => {
  it('uses the Tanzania date, not UTC', () => {
    expect(tanzaniaDate(0, lateEvening)).toBe('2026-11-08');
    expect(tanzaniaDate(8, lateEvening)).toBe('2026-11-16');
    expect(tripStarted('2026-11-07', lateEvening)).toBe(true);
    expect(tripStarted('2026-11-08', lateEvening)).toBe(false);
  });

  it('closes online deposits 8 days before the start date', () => {
    expect(depositLastDay('2026-11-16')).toBe('2026-11-08');
    expect(depositLastDay('2026-03-05')).toBe('2026-02-25');
    expect(depositClosed('2026-11-16', lateEvening)).toBe(false);
    expect(depositClosed('2026-11-15', lateEvening)).toBe(true);
    expect(depositClosed(null, lateEvening)).toBe(false);
  });
});

describe('card billing', () => {
  const full = { firstname: ' Amani ', lastname: 'Mushi', address_1: 'Plot 12, Sokoine Rd', city: 'Arusha', state_or_region: 'Arusha', postcode_or_pobox: 'P.O. Box 123', country: 'tz' };

  it('cleans a full address', () => {
    expect(checkBilling(full)).toEqual({ billing: { ...full, firstname: 'Amani', country: 'TZ' } });
  });

  it('asks for missing fields and refuses characters Selcom cannot take', () => {
    expect(checkBilling({ ...full, city: ' ' })).toEqual({ problem: 'missing' });
    expect(checkBilling({ ...full, address_1: 'a=b&c' })).toEqual({ problem: 'chars' });
    expect(checkBilling({ ...full, postcode_or_pobox: 'x'.repeat(21) })).toEqual({ problem: 'chars' });
  });

  it('lists ISO countries only, Tanzania first', () => {
    const list = billingCountries('en');
    expect(list[0].code).toBe('TZ');
    expect(list.some((c) => c.code === 'AC' || c.code === 'XK')).toBe(false);
  });
});
