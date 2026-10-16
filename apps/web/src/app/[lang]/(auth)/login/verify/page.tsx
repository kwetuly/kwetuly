import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { verifySignInCode } from '../../actions';
import { SubmitButton } from '@/components/submit-button';

export const metadata: Metadata = { robots: { index: false } };

// Second step of signing in for accounts with two-step sign-in turned on.
export default async function VerifyPage({ searchParams }: PageProps<'/[lang]/login/verify'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t.ux.verifyTitle}</h1>
      <p className="mt-2 text-muted">{t.ux.verifyBody}</p>
      <Suspense fallback={<div className="card mt-6 h-48 animate-pulse" />}>
        <CodeForm searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function CodeForm({ searchParams, t, locale }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary; locale: Locale }) {
  const params = await searchParams;
  return (
    <form action={verifySignInCode} className="card mt-6 space-y-4">
      {params.error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.ux.codeError}</p>}
      <input type="hidden" name="locale" value={locale} />
      {typeof params.next === 'string' && <input type="hidden" name="next" value={params.next} />}
      <div>
        <label className="label" htmlFor="code">{t.ux.code}</label>
        <input
          className="field text-center text-2xl tracking-[0.4em] tabular-nums"
          id="code"
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          autoFocus
        />
      </div>
      <SubmitButton className="btn w-full">{t.auth.signIn}</SubmitButton>
    </form>
  );
}
