'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { CALL_TOPICS, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

/** A path the browser uploaded into this user's own storage folder, e.g. "<user id>/avatar-1791234567890.jpg". */
function ownPath(formData: FormData, key: string, userId: string, prefix: string, extensions: string[]) {
  const value = String(formData.get(key) ?? '');
  const match = value.match(/^([0-9a-f-]{36})\/([a-z-]+)-\d{10,16}\.([a-z]+)$/);
  return match && match[1] === userId && match[2] === prefix && extensions.includes(match[3]) ? value : null;
}

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
    expertise: allowed(formData.getAll('expertise'), GUIDE_EXPERTISE.map((e) => e.id)),
    female_guide: formData.get('female_guide') === 'on',
    open_to_partners: formData.get('open_to_partners') === 'on',
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
    call_enabled: formData.get('call_enabled') === 'on',
    call_price_usd: int(formData, 'call_price_usd'),
    call_minutes: Math.min(Math.max(int(formData, 'call_minutes') ?? 45, 15), 180),
    call_topics: allowed(formData.getAll('call_topics'), CALL_TOPICS.map((c) => c.id)),
  };

  // The browser uploads the photo straight into the user's folder in the avatars bucket and sends
  // only its path here (phone photos are too big to pass through a Server Action).
  const photoPath = ownPath(formData, 'photo_path', user.id, 'avatar', ['jpg', 'png', 'webp']);
  if (photoPath) Object.assign(guide, { photo_url: supabase.storage.from('avatars').getPublicUrl(photoPath).data.publicUrl });

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
  // Same for the ID document, in the private verification bucket.
  const idPath = ownPath(formData, 'id_document_path', user.id, 'guide-id', ['jpg', 'png', 'webp', 'pdf']);
  if (idPath) privateData.id_document_path = idPath;
  const licencePath = ownPath(formData, 'license_document_path', user.id, 'guide-licence', ['jpg', 'png', 'webp', 'pdf']);
  if (licencePath) privateData.license_document_path = licencePath;
  const firstAidPath = ownPath(formData, 'first_aid_document_path', user.id, 'guide-first-aid', ['jpg', 'png', 'webp', 'pdf']);
  if (firstAidPath) privateData.first_aid_document_path = firstAidPath;

  const { error: privateError } = await supabase.from('guide_private').upsert(privateData);
  if (privateError) redirect(`${back}?error=save`);

  // A new document has not been looked at yet, so its public check comes off until an admin checks it again.
  const cleared = {
    ...(idPath ? { identity_checked_at: null } : {}),
    ...(licencePath ? { licence_checked_at: null } : {}),
    ...(firstAidPath ? { first_aid_checked_at: null } : {}),
  };
  if (Object.keys(cleared).length > 0) await supabase.from('guides').update(cleared).eq('id', saved.id);

  revalidateTag('guides', 'max');
  redirect(`${back}?saved=1`);
}
