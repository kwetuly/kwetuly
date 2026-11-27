import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CALL_TOPICS, GROUP_SIZES, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, JOB_ROLES, REGIONS, documentStatus, USER_LINK_REL, guideStatusText, linkErrorMessage, profileCompletion, safeExternalUrl, verificationText, reserveText, guideStepProgress, guideProgressLine, guideProgressText, profileLinksText, uploadsText, type DocumentStatus } from '@kwetuly/shared';
import { StepProgress } from '@/components/step-progress';
import { BookingLinkEntry } from './booking-link/entry';
import { ProfileLinksEntry } from './links/entry';
import { PhotosEntry } from './photos/entry';
import { CalendarCheck, Circle, CircleCheck, FileCheck2, ShieldCheck } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { businessApproval, getCurrentUser, requireUser, type CurrentUser } from '@/lib/auth';
import { topicName, type CallStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { GUIDE_COLUMNS, type Guide } from '@/lib/guides';
import { saveGuideProfile, saveMyDetails } from './actions';
import { BusinessListing } from './business-listing';
import { GuideReferral } from './guide-referral';
import { GUIDE_STEPS, isGuideStep, type GuideStep } from '@/lib/guide-steps';
import { DirectUpload } from '@/components/direct-upload';
import { today } from '@/lib/today';
import { SubmitButton } from '@/components/submit-button';
import { NameInput } from '@/components/name-input';
import { PhoneField } from '@/components/phone-field';
import { KeepForm } from '@/components/keep-form';
import { SavedNote } from '@/components/saved-note';
import { MarkedInput } from '@/components/marked-input';
import { phoneCountryHint } from '@/lib/phone';

// The tab title matches the page: travellers see "My trips", guides their guide profile, business
// owners "My account". The page itself has no <title> of its own.
export async function generateMetadata(): Promise<Metadata> {
  const [t, user] = await Promise.all([getDictionary(), getCurrentUser()]);
  const title =
    user?.role === 'guide' || user?.guide ? t.dashboard.title : user?.role === 'provider' || user?.role === 'admin' || !user ? t.nav.dashboard : t.traveler.title;
  return { title, robots: { index: false } };
}

type PrivateDetails = {
  phone: string | null;
  whatsapp_number: string | null;
  registration_number: string | null;
  kinapa_tanapa_id: string | null;
  id_document_path: string | null;
  license_document_path: string | null;
  first_aid_document_path: string | null;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: PageProps<'/[lang]/dashboard'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <DashboardForRole t={t} locale={locale} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <VerificationLink locale={locale} />
      </Suspense>
      <Link href={`/${locale}/reservations`} className="mt-6 flex items-center gap-3 rounded-[5px] border border-line bg-white p-4 hover:border-leaf">
        <CalendarCheck className="size-5 shrink-0 text-leaf-dark" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{reserveText(locale).myTitle}</span>
          <span className="block text-sm text-muted">{reserveText(locale).myHint}</span>
        </span>
      </Link>
      <Link href={`/${locale}/security`} className="mt-6 flex items-center gap-3 rounded-[5px] border border-line bg-white p-4 text-sm font-semibold hover:border-leaf">
        <ShieldCheck className="size-5 text-leaf-dark" aria-hidden /> {t.ux.securityLink}
      </Link>
    </div>
  );
}

// Guides, business owners and admins: the way to the Verification page. Travellers never see it.
async function VerificationLink({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  if (!user || !(user.role === 'guide' || user.role === 'provider' || user.role === 'admin' || user.guide || (await businessApproval(user)) !== 'none')) return null;
  const v = verificationText(locale);
  return (
    <Link href={`/${locale}/dashboard/verification`} className="mt-6 flex items-center gap-3 rounded-[5px] border border-line bg-white p-4 hover:border-leaf">
      <FileCheck2 className="size-5 shrink-0 text-leaf-dark" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{v.title}</span>
        <span className="block text-sm text-muted">{v.menuHint}</span>
      </span>
    </Link>
  );
}

// Guides see their guide tools, business accounts their listing. Anyone who owns an approved listing
// also gets the business tools, whatever account type they picked at sign-up (the database allows it).
// Admins keep their own view.
async function DashboardForRole({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: SearchParams }) {
  const user = await requireUser(locale);
  const params = await searchParams;
  const business = user.role === 'admin' ? 'none' : await businessApproval(user);
  const isBusiness = user.role === 'provider' || business === 'approved';
  const detail = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const businessTools = (embedded: boolean) => (
    <>
      <BusinessListing t={t} locale={locale} user={user} status={params} embedded={embedded} />
      {/* Under a guide's overview the guide already has this line (the same page covers both). */}
      {!embedded && <ProfileLinksEntry locale={locale} business />}
      <div className="mt-12">
        <BusinessDashboard t={t} locale={locale} user={user} />
      </div>
    </>
  );

  if (user.role === 'guide' || user.guide || params.as === 'guide') {
    return (
      <>
        <GuideEditor t={t} locale={locale} user={user} status={params} />
        {/* A guide who also owns an approved listing: business tools under the guide overview. */}
        {isBusiness && !isGuideStep(params.step) && <div className="mt-12 border-t border-line pt-10">{businessTools(true)}</div>}
      </>
    );
  }
  if (user.role === 'provider') return businessTools(false);
  if (isBusiness) {
    // A traveller who owns an approved listing keeps their traveller sections below the business tools.
    return (
      <>
        {businessTools(false)}
        <div className="mt-12 border-t border-line pt-10">
          <TravelerDashboard t={t} locale={locale} user={user} details={detail('details')} back={detail('back')} embedded />
        </div>
      </>
    );
  }
  return <TravelerDashboard t={t} locale={locale} user={user} details={detail('details')} back={detail('back')} />;
}

async function GuideEditor({
  t,
  locale,
  user,
  status,
}: {
  t: Dictionary;
  locale: Locale;
  user: CurrentUser;
  status: Awaited<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: guide } = await supabase.from('guides').select(GUIDE_COLUMNS).eq('owner_id', user.id).maybeSingle<Guide>();
  const { data: details } = guide
    ? await supabase
        .from('guide_private')
        .select('phone, whatsapp_number, registration_number, kinapa_tanapa_id, id_document_path, license_document_path, first_aid_document_path')
        .eq('guide_id', guide.id)
        .maybeSingle<PrivateDetails>()
    : { data: null };
  // Step 4 "your trips": packages sent for checking or approved (drafts and refused ones do not count).
  const { count: tripCount } = guide
    ? await supabase.from('guide_packages').select('id', { count: 'exact', head: true }).eq('guide_id', guide.id).in('status', ['pending', 'approved'])
    : { count: 0 };
  const d = t.dashboard;
  const g = guideProgressText(locale);
  const pl = profileLinksText(locale);
  const up = uploadsText(locale);
  const now = await today();
  const phoneCountry = await phoneCountryHint();
  // A new guide goes straight into the first step; others see the overview unless they open a step.
  const step: GuideStep | null = isGuideStep(status.step) ? status.step : guide ? null : 'basics';

  const statusText =
    guide?.verification_status === 'approved'
      ? d.statusApproved
      : guide?.verification_status === 'rejected'
        ? d.statusRejected
        : d.statusPending;

  const uploadLabels = { uploading: t.chats.uploading, uploaded: t.chats.uploaded, error: t.chats.uploadError };
  const stepHref = (s: GuideStep) => `/${locale}/dashboard?step=${s}`;
  const stepMessages: Record<string, string> = {
    name: t.auth.nameReserved,
    phone: `${guideStatusText(locale).phoneShort}: ${t.phone.invalidGeneric}`,
    whatsapp: `${guideStatusText(locale).whatsappShort}: ${t.phone.invalidGeneric}`,
    slug: guideStatusText(locale).slugTaken,
    // A link saved before the database checks can still refuse a save of this step ('links').
    links: linkErrorMessage('links', locale) ?? t.auth.error,
  };
  const progress = guideStepProgress({ guide, idDocument: !!details?.id_document_path, licenceDocument: !!details?.license_document_path, tripCount: tripCount ?? 0 });
  const progressLabels = { progressLabel: g.progressLabel, optional: g.optional, done: g.done, todo: g.todo, stepStatus: g.stepStatus };

  if (step) {
    const index = GUIDE_STEPS.indexOf(step);
    const next = GUIDE_STEPS[index + 1];
    return (
      <>
        <p className="text-sm font-semibold text-leaf-dark">{g.stepOf.replace('{n}', String(index + 1)).replace('{total}', String(GUIDE_STEPS.length))}</p>
        <h1 className="mt-1 text-3xl font-bold">
          {g.steps[index]}
          {progress.steps[index].optional && <span className="ml-2 align-middle text-sm font-semibold text-muted">({g.optional})</span>}
        </h1>
        {!guide && <p className="mt-2 text-muted">{g.stepsIntro}</p>}
        <StepProgress progress={progress} titles={g.steps} line={guideProgressLine(progress, locale)} labels={progressLabels} current={index} />
        {/* Refusals come back into the form, which keeps everything typed (KeepForm). */}
        {/* key: a message from one step never shows on the next. */}
        <KeepForm key={step} action={saveGuideProfile} messages={stepMessages} fallback={t.auth.error} className="card mt-6 space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="step" value={step} />

          {step === 'basics' && (
            <>
              <Field label={d.displayName}>
                <NameInput reservedMessage={t.auth.nameReserved} allowReserved={user.role === 'admin'} className="field" name="display_name" required maxLength={80} autoComplete="name" defaultValue={guide?.display_name ?? user.fullName ?? ''} />
              </Field>
              <Field label={d.baseRegion}>
                <select className="field" name="base_region" required defaultValue={guide?.base_region ?? ''}>
                  <option value="" disabled>—</option>
                  {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Checkboxes name="languages" label={d.languages} options={GUIDE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} checked={guide?.languages ?? ['sw', 'en']} />
              <Field label={`${d.photo} (${g.needed})`}>
                {/* Needed for step 1 to count as finished; saving without one still works, as before. */}
                {!guide?.photo_url && <span className="mb-2 block text-sm text-muted">{g.photoNeeded}</span>}
                {guide?.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guide.photo_url} alt={d.currentPhoto} className="mb-2 block size-20 rounded-[5px] object-cover" />
                )}
                <DirectUpload name="photo_path" bucket="avatars" userId={user.id} prefix="avatar" accept="image/jpeg,image/png,image/webp" labels={{ ...uploadLabels, uploaded: d.photoUploaded }} />
              </Field>
            </>
          )}

          {step === 'work' && (
            <>
              <Field label={d.headline}>
                <input className="field" name="headline" maxLength={140} defaultValue={guide?.headline ?? ''} placeholder={d.headlineHint} />
              </Field>
              <Checkboxes name="specialties" label={d.specialties} options={GUIDE_SPECIALTIES.map((s) => ({ value: s.id, label: s[locale] }))} checked={guide?.specialties ?? []} />
              <Checkboxes name="regions" label={d.regions} options={REGIONS.map((r) => ({ value: r, label: r }))} checked={guide?.regions ?? []} />
              <Checkboxes name="expertise" label={d.expertise} options={GUIDE_EXPERTISE.map((e) => ({ value: e.id, label: e.label[locale] }))} checked={guide?.expertise ?? []} />
              <p className="-mt-2 text-xs text-muted">{d.expertiseHint}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={d.maxGroup}>
                  <select className="field" name="max_group_size" defaultValue={String(guide?.max_group_size ?? 8)}>
                    {GROUP_SIZES.map((g) => <option key={g.max} value={g.max}>{g[locale]}</option>)}
                  </select>
                </Field>
                <Field label={d.years}>
                  <input className="field" name="years_experience" type="number" inputMode="numeric" min={0} max={70} defaultValue={guide?.years_experience ?? ''} />
                </Field>
                <Field label={d.summits}>
                  <input className="field" name="summits" type="number" inputMode="numeric" min={0} defaultValue={guide?.summits ?? ''} />
                </Field>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="female_guide" defaultChecked={guide?.female_guide ?? false} className="size-4 accent-forest" />
                {d.femaleGuide}
              </label>
            </>
          )}

          {step === 'documents' && (
            <>
              <p className="text-sm text-muted">{d.documentsWhy}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <PhoneField id="phone" label={d.phone} locale={locale} t={t.phone} defaultValue={details?.phone ?? user.phone ?? ''} defaultCountry={phoneCountry} errorCode="phone" maxLength={30} />
                <PhoneField id="whatsapp_number" name="whatsapp_number" countryName="whatsapp_country" label={d.whatsapp} locale={locale} t={t.phone} defaultValue={details?.whatsapp_number ?? user.phone ?? ''} defaultCountry={phoneCountry} errorCode="whatsapp" maxLength={30} />
                <Field label={d.registration}><input className="field" name="registration_number" defaultValue={details?.registration_number ?? ''} /></Field>
                <Field label={d.kinapa}><input className="field" name="kinapa_tanapa_id" defaultValue={details?.kinapa_tanapa_id ?? ''} /></Field>
              </div>
              <p className="text-sm text-muted">{t.checks.documentsNote} {t.checks.recheckNote}</p>
              <DocumentField label={d.idDocument} status={documentStatus(!!details?.id_document_path, guide?.identity_checked_at ?? null, null, now)} t={t}>
                <DirectUpload name="id_document_path" bucket="verification" userId={user.id} prefix="guide-id" accept="image/jpeg,image/png,image/webp,application/pdf" labels={uploadLabels} />
              </DocumentField>
              <DocumentField label={t.checks.licenceUpload} status={documentStatus(!!details?.license_document_path, guide?.licence_checked_at ?? null, null, now)} t={t}>
                <DirectUpload name="license_document_path" bucket="verification" userId={user.id} prefix="guide-licence" accept="image/jpeg,image/png,image/webp,application/pdf" labels={uploadLabels} />
              </DocumentField>
              <DocumentField
                label={t.checks.firstAidUpload}
                status={documentStatus(!!details?.first_aid_document_path, guide?.first_aid_checked_at ?? null, guide?.first_aid_valid_until ?? null, now)}
                t={t}
              >
                <DirectUpload name="first_aid_document_path" bucket="verification" userId={user.id} prefix="guide-first-aid" accept="image/jpeg,image/png,image/webp,application/pdf" labels={uploadLabels} />
              </DocumentField>
            </>
          )}

          {/* Nothing to save here: trips are packages, made on their own page. "Save and continue" moves on. */}
          {step === 'trips' && (
            <>
              <p className="text-sm text-muted">{g.tripsIntro}</p>
              <p className="font-semibold">{!tripCount ? g.tripsNone : tripCount === 1 ? g.tripsOne : g.tripsMany.replace('{n}', String(tripCount))}</p>
              <Link href={`/${locale}/dashboard/packages?next=trips${tripCount ? '' : '&new=1'}`} className="btn-outline">{tripCount ? g.tripsSee : g.tripsAdd}</Link>
            </>
          )}

          {step === 'story' && (
            <>
              {/* Photos (S4) and profile links (S5) have their own pages, which come back here (?next=story).
                  They leave this form, so the guide is asked to save first. */}
              <div className="space-y-2 rounded-[5px] bg-surface p-4 text-sm">
                <p className="font-semibold">{g.saveFirst}</p>
                <p>
                  <Link href={`/${locale}/dashboard/photos?next=story`} className="font-semibold text-forest underline">{up.title}</Link>
                  <span className="block text-muted">{up.menuHint}</span>
                </p>
                <p>
                  <Link href={`/${locale}/dashboard/links?next=story`} className="font-semibold text-forest underline">{pl.entry}</Link>
                  <span className="block text-muted">{pl.entryNote}</span>
                </p>
              </div>
              <Field label={d.bio}>
                <textarea className="field min-h-36" name="bio" maxLength={4000} defaultValue={guide?.bio ?? ''} />
              </Field>
              <Field label={`${d.certifications} (First Aid, WFR…)`}>
                <input className="field" name="certifications" maxLength={300} defaultValue={guide?.certifications.join(', ') ?? ''} aria-describedby="certifications-hint" />
                <span id="certifications-hint" className="mt-1 block text-xs text-muted">{d.certificationsHint}</span>
              </Field>
              <Field label={d.association}>
                <input className="field" name="association" maxLength={80} defaultValue={guide?.association ?? ''} placeholder="TTGA" />
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="has_vehicle" defaultChecked={guide?.has_vehicle ?? false} className="size-4 accent-forest" />
                {d.hasVehicle}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="open_to_partners" defaultChecked={guide?.open_to_partners ?? false} className="size-4 accent-forest" />
                {d.openToPartners}
              </label>
              <p className="text-sm text-muted">{d.followUs}</p>
              <Field label={`${d.slug} (kwetuly.com/${locale}/guides/…)`}>
                <MarkedInput id="slug" errorCode="slug" message={guideStatusText(locale).slugTaken} className="field" name="slug" maxLength={60} pattern="[a-z0-9\-]+" defaultValue={guide?.slug ?? ''} placeholder="your-name" />
              </Field>
              <Field label={d.visibility}>
                <select className="field" name="visibility" defaultValue={guide?.visibility ?? 'public'}>
                  <option value="public">{d.visibilityPublic}</option>
                  <option value="link_only">{d.visibilityLink}</option>
                </select>
              </Field>
            </>
          )}

          {step === 'calls' && (
            <>
              <p className="text-sm text-muted">{d.callsHint}</p>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" name="call_enabled" defaultChecked={guide?.call_enabled ?? false} className="size-5 accent-leaf" />
                {d.callEnabled}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={d.callPrice}>
                  <input className="field" name="call_price_usd" type="number" inputMode="numeric" min={0} step="1" defaultValue={guide?.call_price_usd ?? ''} placeholder="49" />
                </Field>
                <Field label={d.callMinutes}>
                  <select className="field" name="call_minutes" defaultValue={String(guide?.call_minutes ?? 45)}>
                    {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <Checkboxes name="call_topics" label={d.callTopics} options={CALL_TOPICS.map((c) => ({ value: c.id, label: c[locale] }))} checked={guide?.call_topics ?? []} />
            </>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SubmitButton className="btn">{next ? d.saveContinue : d.saveFinish}</SubmitButton>
            {guide && index > 0 && (
              <Link href={stepHref(GUIDE_STEPS[index - 1])} className="btn-outline">{d.back}</Link>
            )}
            {guide && (
              <Link href={next ? stepHref(next) : `/${locale}/dashboard`} className="ml-auto text-sm font-semibold text-forest underline">
                {d.skip}
              </Link>
            )}
          </div>
        </KeepForm>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">{d.title}</h1>
      {/* One status banner: saved (until the next edit), where the profile stands and its link.
          The Guide Hub button lives in the header, so it is not repeated here. */}
      {guide && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[5px] bg-mint p-4 text-forest">
          {status.saved && <SavedNote className="w-full font-semibold">{d.saved}</SavedNote>}
          <span>{guide.verification_status === 'approved' && guide.visibility === 'link_only' ? guideStatusText(locale).approvedLinkOnly : statusText}</span>
          {guide.verification_status === 'approved' && (
            <Link href={`/${locale}/guides/${guide.slug}`} className="font-semibold underline">
              {d.viewProfile}
            </Link>
          )}
        </div>
      )}
      {status.error && <p role="alert" className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">{linkErrorMessage(status.error, locale) ?? (status.error === 'name' ? t.auth.nameReserved : t.auth.error)}</p>}

      {/* The progress line and the sign-up steps, each with its own short form. */}
      <StepProgress progress={progress} titles={g.steps} line={guideProgressLine(progress, locale)} labels={progressLabels} />
      <ol className="card mt-6 divide-y divide-line">
        {GUIDE_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {progress.steps[i].done ? <CircleCheck className="size-5 shrink-0 text-leaf-dark" aria-hidden /> : <Circle className="size-5 shrink-0 text-muted" aria-hidden />}
            <span className="min-w-0">
              <span className="block font-semibold">
                {i + 1}. {g.steps[i]}
              </span>
              <span className="block text-xs text-muted">
                {progress.steps[i].done ? g.done : g.todo}
                {progress.steps[i].optional && ` · ${g.optional}`}
                {' · '}
                {g.stepHints[i]}
              </span>
            </span>
            <Link href={stepHref(s)} className={`ml-auto shrink-0 px-4 py-2 text-sm ${progress.steps[i].done ? 'btn-outline' : 'btn'}`} aria-label={`${d.edit}: ${g.steps[i]}`}>
              {d.edit}
            </Link>
          </li>
        ))}
      </ol>
      {/* Same order as the app's profile overview: packages, booking link, photos, links. */}
      {guide && (
        <Link href={`/${locale}/dashboard/packages`} className="card mt-6 flex items-center gap-3 hover:border-leaf">
          <span className="flex-1">
            <span className="block font-bold">{t.packages.manageTitle}</span>
            <span className="block text-sm text-muted">{t.packages.manageIntro}</span>
          </span>
          <span className="btn px-4 py-2 text-sm">{t.packages.add}</span>
        </Link>
      )}
      {guide && <BookingLinkEntry locale={locale} />}
      {guide && <PhotosEntry locale={locale} />}
      {guide && <ProfileLinksEntry locale={locale} />}
      {guide && <GuideReferral approved={guide.verification_status === 'approved'} t={t} locale={locale} />}
      <ProfileStrength guide={guide} details={details} t={t} />
    </>
  );
}

type MyCall = {
  id: string;
  topic: string;
  status: CallStatus;
  scheduled_at: string | null;
  meeting_link: string | null;
  guides: { display_name: string; slug: string } | null;
};

async function TravelerDashboard({
  t,
  locale,
  user,
  details,
  back,
  embedded = false,
}: {
  t: Dictionary;
  locale: Locale;
  user: CurrentUser;
  details: string;
  back: string;
  /** Shown under the business tools: no page title, a second-level heading. */
  embedded?: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('call_requests')
    .select('id, topic, status, scheduled_at, meeting_link, guides(display_name, slug)')
    .eq('traveler_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MyCall[]>();
  const calls = data ?? [];

  return (
    <>
      {embedded ? <h2 className="text-2xl font-bold">{t.traveler.title}</h2> : <h1 className="text-3xl font-bold">{t.traveler.title}</h1>}
      <MyDetails t={t} locale={locale} user={user} status={details} back={back} />
      <section className="card mt-6">
        <h2 className="text-lg font-bold">{t.traveler.calls}</h2>
        {calls.length === 0 ? (
          <div className="mt-3">
            <p className="text-muted">{t.traveler.noCalls}</p>
            <Link href={`/${locale}/calls`} className="btn mt-4">{t.traveler.findCall}</Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-semibold">{topicName(c.topic, locale)}</span>
                {c.guides && (
                  <Link href={`/${locale}/guides/${c.guides.slug}`} className="text-forest underline">
                    {c.guides.display_name}
                  </Link>
                )}
                <span className="badge ml-auto">{t.hub.status[c.status]}</span>
                {c.status === 'accepted' && c.scheduled_at && (
                  <span className="w-full text-sm text-muted">
                    {new Date(c.scheduled_at).toLocaleString(locale)}
                    {safeExternalUrl(c.meeting_link) && (
                      <>
                        {' · '}
                        <a href={safeExternalUrl(c.meeting_link)!} className="font-semibold text-leaf-dark underline" target="_blank" rel={USER_LINK_REL}>
                          {t.traveler.joinCall}
                        </a>
                      </>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t.groups.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/group-trips/mine`} className="btn-outline px-4 py-2 text-sm">{t.groups.mine}</Link>
          <Link href={`/${locale}/group-trips`} className="btn px-4 py-2 text-sm">{t.ux.findGroupTrip}</Link>
        </div>
      </section>
      <section className="card mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t.requests.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/requests`} className="btn-outline px-4 py-2 text-sm">{t.requests.mine}</Link>
          <Link href={`/${locale}/requests/new`} className="btn px-4 py-2 text-sm">{t.requests.post}</Link>
        </div>
      </section>
      <Link href={`/${locale}/dashboard?as=guide`} className="mt-6 inline-block text-sm font-semibold text-forest underline">
        {t.traveler.becomeGuide}
      </Link>
    </>
  );
}

// Name and phone. Travellers need a phone to start a group, so the group form can send them here and back.
async function MyDetails({ t, locale, user, status, back }: { t: Dictionary; locale: Locale; user: CurrentUser; status: string; back: string }) {
  const x = t.extras;
  return (
    <section id="details" className="card mt-6 scroll-mt-28">
      <h2 className="text-lg font-bold">{x.detailsTitle}</h2>
      {status === 'saved' && <SavedNote className="mt-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">{x.detailsSaved}</SavedNote>}
      {/* Refusals come back into the form, keeping the name, the number and the return page. */}
      <KeepForm action={saveMyDetails} messages={{ invalid: t.phone.invalidGeneric, name: t.auth.nameReserved }} fallback={t.auth.error} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <input type="hidden" name="locale" value={locale} />
        {back && <input type="hidden" name="back" value={back} />}
        <label className="block">
          <span className="label">{t.profile.name}</span>
          <NameInput reservedMessage={t.auth.nameReserved} allowReserved={user.role === 'admin'} name="full_name" className="field" maxLength={120} defaultValue={user.fullName ?? ''} autoComplete="name" />
        </label>
        <PhoneField id="details-phone" label={t.auth.phone} locale={locale} t={t.phone} required defaultValue={user.phone ?? ''} defaultCountry={await phoneCountryHint()} errorCode="invalid" />
        <SubmitButton className="btn px-5 py-2.5 sm:mt-[1.875rem]">{x.saveDetails}</SubmitButton>
      </KeepForm>
    </section>
  );
}

type MyJob = { id: string; title: string; role_needed: string; status: 'pending' | 'approved' | 'rejected'; created_at: string };

async function BusinessDashboard({ t, locale, user }: { t: Dictionary; locale: Locale; user: CurrentUser }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('id, title, role_needed, status, created_at')
    .eq('posted_by', user.id)
    .order('created_at', { ascending: false })
    .returns<MyJob[]>();
  const jobs = data ?? [];

  return (
    <>
      <h2 className="text-2xl font-bold">{t.jobs.postTitle}</h2>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/${locale}/jobs/post`} className="btn">{t.jobs.postNew}</Link>
        <Link href={`/${locale}/group-trips/new`} className="btn-dark">{t.groups.start}</Link>
        <Link href={`/${locale}/group-trips/mine`} className="btn-outline">{t.groups.mine}</Link>
        <Link href={`/${locale}/requests`} className="btn-outline">{t.offers.boardTitle}</Link>
      </div>
      <ul className="card mt-6 divide-y divide-line">
        {jobs.length === 0 && <li className="py-2 text-muted">—</li>}
        {jobs.map((j) => (
          <li key={j.id} className="flex items-center gap-3 py-3">
            <span className="font-semibold">{j.title}</span>
            <span className="text-sm text-muted">{JOB_ROLES.find((r) => r.id === j.role_needed)?.[locale]}</span>
            <span className="badge ml-auto">{t.jobs.status[j.status]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// Profile strength: how complete the profile is and what is still missing.
function ProfileStrength({ guide, details, t }: { guide: Guide | null; details: PrivateDetails | null; t: Dictionary }) {
  const c = t.checks;
  const { items, percent } = profileCompletion({ ...guide, ...details });
  const allDone = items.every((i) => i.done || i.optional);
  return (
    <section className="card mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{c.strength}</h2>
        <p className="font-bold text-leaf-dark">
          {percent}% {c.complete}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-[5px] bg-surface" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={c.strength}>
        <div className="h-full bg-leaf" style={{ width: `${percent}%` }} />
      </div>
      {allDone && <p className="mt-3 text-sm font-semibold text-leaf-dark">{c.allDone}</p>}
      {!allDone && <h3 className="mt-4 text-sm font-semibold text-muted">{c.missing}</h3>}
      <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className={`flex items-center gap-2 ${item.done ? 'text-muted' : 'font-semibold'}`}>
            {item.done ? <CircleCheck className="size-4 shrink-0 text-leaf-dark" aria-hidden /> : <Circle className="size-4 shrink-0 text-muted" aria-hidden />}
            <span>{c[item.id]}</span>
            {item.optional && <span className="text-xs font-normal text-muted">({c.optional})</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// One private document with where its review stands.
function DocumentField({ label, status, t, children }: { label: string; status: DocumentStatus; t: Dictionary; children: React.ReactNode }) {
  const c = t.checks;
  const badge: Record<DocumentStatus, { text: string; className: string }> = {
    checked: { text: c.statusChecked, className: 'bg-mint text-forest' },
    waiting: { text: c.statusWaiting, className: 'bg-sand text-charcoal' },
    missing: { text: c.statusMissing, className: 'bg-surface text-muted' },
    expired: { text: c.statusExpired, className: 'bg-red-50 text-red-800' },
  };
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className={`rounded-[5px] px-2 py-0.5 text-xs font-semibold ${badge[status].className}`}>{badge[status].text}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Checkboxes({
  name,
  label,
  options,
  checked,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  checked: string[];
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.value} defaultChecked={checked.includes(o.value)} className="peer sr-only" />
            <span className="inline-block rounded-[5px] border border-line px-3 py-1.5 text-sm peer-checked:border-forest peer-checked:bg-mint peer-checked:text-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
