import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// The security page says "Google connected" or "Facebook removed" only when this account really
// asked for that change a moment ago. linkSignIn and unlinkSignIn set this short-lived cookie,
// signed with HMAC-SHA256 and bound to the user, the change and the provider; a hand-made
// ?signin=linked or ?signin=removed link alone shows nothing.
//
// It reuses the server-only RECOVERY_COOKIE_SECRET (see lib/recovery.ts) with its own label, so no
// new secret is needed. Without the secret no success note is shown (fails closed); the change
// itself still works.
export const SIGNIN_NOTICE_COOKIE = 'kwetuly_signin_notice';
const MAX_AGE = 10 * 60; // seconds: long enough for the Google or Facebook round trip

export type SignInChange = 'linked' | 'removed';

export const signInNoticeCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
};

function secret(): string | null {
  const value = process.env.RECOVERY_COOKIE_SECRET ?? '';
  return value.length >= 32 ? value : null;
}

function mac(key: string, userId: string, change: SignInChange, provider: string, expires: number): string {
  return createHmac('sha256', key).update(`kwetuly-signin-notice:v1:${userId}:${change}:${provider}:${expires}`).digest('base64url');
}

/** Cookie value for a change this user just asked for, or null when the secret is not set. */
export function signSignInNotice(userId: string, change: SignInChange, provider: string): string | null {
  const key = secret();
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${change}.${provider}.${expires}.${mac(key, userId, change, provider, expires)}`;
}

/** True when the cookie proves this user asked for exactly this change to this provider recently. */
export function signInNoticeIsValid(value: string | undefined, userId: string, change: unknown, provider: unknown): boolean {
  const key = secret();
  if (!key || !value || typeof change !== 'string' || typeof provider !== 'string') return false;
  const [givenChange, givenProvider, expiresText, given, extra] = value.split('.');
  if (extra !== undefined || givenChange !== change || givenProvider !== provider) return false;
  if (change !== 'linked' && change !== 'removed') return false;
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(mac(key, userId, change, provider, expires));
  const actual = Buffer.from(given ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
