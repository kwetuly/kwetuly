import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { UX_TEXT } from '@rafrika/shared';
import { signIn } from '../actions';
import { SocialSignIn } from '@/components/social-sign-in';

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

      <div className="card mt-6 space-y-4">
      <SocialSignIn locale={locale} t={t} />
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <Suspense fallback={null}>
          <NextField searchParams={searchParams} />
        </Suspense>
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="field" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="field" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn w-full">{t.auth.signIn}</button>
        <p className="text-sm">
          <Link href={`/${locale}/forgot-password`} className="font-semibold text-forest">{t.ux.forgotLink}</Link>
        </p>
      </form>
      </div>

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
  if (params.deleted) return <p role="status" className="mt-6 rounded-[5px] bg-mint p-4 font-semibold text-forest">{UX_TEXT[(await getLocale())].deleteDone}</p>;
  return params.error ? <p className="mt-6 rounded-[5px] bg-red-50 p-4 text-red-800">{message}</p> : null;
}

async function NextField({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = (await searchParams).next;
  return typeof next === 'string' ? <input type="hidden" name="next" value={next} /> : null;
}
