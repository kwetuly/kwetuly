import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Briefcase } from 'lucide-react';
import { JOB_ROLES, REGIONS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { postJob } from './actions';
import { PhotoHero } from '@/components/photo-hero';

export const metadata: Metadata = {
  title: 'Hire guides & crew',
  description: 'Post a job for verified Tanzanian guides, cooks, porters and drivers.',
};

export default async function PostJobPage({ searchParams }: PageProps<'/[lang]/jobs/post'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo={'kiliHikers'}>
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-14">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sunset to-gold shadow-lg">
            <Briefcase className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-4xl font-extrabold">{t.jobs.postTitle}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/80">{t.jobs.postSubtitle}</p>
        </div>
      </PhotoHero>
      <div className="mx-auto -mt-16 max-w-4xl px-4 pb-16">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <JobForm searchParams={searchParams} t={t} locale={locale} />
        </Suspense>
      </div>
    </>
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
      {params.error && <p className="rounded-2xl bg-red-50 p-3 text-red-800 sm:col-span-2">{t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="label">{j.company}</span>
        <input name="company_name" className="field" required maxLength={120} />
      </label>
      <label className="block">
        <span className="label">{j.role}</span>
        <select name="role_needed" className="field" required>
          {JOB_ROLES.map((r) => <option key={r.id} value={r.id}>{r[locale]}</option>)}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">{j.title}</span>
        <input name="title" className="field" required maxLength={140} />
      </label>
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
        <span className="label">{j.pay}</span>
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
      <button className="btn sm:col-span-2">{j.submit}</button>
    </form>
  );
}
