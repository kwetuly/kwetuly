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
import { reviewGroupTrip, reviewGuide, reviewJob, setReviewHidden } from './actions';

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
  guide_private: {
    phone: string | null;
    whatsapp_number: string | null;
    registration_number: string | null;
    kinapa_tanapa_id: string | null;
    id_document_path: string | null;
  } | null;
};

export default async function AdminPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold">{t.admin.title}</h1>
        <Link href={`/${locale}/admin/messages`} className="btn-outline ml-auto px-4 py-2 text-sm">Message safety →</Link>
        <Link href={`/${locale}/admin/trips`} className="btn-dark px-4 py-2 text-sm">Trips catalogue →</Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-brand bg-surface" />}>
        <PendingList t={t} locale={locale} />
        <PendingJobs t={t} locale={locale} />
        <PendingGroupTrips t={t} locale={locale} />
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
    .select('id, title, description, company_name, region, start_date, end_date, price_per_person_usd, min_people, max_people, includes, guides(display_name, slug)')
    .eq('status', 'pending')
    .eq('cancelled', false)
    .order('created_at', { ascending: true })
    .returns<{ id: string; title: string; description: string; company_name: string | null; region: string; start_date: string; end_date: string; price_per_person_usd: number; min_people: number; max_people: number; includes: string | null; guides: { display_name: string; slug: string } | null }[]>();
  const trips = data ?? [];

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
                {g.guides ? `Guide: ${g.guides.display_name}` : `Company: ${g.company_name}`} · {g.region} · {g.start_date} → {g.end_date}
              </p>
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
      .select('id, traveler_name, traveler_contact, message, created_at, trips(title_en)')
      .is('guide_id', null)
      .order('created_at', { ascending: false })
      .limit(30)
      .returns<{ id: string; traveler_name: string; traveler_contact: string; message: string | null; created_at: string; trips: { title_en: string } | null }[]>(),
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
              <p className="font-semibold">{l.trips?.title_en ?? 'General enquiry'}</p>
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
            <li key={s.id} className={`card p-4 text-sm ${s.section === 'partners' ? 'border-sunset' : ''}`}>
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
      'id, slug, display_name, headline, base_region, specialties, languages, expertise, female_guide, association, created_at, guide_private(phone, whatsapp_number, registration_number, kinapa_tanapa_id, id_document_path)',
    )
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: true })
    .returns<PendingGuide[]>();
  const guides = data ?? [];

  // Short-lived links to the private ID documents.
  const docLinks = new Map<string, string>();
  await Promise.all(
    guides.map(async (g) => {
      const path = g.guide_private?.id_document_path;
      if (!path) return;
      const { data: signed } = await supabase.storage.from('verification').createSignedUrl(path, 600);
      if (signed) docLinks.set(g.id, signed.signedUrl);
    }),
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
                <p className="font-semibold text-sunset-dark">
                  {/* Special skills are self-declared: ask for proof before approving. */}
                  Check proof: {[...(g.female_guide ? ['Female guide'] : []), ...GUIDE_EXPERTISE.filter((e) => g.expertise.includes(e.id)).map((e) => e.label.en)].join(', ')}
                </p>
              )}
              <p>Registration: <strong>{p?.registration_number ?? '—'}</strong> · KINAPA/TANAPA: {p?.kinapa_tanapa_id ?? '—'}</p>
              <p>Phone: {p?.phone ?? '—'} · WhatsApp: {p?.whatsapp_number ?? '—'} · {g.association ?? ''}</p>
              {docLinks.get(g.id) && (
                <a href={docLinks.get(g.id)} target="_blank" rel="noopener" className="font-semibold text-forest underline">
                  {t.admin.document}
                </a>
              )}
            </div>
            <form action={reviewGuide} className="flex items-start gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="guide_id" value={g.id} />
              <button name="decision" value="approve" className="btn px-4 py-2 text-sm">{t.admin.approve}</button>
              <button name="decision" value="reject" className="btn-outline px-4 py-2 text-sm">{t.admin.reject}</button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
