import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { redirect } from 'next/navigation';
import { businessApproval, getCurrentUser, welcomePath } from '@/lib/auth';
import { PhotoHero } from '@/components/photo-hero';
import { createGroupTrip } from '../actions';
import { SubmitButton } from '@/components/submit-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.groups.newTitle, robots: { index: false } };
}

export default async function NewGroupTripPage({ searchParams }: PageProps<'/[lang]/group-trips/new'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo="giraffesBalloon">
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-14">
          <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white">
            <Plus className="size-7" aria-hidden />
          </span>
          <Suspense fallback={<Heading title={t.groups.newTitle} body={t.groups.newBody} />}>
            <HeroHeading searchParams={searchParams} t={t} />
          </Suspense>
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

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1 className="mt-5 text-4xl font-extrabold">{title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-white/80">{body}</p>
    </>
  );
}

/** "?complete=1" switches the heading, so it reads searchParams inside a Suspense boundary. */
async function HeroHeading({ searchParams, t }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary }) {
  const complete = (await searchParams).complete === '1';
  return complete
    ? <Heading title={t.extras.completeTitle} body={t.extras.completeBody} />
    : <Heading title={t.groups.newTitle} body={t.groups.newBody} />;
}

async function Form({ searchParams, t, locale }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary; locale: Locale }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const g = t.groups;
  const asGuide = user?.guide?.status === 'approved';
  const business = await businessApproval(user);
  const asBusiness = business === 'approved' || user?.role === 'admin';
  const asTraveller = !!user && !asGuide && !asBusiness;
  const complete = params.complete === '1';

  if (!user) {
    return (
      <div className="card space-y-4">
        <p className="text-lg">{t.extras.whoCan}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/group-trips/new${complete ? '?complete=1' : ''}`)}`} className="btn-outline">{t.nav.signIn}</Link>
          <Link href={`/${locale}/join`} className="btn">{t.nav.signUp}</Link>
        </div>
      </div>
    );
  }
  // Unfinished accounts (no invite code yet) go to the welcome step first, then come back here.
  if (!user.onboarded) redirect(welcomePath(locale, `/${locale}/group-trips/new${complete ? '?complete=1' : ''}`));
  if (!asGuide && business === 'waiting') {
    return (
      <div className="card space-y-4">
        <p className="text-lg">{t.business.waitApproval}</p>
        <Link href={`/${locale}/dashboard`} className="btn-outline w-fit">{t.nav.dashboard}</Link>
      </div>
    );
  }
  if (asTraveller && !user.phone) {
    return (
      <div className="card space-y-4">
        <p className="text-lg">{t.extras.phoneNeeded}</p>
        <Link href={`/${locale}/dashboard?back=${encodeURIComponent(`/${locale}/group-trips/new${complete ? '?complete=1' : ''}`)}#details`} className="btn w-fit">{t.extras.addPhone}</Link>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={createGroupTrip} className="card grid gap-4 sm:grid-cols-2">
      {params.error && <p className="rounded-[5px] bg-red-50 p-3 text-red-800 sm:col-span-2">{t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="complete" value={complete ? '1' : ''} />
      {asTraveller && <p className="rounded-[5px] bg-sand p-3 text-sm sm:col-span-2">{t.extras.travellerCheck}</p>}
      {asBusiness && !asGuide && (
        <label className="block sm:col-span-2">
          <span className="label">{g.companyName}</span>
          <input name="company_name" className="field" required maxLength={120} />
        </label>
      )}
      <label className="block sm:col-span-2">
        <span className="label">{g.tripTitle}</span>
        <input name="title" className="field" required minLength={5} maxLength={140} />
      </label>
      <label className="block">
        <span className="label">{g.tripType}</span>
        <select name="specialty" className="field" required>
          {GUIDE_SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s[locale]}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">{g.region}</span>
        <select name="region" className="field" required>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">{g.description}</span>
        <textarea name="description" className="field min-h-36" required minLength={20} maxLength={4000} />
      </label>
      <label className="block">
        <span className="label">{g.startDate}</span>
        <input name="start_date" type="date" min={today} className="field" required />
      </label>
      <label className="block">
        <span className="label">{g.endDate}</span>
        <input name="end_date" type="date" min={today} className="field" required />
      </label>
      <label className="block">
        <span className="label">{g.price}</span>
        <input name="price" type="number" min={0} className="field" required />
      </label>
      {/* Deposits are paid out to guides and businesses only; travellers' groups share costs directly. */}
      {!asTraveller && (
        <label className="block">
          <span className="label">{t.offers.deposit}</span>
          <input name="deposit" type="number" min={0} max={100} defaultValue={30} className="field" />
          <span className="mt-1 block text-xs text-muted">{t.offers.depositHint}</span>
        </label>
      )}
      <label className="block">
        <span className="label">{g.meetingPoint}</span>
        <input name="meeting_point" className="field" maxLength={200} />
      </label>
      <label className="block">
        <span className="label">{g.minPeopleField}</span>
        <input name="min_people" type="number" min={1} max={100} defaultValue={2} className="field" required />
      </label>
      {complete && (
        <label className="block">
          <span className="label">{t.extras.alreadyGoing}</span>
          <input name="already_going" type="number" min={1} max={99} defaultValue={2} className="field" required />
        </label>
      )}
      <label className="block">
        <span className="label">{g.maxPeople}</span>
        <input name="max_people" type="number" min={2} max={100} defaultValue={8} className="field" required />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="label">{t.guides.languages}</legend>
        <div className="flex flex-wrap gap-2">
          {GUIDE_LANGUAGES.map((l) => (
            <label key={l.code} className="cursor-pointer">
              <input type="checkbox" name="languages" value={l.code} defaultChecked={l.code === 'en'} className="peer sr-only" />
              <span className="inline-block rounded-[5px] border border-line px-3 py-1.5 text-sm peer-checked:border-forest peer-checked:bg-mint peer-checked:text-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest">
                {l.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block sm:col-span-2">
        <span className="label">{g.includesField}</span>
        <textarea name="includes" className="field min-h-20" maxLength={1000} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">{g.organiserContact}</span>
        <input name="contact" className="field" required minLength={3} maxLength={160} />
      </label>
      <SubmitButton className="btn sm:col-span-2">{g.submit}</SubmitButton>
    </form>
  );
}
