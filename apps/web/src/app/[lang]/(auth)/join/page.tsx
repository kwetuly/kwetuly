import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Briefcase, Compass, Plane } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { inviteRequired } from '@/lib/invite';
import { InviteCodeField } from '@/components/invite-code-field';
import { signUp } from '../actions';
import { SocialSignIn } from '@/components/social-sign-in';
import { EVENTS } from '@rafrika/shared';
import { LogEvent } from '@/components/analytics';
import { SubmitButton } from '@/components/submit-button';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).join.title };
}

const roles = [
  { id: 'traveler', Icon: Plane },
  { id: 'guide', Icon: Compass },
  { id: 'provider', Icon: Briefcase },
] as const;

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
  const selected = roles.some((r) => r.id === params.role) ? (params.role as string) : 'traveler';

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
    <form action={signUp} className="space-y-5">
      {params.error && params.error !== 'invite' && <p className="rounded-[5px] bg-red-50 p-4 text-red-800">{params.error === 'phone' ? t.auth.phoneError : t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      {(await inviteRequired()) && <InviteCodeField t={t} invalid={params.error === 'invite'} />}
      <fieldset>
        <legend className="label">{t.auth.welcomeRole}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {roles.map(({ id, Icon }) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="role"
                value={id}
                defaultChecked={selected === id}
                className="peer sr-only"
                aria-labelledby={`role-${id}-title`}
                aria-describedby={`role-${id}-body`}
              />
              <span className="flex h-full flex-col gap-2 rounded-[5px] border-2 border-line p-4 transition peer-checked:border-leaf peer-checked:bg-sand peer-focus-visible:ring-4 peer-focus-visible:ring-forest">
                <Icon className="size-6 text-leaf-dark" aria-hidden />
                <span id={`role-${id}-title`} className="font-bold">{t.join[id].title}</span>
                <span id={`role-${id}-body`} className="text-xs text-muted">{t.join[id].body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="full_name">{t.auth.fullName}</label>
        <input className="field" id="full_name" name="full_name" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="phone">{t.auth.phone}</label>
        <input className="field" id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+255 712 345 678" aria-describedby="phone-hint" />
        <p id="phone-hint" className="mt-1 text-xs text-muted">{t.auth.phoneHint}</p>
      </div>
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input className="field" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input className="field" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <SubmitButton className="btn w-full">{t.auth.createAccount}</SubmitButton>
    </form>
    </div>
  );
}
