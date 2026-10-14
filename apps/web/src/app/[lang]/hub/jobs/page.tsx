import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArrowRightLeft, Briefcase, CalendarDays, Languages, MapPin, Users } from 'lucide-react';
import { hubLabel } from '@/lib/menu';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireHubAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { jobRoleName } from '@/lib/labels';
import { languageName, specialtyName } from '@/components/guide-card';

export const metadata: Metadata = { title: 'Jobs', robots: { index: false } };

type Job = {
  id: string;
  company_name: string;
  role_needed: string;
  title: string;
  description: string | null;
  location: string;
  start_date: string | null;
  end_date: string | null;
  pay: string | null;
  how_to_apply: string;
  kind: 'crew' | 'handover';
  group_size: number | null;
  languages: string[];
  specialty: string | null;
};

export default async function HubJobsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white" />}>
      <Jobs t={t} locale={locale} />
    </Suspense>
  );
}

async function Jobs({ t, locale }: { t: Dictionary; locale: Locale }) {
  await requireHubAccess(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('id, company_name, role_needed, title, description, location, start_date, end_date, pay, how_to_apply, kind, group_size, languages, specialty')
    .eq('status', 'approved')
    // Client handovers first: they are whole trips with travellers waiting.
    .order('kind', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60)
    .returns<Job[]>();
  const jobs = data ?? [];

  return (
    <section>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold">
        <Briefcase className="size-7 text-leaf" aria-hidden /> {hubLabel('jobs', locale)}
      </h1>
      {jobs.length === 0 && <p className="mt-6 text-muted">{t.hub.noJobs}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {jobs.map((j) => (
          <div key={j.id} className={`card ${j.kind === 'handover' ? 'border-leaf' : ''}`}>
            {j.kind === 'handover' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf px-3 py-1 text-xs font-bold text-white"><ArrowRightLeft className="size-3.5" aria-hidden /> {t.jobs.handoverBadge}</span>
            ) : (
              <span className="badge">{jobRoleName(j.role_needed, locale)}</span>
            )}
            <h2 className="mt-2 text-lg font-bold">{j.title}</h2>
            <p className="text-sm font-semibold text-muted">{j.company_name}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden /> {j.location}</span>
              {j.specialty && <span>{specialtyName(j.specialty, locale)}</span>}
              {j.group_size && (
                <span className="flex items-center gap-1"><Users className="size-4" aria-hidden /> {j.group_size} {t.jobs.travellers}</span>
              )}
              {j.languages.length > 0 && (
                <span className="flex items-center gap-1"><Languages className="size-4" aria-hidden /> {j.languages.map(languageName).join(', ')}</span>
              )}
              {j.start_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-4" aria-hidden /> {j.start_date}{j.end_date ? ` → ${j.end_date}` : ''}
                </span>
              )}
            </div>
            {j.description && <p className="mt-3 whitespace-pre-line text-sm">{j.description}</p>}
            {j.pay && <p className="mt-3 text-sm"><strong>{t.hub.pay}:</strong> {j.pay}</p>}
            <p className="mt-3 rounded-2xl bg-sand p-3 text-sm"><strong>{t.hub.apply}:</strong> {j.how_to_apply}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
