import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { SHOP_PROVIDER_SETTING } from '@kwetuly/shared';

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price_tzs: number | null;
  sizes: string[];
  photo_url: string | null;
  active: boolean;
  sort_order: number;
};

export const PRODUCT_COLUMNS = 'id, name, description, price_tzs, sizes, photo_url, active, sort_order';

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Kwetuly merchandise on sale. Orders go to the Kwetuly Shop listing (business type "merch"). */
export async function listProducts(): Promise<Product[]> {
  'use cache';
  cacheTag('products');
  cacheLife('minutes');
  const { data } = await publicClient().from('shop_products').select(PRODUCT_COLUMNS).eq('active', true).order('sort_order').order('name');
  return (data ?? []) as Product[];
}

/**
 * The listing that receives merchandise orders, or null until Kwetuly creates it. It is the one named
 * in site setting 'shop_provider' (admins only), never "any merch listing", so no other business can
 * receive shop orders.
 */
export async function getMerchShopId(): Promise<string | null> {
  'use cache';
  cacheTag('businesses');
  cacheTag('settings');
  cacheLife('minutes');
  return findShopId(publicClient());
}

/** The shop named in site setting 'shop_provider', if it is still an approved merch listing. */
export async function findShopId(client: Pick<SupabaseClient, 'from'>): Promise<string | null> {
  const { data: setting } = await client
    .from('site_settings')
    .select('value')
    .eq('key', SHOP_PROVIDER_SETTING)
    .maybeSingle<{ value: { provider_id?: unknown } }>();
  const id = setting?.value?.provider_id;
  if (typeof id !== 'string' || !id) return null;
  const { data } = await client
    .from('providers')
    .select('id')
    .eq('id', id)
    .eq('business_type', 'merch')
    .eq('verification_status', 'approved')
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}
