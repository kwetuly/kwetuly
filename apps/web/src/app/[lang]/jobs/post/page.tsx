import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRightLeft, Briefcase } from 'lucide-react';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, JOB_ROLES, REGIONS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { postJob } from './actions';
import { PhotoHero } from '@/components/photo-hero';

export const metadata: Metadata = {
  title: 'Hire guides & crew, or hand over clients',
  description: 'Post a job for verified Tanzanian guides, cooks, porters and drivers, or hand over trips when you are fully booked.',
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function PostJobPage({ searchParams }: PageProps<'/[lang]/jobs/post'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <Suspense fallback={<div className="pattern-kanga h-72" />}>
        <Hero searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
      <div className="relative mx-auto -mt-16 max-w-4xl px-4 pb-16">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <JobForm searchParams={searchParams} t={t} locale={locale} />
        </Suspense>
      </div>
    </>
  );
}

async function Hero({ searchParams, t, locale }: { searchParams: Search; t: Dictionary; locale: Locale }) {
  const handover = (await searchParams).kind === 'handover';
  const j = t.jobs;
  const tab = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-[5px] px-4 py-2 text-sm font-bold ${active ? 'bg-white text-charcoal' : 'bg-white/10 text-white hover:bg-white/20'}`;
  return (
    <PhotoHero photo={handover ? 'safariSunset' : 'kiliHikers'}>
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-14">
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/jobs/post`} className={tab(!handover)}>
            <Briefcase className="size-4" aria-hidden /> {j.crewTab}
          </Link>
          <Link href={`/${locale}/jobs/post?kind=handover`} className={tab(handover)}>
            <ArrowRightLeft className="size-4" aria-hidden /> {j.handoverTab}
          </Link>
        </div>
        <h1 className="mt-6 text-4xl font-extrabold">{handover ? j.handoverTitle : j.postTitle}</h1>
        <p className="mt-3 max-w-2xl text-lg text-white/80">{handover ? j.handoverSubtitle : j.postSubtitle}</p>
      </div>
    </PhotoHero>
  );
}

async function JobForm({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const j = t.jobs;
  const handover = params.kind === 'handover';

  if (params.sent) return <p className="card text-lg font-semibold text-forest">✓ {j.sent}</p>;
  if (!user) {
    return (
      <div className="card">
        <p>{j.signInFirst}</p>
        <div className="mt-4 flex gap-2">
          <Link href={`/${locale}/login`} className="btn-outline">{t.nav.signIn}</Link>
          <Link href={`/${locale}/join?role=provider`} className="btn">{t.nav.signUp}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={postJob} className="card grid gap-4 sm:grid-cols-2">
      {params.error && <p className="rounded-[5px] bg-red-50 p-3 text-red-800 sm:col-span-2">{t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={handover ? 'handover' : 'crew'} />
      <label className="block">
        <span className="label">{j.company}</span>
        <input name="company_name" className="field" required maxLength={120} />
      </label>
      {handover ? (
        <label className="block">
          <span className="label">{j.tripType}</span>
          <select name="specialty" className="field" required>
            {GUIDE_SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s[locale]}</option>)}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="label">{j.role}</span>
          <select name="role_needed" className="field" required>
            {JOB_ROLES.map((r) => <option key={r.id} value={r.id}>{r[locale]}</option>)}
          </select>
        </label>
      )}
      <label className="block sm:col-span-2">
        <span className="label">{handover ? j.tripTitle : j.title}</span>
        <input name="title" className="field" required maxLength={140} />
      </label>
      {handover && (
        <>
          <label className="block">
            <span className="label">{j.groupSize}</span>
            <input name="group_size" type="number" min={1} max={200} className="field" required />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="label">{j.languagesNeeded}</legend>
            <div className="flex flex-wrap gap-2">
              {GUIDE_LANGUAGES.map((l) => (
                <label key={l.code} className="cursor-pointer">
                  <input type="checkbox" name="languages" value={l.code} className="peer sr-only" />
                  <span className="inline-block rounded-[5px] border border-line px-3 py-1.5 text-sm peer-checked:border-forest peer-checked:bg-mint peer-checked:text-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest">
                    {l.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <label className="block sm:col-span-2">
        <span className="label">{j.description}</span>
        <textarea name="description" className="field min-h-28" maxLength={4000} />
      </label>
      <label className="block">
        <span className="label">{j.location}</span>
        <select name="location" className="field" required>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">{handover ? j.handoverPay : j.pay}</span>
        <input name="pay" className="field" maxLength={120} />
      </label>
      <label className="block">
        <span className="label">{j.start}</span>
        <input name="start_date" type="date" className="field" />
      </label>
      <label className="block">
        <span className="label">{j.end}</span>
        <input name="end_date" type="date" className="field" />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">{j.howToApply}</span>
        <input name="how_to_apply" className="field" required maxLength={300} />
      </label>
      <button className="btn sm:col-span-2">{handover ? j.handoverSubmit : j.submit}</button>
    </form>
  );
}
