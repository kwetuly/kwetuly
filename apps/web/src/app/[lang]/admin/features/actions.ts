'use server';

import { redirect } from 'next/navigation';
import { updateTag } from 'next/cache';
import { FEATURE_ID_PATTERN, featureDef, isLockedOff, parseFeatureRows, tanzaniaToday } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { FEATURES_CACHE_TAG } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

// Feature switches. The browser only says which switch and what to change; everything is checked again
// here and then by public.admin_set_feature (admins with two-step sign-in, known ids, payments_live and
// valid dates; payments_live never on and never a team preview), which also logs every change
// (migration 20261126000000).
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function adminOnly(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  // Keep the "legal check pending only" filter after a save.
  return formData.get('filter') === 'legal' ? `/${locale}/admin/features?filter=legal` : `/${locale}/admin/features?`;
}

// Only fixed codes and a checked id go into the address; the page maps codes to fixed texts.
function done(back: string, id: string | null, params: Record<string, string>): never {
  const sep = back.endsWith('?') ? '' : '&';
  redirect(`${back}${sep}${new URLSearchParams(params)}${id ? `#feature-${id}` : ''}`);
}

function code(message: string | undefined): string {
  const m = message ?? '';
  if (/admins only/i.test(m)) return 'not_admin';
  if (/locked off/i.test(m)) return 'locked';
  if (/unknown feature/i.test(m)) return 'unknown';
  if (/date/i.test(m)) return 'date';
  return 'failed';
}

function readId(formData: FormData): string | null {
  const id = String(formData.get('id') ?? '');
  return FEATURE_ID_PATTERN.test(id) && featureDef(id) && !featureDef(id)?.hidden ? id : null;
}

// The current on/off of one switch, from its public row (null = no row).
async function current(id: string): Promise<{ on: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('key, value').eq('key', `feature.${id}`).maybeSingle<{ key: string; value: unknown }>();
  const map = parseFeatureRows(data ? [data] : []);
  return id in map ? { on: map[id] } : null;
}

async function save(back: string, id: string, on: boolean, legal: string | null, checkedOn: string | null, teamOnly: boolean | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_feature', {
    p_id: id,
    p_on: on,
    p_legal: legal,
    p_legal_checked_on: checkedOn,
    p_team_only: teamOnly,
  });
  if (error) done(back, id, { e: code(error.message) });
  updateTag(FEATURES_CACHE_TAG);
  done(back, id, { ok: 'saved' });
}

/** Switch on or off. "on" is the wanted state, read as a fixed value. */
export async function setFeatureOn(formData: FormData) {
  const back = await adminOnly(formData);
  const id = readId(formData);
  if (!id) done(back, null, { e: 'unknown' });
  const want = String(formData.get('on') ?? '');
  if (want !== 'true' && want !== 'false') done(back, id, { e: 'failed' });
  if (want === 'true' && isLockedOff(id)) done(back, id, { e: 'locked' });
  const now = await current(id);
  if (!now) done(back, id, { e: 'unknown' });
  await save(back, id, want === 'true', null, null, null);
}

/** Team preview: admins see the feature while it is off. */
export async function setFeatureTeamOnly(formData: FormData) {
  const back = await adminOnly(formData);
  const id = readId(formData);
  if (!id) done(back, null, { e: 'unknown' });
  const want = String(formData.get('team_only') ?? '');
  if (want !== 'true' && want !== 'false') done(back, id, { e: 'failed' });
  if (want === 'true' && isLockedOff(id)) done(back, id, { e: 'locked' });
  const now = await current(id);
  if (!now) done(back, id, { e: 'unknown' });
  await save(back, id, now.on, null, null, want === 'true');
}

/** Legal check: pending, or done on the date of the advocate's answer. */
export async function setFeatureLegal(formData: FormData) {
  const back = await adminOnly(formData);
  const id = readId(formData);
  if (!id) done(back, null, { e: 'unknown' });
  const legal = String(formData.get('legal') ?? '');
  if (legal !== 'pending' && legal !== 'cleared') done(back, id, { e: 'failed' });
  let checkedOn: string | null = null;
  if (legal === 'cleared') {
    checkedOn = String(formData.get('legal_checked_on') ?? '').trim();
    if (!DATE.test(checkedOn) || checkedOn > tanzaniaToday()) done(back, id, { e: 'date' });
  }
  const now = await current(id);
  if (!now) done(back, id, { e: 'unknown' });
  await save(back, id, now.on, legal, checkedOn, null);
}
