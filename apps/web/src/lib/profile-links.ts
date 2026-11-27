import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { ProfileLinkColumn } from '@kwetuly/shared';

// Profile links (slice S5): the links on a guide's public page and the feature.profile_links switch.
// Public data only, read without a session so it can be cached and shared between visitors.

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * feature.profile_links, read straight from site_settings (wave 1 rule: S5 does not depend on S1's
 * helper; switch to featureOn('profile_links') once S1 is merged). A missing row is off, like
 * private.feature_on. Tagged 'features' so S1's admin page refreshes it.
 */
export async function profileLinksOn(): Promise<boolean> {
  'use cache';
  cacheTag('features');
  cacheLife('minutes');
  const { data } = await publicClient().from('site_settings').select('value').eq('key', 'feature.profile_links').maybeSingle<{ value: { on?: unknown } | null }>();
  return data?.value?.on === true;
}

export type GuideLinkRow = Partial<Record<ProfileLinkColumn, string | null>>;

const GUIDE_LINK_SELECT = 'instagram_url, facebook_url, tiktok_url, google_business_url, youtube_url, website';
const OLD_GUIDE_LINK_SELECT = 'instagram_url, facebook_url, tiktok_url';

/**
 * An approved guide's stored links. Until the migration 20261126000200 is applied the new columns do
 * not exist, so the old three are read instead and the page keeps working. Tagged 'guides' so a save
 * shows at once.
 */
export async function getGuideLinks(guideId: string): Promise<GuideLinkRow> {
  'use cache';
  cacheTag('guides', `guide-links:${guideId}`);
  cacheLife('minutes');
  const client = publicClient();
  const full = await client.from('guides').select(GUIDE_LINK_SELECT).eq('id', guideId).eq('verification_status', 'approved').maybeSingle<GuideLinkRow>();
  if (!full.error) return full.data ?? {};
  const old = await client.from('guides').select(OLD_GUIDE_LINK_SELECT).eq('id', guideId).eq('verification_status', 'approved').maybeSingle<GuideLinkRow>();
  return old.data ?? {};
}
