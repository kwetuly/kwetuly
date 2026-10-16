'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function httpsUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// Create or update a tour operator. Licence and TripAdvisor details are only kept with the date
// they were checked, and the Verified badge is only ever set here, by an admin.
export async function saveOperator(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);

  const text = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const nullable = (key: string, max: number) => text(key, max) || null;
  const date = (key: string) => (DATE.test(text(key, 10)) ? text(key, 10) : null);
  const id = text('id', 40);
  const back = `/${locale}/admin/operators/${id || 'new'}`;
  const warnings: string[] = [];

  const slug = text('slug', 80).toLowerCase();
  const name = text('name', 120);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || name.length < 2) {
    redirect(`${back}?error=${encodeURIComponent('Name and a web address (a–z, 0–9, dashes) are required.')}`);
  }

  const link = (key: string, max: number) => {
    const raw = text(key, max);
    const url = httpsUrl(raw);
    if (raw && !url) warnings.push(`${key.replace('_', ' ')} was not saved: it must start with https://.`);
    return url;
  };

  let licenceNumber = nullable('licence_number', 80);
  const licenceChecked = date('licence_checked_at');
  if (licenceNumber && !licenceChecked) {
    warnings.push('The licence number was not saved: add the date you checked it.');
    licenceNumber = null;
  }

  const ratingRaw = Number.parseFloat(text('tripadvisor_rating', 4));
  let rating = Number.isFinite(ratingRaw) && ratingRaw >= 0 && ratingRaw <= 5 ? Math.round(ratingRaw * 10) / 10 : null;
  const reviewsRaw = Number.parseInt(text('tripadvisor_reviews', 9), 10);
  let reviews = Number.isInteger(reviewsRaw) && reviewsRaw >= 0 ? reviewsRaw : null;
  const taChecked = date('tripadvisor_checked_at');
  if ((rating != null || reviews != null) && !taChecked) {
    warnings.push('The TripAdvisor rating was not saved: add the date you checked it.');
    rating = reviews = null;
  }

  const upload = text('logo_upload', 300);
  const logo = upload ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${upload}` : link('logo_url', 500);

  const supabase = await createClient();
  const { data: current } = id ? await supabase.from('tour_operators').select('verified_at').eq('id', id).maybeSingle() : { data: null };
  const verified = formData.get('verified') === 'on';

  const row = {
    slug,
    name,
    logo_url: logo,
    description: nullable('description', 2000),
    website: link('website', 300),
    contact_email: nullable('contact_email', 160),
    contact_phone: nullable('contact_phone', 40),
    location: nullable('location', 120),
    licence_number: licenceNumber,
    licence_authority: licenceNumber ? nullable('licence_authority', 120) : null,
    licence_checked_at: licenceNumber ? licenceChecked : null,
    tripadvisor_url: link('tripadvisor_url', 400),
    tripadvisor_rating: rating,
    tripadvisor_reviews: reviews,
    tripadvisor_checked_at: rating != null || reviews != null || text('tripadvisor_url', 400) ? taChecked : null,
    // Keep the original verification date while the box stays ticked.
    verified_at: verified ? (current?.verified_at ?? new Date().toISOString()) : null,
    status: ['draft', 'published', 'archived'].includes(text('status', 20)) ? text('status', 20) : 'draft',
  };

  let operatorId = id;
  if (id) {
    const { error } = await supabase.from('tour_operators').update(row).eq('id', id);
    if (error) redirect(`${back}?error=${encodeURIComponent(error.code === '23505' ? 'That web address is taken.' : error.message)}`);
  } else {
    const { data, error } = await supabase.from('tour_operators').insert(row).select('id').single();
    if (error || !data) redirect(`${back}?error=${encodeURIComponent(error?.code === '23505' ? 'That web address is taken.' : (error?.message ?? 'Could not save.'))}`);
    operatorId = data.id;
  }

  revalidateTag('operators', 'max');
  revalidateTag('trips', 'max');
  redirect(`/${locale}/admin/operators/${operatorId}?${warnings.length ? `error=${encodeURIComponent(warnings.join(' '))}` : 'saved=1'}`);
}

export async function deleteOperator(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const id = String(formData.get('id') ?? '').slice(0, 40);
  if (String(formData.get('confirm') ?? '').trim() !== String(formData.get('slug') ?? '')) {
    redirect(`/${locale}/admin/operators/${id}?error=${encodeURIComponent('Type the web address exactly to delete this operator.')}`);
  }
  const supabase = await createClient();
  // Their tours stay, without an operator, until they are reassigned or archived.
  await supabase.from('tour_operators').delete().eq('id', id);
  revalidateTag('operators', 'max');
  revalidateTag('trips', 'max');
  redirect(`/${locale}/admin/operators`);
}
