'use server';

import { revalidateTag, updateTag } from 'next/cache';
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
  const action = String(formData.get('decision') ?? '');

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('guides')
    .select('identity_checked_at, licence_checked_at, first_aid_checked_at')
    .eq('id', guideId)
    .maybeSingle<{ identity_checked_at: string | null; licence_checked_at: string | null; first_aid_checked_at: string | null }>();
  if (!current) redirect(`/${locale}/admin`);

  // Each ticked box is a document the admin looked at; keep the first check date, clear unticked ones.
  const now = new Date().toISOString();
  const tick = (name: string, previous: string | null) => (formData.get(name) === 'on' ? previous ?? now : null);
  const validUntil = String(formData.get('first_aid_valid_until') ?? '');
  const checks = {
    identity_checked_at: tick('identity', current.identity_checked_at),
    licence_checked_at: tick('licence', current.licence_checked_at),
    first_aid_checked_at: tick('first_aid', current.first_aid_checked_at),
    first_aid_valid_until: formData.get('first_aid') === 'on' && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
  };

  const decision = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
  await supabase
    .from('guides')
    .update({
      ...checks,
      ...(decision ? { verification_status: decision, verified_at: decision === 'approved' ? now : null } : {}),
    })
    .eq('id', guideId);

  revalidateTag('guides', 'max');
  redirect(`/${locale}/admin`);
}

// Hide or show a traveller review (e.g. abusive or off-topic). Ratings update automatically.
export async function setReviewHidden(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  await supabase
    .from('guide_reviews')
    .update({ hidden: formData.get('hidden') === 'true' })
    .eq('id', String(formData.get('review_id') ?? ''));
  revalidateTag('guides', 'max');
  redirect(`/${locale}/admin#reviews`);
}

// Feature (or un-feature) a traveller's shared photo, video or tip in the public gallery.
export async function setFeatured(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  await supabase
    .from('group_chat_messages')
    .update({ featured: formData.get('featured') === 'true' })
    .eq('id', String(formData.get('message_id') ?? ''))
    .eq('share_public', true);
  updateTag('moments');
  redirect(`/${locale}/admin/media`);
}

export async function reviewGroupTrip(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  await supabase
    .from('group_trips')
    .update({ status: formData.get('decision') === 'approve' ? 'approved' : 'rejected' })
    .eq('id', String(formData.get('group_trip_id') ?? ''));
  revalidateTag('groups', 'max');
  redirect(`/${locale}/admin#groups`);
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

// Record that a deposit has been paid out to the guide or company (Rafrika pays out by hand for now).
export async function setPaidOut(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  await supabase
    .from('payments')
    .update({ payout_done: formData.get('done') === 'true' })
    .eq('id', String(formData.get('payment_id') ?? ''));
  redirect(`/${locale}/admin#payments`);
}

// Approve a guide package, or send it back with a note the guide sees.
export async function reviewPackage(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const approve = formData.get('decision') === 'approve';
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const supabase = await createClient();
  await supabase
    .from('guide_packages')
    .update({ status: approve ? 'approved' : 'rejected', review_note: approve ? null : note || null })
    .eq('id', String(formData.get('package_id') ?? ''));
  revalidateTag('packages', 'max');
  redirect(`/${locale}/admin#packages`);
}
