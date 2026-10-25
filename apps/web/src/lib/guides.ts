import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { PACKAGE_COLUMNS, type GuidePackage } from '@kwetuly/shared';

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
  open_to_partners: boolean;
  rating_avg: number | null;
  rating_count: number;
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
  identity_checked_at: string | null;
  licence_checked_at: string | null;
  first_aid_checked_at: string | null;
  first_aid_valid_until: string | null;
  is_sample: boolean;
};

export const GUIDE_COLUMNS =
  'id, slug, display_name, photo_url, headline, bio, base_region, regions, specialties, expertise, female_guide, open_to_partners, rating_avg, rating_count, languages, max_group_size, years_experience, summits, certifications, association, has_vehicle, facebook_url, instagram_url, tiktok_url, visibility, verification_status, plan, call_enabled, call_price_usd, call_minutes, call_topics, identity_checked_at, licence_checked_at, first_aid_checked_at, first_aid_valid_until, is_sample';

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

export type GuideFilters = { specialty?: string; language?: string; region?: string; expertise?: string; female?: boolean; partners?: boolean };

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
  if (filters.partners) query = query.eq('open_to_partners', true);
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

export type Review = { id: string; author_name: string; rating: number; body: string; created_at: string };

// Visible reviews for one guide, newest first. Tagged 'guides' so a new review refreshes the profile.
export async function listReviews(guideId: string): Promise<Review[]> {
  'use cache';
  cacheTag('guides', `reviews:${guideId}`);
  cacheLife('minutes');

  const { data } = await publicClient()
    .from('guide_reviews')
    .select('id, author_name, rating, body, created_at')
    .eq('guide_id', guideId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as Review[];
}

/** Real totals for the home page: verified public guides and the reviews they have received. */
export async function siteStats(): Promise<{ guides: number; reviews: number }> {
  'use cache';
  cacheTag('guides');
  cacheLife('hours');

  const { data } = await publicClient()
    .from('guides')
    .select('rating_count')
    .eq('verification_status', 'approved')
    .eq('visibility', 'public');
  const rows = (data ?? []) as { rating_count: number | null }[];
  return { guides: rows.length, reviews: rows.reduce((sum, g) => sum + (g.rating_count ?? 0), 0) };
}

// Approved packages of one guide (the database only returns approved packages of approved guides to visitors).
export async function getGuidePackages(guideId: string): Promise<GuidePackage[]> {
  'use cache';
  cacheTag('guides', 'packages');
  cacheLife('minutes');

  const { data } = await publicClient()
    .from('guide_packages')
    .select(PACKAGE_COLUMNS)
    .eq('guide_id', guideId)
    .eq('status', 'approved')
    .order('sort_order')
    .order('created_at');
  return (data ?? []) as GuidePackage[];
}

export type PackageWithGuide = GuidePackage & { guides: { display_name: string; slug: string; photo_url: string | null; visibility: string } | null };

// Approved packages from all public guides, optionally of one kind, for the catalogue.
export async function listPackages(kind?: string): Promise<PackageWithGuide[]> {
  'use cache';
  cacheTag('guides', 'packages');
  cacheLife('minutes');

  let query = publicClient()
    .from('guide_packages')
    .select(`${PACKAGE_COLUMNS}, guides!inner(display_name, slug, photo_url, visibility)`)
    .eq('status', 'approved')
    .eq('guides.visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(60);
  if (kind) query = query.eq('kind', kind);
  const { data } = await query;
  return (data ?? []) as unknown as PackageWithGuide[];
}
