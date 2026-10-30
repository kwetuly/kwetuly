import { type EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/auth-providers';
import { RECOVERY_COOKIE, recoveryCookieOptions, signRecoveryCookie, verifiedSession } from '@/lib/recovery';
import { localeOfPath, safeLocalPath } from '@/lib/safe-next';
import { SITE_URL } from '@/lib/site';

const OTP_TYPES: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// Supabase Auth's message when a provider returns no email and "Allow users without an email" is off
// (it has no error code for this case).
const NO_EMAIL = /user email from external provider/i;

// The provider being connected on the security page (`next` is /{locale}/security?signin=linked&provider=...).
function linkingProvider(next: string): SocialProvider | undefined {
  const value = new URL(next, 'https://kwetuly.invalid').searchParams.get('provider');
  return SOCIAL_PROVIDERS.find((p) => p === value);
}

// Landing point for email links: sign-up confirmation, social sign-in and password reset.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Only "/{locale}/..." paths on this site; anything else goes to the home page.
  const next = safeLocalPath(searchParams.get('next'), `/${defaultLocale}`);
  const locale = localeOfPath(next, defaultLocale);

  // Supabase sends people back with ?error=...&error_code=...&error_description=... when a provider
  // sign-in or linking is refused. Turn the known cases into friendly messages, never the raw text.
  const site = new URL(SITE_URL).origin;
  const oauthError = searchParams.get('error');
  if (oauthError) {
    const code = searchParams.get('error_code') ?? '';
    const description = searchParams.get('error_description') ?? '';
    const provider = SOCIAL_PROVIDERS.find((p) => p === searchParams.get('provider')) ?? linkingProvider(next);
    const linking = next.startsWith(`/${locale}/security`);
    let target: string;
    if (linking) {
      const reason = code === 'identity_already_exists' ? 'taken' : code === 'manual_linking_disabled' ? 'off' : 'error';
      target = `/${locale}/security?signin=${reason}${provider ? `&provider=${provider}` : ''}#sign-ins`;
    } else if (NO_EMAIL.test(description)) {
      // "Allow users without an email" is off: the provider (Facebook, X) shared no email address.
      target = `/${locale}/login?error=no_email${provider ? `&provider=${provider}` : ''}`;
    } else {
      target = `/${locale}/login?error=1`;
    }
    // As for any failed link: a refused sign-in never leaves a password-reset permission behind.
    (await cookies()).delete(RECOVERY_COOKIE);
    return NextResponse.redirect(new URL(target, site));
  }

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type') ?? '';
  const type = (OTP_TYPES as readonly string[]).includes(typeParam) ? (typeParam as EmailOtpType) : null;

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { data: { user: null, session: null }, error: new Error('Missing confirmation token') };

  // Password reset links always end on the "Set a new password" page.
  const isRecovery = type === 'recovery' || next.startsWith(`/${locale}/reset-password`);
  const target = error
    ? isRecovery
      ? `/${locale}/forgot-password?error=link`
      : `/${locale}/login?error=link`
    : type === 'recovery'
      ? `/${locale}/reset-password`
      : next;

  // Only a reset link that just signed someone in may set a new password (checked in updatePassword).
  // The cookie is issued only when the link itself proves it was a reset link, never because of `next`:
  //   - ?token_hash=...&type=recovery, verified with verifyOtp as a recovery token, or
  //   - ?code=... (PKCE), when Supabase Auth recorded "recovery" in the new session's amr.
  // The cookie is signed on the server and bound to this user and this new session (see lib/recovery).
  const cookieStore = await cookies();
  const session =
    !error && data.user && data.session ? await verifiedSession(supabase, data.session.access_token) : null;
  const provenRecovery =
    session !== null
    && (code ? session.amrMethods.includes('recovery') : Boolean(tokenHash) && type === 'recovery');
  const signed = provenRecovery && session && data.user ? signRecoveryCookie(data.user.id, session.sessionId) : null;
  if (signed) {
    cookieStore.set(RECOVERY_COOKIE, signed, recoveryCookieOptions);
  } else {
    cookieStore.delete(RECOVERY_COOKIE);
  }

  // Build the redirect from the configured site address, never from the request's Host header.
  const url = new URL(target, site);
  // Belt and braces: never leave this site.
  return NextResponse.redirect(url.origin === site ? url : new URL(`/${defaultLocale}`, site));
}
