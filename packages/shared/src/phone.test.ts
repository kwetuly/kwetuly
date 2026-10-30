import { describe, expect, it } from 'vitest';
import {
  normalizePhone,
  phoneCountries,
  phoneCountryOrDefault,
  phoneExample,
  resolvePhone,
  searchPhoneCountries,
  splitPhone,
} from './phone';

describe('normalizePhone', () => {
  // Each country: with the leading 0 (where the country uses one), without it, with spaces or
  // dashes, and already international. All must give the same E.164 number.
  const cases: [country: string, inputs: string[], e164: string][] = [
    ['TZ', ['0712 345 678', '712345678', '0712-345-678', '+255 712 345 678', '+255 0712 345 678', '00255712345678', '255 712 345 678'], '+255712345678'],
    ['TZ', ['0687 123 456', '687123456'], '+255687123456'],
    ['KE', ['0712 345 678', '712345678', '+254 712 345678'], '+254712345678'],
    ['UG', ['0772 123 456', '772123456', '+256 772 123456'], '+256772123456'],
    ['GB', ['07400 123456', '7400 123456', '+44 7400 123456', '+44 (0)7400 123456'], '+447400123456'],
    ['DE', ['01512 3456789', '1512 3456789', '0151-23456789', '+49 1512 3456789'], '+4915123456789'],
    ['DE', ['030 123456', '+49 30 123456'], '+4930123456'],
    ['IT', ['312 345 6789', '+39 312 345 6789'], '+393123456789'],
    // Italian landlines keep their 0 inside the international number.
    ['IT', ['06 1234 5678', '+39 06 1234 5678'], '+390612345678'],
    ['FR', ['06 12 34 56 78', '6 12 34 56 78', '+33 6 12 34 56 78'], '+33612345678'],
    ['PL', ['512 345 678', '512-345-678', '+48 512 345 678'], '+48512345678'],
    ['CN', ['138 0013 8000', '13800138000', '+86 138 0013 8000'], '+8613800138000'],
    ['US', ['(201) 555-0123', '201-555-0123', '+1 201 555 0123'], '+12015550123'],
  ];
  for (const [country, inputs, e164] of cases) {
    for (const input of inputs) {
      it(`${country}: "${input}" becomes ${e164}`, () => {
        expect(normalizePhone(input, country)).toBe(e164);
      });
    }
  }

  it('defaults to Tanzania when no country is given', () => {
    expect(normalizePhone('0712345678')).toBe('+255712345678');
    expect(normalizePhone('0612 345 678')).toBe('+255612345678');
  });

  it('an international number keeps its own country whatever is picked', () => {
    expect(normalizePhone('+44 7400 123456', 'TZ')).toBe('+447400123456');
    expect(normalizePhone('0049 1512 3456789', 'US')).toBe('+4915123456789');
  });

  it('an unknown country falls back to Tanzania', () => {
    expect(normalizePhone('0712 345 678', 'XX')).toBe('+255712345678');
    expect(normalizePhone('0712 345 678', '')).toBe('+255712345678');
  });

  it('refuses things that are not valid numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('0712 345 67')).toBeNull();
    expect(normalizePhone('0123456789', 'TZ')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
    expect(normalizePhone('+255 712 345 678 ext 9')).toBeNull();
    expect(normalizePhone('+999 123 456 789')).toBeNull();
    expect(normalizePhone('0712345678'.repeat(5))).toBeNull();
    expect(normalizePhone('0712 345 678', 'US')).toBeNull();
  });
});

describe('phone countries', () => {
  it('puts Tanzania first with +255', () => {
    const list = phoneCountries('en');
    expect(list[0]).toMatchObject({ code: 'TZ', dial: '+255', name: 'Tanzania' });
    expect(list.length).toBeGreaterThan(200);
  });

  it('names countries in the chosen language', () => {
    expect(phoneCountries('de').find((c) => c.code === 'DE')?.name).toBe('Deutschland');
  });

  it('searches by name, code and dial code', () => {
    const list = phoneCountries('en');
    expect(searchPhoneCountries(list, 'kenya').map((c) => c.code)).toEqual(['KE']);
    expect(searchPhoneCountries(list, 'ug').map((c) => c.code)).toContain('UG');
    expect(searchPhoneCountries(list, '+255').map((c) => c.code)).toEqual(['TZ']);
    expect(searchPhoneCountries(list, '49').map((c) => c.code)).toContain('DE');
    // Best match first: the exact code before names that merely contain the text.
    expect(searchPhoneCountries(list, 'us')[0].code).toBe('US');
    expect(searchPhoneCountries(list, 'united k')[0].code).toBe('GB');
    expect(searchPhoneCountries(list, '+1')[0].code).toBe('US');
    expect(searchPhoneCountries(list, '44')[0].code).toBe('GB');
    // Accents do not matter on either side.
    expect(searchPhoneCountries(list, 'cote')[0].code).toBe('CI');
    expect(searchPhoneCountries(phoneCountries('fr'), 'Equateur').map((c) => c.code)).toContain('EC');
    // English names still match when the list is in another language.
    expect(searchPhoneCountries(phoneCountries('de'), 'germany').map((c) => c.code)).toEqual(['DE']);
  });

  it('turns a hint into a supported country or Tanzania', () => {
    expect(phoneCountryOrDefault('de')).toBe('DE');
    expect(phoneCountryOrDefault('XX')).toBe('TZ');
    expect(phoneCountryOrDefault(null)).toBe('TZ');
  });

  it('gives an example number written the local way', () => {
    expect(phoneExample('TZ')).toMatch(/^0\d{3} \d{3} \d{3}$/);
    expect(phoneExample('US')).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
});

describe('splitPhone', () => {
  it('splits a saved number into country and local form', () => {
    expect(splitPhone('+255712345678')).toEqual({ country: 'TZ', national: '0712 345 678' });
    expect(splitPhone('+4915123456789', 'TZ').country).toBe('DE');
  });

  it('keeps an old unsaved value with the fallback country', () => {
    expect(splitPhone('0712 345 678', 'KE')).toEqual({ country: 'KE', national: '0712 345 678' });
    expect(splitPhone(null)).toEqual({ country: 'TZ', national: '' });
  });
});

describe('resolvePhone', () => {
  it('keeps a stored number the person did not change, even one the check would refuse', () => {
    expect(resolvePhone('+999 123 456 789', 'TZ', '+999 123 456 789')).toBe('+999 123 456 789');
    expect(resolvePhone('0712 345 678', 'DE', '0712 345 678')).toBe('0712 345 678');
    // Shown the local way with its country, sent back unchanged.
    expect(resolvePhone('0712 345 678', 'TZ', '+255712345678')).toBe('+255712345678');
  });

  it('keeps an old "+2550…" form when the digits are the same', () => {
    expect(resolvePhone('0712 345 678', 'TZ', '+2550712345678')).toBe('+2550712345678');
    expect(resolvePhone('+255 0712 345 678', 'TZ', '+2550712345678')).toBe('+2550712345678');
  });

  it('saves a changed number in international form, or refuses it', () => {
    expect(resolvePhone('0712 999 888', 'TZ', '+255712345678')).toBe('+255712999888');
    expect(resolvePhone('0712 345 678', 'TZ', null)).toBe('+255712345678');
    expect(resolvePhone('12345', 'US', '+255712345678')).toBeNull();
    expect(resolvePhone('  ', 'TZ', '+255712345678')).toBeNull();
  });
});
