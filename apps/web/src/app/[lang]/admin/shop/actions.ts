'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
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

export async function saveProduct(formData: FormData) {
  const { locale } = await adminOnly(formData);
  const id = text(formData, 'id', 40);
  const price = Number.parseInt(text(formData, 'price_tzs', 10), 10);
  const photo = text(formData, 'photo_url', 400);
  const row = {
    name: text(formData, 'name', 120),
    description: text(formData, 'description', 2000) || null,
    price_tzs: Number.isFinite(price) && price >= 0 ? price : null,
    sizes: text(formData, 'sizes', 200).split(',').map((s) => s.trim().slice(0, 20)).filter(Boolean).slice(0, 12),
    photo_url: /^https:\/\/\S+$/.test(photo) ? photo : null,
    active: formData.get('active') === 'on',
    sort_order: Number.parseInt(text(formData, 'sort_order', 4), 10) || 0,
    updated_at: new Date().toISOString(),
  };
  const back = `/${locale}/admin/shop`;
  if (row.name.length < 2) redirect(`${back}?error=1`);
  const supabase = await createClient();
  const { error } = id ? await supabase.from('shop_products').update(row).eq('id', id) : await supabase.from('shop_products').insert(row);
  revalidateTag('products', 'max');
  redirect(`${back}?${error ? 'error' : 'saved'}=1`);
}

export async function deleteProduct(formData: FormData) {
  const { locale } = await adminOnly(formData);
  const supabase = await createClient();
  await supabase.from('shop_products').delete().eq('id', text(formData, 'id', 40));
  revalidateTag('products', 'max');
  redirect(`/${locale}/admin/shop?deleted=1`);
}

// Orders need somewhere to arrive: a "Rafrika Shop" listing owned by the admin account.
export async function createMerchShop(formData: FormData) {
  const { locale, userId } = await adminOnly(formData);
  const supabase = await createClient();
  const { data } = await supabase.from('providers').select('id').eq('business_type', 'merch').limit(1).maybeSingle();
  if (!data) {
    await supabase.from('providers').insert({
      owner_id: userId,
      business_name: 'Rafrika Shop',
      business_type: 'merch',
      base_region: 'Arusha',
      story: 'Official Rafrika merchandise.',
      languages: ['en', 'sw'],
      verification_status: 'approved',
    });
  }
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin/shop`);
}
