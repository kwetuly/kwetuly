// Deposit rules the website and the app show before anyone presses Pay. The `payments` Edge Function
// enforces the same rules; these only decide what to show.
import { phoneCountries } from './phone';

/** New online deposits close this many days before the trip's start date (Tanzania date). */
export const DEPOSIT_CLOSE_DAYS = 8;

const DAY = 24 * 3600_000;

/** The date in Tanzania (UTC+3 all year, no daylight saving) `days` from today, e.g. "2026-11-15". */
export function tanzaniaDate(days = 0, now: number = Date.now()): string {
  return new Date(now + 3 * 3600_000 + days * DAY).toISOString().slice(0, 10);
}

/** Whether a trip starting on `startDate` (YYYY-MM-DD) has started, by the Tanzania date. */
export function tripStarted(startDate: string, now: number = Date.now()): boolean {
  return startDate < tanzaniaDate(0, now);
}

/** The last day a deposit can be started online for a trip starting on `startDate`: 8 days before it. */
export function depositLastDay(startDate: string): string {
  return new Date(Date.parse(`${startDate}T00:00:00Z`) - DEPOSIT_CLOSE_DAYS * DAY).toISOString().slice(0, 10);
}

/** True when a trip with this start date is within 8 days (or past), so no new online deposit. */
export function depositClosed(startDate: string | null | undefined, now: number = Date.now()): boolean {
  return Boolean(startDate) && startDate! < tanzaniaDate(DEPOSIT_CLOSE_DAYS, now);
}

/** A calendar date (YYYY-MM-DD) in the visitor's language, e.g. "7 November 2026". */
export function formatDay(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  } catch {
    return day;
  }
}

export type PayMethod = 'mobile_money' | 'card';

/** Card billing address as the Edge Function takes it. Sent once to Selcom; never stored by Kwetuly. */
export type Billing = {
  firstname: string;
  lastname: string;
  address_1: string;
  address_2?: string;
  city: string;
  state_or_region: string;
  postcode_or_pobox: string;
  /** ISO 3166-1 two-letter code, e.g. "TZ". */
  country: string;
};

// Field, longest length, required: the same limits as readBilling in the Edge Function.
export const BILLING_FIELDS: readonly [keyof Billing, number, boolean][] = [
  ['firstname', 60, true],
  ['lastname', 60, true],
  ['address_1', 100, true],
  ['address_2', 100, false],
  ['city', 60, true],
  ['state_or_region', 60, true],
  ['postcode_or_pobox', 20, true],
  ['country', 2, true],
];

// Letters (any script), digits, spaces and . , ' ’ ( ) / # - (as the Edge Function allows).
const BILLING_CHARS = /^[\p{L}\p{M}\p{N} .,'’()/#-]*$/u;
/** The same rule for an HTML `pattern` attribute (browsers compile it with the `v` flag). */
export const BILLING_PATTERN = "[\\p{L}\\p{M}\\p{N} .,'’\\(\\)\\/#\\-]*";

/**
 * The billing address cleaned up as the Edge Function will read it, or what is wrong with it:
 * 'missing' (a required field is empty) or 'chars' (too long or a character Selcom cannot take).
 */
export function checkBilling(raw: Partial<Record<keyof Billing, string>>): { billing: Billing } | { problem: 'missing' | 'chars' } {
  const out: Record<string, string> = {};
  let chars = false;
  for (const [key, max, required] of BILLING_FIELDS) {
    const value = String(raw[key] ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (required && !value) return { problem: 'missing' };
    if (value.length > max || !BILLING_CHARS.test(value)) chars = true;
    if (value) out[key] = value;
  }
  if (chars) return { problem: 'chars' };
  out.country = out.country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(out.country)) return { problem: 'missing' };
  return { billing: out as Billing };
}

// Dialling regions that are not ISO countries (Ascension, Tristan da Cunha, Kosovo).
const NOT_ISO = new Set(['AC', 'TA', 'XK']);

/** Countries for the card billing address: names in the visitor's language, Tanzania first. */
export function billingCountries(locale = 'en'): { code: string; name: string; flag: string }[] {
  return phoneCountries(locale)
    .filter((c) => !NOT_ISO.has(c.code))
    .map(({ code, name, flag }) => ({ code, name, flag }));
}
