import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { BUSINESS_COLUMNS, SAMPLE_LISTING_COLUMNS, type Business, type BusinessType, type PhotoCredit, type SampleListing } from '@kwetuly/shared';

// Public data has no session, so it can be cached and shared between visitors.
function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

// Approved businesses of some types. Ones with a valid badge are sorted first by the page.
export async function listBusinesses(types: BusinessType[]): Promise<Business[]> {
  'use cache';
  cacheTag('businesses');
  cacheLife('minutes');
  const { data } = await publicClient()
    .from('providers')
    .select(BUSINESS_COLUMNS)
    .eq('verification_status', 'approved')
    .eq('is_available', true)
    .in('business_type', types)
    .order('business_name')
    .limit(60);
  return (data ?? []) as Business[];
}

export async function getBusiness(id: string): Promise<Business | null> {
  'use cache';
  cacheTag('businesses');
  cacheLife('minutes');
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await publicClient().from('providers').select(BUSINESS_COLUMNS).eq('id', id).eq('verification_status', 'approved').maybeSingle();
  return (data as Business | null) ?? null;
}

/** The yearly badge fee in USD, or null while Kwetuly has not set it. */
export async function getBadgeFee(): Promise<number | null> {
  'use cache';
  cacheTag('settings');
  cacheLife('minutes');
  const { data } = await publicClient().from('site_settings').select('value').eq('key', 'badge_fee').maybeSingle<{ value: { amount_usd: number | null } }>();
  return data?.value.amount_usd ?? null;
}

/**
 * "What they offer": published items of a SAMPLE business only. Security finding F1: owners can
 * still publish listings without review, so real owners' items stay hidden until the catalogue
 * review rules exist. The inner join plus the is_sample filter enforce that in the query itself.
 */
export async function getSampleListings(providerId: string): Promise<SampleListing[]> {
  'use cache';
  cacheTag('businesses');
  cacheLife('minutes');
  if (!/^[0-9a-f-]{36}$/.test(providerId)) return [];
  const { data, error } = await publicClient()
    .from('listings')
    .select(SAMPLE_LISTING_COLUMNS)
    .eq('provider_id', providerId)
    .eq('is_published', true)
    .eq('providers.is_sample', true)
    .order('created_at')
    .limit(30);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SampleListing[]).map((x) => ({ id: x.id, title: x.title, description: x.description, photos: x.photos ?? [], price_note: x.price_note }));
}

/** Credit lines for sample photos, by storage path. Empty when the credits table does not exist yet. */
export async function getPhotoCredits(paths: string[]): Promise<PhotoCredit[]> {
  'use cache';
  cacheTag('sample-media');
  cacheLife('hours');
  if (paths.length === 0) return [];
  const { data } = await publicClient().from('sample_media_credits').select('path, credit, source_url, licence').in('path', paths.slice(0, 100));
  return (data ?? []) as PhotoCredit[];
}
