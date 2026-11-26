import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';

// The feature.booking_link switch, read the way the other site settings are read (a public row in
// site_settings). A missing row or anything but {"on": true} means off, like private.feature_on.
// Wave 1 keeps this read here; when the shared feature helper (apps/web/src/lib/features.ts, S1)
// lands, replace this with featureOn('booking_link').
export async function bookingLinkOn(): Promise<boolean> {
  'use cache';
  cacheTag('features', 'settings');
  cacheLife('minutes');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data } = await client.from('site_settings').select('value').eq('key', 'feature.booking_link').maybeSingle<{ value: { on?: unknown } }>();
  return data?.value?.on === true;
}
