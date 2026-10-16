import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type AuthClient = { auth: Pick<SupabaseClient['auth'], 'getClaims'> };

// "Set a new password" is allowed only within 15 minutes of following a password reset link, in the
// same session that link created. Two checks, both required:
//
// 1. The verified access token (supabase.auth.getClaims()) has an `amr` entry "recovery" or "otp"
//    no older than 15 minutes. Supabase Auth records "recovery" when a PKCE reset link (?code=) is
//    exchanged, and "otp" when a ?token_hash= link is verified with verifyOtp. "otp" is also what
//    sign-up, magic-link and email-change token_hash links produce, so this alone does not prove the
//    link was a reset link.
// 2. A cookie that /auth/confirm sets only after a reset link, signed with HMAC-SHA256 using the
//    server-only secret RECOVERY_COOKIE_SECRET and bound to the user id, the session id and an
//    expiry. The browser cannot forge or move it to another account or session.
//
// RECOVERY_COOKIE_SECRET: a random value of at least 32 characters (for example the output of
// `openssl rand -base64 48`), set in apps/web/.env.local and in the hosting environment. Never commit
// it and never prefix it with NEXT_PUBLIC_. Without it, password reset is refused (fails closed).
// Changing it invalidates reset links that are in progress, nothing else.
export const RECOVERY_COOKIE = 'rafrika_recovery';
export const RECOVERY_COOKIE_MAX_AGE = 15 * 60; // seconds

export const recoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: RECOVERY_COOKIE_MAX_AGE,
};

const RECOVERY_AMR_METHODS = new Set(['recovery', 'otp']);

function secret(): string | null {
  const value = process.env.RECOVERY_COOKIE_SECRET ?? '';
  if (value.length < 32) {
    console.error('RECOVERY_COOKIE_SECRET is missing or shorter than 32 characters; password reset is disabled.');
    return null;
  }
  return value;
}

function mac(key: string, userId: string, sessionId: string, expires: number): string {
  return createHmac('sha256', key).update(`rafrika-recovery:v1:${userId}:${sessionId}:${expires}`).digest('base64url');
}

/** Cookie value for a session that a reset link just created, or null when the secret is not set. */
export function signRecoveryCookie(userId: string, sessionId: string): string | null {
  const key = secret();
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1000) + RECOVERY_COOKIE_MAX_AGE;
  return `${expires}.${mac(key, userId, sessionId, expires)}`;
}

function cookieIsValid(value: string | undefined, userId: string, sessionId: string): boolean {
  const key = secret();
  if (!key || !value) return false;
  const [expiresText, given, extra] = value.split('.');
  if (!expiresText || !given || extra !== undefined || !/^\d{1,12}$/.test(expiresText)) return false;
  const expires = Number(expiresText);
  if (expires < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(mac(key, userId, sessionId, expires));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function recentRecoveryAmr(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  const since = Math.floor(Date.now() / 1000) - RECOVERY_COOKIE_MAX_AGE;
  return amr.some(
    (entry) =>
      typeof entry === 'object' && entry !== null
      && RECOVERY_AMR_METHODS.has(String((entry as { method?: unknown }).method))
      && typeof (entry as { timestamp?: unknown }).timestamp === 'number'
      && (entry as { timestamp: number }).timestamp >= since,
  );
}

/** Session id of a verified access token (pass the token straight after a sign-in). */
export async function verifiedSessionId(supabase: AuthClient, accessToken?: string): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims(accessToken);
  const sessionId = data?.claims?.session_id;
  return !error && typeof sessionId === 'string' && sessionId ? sessionId : null;
}

/**
 * The signed-in user's id when this session came from a password reset link in the last 15 minutes
 * (both checks above), otherwise null.
 */
export async function recoveryUserId(supabase: AuthClient, cookieValue: string | undefined): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims) return null;
  const userId = claims.sub;
  const sessionId = claims.session_id;
  if (typeof userId !== 'string' || !userId || typeof sessionId !== 'string' || !sessionId) return null;
  if (!recentRecoveryAmr(claims.amr)) return null;
  return cookieIsValid(cookieValue, userId, sessionId) ? userId : null;
}
