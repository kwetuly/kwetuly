'use server';

import { redirect } from 'next/navigation';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, JOB_ROLES } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

export async function postJob(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  // Handovers pass a whole trip with clients to verified guides; crew jobs hire people.
  const handover = formData.get('kind') === 'handover';
  const back = `/${locale}/jobs/post${handover ? '?kind=handover&' : '?'}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const date = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(field(key, 10)) ? field(key, 10) : null);
  const role = handover ? 'guide' : field('role_needed', 30);
  const specialty = field('specialty', 30);
  const groupSize = Number.parseInt(field('group_size', 4), 10);

  const job = {
    posted_by: user.id,
    company_name: field('company_name', 120),
    role_needed: role,
    title: field('title', 140),
    description: field('description', 4000) || null,
    location: field('location', 80),
    start_date: date('start_date'),
    end_date: date('end_date'),
    pay: field('pay', 120) || null,
    how_to_apply: field('how_to_apply', 300),
    kind: handover ? 'handover' : 'crew',
    group_size: handover && groupSize >= 1 && groupSize <= 200 ? groupSize : null,
    languages: handover
      ? formData.getAll('languages').map(String).filter((code) => GUIDE_LANGUAGES.some((l) => l.code === code))
      : [],
    specialty: handover && GUIDE_SPECIALTIES.some((s) => s.id === specialty) ? specialty : null,
  };
  if (!job.company_name || !job.title || !job.location || !job.how_to_apply || !JOB_ROLES.some((r) => r.id === role)) {
    redirect(`${back}error=1`);
  }

  const { error } = await supabase.from('jobs').insert(job);
  redirect(`${back}${error ? 'error' : 'sent'}=1`);
}
