import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Briefcase, Compass, Plane } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { inviteRequired } from '@/lib/invite';
import { InviteCodeField } from '@/components/invite-code-field';
import { getCurrentUser } from '@/lib/auth';
import { completeOnboarding } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.welcomeTitle, robots: { index: false } };
}

const roles = [
  { id: 'traveler', Icon: Plane },
  { id: 'guide', Icon: Compass },
  { id: 'provider', Icon: Briefcase },
] as const;

// Shown once to people who signed up with Google, Facebook or Apple:
// they pick their account type and add a phone number.
export default async function WelcomePage({ searchParams }: PageProps<'/[lang]/welcome'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight">{t.auth.welcomeTitle}</h1>
      <p className="mt-2 text-muted">{t.auth.welcomeBody}</p>
      <Suspense fallback={<div className="card mt-8 h-96 animate-pulse" />}>
        <WelcomeForm searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function WelcomeForm({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect(`/${locale}/login`);
  if (user.onboarded) redirect(`/${locale}/dashboard`);
  const selected = roles.some((r) => r.id === params.role) ? (params.role as string) : 'traveler';

  return (
    <form action={completeOnboarding} className="card mt-8 space-y-5">
      {params.error && params.error !== 'invite' && <p className="rounded-[5px] bg-red-50 p-4 text-red-800">{params.error === 'phone' ? t.auth.phoneError : t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      {(await inviteRequired()) && <InviteCodeField t={t} invalid={params.error === 'invite'} />}
      <fieldset>
        <legend className="label">{t.auth.welcomeRole}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {roles.map(({ id, Icon }) => (
            <label key={id} className="cursor-pointer">
              <input type="radio" name="role" value={id} defaultChecked={selected === id} className="peer sr-only" />
              <span className="flex h-full flex-col gap-2 rounded-[5px] border-2 border-line p-4 transition peer-checked:border-leaf peer-checked:bg-sand peer-focus-visible:ring-4 peer-focus-visible:ring-mint">
                <Icon className="size-6 text-leaf-dark" aria-hidden />
                <span className="font-bold">{t.join[id].title}</span>
                <span className="text-xs text-muted">{t.join[id].body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="full_name">{t.auth.fullName}</label>
        <input className="field" id="full_name" name="full_name" required autoComplete="name" defaultValue={user.fullName ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="phone">{t.auth.phone}</label>
        <input className="field" id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+255 712 345 678" defaultValue={user.phone ?? ''} aria-describedby="phone-hint" />
        <p id="phone-hint" className="mt-1 text-xs text-muted">{t.auth.phoneHint}</p>
      </div>
      <button className="btn w-full">{t.auth.finish}</button>
    </form>
  );
}
