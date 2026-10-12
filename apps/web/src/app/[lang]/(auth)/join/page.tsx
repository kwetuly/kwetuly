import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { signUpGuide } from '../actions';

export const metadata: Metadata = { title: 'Join as a guide' };

export default async function JoinPage({ searchParams }: PageProps<'/[lang]/join'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t.auth.joinTitle}</h1>
      <p className="mt-2 text-muted">{t.auth.joinBody}</p>

      <Suspense fallback={null}>
        <Status searchParams={searchParams} sent={t.auth.checkEmail} error={t.auth.error} />
      </Suspense>

      <form action={signUpGuide} className="card mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="label" htmlFor="full_name">{t.auth.fullName}</label>
          <input className="field" id="full_name" name="full_name" required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="field" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="field" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <button className="btn w-full">{t.auth.createAccount}</button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {t.auth.haveAccount}{' '}
        <Link href={`/${locale}/login`} className="font-semibold text-forest">{t.auth.signIn}</Link>
      </p>
    </div>
  );
}

async function Status({
  searchParams,
  sent,
  error,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  sent: string;
  error: string;
}) {
  const params = await searchParams;
  if (params.sent) return <p className="mt-6 rounded-brand bg-mint p-4 text-forest">{sent}</p>;
  if (params.error) return <p className="mt-6 rounded-brand bg-red-50 p-4 text-red-800">{error}</p>;
  return null;
}
