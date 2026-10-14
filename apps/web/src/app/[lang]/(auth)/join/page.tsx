import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Briefcase, Compass, Plane } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { signUp } from '../actions';
import { SocialSignIn } from '@/components/social-sign-in';

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
  const selected = roles.some((r) => r.id === params.role) ? (params.role as string) : 'guide';

  if (params.sent) {
    return <p className="mt-8 rounded-3xl bg-mint p-6 text-lg font-semibold text-forest">{t.auth.checkEmail}</p>;
  }

  return (
    <div className="card mt-8 space-y-5">
    <SocialSignIn locale={locale} t={t} role={selected} />
    <form action={signUp} className="space-y-5">
      {params.error && <p className="rounded-2xl bg-red-50 p-4 text-red-800">{params.error === 'phone' ? t.auth.phoneError : t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <fieldset className="grid gap-3 sm:grid-cols-3">
        {roles.map(({ id, Icon }) => (
          <label key={id} className="cursor-pointer">
            <input type="radio" name="role" value={id} defaultChecked={selected === id} className="peer sr-only" />
            <span className="flex h-full flex-col gap-2 rounded-2xl border-2 border-line p-4 transition peer-checked:border-leaf peer-checked:bg-sand peer-focus-visible:ring-4 peer-focus-visible:ring-mint">
              <Icon className="size-6 text-leaf" aria-hidden />
              <span className="font-bold">{t.join[id].title}</span>
              <span className="text-xs text-muted">{t.join[id].body}</span>
            </span>
          </label>
        ))}
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
      <button className="btn w-full">{t.auth.createAccount}</button>
    </form>
    </div>
  );
}
