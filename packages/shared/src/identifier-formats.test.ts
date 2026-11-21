import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { maskIdentifier, normalizeCountry, normalizeIdentifier, parseIdentifier } from './identifier-formats';

// Made-up numbers only. None of these is a real person's number.
describe('normalizeIdentifier', () => {
  it('removes spaces, dashes and dots and upper-cases', () => {
    expect(normalizeIdentifier(' 19900101-12345-00001-12 ')).toBe('19900101123450000112');
    expect(normalizeIdentifier('ab 12.34–56')).toBe('AB123456');
    expect(normalizeIdentifier('１２３')).toBe('123'); // full-width digits
  });
});

describe('parseIdentifier', () => {
  it('accepts a NIDA number written in groups and gives the same hash input', () => {
    const a = parseIdentifier('nida', '19900101-12345-00001-12');
    const b = parseIdentifier('nida', '1990 0101 1234 5000 0112');
    expect(a).toEqual({ ok: true, field: 'nida', value: '19900101123450000112', last3: '112', hmacInput: 'nida|19900101123450000112' });
    expect(b).toEqual(a);
  });

  it('refuses a NIDA number with letters or far too few digits', () => {
    expect(parseIdentifier('nida', '1234567')).toEqual({ ok: false, error: 'format' });
    expect(parseIdentifier('nida', '19900101A23450000112')).toEqual({ ok: false, error: 'format' });
    expect(parseIdentifier('nida', '   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('binds the passport hash to the issuing country', () => {
    const de = parseIdentifier('passport', 'c01x 00t47', 'de');
    const fr = parseIdentifier('passport', 'C01X00T47', 'FR');
    expect(de.ok && de.hmacInput).toBe('passport|DE|C01X00T47');
    expect(fr.ok && fr.hmacInput).toBe('passport|FR|C01X00T47');
    expect(de.ok && de.last3).toBe('T47');
  });

  it('needs a two-letter country and a digit for passports', () => {
    expect(parseIdentifier('passport', 'C01X00T47', 'Germany')).toEqual({ ok: false, error: 'country' });
    expect(parseIdentifier('passport', 'C01X00T47')).toEqual({ ok: false, error: 'country' });
    expect(parseIdentifier('passport', 'ABCDEFG', 'DE')).toEqual({ ok: false, error: 'format' });
    expect(parseIdentifier('passport', 'A1', 'DE')).toEqual({ ok: false, error: 'format' });
  });

  it('accepts a TIN written 123-456-789 and gives no hash input', () => {
    expect(parseIdentifier('tin', '123-456-789')).toEqual({ ok: true, field: 'tin', value: '123456789', last3: '789', hmacInput: null });
    expect(parseIdentifier('business_tin', '123 456 789').ok).toBe(true);
    expect(parseIdentifier('tin', '12345678')).toEqual({ ok: false, error: 'format' });
  });

  it('last 3 always matches the database shape', () => {
    for (const [f, v, c] of [['nida', '19900101123450000112'], ['passport', 'x1234567', 'ke'], ['tin', '123456789']] as const) {
      const p = parseIdentifier(f, v, c);
      expect(p.ok && /^[0-9A-Z]{3}$/.test(p.last3)).toBe(true);
    }
  });
});

describe('normalizeCountry and maskIdentifier', () => {
  it('works', () => {
    expect(normalizeCountry(' tz ')).toBe('TZ');
    expect(normalizeCountry('TZA')).toBeNull();
    expect(maskIdentifier('112')).toBe('••• 112');
    expect(maskIdentifier(null)).toBe('');
  });
});

describe('Edge Function copy', () => {
  it('supabase/functions/_shared/identifier-formats.ts is identical to this file', () => {
    const source = readFileSync(new URL('./identifier-formats.ts', import.meta.url), 'utf8');
    const copy = readFileSync(new URL('../../../supabase/functions/_shared/identifier-formats.ts', import.meta.url), 'utf8');
    expect(copy).toBe(source);
  });
});
