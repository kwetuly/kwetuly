import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { featuresFromSettings, type FeatureSwitch } from '@kwetuly/shared';

// Admin on/off switches: site_settings rows "feature.<id>" with {"on": true|false}, the same rows the
// database reads with private.feature_on (migration 20261031214101). A missing row, or a failed read,
// counts as off (fail closed). site_settings is publicly readable, so no sign-in is needed.

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** The ids of every switched-on feature, e.g. ["vip_hosts", "booking_link"]. */
export async function featuresOn(): Promise<string[]> {
  'use cache';
  cacheTag('settings');
  cacheLife('minutes');
  const { data, error } = await publicClient().from('site_settings').select('key, value').like('key', 'feature.%');
  if (error) return [];
  return featuresFromSettings(data);
}

export async function featureOn(id: FeatureSwitch): Promise<boolean> {
  return (await featuresOn()).includes(id);
}
