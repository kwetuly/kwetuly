import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { isFeatureOn, isFeatureVisible, parseFeatureRows, type FeatureMap } from '@kwetuly/shared';

// Feature switches (site_settings feature.<id>, design docs/team/design-2026-11-24.md section 2). Public
// rows, no session: cached for everyone under the 'features' tag; /admin/features refreshes the tag
// after every change. A missing or broken row reads as off (fail closed), like private.feature_on.
// The screen check is for looks only: server rules that matter also check feature_on in the database.

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

export const FEATURES_CACHE_TAG = 'features';

export async function getFeatures(): Promise<FeatureMap> {
  'use cache';
  cacheTag(FEATURES_CACHE_TAG);
  cacheLife('minutes');
  const { data, error } = await publicClient().from('site_settings').select('key, value').like('key', 'feature.%').limit(500);
  if (error) return {};
  return parseFeatureRows(data as { key: string; value: unknown }[]);
}

/** True only when feature.<id> exists and is on. */
export async function featureOn(id: string): Promise<boolean> {
  return isFeatureOn(await getFeatures(), id);
}

/** On for everyone, or a team-only preview when the caller is an admin with a two-step session. */
export async function featureVisible(id: string, isAdmin: boolean): Promise<boolean> {
  return isFeatureVisible(await getFeatures(), id, isAdmin);
}
