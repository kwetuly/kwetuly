// Format checks for identity numbers (NIDA, passport, TIN). Run on the server (the `identifiers`
// Edge Function) before a number is encrypted, and may also run in forms for early feedback.
// The database never sees a number in clear, so these checks are the only format check there is.
//
// This file has NO imports on purpose: the Edge Function keeps a byte-identical copy at
// supabase/functions/_shared/identifier-formats.ts (Deno cannot import from packages/), and
// identifier-formats.test.ts fails if the two drift apart. Edit this file, then copy it.
//
// TODO-verify: none of these formats is confirmed by NIDA, the Immigration Department or TRA.
// They are deliberately lenient (they reject only what is clearly not a number of that kind).

export type IdentifierField = 'nida' | 'passport' | 'tin' | 'business_tin';

export type ParsedIdentifier =
  | { ok: true; field: IdentifierField; value: string; last3: string; hmacInput: string | null }
  | { ok: false; error: 'empty' | 'format' | 'country' };

/** Upper case, without spaces, dashes or dots (the ways people write these numbers). */
export function normalizeIdentifier(raw: string): string {
  return raw
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s\-‐-―.]/g, '');
}

// TODO-verify: NIDA numbers are usually 20 digits (often written 8-5-5-2). Accept 18-22 digits.
const NIDA = /^\d{18,22}$/;
// TODO-verify: passport numbers vary by country; ICAO allows up to 9 characters in the MRZ, but
// some countries print more. Accept 5-15 letters and digits with at least one digit.
const PASSPORT = /^(?=.*\d)[A-Z0-9]{5,15}$/;
// TODO-verify: Tanzanian TINs are 9 digits (written 123-456-789). Accept 9-12 digits.
const TIN = /^\d{9,12}$/;
const COUNTRY = /^[A-Z]{2}$/;

/** ISO 3166-1 alpha-2 code in upper case, or null if it is not two letters. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim().toUpperCase();
  return COUNTRY.test(c) ? c : null;
}

/**
 * Checks and normalises one identifier. `hmacInput` is what the server hashes for the duplicate flag
 * (null for TINs, which have no duplicate flag): the field name and, for passports, the issuing
 * country, so the same number from two countries is not a duplicate.
 */
export function parseIdentifier(field: IdentifierField, raw: string, country?: string | null): ParsedIdentifier {
  const value = normalizeIdentifier(raw ?? '');
  if (!value) return { ok: false, error: 'empty' };
  const rule = field === 'nida' ? NIDA : field === 'passport' ? PASSPORT : TIN;
  if (!rule.test(value)) return { ok: false, error: 'format' };
  const last3 = value.slice(-3);
  if (field === 'passport') {
    const c = normalizeCountry(country);
    if (!c) return { ok: false, error: 'country' };
    return { ok: true, field, value, last3, hmacInput: `passport|${c}|${value}` };
  }
  return { ok: true, field, value, last3, hmacInput: field === 'nida' ? `nida|${value}` : null };
}

/** Shows only the last three characters, for the owner's and admins' screens. */
export function maskIdentifier(last3: string | null | undefined): string {
  return last3 ? `••• ${last3}` : '';
}
