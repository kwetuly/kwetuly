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
import { reviewGuide, reviewJob } from './actions';

type PendingJob = {
  id: string;
  company_name: string;
  role_needed: string;
  title: string;
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
    .select('id, company_name, role_needed, title, location, pay, how_to_apply, description')
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
              <p className="text-base font-semibold">{j.title} · {jobRoleName(j.role_needed, locale)}</p>
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
      </Suspense>
    </div>
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
