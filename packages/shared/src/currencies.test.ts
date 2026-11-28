import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BOT_CURRENCIES,
  COUNTRY_CURRENCY,
  currencyForCountry,
  currencyForLocale,
  estimateLocal,
  isDisplayCurrency,
  isRateCurrency,
  RATE_CURRENCIES,
  ratesByCurrency,
  roundEstimate,
} from './currencies';

// Means from the Bank of Tanzania page of 27 Nov 2026 (the saved fixture of the exchange-rates function).
const RATES = [
  { currency: 'USD', tzs_per_unit: 2678.1658 },
  { currency: 'EUR', tzs_per_unit: '2941.1617' },
  { currency: 'JPY', tzs_per_unit: 16.8174 },
  { currency: 'KES', tzs_per_unit: 20.5617 },
  { currency: 'UGX', tzs_per_unit: 0.6207 },
  { currency: 'PKR', tzs_per_unit: 9.686 },
];

describe('allow-list', () => {
  it('has no obsolete codes, no GOLD, no SDR and no IRR', () => {
    for (const code of ['ATS', 'NLG', 'ZWD', 'MZM', 'CUC', 'GOLD', 'SDR', 'XDR', 'IRR']) {
      expect(isRateCurrency(code)).toBe(false);
    }
  });

  it('PLN is override-only and TZS is never a rate', () => {
    expect(isRateCurrency('PLN')).toBe(true);
    expect((BOT_CURRENCIES as readonly string[]).includes('PLN')).toBe(false);
    expect(isRateCurrency('TZS')).toBe(false);
    expect(isDisplayCurrency('TZS')).toBe(true);
  });

  it('codes are unique three-letter codes', () => {
    expect(new Set(RATE_CURRENCIES).size).toBe(RATE_CURRENCIES.length);
    for (const c of RATE_CURRENCIES) expect(c).toMatch(/^[A-Z]{3}$/);
  });

  it('matches the check constraint and private.rate_currencies() in the migration', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20261203030000_exchange_rates.sql', import.meta.url), 'utf8');
    const codesIn = (text: string) => [...text.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]);
    const body = sql.slice(sql.indexOf('create or replace function private.rate_currencies()'));
    expect(codesIn(body.slice(body.indexOf('array['), body.indexOf(']::text[]')))).toEqual([...RATE_CURRENCIES]);
    const check = sql.slice(sql.indexOf('constraint exchange_rates_currency_allowed check ('));
    expect(codesIn(check.slice(check.indexOf('in ('), check.indexOf('))')))).toEqual([...RATE_CURRENCIES]);
  });

  it('supabase/functions/_shared/currencies.ts is identical to this file', () => {
    const here = readFileSync(new URL('./currencies.ts', import.meta.url), 'utf8');
    const copy = readFileSync(new URL('../../../supabase/functions/_shared/currencies.ts', import.meta.url), 'utf8');
    expect(copy.replace(/\r\n/g, '\n')).toBe(here.replace(/\r\n/g, '\n'));
  });
});

describe('country and locale', () => {
  it('euro countries give EUR', () => {
    for (const c of ['DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'IE', 'HR', 'BG', 'RE', 'GP', 'AX']) expect(currencyForCountry(c)).toBe('EUR');
  });

  it('other countries', () => {
    expect(currencyForCountry('gb')).toBe('GBP');
    expect(currencyForCountry('PL')).toBe('PLN');
    expect(currencyForCountry('CN')).toBe('CNY');
    expect(currencyForCountry('TZ')).toBe('TZS');
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('BR')).toBeNull();
    expect(currencyForCountry('')).toBeNull();
    expect(currencyForCountry('DEU')).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
  });

  it('every mapped currency can be shown', () => {
    for (const cur of Object.values(COUNTRY_CURRENCY)) expect(isDisplayCurrency(cur)).toBe(true);
  });

  it('reads the region of a locale', () => {
    expect(currencyForLocale('de-DE')).toBe('EUR');
    expect(currencyForLocale('pl_PL')).toBe('PLN');
    expect(currencyForLocale('zh-Hans-CN')).toBe('CNY');
    expect(currencyForLocale('sw-TZ')).toBe('TZS');
    expect(currencyForLocale('fr')).toBeNull();
    expect(currencyForLocale(undefined)).toBeNull();
  });
});

describe('estimateLocal', () => {
  it('TZS to EUR, whole units', () => {
    // 150,000 / 2941.1617 = 51.0
    expect(estimateLocal(150_000, 'TZS', 'EUR', RATES)).toBe(51);
  });

  it('USD to EUR goes through TZS', () => {
    // 56 * 2678.1658 / 2941.1617 = 50.99
    expect(estimateLocal(56, 'USD', 'EUR', RATES)).toBe(51);
  });

  it('large-number currencies: nearest 100 from 10,000, 2 significant figures from 100, whole below', () => {
    // 150,000 / 0.6207 = 241,662 -> 241,700; 150,000 / 9.686 = 15,486 -> 15,500
    expect(estimateLocal(150_000, 'TZS', 'UGX', RATES)).toBe(241_700);
    expect(estimateLocal(150_000, 'TZS', 'PKR', RATES)).toBe(15_500);
    // 150,000 / 16.8174 = 8,919 -> 8,900; 5,000 / 16.8174 = 297.3 -> 300; 1,000 / 16.8174 = 59.5 -> 59
    expect(estimateLocal(150_000, 'TZS', 'JPY', RATES)).toBe(8900);
    expect(estimateLocal(5_000, 'TZS', 'JPY', RATES)).toBe(300);
    expect(estimateLocal(1_000, 'TZS', 'JPY', RATES)).toBe(59);
    // 500 / 9.686 = 51.6 -> 52; 10,000 / 9.686 = 1,032 -> 1,000
    expect(estimateLocal(500, 'TZS', 'PKR', RATES)).toBe(52);
    expect(estimateLocal(10_000, 'TZS', 'PKR', RATES)).toBe(1000);
    expect(roundEstimate(8949.9, 'KRW')).toBe(8900);
    expect(roundEstimate(9_960, 'KRW')).toBe(10_000);
    expect(roundEstimate(7294.5, 'KES')).toBe(7295);
  });

  it('a positive value never rounds to 0', () => {
    expect(roundEstimate(0.4, 'EUR')).toBe(1);
    expect(roundEstimate(0.4, 'JPY')).toBe(1);
    expect(roundEstimate(40, 'JPY')).toBe(40);
  });

  it('no estimate for TZS or USD visitors, unknown currencies or missing rates', () => {
    expect(estimateLocal(150_000, 'TZS', 'TZS', RATES)).toBeNull();
    expect(estimateLocal(150_000, 'TZS', 'USD', RATES)).toBeNull();
    expect(estimateLocal(150_000, 'TZS', 'GBP', RATES)).toBeNull();
    expect(estimateLocal(150_000, 'TZS', 'GOLD', RATES)).toBeNull();
    expect(estimateLocal(150_000, 'TZS', null, RATES)).toBeNull();
    expect(estimateLocal(56, 'USD', 'EUR', RATES.filter((r) => r.currency !== 'USD'))).toBeNull();
  });

  it('no estimate for zero, negative or broken amounts, or less than one unit', () => {
    expect(estimateLocal(0, 'TZS', 'EUR', RATES)).toBeNull();
    expect(estimateLocal(-5, 'TZS', 'EUR', RATES)).toBeNull();
    expect(estimateLocal(Number.NaN, 'TZS', 'EUR', RATES)).toBeNull();
    expect(estimateLocal(1000, 'TZS', 'EUR', RATES)).toBeNull();
  });

  it('accepts a prepared map and ignores bad rows', () => {
    const map = ratesByCurrency([...RATES, { currency: 'XXX', tzs_per_unit: 5 }, { currency: 'GBP', tzs_per_unit: 'abc' }, { currency: 'CNY', tzs_per_unit: -1 }]);
    expect([...map.keys()].sort()).toEqual(['EUR', 'JPY', 'KES', 'PKR', 'UGX', 'USD']);
    expect(estimateLocal(150_000, 'TZS', 'KES', map)).toBe(7295);
  });
});
