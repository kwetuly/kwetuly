import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { inviteRequired } from '@/lib/invite';
import { JoinForm as JoinFields } from './join-form';
import { SocialSignIn } from '@/components/social-sign-in';
import { EVENTS } from '@rafrika/shared';
import { LogEvent } from '@/components/analytics';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).join.title };
}

const roles = ['traveler', 'guide', 'provider'];

export default async function JoinPage({ searchParams }: PageProps<'/[lang]/join'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight">{t.join.title}</h1>
      <p className="mt-2 text-muted">{t.join.subtitle}</p>
      <Suspense fallback={<div className="card mt-8 h-96 animate-pulse" />}>
        <JoinForm searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
      <p className="mt-4 text-sm text-muted">
        {t.auth.haveAccount}{' '}
        <Link href={`/${locale}/login`} className="font-semibold text-forest">{t.auth.signIn}</Link>
      </p>
    </div>
  );
}

async function JoinForm({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const params = await searchParams;
  const selected = roles.includes(params.role as string) ? (params.role as string) : 'traveler';

  if (params.sent) {
    return <>
      <LogEvent event={EVENTS.signupCompleted} props={{ role: selected, locale }} />
      <p className="mt-8 rounded-[5px] bg-mint p-6 text-lg font-semibold text-forest">{t.auth.checkEmail}</p>
    </>;
  }

  return (
    <div className="card mt-8 space-y-5">
    <LogEvent event={EVENTS.signupStarted} props={{ role: selected, locale }} />
    <SocialSignIn locale={locale} t={t} role={selected} />
    <JoinFields
      locale={locale}
      selected={selected}
      invite={await inviteRequired()}
      initialError={typeof params.error === 'string' ? params.error : null}
      t={{
        auth: {
          welcomeRole: t.auth.welcomeRole,
          fullName: t.auth.fullName,
          phone: t.auth.phone,
          phoneHint: t.auth.phoneHint,
          email: t.auth.email,
          password: t.auth.password,
          createAccount: t.auth.createAccount,
          error: t.auth.error,
          phoneError: t.auth.phoneError,
          inviteCode: t.auth.inviteCode,
          inviteError: t.auth.inviteError,
          inviteHint: t.auth.inviteHint,
        },
        join: { traveler: t.join.traveler, guide: t.join.guide, provider: t.join.provider },
      }}
    />
    </div>
  );
}
