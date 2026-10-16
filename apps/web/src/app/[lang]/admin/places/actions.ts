'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { PLACE_KINDS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Create or update a place guide. Figures (area, years, highest point) are only kept when a
// source link and the date it was checked are given.
export async function savePlace(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const text = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const nullable = (key: string, max: number) => text(key, max) || null;
  const num = (key: string, min: number, max: number) => {
    const n = Number.parseFloat(text(key, 14));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const lines = (key: string) => text(key, 4000).split('\n').map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 20);
  const id = text('id', 40);
  const back = `/${locale}/admin/places/${id || 'new'}`;
  const warnings: string[] = [];

  const slug = text('slug', 80).toLowerCase();
  const name = text('name', 120);
  const summary = text('summary', 1200);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || name.length < 2 || summary.length < 20) {
    redirect(`${back}?error=${encodeURIComponent('Name, web address and a summary of at least 20 characters are required.')}`);
  }

  let sourceUrl: string | null = null;
  try {
    const url = new URL(text('source_url', 400));
    if (url.protocol === 'https:') sourceUrl = url.toString();
  } catch {}
  const checked = DATE.test(text('source_checked_at', 10)) ? text('source_checked_at', 10) : null;
  const figures = {
    area_km2: num('area_km2', 0.01, 100000),
    established: num('established', 1800, 2100),
    unesco_year: num('unesco_year', 1972, 2100),
    highest_point: nullable('highest_point', 120),
  };
  const hasFigures = Object.values(figures).some((v) => v != null);
  if (hasFigures && (!sourceUrl || !checked)) {
    warnings.push('Figures were not saved: add the https source link and the date you checked it.');
    figures.area_km2 = figures.established = figures.unesco_year = null;
    figures.highest_point = null;
  }

  const kind = text('kind', 30);
  const row = {
    slug,
    name,
    kind: PLACE_KINDS.some((k) => k.id === kind) ? kind : 'national_park',
    region: nullable('region', 80),
    summary,
    known_for: lines('known_for'),
    wildlife: lines('wildlife'),
    activities: lines('activities'),
    ...figures,
    managed_by: nullable('managed_by', 120),
    lat: num('lat', -12, 0),
    lng: num('lng', 29, 41),
    source_name: nullable('source_name', 120),
    source_url: sourceUrl,
    source_checked_at: sourceUrl ? checked : null,
    status: ['draft', 'published', 'archived'].includes(text('status', 20)) ? text('status', 20) : 'published',
  };

  const supabase = await createClient();
  let placeId = id;
  if (id) {
    const { error } = await supabase.from('places').update(row).eq('id', id);
    if (error) redirect(`${back}?error=${encodeURIComponent(error.code === '23505' ? 'That web address is taken.' : error.message)}`);
  } else {
    const { data, error } = await supabase.from('places').insert(row).select('id').single();
    if (error || !data) redirect(`${back}?error=${encodeURIComponent(error?.code === '23505' ? 'That web address is taken.' : (error?.message ?? 'Could not save.'))}`);
    placeId = data.id;
  }
  revalidateTag('places', 'max');
  redirect(`/${locale}/admin/places/${placeId}?${warnings.length ? `error=${encodeURIComponent(warnings.join(' '))}` : 'saved=1'}`);
}
