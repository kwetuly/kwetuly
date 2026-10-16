import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { UX_TEXT } from '@rafrika/shared';
import { LoginForm } from './login-form';
import { SocialSignIn } from '@/components/social-sign-in';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.signInTitle };
}

export default async function LoginPage({ searchParams }: PageProps<'/[lang]/login'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t.auth.signInTitle}</h1>

      <div className="card mt-6 space-y-4">
      <SocialSignIn locale={locale} t={t} />
      <LoginForm
        locale={locale}
        notice={
          <Suspense fallback={null}>
            <ErrorNote searchParams={searchParams} message={t.auth.error} linkExpired={t.ux.linkExpired} />
          </Suspense>
        }
        labels={{
          email: t.auth.email,
          password: t.ux.passwordLabel,
          signIn: t.auth.signIn,
          forgot: t.ux.forgotLink,
          wrong: t.ux.signInWrong,
          error: t.auth.error,
        }}
        next={
          <Suspense fallback={null}>
            <NextField searchParams={searchParams} />
          </Suspense>
        }
      />
      </div>

      <p className="mt-4 text-sm text-muted">
        {t.auth.noAccount}{' '}
        <Link href={`/${locale}/join`} className="font-semibold text-forest">{t.nav.signUp}</Link>
      </p>
    </div>
  );
}

// ?error=link: an email link (sign-up confirmation, magic link) that expired or was already used.
async function ErrorNote({
  searchParams,
  message,
  linkExpired,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  message: string;
  linkExpired: string;
}) {
  const params = await searchParams;
  if (params.deleted) return <p role="status" className="rounded-[5px] bg-mint p-4 font-semibold text-forest">{UX_TEXT[(await getLocale())].deleteDone}</p>;
  if (!params.error) return null;
  return <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">{params.error === 'link' ? linkExpired : message}</p>;
}

async function NextField({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = (await searchParams).next;
  return typeof next === 'string' ? <input type="hidden" name="next" value={next} /> : null;
}
