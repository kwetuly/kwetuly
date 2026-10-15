'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { PACKAGE_KINDS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

const text = (formData: FormData, key: string, max: number) => {
  const value = String(formData.get(key) ?? '').trim().slice(0, max);
  return value || null;
};

const whole = (formData: FormData, key: string, min: number, max: number) => {
  const n = Number.parseInt(String(formData.get(key) ?? ''), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** A photo the browser uploaded into this user's avatars folder, e.g. "<user id>/package-1791234567890.jpg". */
function ownPhoto(formData: FormData, userId: string) {
  const value = String(formData.get('photo_path') ?? '');
  const match = value.match(/^([0-9a-f-]{36})\/package-\d{10,16}\.(jpg|png|webp)$/);
  return match && match[1] === userId ? value : null;
}

// Creates or updates one of the signed-in guide's packages. The database keeps it out of sight
// until an admin approves it, and sends an approved package back for review when it changes.
export async function savePackage(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const back = `/${locale}/dashboard/packages`;
  const id = String(formData.get('id') ?? '');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data: guide } = await supabase.from('guides').select('id').eq('owner_id', user.id).maybeSingle<{ id: string }>();
  if (!guide) redirect(`/${locale}/dashboard`);

  const kind = String(formData.get('kind') ?? '');
  const title = text(formData, 'title', 120);
  const summary = text(formData, 'summary', 500);
  if (!PACKAGE_KINDS.some((k) => k.id === kind) || !title || title.length < 3 || !summary || summary.length < 10) {
    redirect(`${back}?${id ? `edit=${id}&` : 'new=1&'}error=missing`);
  }
  const price = Number.parseFloat(String(formData.get('price_usd') ?? ''));

  const row: Record<string, unknown> = {
    kind,
    title,
    summary,
    details: text(formData, 'details', 4000),
    duration_hours: whole(formData, 'duration_hours', 1, 24),
    duration_days: whole(formData, 'duration_days', 1, 30),
    price_usd: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null,
    price_per: formData.get('price_per') === 'group' ? 'group' : 'person',
    max_group: whole(formData, 'max_group', 1, 60),
    includes: (text(formData, 'includes', 1500) ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 15),
    meeting_point: text(formData, 'meeting_point', 200),
    status: formData.get('draft') ? 'draft' : 'pending',
  };
  const photoPath = ownPhoto(formData, user.id);
  if (photoPath) row.photo_url = supabase.storage.from('avatars').getPublicUrl(photoPath).data.publicUrl;

  const { error } = id
    ? await supabase.from('guide_packages').update(row).eq('id', id).eq('guide_id', guide.id)
    : await supabase.from('guide_packages').insert({ ...row, guide_id: guide.id });
  if (error) redirect(`${back}?${id ? `edit=${id}&` : 'new=1&'}error=save`);

  revalidateTag('packages', 'max');
  redirect(`${back}?saved=1`);
}

export async function deletePackage(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  // Row-level security only lets the guide who owns the package (or an admin) delete it.
  await supabase.from('guide_packages').delete().eq('id', id);
  revalidateTag('packages', 'max');
  redirect(`/${locale}/dashboard/packages`);
}
