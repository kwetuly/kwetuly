import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';

export type Guide = {
  id: string;
  slug: string;
  display_name: string;
  photo_url: string | null;
  headline: string | null;
  bio: string | null;
  base_region: string;
  regions: string[];
  specialties: string[];
  expertise: string[];
  female_guide: boolean;
  languages: string[];
  max_group_size: number;
  years_experience: number | null;
  summits: number | null;
  certifications: string[];
  association: string | null;
  has_vehicle: boolean;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  visibility: 'public' | 'link_only';
  verification_status: 'pending' | 'approved' | 'rejected';
  plan: 'msingi' | 'pro';
  call_enabled: boolean;
  call_price_usd: number | null;
  call_minutes: number;
  call_topics: string[];
};

export const GUIDE_COLUMNS =
  'id, slug, display_name, photo_url, headline, bio, base_region, regions, specialties, expertise, female_guide, languages, max_group_size, years_experience, summits, certifications, association, has_vehicle, facebook_url, instagram_url, tiktok_url, visibility, verification_status, plan, call_enabled, call_price_usd, call_minutes, call_topics';

// Approved, public guides who offer 1-on-1 prep calls, optionally for one topic.
export async function listCallGuides(topic?: string): Promise<Guide[]> {
  'use cache';
  cacheTag('guides');
  cacheLife('minutes');

  let query = publicClient()
    .from('guides')
    .select(GUIDE_COLUMNS)
    .eq('verification_status', 'approved')
    .eq('visibility', 'public')
    .eq('call_enabled', true)
    .order('plan', { ascending: false })
    .limit(60);
  if (topic) query = query.contains('call_topics', [topic]);

  const { data } = await query;
  return (data ?? []) as Guide[];
}

// Public data has no session, so it can be cached and shared between visitors.
function publicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type GuideFilters = { specialty?: string; language?: string; region?: string; expertise?: string; female?: boolean };

export async function listGuides(filters: GuideFilters): Promise<Guide[]> {
  'use cache';
  cacheTag('guides');
  cacheLife('minutes');

  let query = publicClient()
    .from('guides')
    .select(GUIDE_COLUMNS)
    .eq('verification_status', 'approved')
    .eq('visibility', 'public')
    .order('plan', { ascending: false }) // Pro guides first
    .order('created_at', { ascending: true })
    .limit(60);

  if (filters.specialty) query = query.contains('specialties', [filters.specialty]);
  if (filters.language) query = query.contains('languages', [filters.language]);
  if (filters.expertise) query = query.contains('expertise', [filters.expertise]);
  if (filters.female) query = query.eq('female_guide', true);
  if (filters.region) query = query.or(`base_region.eq.${filters.region},regions.cs.{"${filters.region}"}`);

  const { data } = await query;
  return (data ?? []) as Guide[];
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  'use cache';
  cacheTag('guides', `guide:${slug}`);
  cacheLife('minutes');

  const { data } = await publicClient()
    .from('guides')
    .select(GUIDE_COLUMNS)
    .eq('slug', slug)
    .eq('verification_status', 'approved')
    .maybeSingle();
  return (data as Guide | null) ?? null;
}
