'use server';

import { revalidateTag, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { safeLocalPath } from '@/lib/safe-next';
import { BATCH_MAX, decodePick, encodeSkip, loadOne, type Pick, type ReviewKind, type SkipCode } from '@/lib/admin-queue';

// Where an admin form goes back to: the page it came from (admin pages only), or the old long page.
function backTo(formData: FormData, locale: string, fallback: string, params: Record<string, string> = {}) {
  const asked = safeLocalPath(formData.get('back'), '');
  const base = asked.startsWith(`/${locale}/admin`) ? asked : `/${locale}/admin/all${fallback}`;
  const [beforeHash, hash] = base.split('#');
  const [path, query] = beforeHash.split('?');
  const search = new URLSearchParams(query ?? '');
  // A new result replaces the previous one.
  for (const key of ['error', 'ok', 'skip', 'done']) search.delete(key);
  for (const [key, value] of Object.entries(params)) search.set(key, value);
  const q = search.toString();
  return `${path}${q ? `?${q}` : ''}${hash ? `#${hash}` : ''}`;
}

// The updated_at the page showed. Approvals and rejections only apply to the version the admin saw.
function shownVersion(formData: FormData) {
  const value = String(formData.get('updated_at') ?? '');
  return value && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null;
}

export async function reviewGuide(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;

  // Re-check the role here; the database policies enforce it again.
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const guideId = String(formData.get('guide_id') ?? '');
  const action = String(formData.get('decision') ?? '');
  const shown = shownVersion(formData);
  if (!shown) redirect(backTo(formData, locale, '', { error: 'changed' }));

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('guides')
    .select('identity_checked_at, licence_checked_at, first_aid_checked_at')
    .eq('id', guideId)
    .maybeSingle<{ identity_checked_at: string | null; licence_checked_at: string | null; first_aid_checked_at: string | null }>();
  if (!current) redirect(backTo(formData, locale, '', { error: 'changed' }));

  // Each ticked box is a document the admin looked at; keep the first check date, clear unticked ones.
  // Only forms that show the tick boxes send them (with_checks=1): an Approve or Reject button on its
  // own never changes the checks. A box that could not be shown as tickable (file missing or could
  // not be opened) sends "keep", so an earlier check is never cleared by accident.
  const now = new Date().toISOString();
  const tick = (name: string, previous: string | null) => {
    const value = formData.get(name);
    return value === 'on' ? previous ?? now : value === 'keep' ? previous : null;
  };
  const validUntil = String(formData.get('first_aid_valid_until') ?? '');
  let checks: {
    identity_checked_at: string | null;
    licence_checked_at: string | null;
    first_aid_checked_at: string | null;
    first_aid_valid_until: string | null;
  } | null = null;
  if (formData.get('with_checks') === '1') {
    const firstAid = tick('first_aid', current.first_aid_checked_at);
    checks = {
      identity_checked_at: tick('identity', current.identity_checked_at),
      licence_checked_at: tick('licence', current.licence_checked_at),
      first_aid_checked_at: firstAid,
      first_aid_valid_until: firstAid && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
    };
  }

  const decision = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
  if (!decision && !checks) redirect(backTo(formData, locale, ''));

  // Ticks first (on the version the admin saw), so a form that ticks and approves in one go still
  // works: the decision below then applies to the version with the ticks saved.
  let version = shown;
  if (checks) {
    let save = supabase.from('guides').update(checks).eq('id', guideId).eq('updated_at', shown);
    if (decision) save = save.eq('verification_status', 'pending');
    const { data, error } = await save.select('updated_at').returns<{ updated_at: string }[]>();
    revalidateTag('guides', 'max');
    if (error) redirect(backTo(formData, locale, '', { error: 'save' }));
    if (!data?.length) redirect(backTo(formData, locale, '', { error: 'changed' }));
    if (!decision) redirect(backTo(formData, locale, '', { done: 'checks' }));
    version = data[0].updated_at;
  }
  if (!decision) redirect(backTo(formData, locale, ''));

  // Approval needs the ID and licence checks saved; the update itself requires them too.
  const identity = checks ? checks.identity_checked_at : current.identity_checked_at;
  const licence = checks ? checks.licence_checked_at : current.licence_checked_at;
  if (decision === 'approved' && (!identity || !licence)) redirect(backTo(formData, locale, '', { error: 'checks' }));

  // A decision only applies while the guide is still waiting (a double tap or an old tab does nothing).
  let update = supabase
    .from('guides')
    .update({ verification_status: decision, verified_at: decision === 'approved' ? now : null })
    .eq('id', guideId)
    .eq('updated_at', version)
    .eq('verification_status', 'pending');
  if (decision === 'approved') update = update.not('identity_checked_at', 'is', null).not('licence_checked_at', 'is', null);
  const { data, error } = await update.select('id');

  revalidateTag('guides', 'max');
  if (error) redirect(backTo(formData, locale, '', { error: 'save' }));
  if (!data?.length) {
    // Tell "checks missing" apart from "changed meanwhile".
    if (decision === 'approved') {
      const { data: fresh } = await supabase
        .from('guides')
        .select('identity_checked_at, licence_checked_at, verification_status')
        .eq('id', guideId)
        .maybeSingle<{ identity_checked_at: string | null; licence_checked_at: string | null; verification_status: string }>();
      if (fresh?.verification_status === 'pending' && (!fresh.identity_checked_at || !fresh.licence_checked_at)) {
        redirect(backTo(formData, locale, '', { error: 'checks' }));
      }
    }
    redirect(backTo(formData, locale, '', { error: 'changed' }));
  }
  redirect(backTo(formData, locale, '', { done: decision }));
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
  redirect(`/${locale}/admin/all#reviews`);
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

  const shown = shownVersion(formData);
  if (!shown) redirect(backTo(formData, locale, '#groups', { error: 'changed' }));

  const approve = formData.get('decision') === 'approve';
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('group_trips')
    .update({ status: approve ? 'approved' : 'rejected' })
    .eq('id', String(formData.get('group_trip_id') ?? ''))
    .eq('status', 'pending')
    .eq('updated_at', shown)
    .select('id');
  revalidateTag('groups', 'max');
  // The database refuses to approve a traveller's group before their phone is confirmed.
  if (error) redirect(backTo(formData, locale, '#groups', { error: 'phone' }));
  if (!data?.length) redirect(backTo(formData, locale, '#groups', { error: 'changed' }));
  redirect(backTo(formData, locale, '#groups', { done: approve ? 'approved' : 'rejected' }));
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
  if (!userId || !shown || shown.length > 32) redirect(backTo(formData, locale, '#groups', { error: 'phone_changed' }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ phone_verified_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('phone', shown)
    .select('id');
  if (error) redirect(backTo(formData, locale, '#groups', { error: 'phone_confirm' }));
  if (!data?.length) redirect(backTo(formData, locale, '#groups', { error: 'phone_changed' }));
  redirect(backTo(formData, locale, '#groups', { done: 'phone' }));
}

export async function reviewJob(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const shown = shownVersion(formData);
  if (!shown) redirect(backTo(formData, locale, '#jobs', { error: 'changed' }));

  const approve = formData.get('decision') === 'approve';
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .update({ status: approve ? 'approved' : 'rejected' })
    .eq('id', String(formData.get('job_id') ?? ''))
    .eq('status', 'pending')
    .eq('updated_at', shown)
    .select('id');
  if (error) redirect(backTo(formData, locale, '#jobs', { error: 'save' }));
  if (!data?.length) redirect(backTo(formData, locale, '#jobs', { error: 'changed' }));
  redirect(backTo(formData, locale, '#jobs', { done: approve ? 'approved' : 'rejected' }));
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
  redirect(`/${locale}/admin/all#payments`);
}

// Approve a guide package, or send it back with a note the guide sees.
export async function reviewPackage(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const shown = shownVersion(formData);
  if (!shown) redirect(backTo(formData, locale, '#packages', { error: 'changed' }));

  const approve = formData.get('decision') === 'approve';
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guide_packages')
    .update({ status: approve ? 'approved' : 'rejected', review_note: approve ? null : note || null })
    .eq('id', String(formData.get('package_id') ?? ''))
    .eq('status', 'pending')
    .eq('updated_at', shown)
    .select('id');
  revalidateTag('packages', 'max');
  if (error) redirect(backTo(formData, locale, '#packages', { error: 'save' }));
  if (!data?.length) redirect(backTo(formData, locale, '#packages', { error: 'changed' }));
  redirect(backTo(formData, locale, '#packages', { done: approve ? 'approved' : 'rejected' }));
}

// Approve or reject a business listing (listing itself is free).
export async function reviewBusiness(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const shown = shownVersion(formData);
  if (!shown) redirect(backTo(formData, locale, '#businesses', { error: 'changed' }));
  const approve = formData.get('decision') === 'approve';
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('providers')
    .update({ verification_status: approve ? 'approved' : 'rejected', verified_at: approve ? new Date().toISOString() : null })
    .eq('id', String(formData.get('provider_id') ?? ''))
    .eq('verification_status', 'pending')
    .eq('updated_at', shown)
    .select('id');
  revalidateTag('businesses', 'max');
  if (error) redirect(backTo(formData, locale, '#businesses', { error: 'save' }));
  if (!data?.length) redirect(backTo(formData, locale, '#businesses', { error: 'changed' }));
  redirect(backTo(formData, locale, '#businesses', { done: approve ? 'approved' : 'rejected' }));
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
  redirect(`/${locale}/admin/all#businesses`);
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
  redirect(`/${locale}/admin/all#businesses`);
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
    kwetuly_pct: pct('kwetuly_pct'),
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

// "Approve selected" / "Approve all ready on this page" (phase 1, no database change).
// Each item is approved on its own with the admin's own client, so row level security, the guard
// triggers and the usual "approved" notices all apply per item. An item is only approved if it is
// still pending, still shows the version the page showed (updated_at), is not a sample and still
// passes its ready rule (checked again here). Approve only: no batch reject, no document ticks.
export async function approveBatch(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const raw = formData.getAll('item').map(String);
  const picks = raw.map(decodePick);
  if (raw.length === 0 || raw.length > BATCH_MAX || picks.some((p) => p === null)) {
    redirect(backTo(formData, locale, '', { error: 'batch' }));
  }
  const unique = new Map<string, Pick>();
  for (const p of picks as Pick[]) unique.set(`${p.kind}:${p.id}`, p);

  const supabase = await createClient();
  // Read every item fresh first (in parallel), then approve one at a time.
  const list = [...unique.values()];
  // A failed read counts as an error for that item only (undefined), never for the whole batch.
  const fresh = await Promise.all(list.map((p) => loadOne(supabase, p.kind, p.id).catch(() => undefined)));
  const now = new Date().toISOString();
  let approved = 0;
  const skipped: string[] = [];
  const touched = new Set<ReviewKind>();

  // One item: 'ok' when approved, otherwise why it was skipped.
  async function approveOne(pick: Pick, item: Awaited<ReturnType<typeof loadOne>> | undefined): Promise<SkipCode | 'ok'> {
    if (item === undefined) return 'error';
    if (!item || item.status !== 'pending') return 'gone';
    if (item.updatedAt !== pick.updatedAt) return 'changed';
    if (item.sample) return 'sample';
    if (item.readiness.state !== 'ready') {
      return item.kind === 'group' && item.row.organizer_kind === 'traveller' && !item.row.organiser?.phone_verified_at ? 'phone' : 'notready';
    }

    let result: { data: { id: string }[] | null; error: unknown };
    if (pick.kind === 'guide') {
      result = await supabase
        .from('guides')
        .update({ verification_status: 'approved', verified_at: now })
        .eq('id', pick.id)
        .eq('verification_status', 'pending')
        .eq('updated_at', pick.updatedAt)
        .eq('is_sample', false)
        .not('identity_checked_at', 'is', null)
        .not('licence_checked_at', 'is', null)
        .select('id');
    } else if (pick.kind === 'package') {
      result = await supabase
        .from('guide_packages')
        .update({ status: 'approved', review_note: null })
        .eq('id', pick.id)
        .eq('status', 'pending')
        .eq('updated_at', pick.updatedAt)
        .select('id');
    } else if (pick.kind === 'group') {
      result = await supabase
        .from('group_trips')
        .update({ status: 'approved' })
        .eq('id', pick.id)
        .eq('status', 'pending')
        .eq('cancelled', false)
        .eq('updated_at', pick.updatedAt)
        .select('id');
    } else {
      // Businesses and jobs are approved one by one only.
      return 'notready';
    }
    if (result.error) return 'error';
    if (!result.data?.length) return 'changed';
    return 'ok';
  }

  for (let i = 0; i < list.length; i++) {
    const pick = list[i];
    // One item failing (network, database) never stops the others, the result note or the cache refresh.
    let outcome: SkipCode | 'ok';
    try {
      outcome = await approveOne(pick, fresh[i]);
    } catch {
      outcome = 'error';
    }
    if (outcome === 'ok') {
      approved++;
      touched.add(pick.kind);
    } else {
      skipped.push(encodeSkip(pick.kind, pick.id, outcome));
    }
  }

  if (touched.has('guide')) revalidateTag('guides', 'max');
  if (touched.has('package')) revalidateTag('packages', 'max');
  if (touched.has('group')) revalidateTag('groups', 'max');
  redirect(backTo(formData, locale, '', { ok: String(approved), ...(skipped.length ? { skip: skipped.join(',') } : {}) }));
}
