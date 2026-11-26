import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { isFeatureOn, parseFeatureRows, type FeatureMap } from '@kwetuly/shared';
import { createClient } from '@/lib/supabase/server';

// Feature switches (public site_settings rows feature.<id> = {"on": bool}; design
// docs/team/design-2026-11-24.md section 2). No session: cached for everyone under the 'features' tag;
// /admin/features refreshes the tag after every change. A missing or broken row reads as off (fail
// closed), like private.feature_on. The screen check is for looks only: server rules that matter check
// feature_on (or money_feature_on / manual_payments_on for money) inside the database.

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

export const FEATURES_CACHE_TAG = 'features';

async function loadFeatures(): Promise<FeatureMap> {
  'use cache';
  cacheTag(FEATURES_CACHE_TAG);
  cacheLife('minutes');
  const { data, error } = await publicClient().from('site_settings').select('key, value').like('key', 'feature.%').limit(500);
  // Throwing keeps a failed read out of the cache (security review L4); callers read it as all off.
  if (error) throw new Error('feature switches could not be read');
  return parseFeatureRows(data as { key: string; value: unknown }[]);
}

export async function getFeatures(): Promise<FeatureMap> {
  try {
    return await loadFeatures();
  } catch {
    return {};
  }
}

/** True only when feature.<id> exists and is on. */
export async function featureOn(id: string): Promise<boolean> {
  return isFeatureOn(await getFeatures(), id);
}

/**
 * On for everyone, or a team preview for an admin with a two-step session. The admin check runs in the
 * database (public.feature_visible) with the caller's own session, not on a flag the page passes in
 * (security review L3). Not cached: the answer depends on who is asking. Screens only, never money.
 */
export async function featureVisible(id: string): Promise<boolean> {
  if (await featureOn(id)) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('feature_visible', { p_id: id });
  return !error && data === true;
}
