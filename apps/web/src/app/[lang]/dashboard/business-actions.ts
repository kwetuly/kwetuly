'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { BUSINESS_TYPES, REGIONS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireOnboarded } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const text = (formData: FormData, key: string, max: number) => {
  const value = String(formData.get(key) ?? '').trim().slice(0, max);
  return value || null;
};

/** A file the browser uploaded into this user's own folder, e.g. "<user id>/business-1791234567890.jpg". */
function ownPath(value: FormDataEntryValue | null, userId: string, prefix: string, extensions: string[]) {
  const match = String(value ?? '').match(/^([0-9a-f-]{36})\/([a-z-]+)-\d{10,16}\.([a-z]+)$/);
  return match && match[1] === userId && match[2] === prefix && extensions.includes(match[3]) ? String(value) : null;
}

// Creates or updates the signed-in owner's business listing. New listings wait for an admin.
export async function saveBusiness(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const back = `/${locale}/dashboard`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, `${back}#business`);

  const name = text(formData, 'business_name', 120);
  const type = String(formData.get('business_type') ?? '');
  const region = text(formData, 'base_region', 60);
  const whatsapp = text(formData, 'whatsapp_number', 30);
  const website = text(formData, 'website', 200);
  if (!name || !BUSINESS_TYPES.some((b) => b.id === type) || !region || !(REGIONS as readonly string[]).includes(region) || !whatsapp) {
    redirect(`${back}?error=missing#business`);
  }

  const row: Record<string, unknown> = {
    business_name: name,
    business_type: type,
    base_region: region,
    location: text(formData, 'location', 160),
    story: text(formData, 'story', 4000),
    website: website && /^https:\/\/\S+$/i.test(website) ? website : null,
  };
  const avatars = supabase.storage.from('avatars');
  const photo = ownPath(formData.get('photo_path'), user.id, 'business', ['jpg', 'png', 'webp']);
  if (photo) row.photo_url = avatars.getPublicUrl(photo).data.publicUrl;
  const extra = ownPath(formData.get('extra_photo_path'), user.id, 'business-extra', ['jpg', 'png', 'webp']);
  const licence = ownPath(formData.get('licence_path'), user.id, 'business-licence', ['jpg', 'png', 'webp', 'pdf']);

  const { data: existing } = await supabase.from('providers').select('id, photos').eq('owner_id', user.id).maybeSingle<{ id: string; photos: string[] }>();
  if (extra) row.photos = [...(existing?.photos ?? []), avatars.getPublicUrl(extra).data.publicUrl].slice(-6);
  const saved = existing
    ? await supabase.from('providers').update(row).eq('id', existing.id).select('id').single<{ id: string }>()
    : await supabase.from('providers').insert({ ...row, owner_id: user.id }).select('id').single<{ id: string }>();
  if (saved.error || !saved.data) redirect(`${back}?error=save#business`);

  // WhatsApp number and licence stay private: only the owner and Rafrika can read them.
  const privateRow: Record<string, string> = { provider_id: saved.data.id, whatsapp_number: whatsapp };
  if (licence) privateRow.licence_document_path = licence;
  const { error } = await supabase.from('provider_private').upsert(privateRow);
  if (error) redirect(`${back}?error=save#business`);

  revalidateTag('businesses', 'max');
  redirect(`${back}?saved=1#business`);
}

// The owner asks for the paid badge check; Rafrika then arranges the check and the payment.
export async function requestBadge(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, `/${locale}/dashboard#badge`);
  await supabase.from('providers').update({ badge_requested_at: new Date().toISOString() }).eq('owner_id', user.id);
  redirect(`/${locale}/dashboard#badge`);
}

// The business records a sale that came with a Rafrika referral code. The database fills in the guide.
export async function reportSale(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const back = `/${locale}/dashboard`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, `${back}#sales`);
  const { data: business } = await supabase.from('providers').select('id').eq('owner_id', user.id).maybeSingle<{ id: string }>();
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const amount = Number.parseFloat(String(formData.get('amount_tzs') ?? ''));
  const date = String(formData.get('sale_date') ?? '');
  if (!business || !/^[A-Z0-9]{6,10}$/.test(code) || !Number.isFinite(amount) || amount <= 0) redirect(`${back}?sale_error=1#sales`);
  const { error } = await supabase.from('referral_sales').insert({
    provider_id: business.id,
    code,
    amount_tzs: Math.round(amount),
    sale_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
    note: text(formData, 'note', 500),
  });
  redirect(`${back}?${error ? 'sale_error' : 'sale_saved'}=1#sales`);
}
