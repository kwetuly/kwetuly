'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS } from '@rafrika/shared';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function adminOnly(formData: FormData): Promise<{ locale: Locale; userId: string }> {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);
  return { locale, userId: user.id };
}

const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
const https = (value: string) => (/^https:\/\/\S+$/.test(value) ? value : null);

// Create or edit any business listing. Listings Rafrika adds itself belong to the admin account,
// so enquiries to them arrive in the admin inbox.
export async function saveListing(formData: FormData) {
  const { locale, userId } = await adminOnly(formData);
  const id = text(formData, 'id', 40);
  const type = text(formData, 'business_type', 30);
  const region = text(formData, 'base_region', 80);
  const row = {
    business_name: text(formData, 'business_name', 120),
    business_type: type,
    base_region: region,
    location: text(formData, 'location', 160) || null,
    story: text(formData, 'story', 4000) || null,
    website: https(text(formData, 'website', 400)),
    source_url: https(text(formData, 'source_url', 400)),
    photo_url: https(text(formData, 'photo_url', 400)),
    is_sample: formData.get('is_sample') === 'on',
    verification_status: formData.get('published') === 'on' ? 'approved' : 'pending',
    is_available: true,
  };
  const back = `/${locale}/admin/listings`;
  if (row.business_name.length < 2 || !BUSINESS_TYPES.some((b) => b.id === type) || !(REGIONS as readonly string[]).includes(region)) {
    redirect(`${back}?error=1`);
  }
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('providers').update(row).eq('id', id)
    : await supabase.from('providers').insert({ ...row, owner_id: userId, languages: ['en', 'sw'] });
  revalidateTag('businesses', 'max');
  redirect(`${back}?${error ? 'error' : 'saved'}=1${id ? `#b-${id}` : ''}`);
}

export async function deleteListing(formData: FormData) {
  const { locale } = await adminOnly(formData);
  const supabase = await createClient();
  await supabase.from('providers').delete().eq('id', text(formData, 'id', 40));
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin/listings?deleted=1`);
}

// Before launch: remove every sample listing in one go.
export async function deleteAllSamples(formData: FormData) {
  const { locale } = await adminOnly(formData);
  if (formData.get('confirm') !== 'DELETE') redirect(`/${locale}/admin/listings?error=confirm`);
  const supabase = await createClient();
  await supabase.from('providers').delete().eq('is_sample', true);
  // Sample guides take their packages with them; their sample group trips go first.
  const { data: guides } = await supabase.from('guides').select('id').eq('is_sample', true);
  const ids = (guides ?? []).map((g) => g.id as string);
  if (ids.length) {
    await supabase.from('group_trips').delete().in('guide_id', ids);
    await supabase.from('guides').delete().in('id', ids);
  }
  revalidateTag('guides', 'max');
  revalidateTag('packages', 'max');
  revalidateTag('groups', 'max');
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin/listings?deleted=1`);
}
