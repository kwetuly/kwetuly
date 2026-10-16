import { GUIDE_EXPERTISE } from '@rafrika/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { languageName, specialtyName } from '@/components/guide-card';
import { jobRoleName } from '@/lib/labels';
import { reviewGroupTrip, confirmPhone, reviewGuide, reviewJob, setPaidOut, setReviewHidden } from './actions';
import { PendingPackages } from './pending-packages';
import { BusinessesAdmin } from './businesses-admin';

type PendingJob = {
  id: string;
  company_name: string;
  role_needed: string;
  title: string;
  kind: 'crew' | 'handover';
  location: string;
  pay: string | null;
  how_to_apply: string;
  description: string | null;
};

async function PendingJobs({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('id, company_name, role_needed, title, location, pay, how_to_apply, description, kind')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .returns<PendingJob[]>();
  const jobs = data ?? [];

  return (
    <section id="jobs" className="mt-12">
      <h2 className="text-2xl font-bold">Jobs ({jobs.length})</h2>
      {jobs.length === 0 && <p className="mt-3 text-muted">—</p>}
      <div className="mt-4 space-y-4">
        {jobs.map((j) => (
          <div key={j.id} className="card grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1 text-sm">
              <p className="text-base font-semibold">{j.title} · {j.kind === 'handover' ? 'Client handover' : jobRoleName(j.role_needed, locale)}</p>
              <p>{j.company_name} · {j.location} · {j.pay ?? '—'}</p>
              <p className="text-muted">{j.description}</p>
              <p>{j.how_to_apply}</p>
            </div>
            <form action={reviewJob} className="flex items-start gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="job_id" value={j.id} />
              <button name="decision" value="approve" className="btn px-4 py-2 text-sm">{t.admin.approve}</button>
              <button name="decision" value="reject" className="btn-outline px-4 py-2 text-sm">{t.admin.reject}</button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

type PendingGuide = {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  base_region: string;
  specialties: string[];
  languages: string[];
  expertise: string[];
  female_guide: boolean;
  association: string | null;
  created_at: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  identity_checked_at: string | null;
  licence_checked_at: string | null;
  first_aid_checked_at: string | null;
  first_aid_valid_until: string | null;
  guide_private: {
    phone: string | null;
    whatsapp_number: string | null;
    registration_number: string | null;
    kinapa_tanapa_id: string | null;
    id_document_path: string | null;
    license_document_path: string | null;
    first_aid_document_path: string | null;
  } | null;
};

const DOCUMENTS = [
  { path: 'id_document_path', check: 'identity_checked_at', field: 'identity', label: 'ID document' },
  { path: 'license_document_path', check: 'licence_checked_at', field: 'licence', label: 'Guide licence' },
  { path: 'first_aid_document_path', check: 'first_aid_checked_at', field: 'first_aid', label: 'First-aid certificate' },
] as const;

// An uploaded document nobody has checked yet (e.g. an approved guide uploaded a new one).
function hasUncheckedDocument(g: PendingGuide) {
  return DOCUMENTS.some((doc) => g.guide_private?.[doc.path] && !g[doc.check]);
}

export default async function AdminPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold">{t.admin.title}</h1>
        <Link href={`/${locale}/admin/media`} className="btn-outline ml-auto px-4 py-2 text-sm">Shared media</Link>
        <Link href={`/${locale}/admin/messages`} className="btn-outline px-4 py-2 text-sm">Message safety</Link>
        <Link href={`/${locale}/admin/commissions`} className="btn-outline px-4 py-2 text-sm">Commissions</Link>
        <Link href={`/${locale}/admin/news`} className="btn-outline px-4 py-2 text-sm">News</Link>
        <Link href={`/${locale}/admin/listings`} className="btn-outline px-4 py-2 text-sm">Business listings</Link>
        <Link href={`/${locale}/admin/shop`} className="btn-outline px-4 py-2 text-sm">Merchandise</Link>
        <Link href={`/${locale}/admin/places`} className="btn-outline px-4 py-2 text-sm">Places</Link>
        <Link href={`/${locale}/admin/trips`} className="btn-dark px-4 py-2 text-sm">Tours &amp; operators</Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <PendingList t={t} locale={locale} />
        <PendingPackages t={t} locale={locale} />
        <BusinessesAdmin t={t} locale={locale} />
        <PendingJobs t={t} locale={locale} />
        <PendingGroupTrips t={t} locale={locale} />
        <Payments t={t} locale={locale} />
        <LatestRequests t={t} locale={locale} />
        <Inbox locale={locale} />
        <RecentReviews locale={locale} />
      </Suspense>
    </div>
  );
}

// Group trips wait here until approved. Check the organiser, dates, price and what is included.
async function PendingGroupTrips({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('group_trips')
    .select('id, organizer_id, organizer_kind, already_going, title, description, company_name, region, start_date, end_date, price_per_person_usd, min_people, max_people, includes, guides(display_name, slug), group_trip_private(contact)')
    .eq('status', 'pending')
    .eq('cancelled', false)
    .order('created_at', { ascending: true })
    .returns<{ id: string; organizer_id: string; organizer_kind: string; already_going: number; group_trip_private: { contact: string } | null; title: string; description: string; company_name: string | null; region: string; start_date: string; end_date: string; price_per_person_usd: number; min_people: number; max_people: number; includes: string | null; guides: { display_name: string; slug: string } | null }[]>();
  const trips = data ?? [];
  // Travellers' groups need a confirmed phone before approval: call the number, then confirm it here.
  const ids = trips.filter((g) => g.organizer_kind === 'traveller').map((g) => g.organizer_id);
  const { data: people } = ids.length
    ? await supabase.from('profiles').select('id, full_name, phone, phone_verified_at').in('id', ids)
    : { data: [] as { id: string; full_name: string | null; phone: string | null; phone_verified_at: string | null }[] };
  const person = new Map((people ?? []).map((p) => [p.id, p]));

  return (
    <section id="groups" className="mt-12">
      <h2 className="text-2xl font-bold">Group trips ({trips.length})</h2>
      {trips.length === 0 && <p className="mt-3 text-muted">—</p>}
      <div className="mt-4 space-y-4">
        {trips.map((g) => (
          <div key={g.id} className="card grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1 text-sm">
              <Link href={`/${locale}/group-trips/${g.id}`} className="text-base font-semibold underline">{g.title}</Link>
              <p>
                {g.guides ? `Guide: ${g.guides.display_name}` : g.organizer_kind === 'traveller' ? `Traveller: ${person.get(g.organizer_id)?.full_name ?? '—'}` : `Company: ${g.company_name}`} · {g.region} · {g.start_date} → {g.end_date}
              </p>
              {g.already_going > 0 && <p>Completing a group: {g.already_going} already going</p>}
              {g.group_trip_private && <p>Contact given: {g.group_trip_private.contact}</p>}
              {g.organizer_kind === 'traveller' && (
                <p className={person.get(g.organizer_id)?.phone_verified_at ? 'font-semibold text-forest' : 'font-semibold text-red-800'}>
                  Phone {person.get(g.organizer_id)?.phone ?? '—'}:{' '}
                  {person.get(g.organizer_id)?.phone_verified_at ? 'confirmed' : 'not confirmed yet. Call this number, then press "Phone confirmed".'}
                </p>
              )}
              <p>${g.price_per_person_usd} per person · {g.min_people}–{g.max_people} people</p>
              <p className="whitespace-pre-line text-muted">{g.description}</p>
              {g.includes && <p className="text-muted">Includes: {g.includes}</p>}
            </div>
            <form action={reviewGroupTrip} className="flex items-start gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="group_trip_id" value={g.id} />
              <button name="decision" value="approve" className="btn px-4 py-2 text-sm">{t.admin.approve}</button>
              <button name="decision" value="reject" className="btn-outline px-4 py-2 text-sm">{t.admin.reject}</button>
            </form>
            {g.organizer_kind === 'traveller' && !person.get(g.organizer_id)?.phone_verified_at && (
              <form action={confirmPhone} className="sm:col-span-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="user_id" value={g.organizer_id} />
                <button className="btn-outline px-4 py-2 text-sm">Phone confirmed</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' });

// Trip enquiries (not addressed to a single guide) and sign-ups from partner and coming-soon pages.
async function Inbox({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const [leads, signups] = await Promise.all([
    supabase
      .from('leads')
      .select('id, traveler_name, traveler_contact, message, created_at, trips(title_en), providers(business_name, is_sample)')
      .is('guide_id', null)
      .order('created_at', { ascending: false })
      .limit(30)
      .returns<{ id: string; traveler_name: string; traveler_contact: string; message: string | null; created_at: string; trips: { title_en: string } | null; providers: { business_name: string; is_sample: boolean } | null }[]>(),
    supabase
      .from('interest_signups')
      .select('id, section, item, kind, name, contact, business_name, message, locale, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<{ id: string; section: string; item: string; kind: string; name: string; contact: string; business_name: string | null; message: string | null; locale: string; created_at: string }[]>(),
  ]);

  return (
    <section id="inbox" className="mt-12 grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-2xl font-bold">Trip enquiries ({leads.data?.length ?? 0})</h2>
        <ul className="mt-4 space-y-3">
          {(leads.data ?? []).map((l) => (
            <li key={l.id} className="card p-4 text-sm">
              <p className="font-semibold">{l.trips?.title_en ?? (l.providers ? `To ${l.providers.business_name}${l.providers.is_sample ? ' (sample listing)' : ''}` : 'General enquiry')}</p>
              <p>{l.traveler_name} · {l.traveler_contact}</p>
              {l.message && <p className="mt-1 whitespace-pre-line text-muted">{l.message}</p>}
              <p className="mt-1 text-xs text-muted">{when(l.created_at)}</p>
            </li>
          ))}
          {!leads.data?.length && <li className="text-muted">—</li>}
        </ul>
      </div>
      <div>
        <h2 className="text-2xl font-bold">Sign-ups & partner applications ({signups.data?.length ?? 0})</h2>
        <ul className="mt-4 space-y-3">
          {(signups.data ?? []).map((s) => (
            <li key={s.id} className={`card p-4 text-sm ${s.section === 'partners' ? 'border-leaf' : ''}`}>
              <p className="font-semibold">
                {s.section === 'partners' ? 'Travel agent application' : `${s.kind === 'business' ? 'Business listing' : 'Traveller interest'}: ${s.section} / ${s.item}`}
              </p>
              <p>{s.business_name ? `${s.business_name} · ` : ''}{s.name} · {s.contact} · {s.locale.toUpperCase()}</p>
              {s.message && <p className="mt-1 whitespace-pre-line text-muted">{s.message}</p>}
              <p className="mt-1 text-xs text-muted">{when(s.created_at)}</p>
            </li>
          ))}
          {!signups.data?.length && <li className="text-muted">—</li>}
        </ul>
      </div>
    </section>
  );
}

async function RecentReviews({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('guide_reviews')
    .select('id, author_name, rating, body, hidden, created_at, guides(display_name, slug)')
    .order('created_at', { ascending: false })
    .limit(30)
    .returns<{ id: string; author_name: string; rating: number; body: string; hidden: boolean; created_at: string; guides: { display_name: string; slug: string } | null }[]>();

  return (
    <section id="reviews" className="mt-12">
      <h2 className="text-2xl font-bold">Latest reviews</h2>
      <ul className="mt-4 space-y-3">
        {(data ?? []).map((r) => (
          <li key={r.id} className={`card grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto] ${r.hidden ? 'opacity-60' : ''}`}>
            <div>
              <p className="font-semibold">
                {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.guides?.display_name} · by {r.author_name}
                {r.hidden && ' · HIDDEN'}
              </p>
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
              <p className="mt-1 text-xs text-muted">{when(r.created_at)}</p>
            </div>
            <form action={setReviewHidden}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="review_id" value={r.id} />
              <input type="hidden" name="hidden" value={r.hidden ? 'false' : 'true'} />
              <button className="btn-outline px-4 py-2 text-sm">{r.hidden ? 'Show' : 'Hide'}</button>
            </form>
          </li>
        ))}
        {!data?.length && <li className="text-muted">—</li>}
      </ul>
    </section>
  );
}

async function PendingList({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  const { data } = await supabase
    .from('guides')
    .select(
      'id, slug, display_name, headline, base_region, specialties, languages, expertise, female_guide, association, created_at, verification_status, identity_checked_at, licence_checked_at, first_aid_checked_at, first_aid_valid_until, guide_private(phone, whatsapp_number, registration_number, kinapa_tanapa_id, id_document_path, license_document_path, first_aid_document_path)',
    )
    .in('verification_status', ['pending', 'approved'])
    .order('created_at', { ascending: true })
    .returns<PendingGuide[]>();
  // New applications, plus approved guides who uploaded a document that still needs a check.
  const guides = (data ?? []).filter((g) => g.verification_status === 'pending' || hasUncheckedDocument(g));

  // Short-lived links to the private documents, keyed "guideId:path".
  const docLinks = new Map<string, string>();
  await Promise.all(
    guides.flatMap((g) =>
      DOCUMENTS.map(async (doc) => {
        const path = g.guide_private?.[doc.path];
        if (!path) return;
        const { data: signed } = await supabase.storage.from('verification').createSignedUrl(path, 600);
        if (signed) docLinks.set(`${g.id}:${doc.path}`, signed.signedUrl);
      }),
    ),
  );

  if (guides.length === 0) return <p className="mt-6 text-muted">{t.admin.none}</p>;

  return (
    <div className="mt-6 space-y-4">
      <h2 className="font-semibold text-muted">
        {t.admin.pending} ({guides.length})
      </h2>
      {guides.map((g) => {
        const p = g.guide_private;
        return (
          <div key={g.id} className="card grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1 text-sm">
              <p className="text-base font-semibold">{g.display_name}</p>
              {g.headline && <p className="text-muted">{g.headline}</p>}
              <p>{g.base_region} · {g.specialties.map((s) => specialtyName(s, locale)).join(', ')}</p>
              <p>{g.languages.map(languageName).join(', ')}</p>
              {(g.expertise.length > 0 || g.female_guide) && (
                <p className="font-semibold text-amber-700">
                  {/* Special skills are self-declared: ask for proof before approving. */}
                  Check proof: {[...(g.female_guide ? ['Female guide'] : []), ...GUIDE_EXPERTISE.filter((e) => g.expertise.includes(e.id)).map((e) => e.label.en)].join(', ')}
                </p>
              )}
              <p>Registration: <strong>{p?.registration_number ?? '—'}</strong> · KINAPA/TANAPA: {p?.kinapa_tanapa_id ?? '—'}</p>
              <p>Phone: {p?.phone ?? '—'} · WhatsApp: {p?.whatsapp_number ?? '—'} · {g.association ?? ''}</p>
              {g.verification_status === 'approved' && <p className="font-semibold text-leaf-dark">Approved guide: new document to check</p>}
            </div>
            {/* Tick only what you actually looked at: each tick shows publicly as "… checked". */}
            <form action={reviewGuide} className="space-y-2 text-sm sm:w-72">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="guide_id" value={g.id} />
              {DOCUMENTS.map((doc) => {
                const link = docLinks.get(`${g.id}:${doc.path}`);
                return (
                  <label key={doc.field} className="flex items-center gap-2">
                    <input type="checkbox" name={doc.field} defaultChecked={!!g[doc.check]} disabled={!link} className="size-4 accent-leaf" />
                    {link ? (
                      <a href={link} target="_blank" rel="noopener" className="font-semibold text-leaf-dark underline">
                        {doc.label} checked
                      </a>
                    ) : (
                      <span className="text-muted">{doc.label}: not uploaded</span>
                    )}
                  </label>
                );
              })}
              <label className="block">
                <span className="text-xs text-muted">First aid valid until</span>
                <input type="date" name="first_aid_valid_until" defaultValue={g.first_aid_valid_until ?? ''} className="field py-1.5" />
              </label>
              <div className="flex gap-2 pt-1">
                {g.verification_status === 'pending' ? (
                  <>
                    <button name="decision" value="approve" className="btn px-4 py-2 text-sm">{t.admin.approve}</button>
                    <button name="decision" value="reject" className="btn-outline px-4 py-2 text-sm">{t.admin.reject}</button>
                  </>
                ) : (
                  <button name="decision" value="checks" className="btn px-4 py-2 text-sm">Save checks</button>
                )}
              </div>
            </form>
          </div>
        );
      })}
    </div>
  );
}

type PaymentRow = {
  id: string;
  user_id: string;
  payee_user_id: string | null;
  description: string;
  amount_tzs: number;
  amount_usd: number;
  status: string;
  provider_reference: string | null;
  provider_channel: string | null;
  payout_done: boolean;
  created_at: string;
};

// Deposits paid through Selcom. Rafrika pays them out to the guide or company, then ticks them here.
async function Payments({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('id, user_id, payee_user_id, description, amount_tzs, amount_usd, status, provider_reference, provider_channel, payout_done, created_at')
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<PaymentRow[]>();
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.user_id, r.payee_user_id]).filter(Boolean) as string[])];
  const { data: people } = ids.length
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', ids).returns<{ id: string; full_name: string | null; phone: string | null }[]>()
    : { data: [] };
  const who = (id: string | null) => {
    const person = people?.find((p) => p.id === id);
    return person ? [person.full_name, person.phone].filter(Boolean).join(' · ') : '—';
  };
  const a = t.admin;

  return (
    <section id="payments" className="mt-12 scroll-mt-24">
      <h2 className="text-2xl font-bold">{a.paymentsTitle} ({rows.length})</h2>
      {rows.length === 0 && <p className="mt-3 text-muted">{a.noPayments}</p>}
      <ul className="mt-4 space-y-3">
        {rows.map((p) => (
          <li key={p.id} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="text-sm">
              <p className="font-bold">
                {p.description} · TZS {p.amount_tzs.toLocaleString('en')} (${p.amount_usd})
                <span className={`ml-2 rounded-[5px] px-2 py-0.5 text-xs font-semibold ${p.status === 'paid' ? 'bg-mint text-forest' : 'bg-red-50 text-red-800'}`}>{p.status}</span>
              </p>
              <p className="text-muted">
                {new Date(p.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })} · {p.provider_channel ?? ''} {p.provider_reference ?? ''}
              </p>
              <p>From: {who(p.user_id)}</p>
              <p className="font-semibold">{a.payee}: {who(p.payee_user_id)}</p>
            </div>
            {p.status === 'paid' && (
              <form action={setPaidOut}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="payment_id" value={p.id} />
                <input type="hidden" name="done" value={p.payout_done ? 'false' : 'true'} />
                <button className={p.payout_done ? 'btn-outline px-4 py-2 text-sm' : 'btn px-4 py-2 text-sm'}>
                  {p.payout_done ? `✓ ${a.paidOut}` : a.markPaidOut}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function LatestRequests({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('trip_requests')
    .select('id, title, traveler_name, status, offers_count, created_at')
    .order('created_at', { ascending: false })
    .limit(15)
    .returns<{ id: string; title: string; traveler_name: string; status: string; offers_count: number; created_at: string }[]>();
  const rows = data ?? [];

  return (
    <section id="requests" className="mt-12 scroll-mt-24">
      <h2 className="text-2xl font-bold">{t.admin.requestsTitle} ({rows.length})</h2>
      {rows.length === 0 && <p className="mt-3 text-muted">—</p>}
      <ul className="mt-4 divide-y divide-line rounded-[5px] border border-line bg-white">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/${locale}/requests/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-surface">
              <span className="font-semibold">{r.title} · {r.traveler_name}</span>
              <span className="text-muted">{r.status} · {r.offers_count} offers · {new Date(r.created_at).toLocaleDateString('en-GB')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
