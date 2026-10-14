import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Gavel } from 'lucide-react';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { PhotoHero } from '@/components/photo-hero';
import { createRequest } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.requests.newTitle, description: t.requests.subtitle };
}

export default async function NewRequestPage({ searchParams }: PageProps<'/[lang]/requests/new'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo="safariSunset">
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-14">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-leaf">
            <Gavel className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-4xl font-extrabold">{t.requests.newTitle}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/80">{t.requests.newBody}</p>
        </div>
      </PhotoHero>
      <div className="relative mx-auto -mt-16 max-w-4xl px-4 pb-16">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <Form searchParams={searchParams} t={t} locale={locale} />
        </Suspense>
      </div>
    </>
  );
}

const chip =
  'inline-block rounded-[5px] border border-line px-3 py-1.5 text-sm peer-checked:border-forest peer-checked:bg-mint peer-checked:text-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest';

async function Form({ searchParams, t, locale }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary; locale: Locale }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const r = t.requests;
  if (!user) {
    return (
      <div className="card space-y-4">
        <p className="text-lg">{t.app.signInPrompt}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/login?next=/${locale}/requests/new`} className="btn-outline">{t.nav.signIn}</Link>
          <Link href={`/${locale}/join`} className="btn">{t.nav.signUp}</Link>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const preset = typeof params.specialty === 'string' ? params.specialty : 'safari';
  return (
    <form action={createRequest} className="card grid gap-4 sm:grid-cols-2">
      {params.error && <p className="rounded-2xl bg-red-50 p-3 text-red-800 sm:col-span-2">{r.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <label className="block sm:col-span-2">
        <span className="label">{r.tripTitle}</span>
        <input name="title" className="field" required minLength={5} maxLength={140} placeholder={r.tripTitlePlaceholder} />
      </label>
      <label className="block">
        <span className="label">{r.tripType}</span>
        <select name="specialty" className="field" required defaultValue={preset}>
          {GUIDE_SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s[locale]}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">{r.adults}</span>
          <input name="adults" type="number" min={1} max={50} defaultValue={2} className="field" required />
        </label>
        <label className="block">
          <span className="label">{r.children}</span>
          <input name="children" type="number" min={0} max={50} defaultValue={0} className="field" />
        </label>
      </div>
      <label className="block sm:col-span-2">
        <span className="label">{r.details}</span>
        <textarea name="details" className="field min-h-36" required minLength={20} maxLength={4000} placeholder={r.detailsPlaceholder} />
      </label>
      <label className="block">
        <span className="label">{r.startDate}</span>
        <input name="start_date" type="date" min={today} className="field" />
      </label>
      <label className="block">
        <span className="label">{r.endDate}</span>
        <input name="end_date" type="date" min={today} className="field" />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="flexible" className="size-4 accent-forest" /> {r.flexible}
      </label>
      <label className="block">
        <span className="label">{r.budget}</span>
        <input name="budget" type="number" min={0} max={100000} className="field" />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="label">{r.regions}</legend>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((region) => (
            <label key={region} className="cursor-pointer">
              <input type="checkbox" name="regions" value={region} className="peer sr-only" />
              <span className={chip}>{region}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="label">{r.languages}</legend>
        <div className="flex flex-wrap gap-2">
          {GUIDE_LANGUAGES.map((l) => (
            <label key={l.code} className="cursor-pointer">
              <input type="checkbox" name="languages" value={l.code} defaultChecked={l.code === locale} className="peer sr-only" />
              <span className={chip}>{l.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="label">{r.expertise}</legend>
        <div className="flex flex-wrap gap-2">
          {GUIDE_EXPERTISE.map((e) => (
            <label key={e.id} className="cursor-pointer">
              <input type="checkbox" name="expertise" value={e.id} className="peer sr-only" />
              <span className={chip}>{e.label[locale]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="female_guide" className="size-4 accent-forest" /> {r.femaleGuide}
      </label>
      <button className="btn sm:col-span-2">{r.submit}</button>
    </form>
  );
}
