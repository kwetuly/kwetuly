import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { inviteRequired } from '@/lib/invite';
import { phoneCountryHint } from '@/lib/phone';
import { JoinForm as JoinFields } from './join-form';
import { SocialSignIn } from '@/components/social-sign-in';
import { EVENTS, HOST_FEATURES, HOSTS_ENTRY_LINKS, hostsEntryText } from '@kwetuly/shared';
import { featuresOn } from '@/lib/feature-switches';
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
  const [params, features] = await Promise.all([searchParams, featuresOn()]);
  const selected = roles.includes(params.role as string) ? (params.role as string) : 'traveler';
  // Host sign-up ("Become a concierge or VIP host") while either host switch is on: the option leads to
  // /hosts, which explains the work and comes back here with role=guide&intent=host.
  const concierge = features.includes(HOST_FEATURES.concierge);
  const hostsOpen = concierge || features.includes(HOST_FEATURES.investment);
  const hostIntent = hostsOpen && params.intent === 'host';

  if (params.sent) {
    return <>
      <LogEvent event={EVENTS.signupCompleted} props={{ role: selected, locale }} />
      <p className="mt-8 rounded-[5px] bg-mint p-6 text-lg font-semibold text-forest">{t.auth.checkEmail}</p>
    </>;
  }

  return (
    <div className="card mt-8 space-y-5">
    {hostIntent && (
      <p lang={locale === 'sw' ? 'sw' : 'en'} className="rounded-[5px] border border-gold bg-sand p-4 text-charcoal">{hostsEntryText(locale).joinIntent}</p>
    )}
    <LogEvent event={EVENTS.signupStarted} props={{ role: selected, locale }} />
    <SocialSignIn locale={locale} t={t} role={selected} />
    <JoinFields
      locale={locale}
      selected={selected}
      invite={await inviteRequired()}
      phoneCountry={await phoneCountryHint()}
      initialError={typeof params.error === 'string' ? params.error : null}
      hostOption={hostsOpen && !hostIntent ? {
        href: `/${locale}/hosts${concierge ? '#concierge' : '#investment'}`,
        title: HOSTS_ENTRY_LINKS.join.title[locale],
        body: HOSTS_ENTRY_LINKS.join.body[locale],
      } : null}
      t={{
        auth: {
          welcomeRole: t.auth.welcomeRole,
          fullName: t.auth.fullName,
          phone: t.auth.phone,
          email: t.auth.email,
          password: t.auth.password,
          createAccount: t.auth.createAccount,
          error: t.auth.error,
          nameReserved: t.auth.nameReserved,
          inviteCode: t.auth.inviteCode,
          inviteError: t.auth.inviteError,
          inviteHint: t.auth.inviteHint,
        },
        join: { traveler: t.join.traveler, guide: t.join.guide, provider: t.join.provider },
        phone: t.phone,
      }}
    />
    </div>
  );
}
