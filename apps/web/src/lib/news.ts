import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';

export type TravelNews = {
  id: string;
  title: string;
  body: string;
  region: string | null;
  source_name: string | null;
  source_url: string | null;
  published: boolean;
  published_on: string;
};

export const NEWS_COLUMNS = 'id, title, body, region, source_name, source_url, published, published_on';

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Published news for travellers, newest first. Guides have their own Field news in the Hub. */
export async function listTravelNews(limit = 50): Promise<TravelNews[]> {
  'use cache';
  cacheTag('news');
  cacheLife('minutes');
  const { data } = await publicClient()
    .from('travel_news')
    .select(NEWS_COLUMNS)
    .eq('published', true)
    .order('published_on', { ascending: false })
    .limit(limit);
  return (data ?? []) as TravelNews[];
}
