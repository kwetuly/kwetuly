import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';

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

/** The listing that receives merchandise orders, or null until Kwetuly creates it. */
export async function getMerchShopId(): Promise<string | null> {
  'use cache';
  cacheTag('businesses');
  cacheLife('minutes');
  const { data } = await publicClient().from('providers').select('id').eq('business_type', 'merch').eq('verification_status', 'approved').limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
