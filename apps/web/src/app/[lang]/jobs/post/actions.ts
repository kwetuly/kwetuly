'use server';

import { redirect } from 'next/navigation';
import { JOB_ROLES } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

export async function postJob(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const back = `/${locale}/jobs/post`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const date = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(field(key, 10)) ? field(key, 10) : null);
  const role = field('role_needed', 30);

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
  };
  if (!job.company_name || !job.title || !job.location || !job.how_to_apply || !JOB_ROLES.some((r) => r.id === role)) {
    redirect(`${back}?error=1`);
  }

  const { error } = await supabase.from('jobs').insert(job);
  redirect(`${back}?${error ? 'error' : 'sent'}=1`);
}
