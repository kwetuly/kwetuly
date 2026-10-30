import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CALL_TOPICS, GROUP_SIZES, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, JOB_ROLES, REGIONS, documentStatus, USER_LINK_REL, linkErrorMessage, linkTexts, profileCompletion, safeExternalUrl, type DocumentStatus } from '@kwetuly/shared';
import { Circle, CircleCheck, ShieldCheck } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { businessApproval, requireUser, type CurrentUser } from '@/lib/auth';
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
import { LinkInput } from '@/components/link-input';
import { phoneCountryHint } from '@/lib/phone';

export const metadata: Metadata = { title: 'My profile', robots: { index: false } };

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
      <Link href={`/${locale}/security`} className="mt-6 flex items-center gap-3 rounded-[5px] border border-line bg-white p-4 text-sm font-semibold hover:border-leaf">
        <ShieldCheck className="size-5 text-leaf-dark" aria-hidden /> {t.ux.securityLink}
      </Link>
    </div>
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
  const d = t.dashboard;
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
  const stepDone: Record<GuideStep, boolean> = {
    basics: !!guide,
    work: (guide?.specialties.length ?? 0) > 0 && !!guide?.headline,
    documents: !!details?.id_document_path && !!details?.license_document_path,
    story: !!guide?.bio,
    calls: !!guide?.call_enabled,
  };

  if (step) {
    const index = GUIDE_STEPS.indexOf(step);
    const next = GUIDE_STEPS[index + 1];
    return (
      <>
        <p className="text-sm font-semibold text-leaf-dark">{d.stepOf.replace('{n}', String(index + 1)).replace('{total}', String(GUIDE_STEPS.length))}</p>
        <h1 className="mt-1 text-3xl font-bold">{d.steps[index]}</h1>
        {!guide && <p className="mt-2 text-muted">{d.stepsIntro}</p>}
        <ol className="mt-4 flex gap-1.5" aria-hidden>
          {GUIDE_STEPS.map((s, i) => (
            <li key={s} className={`h-1.5 flex-1 rounded-[5px] ${i <= index ? 'bg-leaf' : 'bg-surface'}`} />
          ))}
        </ol>
        {status.error && <p className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">{linkErrorMessage(status.error, locale) ?? (status.error === 'name' ? t.auth.nameReserved : status.error === 'phone' || status.error === 'whatsapp' ? t.phone.invalidGeneric : t.auth.error)}</p>}

        <form action={saveGuideProfile} className="card mt-6 space-y-5">
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
              <Field label={d.photo}>
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
                <PhoneField id="phone" label={d.phone} locale={locale} t={t.phone} defaultValue={details?.phone ?? user.phone ?? ''} defaultCountry={phoneCountry} invalid={status.error === 'phone'} maxLength={30} />
                <PhoneField id="whatsapp_number" name="whatsapp_number" countryName="whatsapp_country" label={d.whatsapp} locale={locale} t={t.phone} defaultValue={details?.whatsapp_number ?? user.phone ?? ''} defaultCountry={phoneCountry} invalid={status.error === 'whatsapp'} maxLength={30} />
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

          {step === 'story' && (
            <>
              <Field label={d.bio}>
                <textarea className="field min-h-36" name="bio" maxLength={4000} defaultValue={guide?.bio ?? ''} />
              </Field>
              <Field label={`${d.certifications} (First Aid, WFR…)`}>
                <input className="field" name="certifications" maxLength={300} defaultValue={guide?.certifications.join(', ') ?? ''} />
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
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Facebook"><LinkInput id="facebook_url" name="facebook_url" kind="facebook" locale={locale} defaultValue={guide?.facebook_url} placeholder="facebook.com/…" /></Field>
                <Field label="Instagram"><LinkInput id="instagram_url" name="instagram_url" kind="instagram" locale={locale} defaultValue={guide?.instagram_url} placeholder="@…" /></Field>
                <Field label="TikTok"><LinkInput id="tiktok_url" name="tiktok_url" kind="tiktok" locale={locale} defaultValue={guide?.tiktok_url} placeholder="@…" /></Field>
              </div>
              <p className="text-sm text-muted">{linkTexts(locale).socialHint}</p>
              <p className="text-sm text-muted">{d.followUs}</p>
              <Field label={`${d.slug} (kwetuly.com/${locale}/guides/…)`}>
                <input className="field" name="slug" maxLength={60} pattern="[a-z0-9-]+" defaultValue={guide?.slug ?? ''} placeholder="your-name" />
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
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">{d.title}</h1>
      {guide && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[5px] bg-mint p-4 text-forest">
          <span>{statusText}</span>
          {guide.verification_status === 'approved' && (
            <>
              <Link href={`/${locale}/guides/${guide.slug}`} className="font-semibold underline">
                {d.viewProfile}
              </Link>
              <Link href={`/${locale}/hub`} className="btn ml-auto px-4 py-2 text-sm">
                {t.nav.hub}
              </Link>
            </>
          )}
        </div>
      )}
      {status.saved && <p className="mt-4 rounded-[5px] bg-mint p-4 font-semibold text-forest">{d.saved}</p>}
      {status.error && <p className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">{linkErrorMessage(status.error, locale) ?? (status.error === 'name' ? t.auth.nameReserved : t.auth.error)}</p>}

      {/* The sign-up steps, each with its own short form. */}
      <ol className="card mt-6 divide-y divide-line">
        {GUIDE_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {stepDone[s] ? <CircleCheck className="size-5 shrink-0 text-leaf-dark" aria-hidden /> : <Circle className="size-5 shrink-0 text-muted" aria-hidden />}
            <span className="font-semibold">
              {i + 1}. {d.steps[i]}
            </span>
            <span className="text-xs text-muted">{s === 'calls' ? d.optionalStep : stepDone[s] ? d.stepDone : d.stepTodo}</span>
            <Link href={stepHref(s)} className={`ml-auto px-4 py-2 text-sm ${stepDone[s] ? 'btn-outline' : 'btn'}`}>
              {d.edit}
            </Link>
          </li>
        ))}
      </ol>
      {guide && (
        <Link href={`/${locale}/dashboard/packages`} className="card mt-6 flex items-center gap-3 hover:border-leaf">
          <span className="flex-1">
            <span className="block font-bold">{t.packages.manageTitle}</span>
            <span className="block text-sm text-muted">{t.packages.manageIntro}</span>
          </span>
          <span className="btn px-4 py-2 text-sm">{t.packages.add}</span>
        </Link>
      )}
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
      {/* The page metadata says "My profile"; travellers' tab title matches their heading instead. */}
      {embedded ? (
        <h2 className="text-2xl font-bold">{t.traveler.title}</h2>
      ) : (
        <>
          <title>{`${t.traveler.title} · Kwetuly`}</title>
          <h1 className="text-3xl font-bold">{t.traveler.title}</h1>
        </>
      )}
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
      {status === 'saved' && <p className="mt-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">{x.detailsSaved}</p>}
      {status === 'invalid' && <p role="alert" className="mt-2 rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.phone.invalidGeneric}</p>}
      {status === 'name' && <p role="alert" className="mt-2 rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.nameReserved}</p>}
      <form action={saveMyDetails} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="locale" value={locale} />
        {back && <input type="hidden" name="back" value={back} />}
        <label className="block">
          <span className="label">{t.profile.name}</span>
          <NameInput reservedMessage={t.auth.nameReserved} allowReserved={user.role === 'admin'} name="full_name" className="field" maxLength={120} defaultValue={user.fullName ?? ''} autoComplete="name" />
        </label>
        <PhoneField id="details-phone" label={t.auth.phone} locale={locale} t={t.phone} required defaultValue={user.phone ?? ''} defaultCountry={await phoneCountryHint()} />
        <SubmitButton className="btn px-5 py-2.5">{x.saveDetails}</SubmitButton>
      </form>
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
