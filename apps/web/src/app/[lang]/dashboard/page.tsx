import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CALL_TOPICS, GROUP_SIZES, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, JOB_ROLES, REGIONS, documentStatus, profileCompletion, type DocumentStatus } from '@rafrika/shared';
import { Circle, CircleCheck, ShieldCheck } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser, type CurrentUser } from '@/lib/auth';
import { topicName, type CallStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { GUIDE_COLUMNS, type Guide } from '@/lib/guides';
import { saveGuideProfile } from './actions';
import { DirectUpload } from '@/components/direct-upload';
import { today } from '@/lib/today';

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

// Each account type gets its own dashboard and never sees the others' tools.
async function DashboardForRole({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: SearchParams }) {
  const user = await requireUser(locale);
  const params = await searchParams;
  if (user.role === 'guide' || user.guide || params.as === 'guide') {
    return <GuideEditor t={t} locale={locale} user={user} status={params} />;
  }
  if (user.role === 'provider') return <BusinessDashboard t={t} locale={locale} user={user} />;
  return <TravelerDashboard t={t} locale={locale} user={user} />;
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

  const statusText =
    guide?.verification_status === 'approved'
      ? d.statusApproved
      : guide?.verification_status === 'rejected'
        ? d.statusRejected
        : d.statusPending;

  const uploadLabels = { uploading: t.chats.uploading, uploaded: t.chats.uploaded, error: t.chats.uploadError };
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
      <ProfileStrength guide={guide} details={details} t={t} />
      {status.saved && <p className="mt-4 rounded-[5px] bg-mint p-4 font-semibold text-forest">{d.saved}</p>}
      {status.error && <p className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">{t.auth.error}</p>}

      <form action={saveGuideProfile} className="mt-6 space-y-8">
        <input type="hidden" name="locale" value={locale} />

        <fieldset className="card space-y-4">
          <legend className="px-1 text-lg font-semibold">{d.publicSection}</legend>
          <Field label={d.displayName}>
            <input className="field" name="display_name" required maxLength={80} defaultValue={guide?.display_name ?? user.fullName ?? ''} />
          </Field>
          <Field label={`${d.slug} (rafrika.com/${locale}/guides/…)`}>
            <input className="field" name="slug" maxLength={60} pattern="[a-z0-9-]+" defaultValue={guide?.slug ?? ''} placeholder="your-name" />
          </Field>
          <Field label={d.photo}>
            <DirectUpload name="photo_path" bucket="avatars" userId={user.id} prefix="avatar" accept="image/jpeg,image/png,image/webp" labels={uploadLabels} />
          </Field>
          <Field label={d.headline}>
            <input className="field" name="headline" maxLength={140} defaultValue={guide?.headline ?? ''} placeholder={d.headlineHint} />
          </Field>
          <Field label={d.bio}>
            <textarea className="field min-h-36" name="bio" maxLength={4000} defaultValue={guide?.bio ?? ''} />
          </Field>
          <Field label={d.baseRegion}>
            <select className="field" name="base_region" required defaultValue={guide?.base_region ?? ''}>
              <option value="" disabled>—</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Checkboxes name="regions" label={d.regions} options={REGIONS.map((r) => ({ value: r, label: r }))} checked={guide?.regions ?? []} />
          <Checkboxes name="specialties" label={d.specialties} options={GUIDE_SPECIALTIES.map((s) => ({ value: s.id, label: s[locale] }))} checked={guide?.specialties ?? []} />
          <Checkboxes name="expertise" label={d.expertise} options={GUIDE_EXPERTISE.map((e) => ({ value: e.id, label: e.label[locale] }))} checked={guide?.expertise ?? []} />
          <p className="-mt-2 text-xs text-muted">{d.expertiseHint}</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="female_guide" defaultChecked={guide?.female_guide ?? false} className="size-4 accent-forest" />
            {d.femaleGuide}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="open_to_partners" defaultChecked={guide?.open_to_partners ?? false} className="size-4 accent-forest" />
            {d.openToPartners}
          </label>
          <Checkboxes name="languages" label={d.languages} options={GUIDE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} checked={guide?.languages ?? ['sw', 'en']} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={d.maxGroup}>
              <select className="field" name="max_group_size" defaultValue={String(guide?.max_group_size ?? 8)}>
                {GROUP_SIZES.map((g) => <option key={g.max} value={g.max}>{g[locale]}</option>)}
              </select>
            </Field>
            <Field label={d.years}>
              <input className="field" name="years_experience" type="number" min={0} max={70} defaultValue={guide?.years_experience ?? ''} />
            </Field>
            <Field label={d.summits}>
              <input className="field" name="summits" type="number" min={0} defaultValue={guide?.summits ?? ''} />
            </Field>
          </div>
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Facebook"><input className="field" name="facebook_url" type="url" defaultValue={guide?.facebook_url ?? ''} placeholder="https://" /></Field>
            <Field label="Instagram"><input className="field" name="instagram_url" type="url" defaultValue={guide?.instagram_url ?? ''} placeholder="https://" /></Field>
            <Field label="TikTok"><input className="field" name="tiktok_url" type="url" defaultValue={guide?.tiktok_url ?? ''} placeholder="https://" /></Field>
          </div>
          <p className="text-sm text-muted">{d.followUs}</p>
          <Field label={d.visibility}>
            <select className="field" name="visibility" defaultValue={guide?.visibility ?? 'public'}>
              <option value="public">{d.visibilityPublic}</option>
              <option value="link_only">{d.visibilityLink}</option>
            </select>
          </Field>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-lg font-semibold">{d.callsSection}</legend>
          <p className="text-sm text-muted">{d.callsHint}</p>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" name="call_enabled" defaultChecked={guide?.call_enabled ?? false} className="size-5 accent-leaf" />
            {d.callEnabled}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.callPrice}>
              <input className="field" name="call_price_usd" type="number" min={0} step="1" defaultValue={guide?.call_price_usd ?? ''} placeholder="49" />
            </Field>
            <Field label={d.callMinutes}>
              <select className="field" name="call_minutes" defaultValue={String(guide?.call_minutes ?? 45)}>
                {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Checkboxes name="call_topics" label={d.callTopics} options={CALL_TOPICS.map((c) => ({ value: c.id, label: c[locale] }))} checked={guide?.call_topics ?? []} />
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-lg font-semibold">{d.privateSection}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.phone}><input className="field" name="phone" type="tel" defaultValue={details?.phone ?? user.phone ?? ''} /></Field>
            <Field label={d.whatsapp}><input className="field" name="whatsapp_number" type="tel" defaultValue={details?.whatsapp_number ?? user.phone ?? ''} /></Field>
            <Field label={d.registration}><input className="field" name="registration_number" defaultValue={details?.registration_number ?? ''} /></Field>
            <Field label={d.kinapa}><input className="field" name="kinapa_tanapa_id" defaultValue={details?.kinapa_tanapa_id ?? ''} /></Field>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-lg font-semibold">{t.checks.documentsTitle}</legend>
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
        </fieldset>

        <button className="btn w-full sm:w-auto">{d.save}</button>
      </form>
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

async function TravelerDashboard({ t, locale, user }: { t: Dictionary; locale: Locale; user: CurrentUser }) {
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
      <h1 className="text-3xl font-bold">{t.traveler.title}</h1>
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
                    {c.meeting_link && (
                      <>
                        {' · '}
                        <a href={c.meeting_link} className="font-semibold text-leaf-dark underline" target="_blank" rel="noopener">
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
          <Link href={`/${locale}/group-trips`} className="btn px-4 py-2 text-sm">{t.groups.joinTitle}</Link>
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
      <h1 className="text-3xl font-bold">{t.jobs.postTitle}</h1>
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
      <div className="mt-3 h-2 overflow-hidden rounded-[4px] bg-surface" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={c.strength}>
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
