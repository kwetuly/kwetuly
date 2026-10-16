import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { localeOfPath, safeLocalPath } from '@/lib/safe-next';

const OTP_TYPES: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// Landing point for email links: sign-up confirmation, social sign-in and password reset.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // Only "/{locale}/..." paths on this site; anything else goes to the home page.
  const next = safeLocalPath(searchParams.get('next'), `/${defaultLocale}`);
  const locale = localeOfPath(next, defaultLocale);

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type') ?? '';
  const type = (OTP_TYPES as readonly string[]).includes(typeParam) ? (typeParam as EmailOtpType) : null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error('Missing confirmation token') };

  // Password reset links always end on the "Set a new password" page.
  const isRecovery = type === 'recovery' || next.startsWith(`/${locale}/reset-password`);
  const target = error
    ? isRecovery
      ? `/${locale}/forgot-password?error=link`
      : `/${locale}/login?error=1`
    : type === 'recovery'
      ? `/${locale}/reset-password`
      : next;

  const url = new URL(target, origin);
  // Belt and braces: never leave this site.
  return NextResponse.redirect(url.origin === origin ? url : new URL(`/${defaultLocale}`, origin));
}
