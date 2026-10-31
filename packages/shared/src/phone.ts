// Phone numbers for the website and the app, so both agree on what is a valid number.
// People pick a country (Tanzania first) and type the number the way they know it: with or without
// the leading 0, with spaces or dashes. We save it as one international number (E.164, +255712345678).
// Uses libphonenumber-js with its small ("min") metadata and the mobile example numbers.
import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import examples from 'libphonenumber-js/mobile/examples';
import metadata from 'libphonenumber-js/min/metadata';
import { COUNTRY_NAMES_EN } from './phone-countries';

export const DEFAULT_PHONE_COUNTRY = 'TZ';

// Longest text we look at; anything longer is not a phone number.
const MAX_INPUT = 40;

const COUNTRY_SET = new Set<string>(getCountries());

export function isPhoneCountry(code: unknown): code is CountryCode {
  return typeof code === 'string' && COUNTRY_SET.has(code);
}

// A hint (Vercel geo header, device region, form field) becomes a supported country, or Tanzania.
export function phoneCountryOrDefault(hint: string | null | undefined): CountryCode {
  const code = (hint ?? '').trim().toUpperCase();
  return isPhoneCountry(code) ? code : DEFAULT_PHONE_COUNTRY;
}

export type PhoneCountry = { code: CountryCode; dial: string; flag: string; name: string };

// Flag from the two regional-indicator letters of the country code.
function flagOf(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function displayNames(locale: string): ((code: string) => string | undefined) | null {
  try {
    const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: 'region' }) => { of(c: string): string | undefined } }).DisplayNames;
    if (!DN) return null;
    const names = new DN([locale], { type: 'region' });
    return (code) => names.of(code);
  } catch {
    return null;
  }
}

// Top of the list: Tanzania, its neighbours, then the countries most travellers come from; then A to Z.
export const PINNED_COUNTRIES: readonly CountryCode[] = [
  'TZ', 'KE', 'UG', 'RW', 'BI', 'CD', 'ZM', 'MW', 'MZ',
  'US', 'GB', 'DE', 'FR', 'IT', 'PL', 'CN', 'NL', 'ES', 'IN',
];

// Kenyan mobile numbers grouped like Tanzanian ones (0712 345 678) rather than the library's
// 0712 345678, so the two neighbours read the same way. Other countries keep the library format.
function formatLocal(country: string | undefined, national: string): string {
  const digits = national.replace(/\D/g, '');
  if (country === 'KE' && /^0[17]\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return national;
}

const listCache = new Map<string, PhoneCountry[]>();

// Every country with its dial code, flag and name in the visitor's language (English names where
// the device has no translated names). Tanzania first, then by name.
export function phoneCountries(locale = 'en'): PhoneCountry[] {
  const cached = listCache.get(locale);
  if (cached) return cached;
  const local = displayNames(locale);
  const all = getCountries().map((code) => {
    const translated = local?.(code);
    const name = translated && translated !== code ? translated : COUNTRY_NAMES_EN[code] ?? code;
    return { code, dial: `+${getCountryCallingCode(code)}`, flag: flagOf(code), name };
  });
  let compare: (a: string, b: string) => number;
  try {
    compare = new Intl.Collator(locale).compare;
  } catch {
    compare = (a, b) => a.localeCompare(b);
  }
  const pinned = PINNED_COUNTRIES.map((code) => all.find((c) => c.code === code)).filter((c): c is PhoneCountry => !!c);
  const rest = all.filter((c) => !PINNED_COUNTRIES.includes(c.code)).sort((a, b) => compare(a.name, b.name));
  const list = [...pinned, ...rest];
  listCache.set(locale, list);
  return list;
}

// The main country of a dial code shared by several (+1 United States, +44 United Kingdom, +7
// Russia): the metadata lists it first for that code.
function isMainCountry(code: CountryCode): boolean {
  return metadata.country_calling_codes[getCountryCallingCode(code)]?.[0] === code;
}

// Search by name, country code or dial code ("tanz", "TZ", "+255", "255"). Best matches first:
// the exact country code, then names that start with the text, then names that contain it; for a
// dial code, the exact code first with its main country on top.
// Lower case without accents, so "cote", "Côte" and "COTE" all find Côte d’Ivoire.
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function searchPhoneCountries(list: PhoneCountry[], query: string): PhoneCountry[] {
  const q = fold(query.trim());
  if (!q) return list;
  const isDial = /^\+?\d+$/.test(q);
  const digits = q.replace(/\D/g, '');
  const scored: { c: PhoneCountry; score: number }[] = [];
  list.forEach((c, index) => {
    const name = fold(c.name);
    const english = fold(COUNTRY_NAMES_EN[c.code] ?? '');
    let score = -1;
    if (isDial) {
      const dial = c.dial.slice(1);
      if (dial === digits) score = isMainCountry(c.code) ? 0 : 1;
      else if (dial.startsWith(digits)) score = 2;
    } else if (c.code.toLowerCase() === q) score = 0;
    else if (name.startsWith(q) || english.startsWith(q)) score = 1;
    else if (name.includes(q) || english.includes(q)) score = 2;
    if (score >= 0) scored.push({ c, score: score * 1000 + index });
  });
  return scored.sort((a, b) => a.score - b.score).map((s) => s.c);
}

// An example number for the country, written the local way (Tanzania: 0712 345 678).
export function phoneExample(country: string): string {
  const code = phoneCountryOrDefault(country);
  return formatLocal(code, getExampleNumber(code, examples)?.formatNational() ?? '');
}

// Turns what people type into an international number like +255712345678, or null if it is not a
// valid number. A number starting with + or 00 keeps its own country; anything else is read as a
// number in `country` (Tanzania when none is given), with or without the leading 0.
export function normalizePhone(raw: string, country: string = DEFAULT_PHONE_COUNTRY): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed.length > MAX_INPUT) return null;
  // Only digits, spaces, dashes, dots, brackets and one leading + are a phone number.
  if (!/^\+?[\d\s\-().\/]+$/.test(trimmed)) return null;
  const region = phoneCountryOrDefault(country);
  const text = trimmed.startsWith('00') ? `+${trimmed.replace(/\D/g, '').slice(2)}` : trimmed;
  const parsed = parsePhoneNumberFromString(text, region);
  if (parsed?.isValid()) return parsed.number;
  // The country code typed without + (255 712 345 678 with Tanzania picked).
  const digits = text.replace(/\D/g, '');
  const dial = getCountryCallingCode(region);
  if (!text.startsWith('+') && digits.startsWith(dial)) {
    const withPlus = parsePhoneNumberFromString(`+${digits}`);
    if (withPlus?.isValid()) return withPlus.number;
  }
  return null;
}

// Splits a saved number back into the country and the local way of writing it, for edit forms.
// Something that is not a saved international number is returned as typed, with the fallback country.
export function splitPhone(saved: string | null | undefined, fallback: string = DEFAULT_PHONE_COUNTRY): { country: CountryCode; national: string } {
  const value = (saved ?? '').trim();
  const parsed = value.startsWith('+') ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) return { country: parsed.country, national: formatLocal(parsed.country, parsed.formatNational()) };
  return { country: phoneCountryOrDefault(fallback), national: value };
}

// What to save for a phone field, given what was saved before. A number the person did not change
// is kept exactly as stored, even one the current check would refuse or an old "+2550…" form, so
// nobody is stuck on a form and a confirmed number keeps its confirmation. Otherwise the new
// number, or null when it is not a valid number (an empty field is null too).
export function resolvePhone(input: string, country: string, stored: string | null | undefined): string | null {
  const typed = String(input ?? '').trim();
  if (!typed) return null;
  const saved = (stored ?? '').trim();
  if (saved) {
    if (typed === saved) return saved;
    // The form showed the saved number the local way with its country, and it came back unchanged.
    const shown = splitPhone(saved, country);
    if (shown.country === phoneCountryOrDefault(country) && shown.national === typed) return saved;
  }
  const normalized = normalizePhone(typed, country);
  // Same digits as the saved number, only written differently: keep the saved value.
  if (normalized && saved && normalizePhone(saved, country) === normalized) return saved;
  return normalized;
}
