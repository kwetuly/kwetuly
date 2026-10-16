import { type EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { RECOVERY_COOKIE, recoveryCookieOptions } from '@/lib/recovery';
import { localeOfPath, safeLocalPath } from '@/lib/safe-next';
import { SITE_URL } from '@/lib/site';

const OTP_TYPES: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// Landing point for email links: sign-up confirmation, social sign-in and password reset.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Only "/{locale}/..." paths on this site; anything else goes to the home page.
  const next = safeLocalPath(searchParams.get('next'), `/${defaultLocale}`);
  const locale = localeOfPath(next, defaultLocale);

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type') ?? '';
  const type = (OTP_TYPES as readonly string[]).includes(typeParam) ? (typeParam as EmailOtpType) : null;

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { data: { user: null }, error: new Error('Missing confirmation token') };

  // Password reset links always end on the "Set a new password" page.
  const isRecovery = type === 'recovery' || next.startsWith(`/${locale}/reset-password`);
  const target = error
    ? isRecovery
      ? `/${locale}/forgot-password?error=link`
      : `/${locale}/login?error=1`
    : type === 'recovery'
      ? `/${locale}/reset-password`
      : next;

  // Only a reset link that just signed someone in may set a new password (checked in updatePassword).
  // Reset links arrive as ?type=recovery&token_hash=..., or (PKCE) as ?code= with the reset page as next.
  const cookieStore = await cookies();
  if (!error && isRecovery && data.user) {
    cookieStore.set(RECOVERY_COOKIE, data.user.id, recoveryCookieOptions);
  } else {
    cookieStore.delete(RECOVERY_COOKIE);
  }

  // Build the redirect from the configured site address, never from the request's Host header.
  const site = new URL(SITE_URL).origin;
  const url = new URL(target, site);
  // Belt and braces: never leave this site.
  return NextResponse.redirect(url.origin === site ? url : new URL(`/${defaultLocale}`, site));
}
