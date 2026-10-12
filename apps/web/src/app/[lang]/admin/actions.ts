'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function reviewGuide(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;

  // Re-check the role here; the database policies enforce it again.
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const guideId = String(formData.get('guide_id') ?? '');
  const decision = formData.get('decision') === 'approve' ? 'approved' : 'rejected';

  const supabase = await createClient();
  await supabase
    .from('guides')
    .update({
      verification_status: decision,
      verified_at: decision === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', guideId);

  revalidateTag('guides', 'max');
  redirect(`/${locale}/admin`);
}

export async function reviewJob(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  await supabase
    .from('jobs')
    .update({ status: formData.get('decision') === 'approve' ? 'approved' : 'rejected' })
    .eq('id', String(formData.get('job_id') ?? ''));
  redirect(`/${locale}/admin#jobs`);
}
