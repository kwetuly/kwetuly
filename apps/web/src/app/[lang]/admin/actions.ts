'use server';

import { revalidateTag, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function reviewGuide(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;

  // Re-check the role here; the database policies enforce it again.
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

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
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

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
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

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
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from('group_trips')
    .update({ status: formData.get('decision') === 'approve' ? 'approved' : 'rejected' })
    .eq('id', String(formData.get('group_trip_id') ?? ''));
  revalidateTag('groups', 'max');
  // The database refuses to approve a traveller's group before their phone is confirmed.
  redirect(`/${locale}/admin${error ? '?error=phone' : ''}#groups`);
}

// After calling a traveller organiser, mark their phone number as confirmed. Only the number the
// admin saw (and called) is confirmed: if the organiser changed it meanwhile, nothing is updated.
export async function confirmPhone(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const userId = String(formData.get('user_id') ?? '');
  const shown = String(formData.get('phone') ?? '').trim();
  if (!userId || !shown || shown.length > 32) redirect(`/${locale}/admin?error=phone_changed#groups`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ phone_verified_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('phone', shown)
    .select('id');
  if (error) redirect(`/${locale}/admin?error=phone_confirm#groups`);
  if (!data?.length) redirect(`/${locale}/admin?error=phone_changed#groups`);
  redirect(`/${locale}/admin#groups`);
}

export async function reviewJob(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const supabase = await createClient();
  await supabase
    .from('jobs')
    .update({ status: formData.get('decision') === 'approve' ? 'approved' : 'rejected' })
    .eq('id', String(formData.get('job_id') ?? ''));
  redirect(`/${locale}/admin#jobs`);
}

// Record that a deposit has been paid out to the guide or company (Kwetuly pays out by hand for now).
export async function setPaidOut(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

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
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

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

// Approve or reject a business listing (listing itself is free).
export async function reviewBusiness(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const approve = formData.get('decision') === 'approve';
  const supabase = await createClient();
  await supabase
    .from('providers')
    .update({ verification_status: approve ? 'approved' : 'rejected', verified_at: approve ? new Date().toISOString() : null })
    .eq('id', String(formData.get('provider_id') ?? ''));
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin#businesses`);
}

// Record a paid badge check: only the checks actually done, for one year from today.
// Do this only after the fee is received and the checks are done.
export async function grantBadge(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const allowed = ['licence', 'tourism_licence', 'identity', 'photos', 'visit'];
  const checks = formData.getAll('checks').map(String).filter((c) => allowed.includes(c));
  const now = new Date();
  const until = new Date(now);
  until.setUTCFullYear(until.getUTCFullYear() + 1);
  const providerId = String(formData.get('provider_id') ?? '');
  const supabase = await createClient();
  await supabase
    .from('providers')
    .update(
      checks.length > 0
        ? { badge_checks: checks, badge_checked_at: now.toISOString().slice(0, 10), badge_valid_until: until.toISOString().slice(0, 10), badge_requested_at: null }
        : { badge_requested_at: null },
    )
    .eq('id', providerId);
  // The note (payment reference, who checked) is private to admins.
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  if (note) await supabase.from('provider_private').upsert({ provider_id: providerId, badge_note: note });
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin#businesses`);
}

// The yearly badge fee in USD; empty means "ask Kwetuly".
export async function setBadgeFee(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const amount = Number.parseFloat(String(formData.get('amount_usd') ?? ''));
  const supabase = await createClient();
  await supabase
    .from('site_settings')
    .upsert({ key: 'badge_fee', value: { amount_usd: Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null } });
  revalidateTag('settings', 'max');
  redirect(`/${locale}/admin#businesses`);
}

// Record or change a business's commission agreement (from the signed paper agreement).
export async function saveAgreement(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const pct = (key: string) => {
    const n = Number.parseFloat(String(formData.get(key) ?? ''));
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : 0;
  };
  const signed = String(formData.get('signed_on') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.from('business_agreements').upsert({
    provider_id: String(formData.get('provider_id') ?? ''),
    rafrika_pct: pct('rafrika_pct'),
    guide_pct: pct('guide_pct'),
    signed_on: /^\d{4}-\d{2}-\d{2}$/.test(signed) ? signed : null,
    notes: String(formData.get('notes') ?? '').trim().slice(0, 2000) || null,
    active: formData.get('active') === 'on',
  });
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin/commissions${error ? '?error=1' : ''}`);
}

// Mark one business's sales for one month as invoiced or paid.
export async function setSalesStatus(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const month = String(formData.get('month') ?? '');
  const status = formData.get('status') === 'paid' ? 'paid' : 'invoiced';
  if (!/^\d{4}-\d{2}$/.test(month)) redirect(`/${locale}/admin/commissions`);
  const [y, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const supabase = await createClient();
  await supabase
    .from('referral_sales')
    .update({ status })
    .eq('provider_id', String(formData.get('provider_id') ?? ''))
    .gte('sale_date', `${month}-01`)
    .lt('sale_date', end);
  redirect(`/${locale}/admin/commissions?month=${month}`);
}
