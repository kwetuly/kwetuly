'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { REGIONS } from '@kwetuly/shared';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function adminOnly(formData: FormData): Promise<Locale> {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  return locale;
}

const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);

// Create or update a news item for travellers.
export async function saveTravelNews(formData: FormData) {
  const locale = await adminOnly(formData);
  const id = text(formData, 'id', 40);
  const region = text(formData, 'region', 80);
  const sourceUrl = text(formData, 'source_url', 400);
  const day = text(formData, 'published_on', 10);
  const row = {
    title: text(formData, 'title', 160),
    body: text(formData, 'body', 8000),
    region: (REGIONS as readonly string[]).includes(region) ? region : null,
    source_name: text(formData, 'source_name', 120) || null,
    source_url: /^https:\/\/\S+$/.test(sourceUrl) ? sourceUrl : null,
    published: formData.get('published') === 'on',
    published_on: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10),
  };
  const back = `/${locale}/admin/news`;
  if (row.title.length < 5 || row.body.length < 20) redirect(`${back}?error=1`);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('travel_news').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    : await supabase.from('travel_news').insert(row);
  revalidateTag('news', 'max');
  redirect(`${back}?${error ? 'error' : 'saved'}=1`);
}

export async function deleteTravelNews(formData: FormData) {
  const locale = await adminOnly(formData);
  const supabase = await createClient();
  await supabase.from('travel_news').delete().eq('id', text(formData, 'id', 40));
  revalidateTag('news', 'max');
  redirect(`/${locale}/admin/news?deleted=1`);
}

// Field news for guides lives in the Hub posts.
export async function deleteFieldNews(formData: FormData) {
  const locale = await adminOnly(formData);
  const supabase = await createClient();
  await supabase.from('hub_posts').delete().eq('id', text(formData, 'id', 40)).eq('kind', 'news');
  redirect(`/${locale}/admin/news?deleted=1#guides`);
}
