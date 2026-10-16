import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requestPasswordReset } from '../actions';
import { SubmitButton } from '@/components/submit-button';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).ux.forgotTitle, robots: { index: false } };
}

// "Forgot password?": ask for a reset email.
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t.ux.forgotTitle}</h1>
      <Suspense fallback={<div className="card mt-6 h-48 animate-pulse" />}>
        <ResetRequest searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
      <p className="mt-4 text-sm text-muted">
        <Link href={`/${locale}/login`} className="font-semibold text-forest">{t.ux.backToSignIn}</Link>
      </p>
    </div>
  );
}

async function ResetRequest({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const params = await searchParams;
  if (params.sent) {
    return <p role="status" className="mt-6 rounded-[5px] bg-mint p-4 font-semibold text-forest">{t.ux.resetSent}</p>;
  }
  const error =
    params.error === 'email'
      ? t.ux.resetEmailError
      : params.error === 'wait'
        ? t.ux.resetWait
        : params.error === 'link'
          ? t.ux.resetLinkError
          : params.error
            ? t.ux.resetError
            : null;
  return (
    <>
      <p className="mt-2 text-muted">{t.ux.forgotBody}</p>
      <form action={requestPasswordReset} className="card mt-6 space-y-4">
        {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="field" id="email" name="email" type="email" required autoComplete="email" maxLength={320} autoFocus />
        </div>
        <SubmitButton className="btn w-full">{t.ux.sendResetLink}</SubmitButton>
      </form>
    </>
  );
}
