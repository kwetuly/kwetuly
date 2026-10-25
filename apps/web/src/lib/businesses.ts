import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { BUSINESS_COLUMNS, type Business, type BusinessType } from '@kwetuly/shared';

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
