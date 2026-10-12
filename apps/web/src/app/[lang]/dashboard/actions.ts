'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, 'application/pdf': 'pdf' };

const text = (formData: FormData, key: string, max = 500) => {
  const value = String(formData.get(key) ?? '').trim().slice(0, max);
  return value || null;
};

const int = (formData: FormData, key: string) => {
  const n = Number.parseInt(String(formData.get(key) ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const httpsUrl = (formData: FormData, key: string) => {
  const value = text(formData, key, 300);
  return value && /^https:\/\/[^\s]+$/i.test(value) ? value : null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function saveGuideProfile(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const back = `/${locale}/dashboard`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const displayName = text(formData, 'display_name', 80);
  const baseRegion = text(formData, 'base_region', 60);
  const slug = slugify(text(formData, 'slug', 60) ?? displayName ?? '');
  if (!displayName || !baseRegion || !(REGIONS as readonly string[]).includes(baseRegion) || !slug) {
    redirect(`${back}?error=missing`);
  }

  const allowed = <T extends string>(values: FormDataEntryValue[], list: readonly T[]) =>
    values.map(String).filter((v): v is T => (list as readonly string[]).includes(v));

  const guide = {
    owner_id: user.id,
    slug,
    display_name: displayName,
    headline: text(formData, 'headline', 140),
    bio: text(formData, 'bio', 4000),
    base_region: baseRegion,
    regions: allowed(formData.getAll('regions'), REGIONS),
    specialties: allowed(formData.getAll('specialties'), GUIDE_SPECIALTIES.map((s) => s.id)),
    languages: allowed(formData.getAll('languages'), GUIDE_LANGUAGES.map((l) => l.code)),
    max_group_size: Math.min(Math.max(int(formData, 'max_group_size') ?? 8, 1), 60),
    years_experience: int(formData, 'years_experience'),
    summits: int(formData, 'summits'),
    certifications: (text(formData, 'certifications', 300) ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 10),
    association: text(formData, 'association', 80),
    has_vehicle: formData.get('has_vehicle') === 'on',
    facebook_url: httpsUrl(formData, 'facebook_url'),
    instagram_url: httpsUrl(formData, 'instagram_url'),
    tiktok_url: httpsUrl(formData, 'tiktok_url'),
    visibility: formData.get('visibility') === 'link_only' ? 'link_only' : 'public',
  };

  // Profile photo goes to the public avatars bucket, in a folder named after the user.
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const ext = IMAGE_TYPES[photo.type];
    if (!ext || photo.size > MAX_UPLOAD_BYTES) redirect(`${back}?error=photo`);
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, photo, { contentType: photo.type });
    if (error) redirect(`${back}?error=photo`);
    Object.assign(guide, { photo_url: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl });
  }

  const { data: saved, error } = await supabase
    .from('guides')
    .upsert(guide, { onConflict: 'owner_id' })
    .select('id')
    .single();
  if (error || !saved) redirect(`${back}?error=${error?.code === '23505' ? 'slug' : 'save'}`);

  // Private details: ID document goes to the private verification bucket.
  const privateData: Record<string, string | null> = {
    guide_id: saved.id,
    phone: text(formData, 'phone', 30),
    whatsapp_number: text(formData, 'whatsapp_number', 30),
    registration_number: text(formData, 'registration_number', 60),
    kinapa_tanapa_id: text(formData, 'kinapa_tanapa_id', 60),
  };
  const idDocument = formData.get('id_document');
  if (idDocument instanceof File && idDocument.size > 0) {
    const ext = DOC_TYPES[idDocument.type];
    if (!ext || idDocument.size > MAX_UPLOAD_BYTES) redirect(`${back}?error=document`);
    const path = `${user.id}/guide-id-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('verification')
      .upload(path, idDocument, { contentType: idDocument.type });
    if (uploadError) redirect(`${back}?error=document`);
    privateData.id_document_path = path;
  }

  const { error: privateError } = await supabase.from('guide_private').upsert(privateData);
  if (privateError) redirect(`${back}?error=save`);

  revalidateTag('guides', 'max');
  redirect(`${back}?saved=1`);
}
