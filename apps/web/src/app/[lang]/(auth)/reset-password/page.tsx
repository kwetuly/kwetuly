import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { RECOVERY_COOKIE, recoveryUserId } from '@/lib/recovery';
import { createClient } from '@/lib/supabase/server';
import { updatePassword } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).ux.newPasswordTitle, robots: { index: false } };
}

// "Set a new password". People arrive here signed in through the reset email (/auth/confirm).
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t.ux.newPasswordTitle}</h1>
      <Suspense fallback={<div className="card mt-6 h-56 animate-pulse" />}>
        <NewPassword searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function NewPassword({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const params = await searchParams;
  if (params.done) {
    return (
      <div className="mt-6 space-y-4">
        <p role="status" className="rounded-[5px] bg-mint p-4 font-semibold text-forest">{t.ux.passwordSaved}</p>
        <Link href={`/${locale}/dashboard`} className="btn w-full">{t.ux.goToDashboard}</Link>
      </div>
    );
  }

  const supabase = await createClient();
  // Same check as updatePassword (lib/recovery): a recent reset link, in this session.
  const fromResetLink = Boolean(await recoveryUserId(supabase, (await cookies()).get(RECOVERY_COOKIE)?.value));
  if (!fromResetLink) {
    // Opened without a valid reset link (or it expired): offer a new one, never a dead end.
    return (
      <div className="mt-6 space-y-4">
        <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">{t.ux.resetLinkError}</p>
        <Link href={`/${locale}/forgot-password`} className="btn w-full">{t.ux.sendResetLink}</Link>
      </div>
    );
  }

  const errors: Record<string, string> = {
    short: t.ux.passwordShort,
    match: t.ux.passwordMatch,
    same: t.ux.passwordSame,
    weak: t.ux.passwordWeak,
    reauth: t.ux.passwordReauth,
  };
  const error = typeof params.error === 'string' ? (errors[params.error] ?? t.ux.passwordError) : null;

  return (
    <>
      <p className="mt-2 text-muted">{t.ux.newPasswordBody}</p>
      <form action={updatePassword} className="card mt-6 space-y-4">
        {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="label" htmlFor="password">{t.ux.newPassword}</label>
          <input className="field" id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="confirm">{t.ux.confirmPassword}</label>
          <input className="field" id="confirm" name="confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
        <button className="btn w-full">{t.ux.savePassword}</button>
      </form>
      {error && (
        <p className="mt-4 text-sm text-muted">
          <Link href={`/${locale}/forgot-password`} className="font-semibold text-forest">{t.ux.sendResetLink}</Link>
        </p>
      )}
    </>
  );
}
