// Currencies for the "about" estimate next to a TZS or USD price (slice S48, design section 12.3).
// Display only: Kwetuly never charges or settles in these rates. Prices stay in TZS or USD as set by
// Walter, a guide or a seller; the estimate is a grey line beside them, never instead of them.
//
// Rates are "TZS per 1 unit" (Bank of Tanzania mean, or an admin override from a named source), as
// returned by public.current_rates() (migration 20261203030000_exchange_rates.sql).
//
// supabase/functions/_shared/currencies.ts must stay an identical copy of this file (the
// `exchange-rates` Edge Function imports it there); currencies.test.ts checks that, and checks that
// the database allow-list in the migration matches RATE_CURRENCIES.

/** The page the Edge Function reads (public HTML table; no API, CSV or feed exists). */
export const BOT_RATES_URL = 'https://www.bot.go.tz/ExchangeRate/excRates?lang=en';

/** Prices are set in these two; no estimate is shown when the visitor's currency is one of them. */
export const PRICE_CURRENCIES = ['TZS', 'USD'] as const;
export type PriceCurrency = (typeof PRICE_CURRENCIES)[number];

/**
 * Currencies kept from the Bank of Tanzania table (checked against the page on 2026-11-27).
 * Dropped on purpose: obsolete codes (ATS, NLG, ZWD, MZM, CUC), GOLD, SDR (not a currency visitors
 * hold) and IRR (published with too few decimals to give a useful estimate). Any code not in this
 * list is ignored by the fetch.
 */
export const BOT_CURRENCIES = [
  'AED', 'AUD', 'BIF', 'BWP', 'CAD', 'CHF', 'CNY', 'DKK', 'DZD', 'EUR', 'GBP', 'HKD', 'IDR', 'INR',
  'IQD', 'JPY', 'KES', 'KRW', 'KWD', 'MWK', 'MYR', 'NAD', 'NGN', 'NOK', 'NZD', 'PKR', 'QAR',
  'RWF', 'SAR', 'SEK', 'SGD', 'TRY', 'UGX', 'USD', 'ZAR', 'ZMW',
] as const;

/** Not on the Bank of Tanzania list: only an admin override from a named source can give a rate. */
export const OVERRIDE_ONLY_CURRENCIES = ['PLN'] as const;

/** Every currency that may have a row in public.exchange_rates (same list as the migration). */
export const RATE_CURRENCIES = [...BOT_CURRENCIES, ...OVERRIDE_ONLY_CURRENCIES] as const;
export type RateCurrency = (typeof RATE_CURRENCIES)[number];

/** Currencies a visitor can pick in "Show prices in". */
export const DISPLAY_CURRENCIES = ['TZS', ...RATE_CURRENCIES] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

const RATE_SET: ReadonlySet<string> = new Set(RATE_CURRENCIES);
const BOT_SET: ReadonlySet<string> = new Set(BOT_CURRENCIES);
const DISPLAY_SET: ReadonlySet<string> = new Set(DISPLAY_CURRENCIES);

export const isRateCurrency = (code: unknown): code is RateCurrency => typeof code === 'string' && RATE_SET.has(code);
export const isBotCurrency = (code: unknown): code is (typeof BOT_CURRENCIES)[number] => typeof code === 'string' && BOT_SET.has(code);
export const isDisplayCurrency = (code: unknown): code is DisplayCurrency => typeof code === 'string' && DISPLAY_SET.has(code);

/**
 * Currencies with large numbers (one unit is worth less than about 20 TZS). Their estimate is rounded
 * to the nearest 100 from 10,000 up, to 2 significant figures from 100 to 9,999, and to whole units
 * below 100. Other currencies are rounded to whole units.
 */
export const ROUND_TO_100 = ['JPY', 'KRW', 'IDR', 'UGX', 'IQD', 'BIF', 'RWF', 'MWK', 'NGN', 'PKR'] as const;
const ROUND_100_SET: ReadonlySet<string> = new Set(ROUND_TO_100);

const EURO_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PT', 'SK', 'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
  // French overseas regions and territories, and Aland, which use the euro
  'RE', 'YT', 'GP', 'MQ', 'GF', 'PM', 'BL', 'MF', 'AX',
] as const;

/**
 * Country (ISO 3166-1 alpha-2, as in Vercel's x-vercel-ip-country or a locale's region) to the
 * currency we show. Only countries whose own currency we can estimate, plus Tanzania. A country not
 * listed gets no currency (the visitor sees TZS and USD only, and can pick one).
 */
export const COUNTRY_CURRENCY: Readonly<Record<string, DisplayCurrency>> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, 'EUR'])),
  TZ: 'TZS',
  US: 'USD', PR: 'USD', GU: 'USD', VI: 'USD', AS: 'USD', MP: 'USD', EC: 'USD', SV: 'USD',
  AE: 'AED', AU: 'AUD', BI: 'BIF', BW: 'BWP', CA: 'CAD', CH: 'CHF', LI: 'CHF', CN: 'CNY',
  DK: 'DKK', FO: 'DKK', GL: 'DKK', DZ: 'DZD', GB: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP',
  HK: 'HKD', ID: 'IDR', IN: 'INR', IQ: 'IQD', JP: 'JPY', KE: 'KES', KR: 'KRW',
  KW: 'KWD', MW: 'MWK', MY: 'MYR', NA: 'NAD', NG: 'NGN', NO: 'NOK', NZ: 'NZD', PK: 'PKR',
  QA: 'QAR', RW: 'RWF', SA: 'SAR', SE: 'SEK', SG: 'SGD', TR: 'TRY', UG: 'UGX', ZA: 'ZAR',
  ZM: 'ZMW', PL: 'PLN',
};

/** "DE" or "de" -> "EUR", "TZ" -> "TZS". Unknown or malformed countries give null. */
export function currencyForCountry(country: string | null | undefined): DisplayCurrency | null {
  if (typeof country !== 'string') return null;
  const code = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return COUNTRY_CURRENCY[code] ?? null;
}

/** Browser or phone locale such as "de-DE", "pl_PL" or "zh-Hans-CN": the region decides. */
export function currencyForLocale(locale: string | null | undefined): DisplayCurrency | null {
  if (typeof locale !== 'string') return null;
  const parts = locale.trim().split(/[-_]/);
  for (let i = parts.length - 1; i >= 1; i--) {
    if (/^[A-Za-z]{2}$/.test(parts[i])) return currencyForCountry(parts[i]);
  }
  return null;
}

/** One row of public.current_rates() (numeric columns may arrive as number or string). */
export type CurrentRate = {
  currency: string;
  tzs_per_unit: number | string;
  source: 'bot' | 'admin';
  source_name: string | null;
  source_url: string | null;
  rate_date: string;
};

/** currency -> TZS per 1 unit; rows that are not allow-listed or not a positive number are left out. */
export function ratesByCurrency(rows: readonly Pick<CurrentRate, 'currency' | 'tzs_per_unit'>[] | null | undefined): Map<RateCurrency, number> {
  const out = new Map<RateCurrency, number>();
  for (const row of rows ?? []) {
    const value = Number(row.tzs_per_unit);
    if (isRateCurrency(row.currency) && Number.isFinite(value) && value > 0) out.set(row.currency, value);
  }
  return out;
}

/**
 * Whole units; for currencies with large numbers (ROUND_TO_100) the nearest 100 from 10,000 up and 2
 * significant figures from 100 up. A positive value never rounds to 0 (the smallest result is 1).
 */
export function roundEstimate(value: number, currency: string): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  let rounded: number;
  if (ROUND_100_SET.has(currency) && value >= 10_000) rounded = Math.round(value / 100) * 100;
  else if (ROUND_100_SET.has(currency) && value >= 100) {
    const step = 10 ** (Math.floor(Math.log10(value)) - 1);
    rounded = Math.round(value / step) * step;
  } else rounded = Math.round(value);
  return Math.max(1, rounded);
}

/**
 * The "about" amount of a TZS or USD price in the visitor's currency, or null when no estimate
 * should be shown: the target is TZS or USD, the amount is not a positive number, the result is
 * less than one unit, or a rate is missing (a USD price also needs the USD rate). Rates are TZS per 1 unit (see ratesByCurrency).
 */
export function estimateLocal(
  amount: number,
  from: PriceCurrency,
  to: string | null | undefined,
  rates: ReadonlyMap<string, number> | readonly Pick<CurrentRate, 'currency' | 'tzs_per_unit'>[],
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (from !== 'TZS' && from !== 'USD') return null;
  if (!isRateCurrency(to) || to === 'USD') return null;
  const table: ReadonlyMap<string, number> = rates instanceof Map ? rates : ratesByCurrency(rates as readonly CurrentRate[]);
  const target = table.get(to);
  if (!target || !Number.isFinite(target) || target <= 0) return null;
  let tzs = amount;
  if (from === 'USD') {
    const usd = table.get('USD');
    if (!usd || !Number.isFinite(usd) || usd <= 0) return null;
    tzs = amount * usd;
  }
  const value = tzs / target;
  // Less than one unit of the visitor's currency: no "about" line.
  if (!(value >= 1)) return null;
  return roundEstimate(value, to);
}
