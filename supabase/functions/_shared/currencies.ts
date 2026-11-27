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
 * Dropped on purpose: obsolete codes (ATS, NLG, ZWD, MZM, CUC), GOLD and SDR (not a currency
 * visitors hold). Any code not in this list is ignored by the fetch.
 */
export const BOT_CURRENCIES = [
  'AED', 'AUD', 'BIF', 'BWP', 'CAD', 'CHF', 'CNY', 'DKK', 'DZD', 'EUR', 'GBP', 'HKD', 'IDR', 'INR',
  'IQD', 'IRR', 'JPY', 'KES', 'KRW', 'KWD', 'MWK', 'MYR', 'NAD', 'NGN', 'NOK', 'NZD', 'PKR', 'QAR',
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
 * Currencies with large numbers: the estimate is rounded to the nearest 100 (others to whole units).
 * Rule of thumb: one unit is worth less than about 20 TZS.
 */
export const ROUND_TO_100 = ['JPY', 'KRW', 'IDR', 'UGX', 'IRR', 'IQD', 'BIF', 'RWF', 'MWK', 'NGN', 'PKR'] as const;
const ROUND_100_SET: ReadonlySet<string> = new Set(ROUND_TO_100);

const EURO_COUNTRIES = [
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT',
  'SK', 'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
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
  HK: 'HKD', ID: 'IDR', IN: 'INR', IQ: 'IQD', IR: 'IRR', JP: 'JPY', KE: 'KES', KR: 'KRW',
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

/** Whole units, or the nearest 100 for currencies with large numbers. */
export function roundEstimate(value: number, currency: string): number {
  return ROUND_100_SET.has(currency) ? Math.round(value / 100) * 100 : Math.round(value);
}

/**
 * The "about" amount of a TZS or USD price in the visitor's currency, or null when no estimate
 * should be shown: the target is TZS or USD, the amount is not a positive number, or a rate is
 * missing (a USD price also needs the USD rate). Rates are TZS per 1 unit (see ratesByCurrency).
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
  const rounded = roundEstimate(tzs / target, to);
  return rounded > 0 ? rounded : null;
}
