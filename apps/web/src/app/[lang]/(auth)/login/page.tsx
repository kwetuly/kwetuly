import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { signIn } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.signInTitle };
}

export default async function LoginPage({ searchParams }: PageProps<'/[lang]/login'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t.auth.signInTitle}</h1>

      <Suspense fallback={null}>
        <ErrorNote searchParams={searchParams} message={t.auth.error} />
      </Suspense>

      <form action={signIn} className="card mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="field" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="field" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn w-full">{t.auth.signIn}</button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {t.auth.noAccount}{' '}
        <Link href={`/${locale}/join`} className="font-semibold text-forest">{t.nav.signUp}</Link>
      </p>
    </div>
  );
}

async function ErrorNote({
  searchParams,
  message,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  message: string;
}) {
  const params = await searchParams;
  return params.error ? <p className="mt-6 rounded-brand bg-red-50 p-4 text-red-800">{message}</p> : null;
}
