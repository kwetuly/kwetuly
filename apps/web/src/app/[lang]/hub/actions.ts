'use server';

import { redirect } from 'next/navigation';
import { REGIONS } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
}

const field = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);

// Re-check access in every action; the database policies enforce it as well.
async function hubUser(locale: string) {
  const user = await getCurrentUser();
  if (!user?.canUseHub) redirect(`/${locale}/dashboard`);
  return user;
}

export async function createPost(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await hubUser(locale);
  const kind = formData.get('kind') === 'news' && user.role === 'admin' ? 'news' : 'forum';
  const back = `/${locale}/hub/${kind === 'news' ? 'news' : 'forum'}`;
  const region = field(formData, 'region', 60);

  const post = {
    author_id: user.id,
    kind,
    title: field(formData, 'title', 160),
    body: field(formData, 'body', 6000),
    region: (REGIONS as readonly string[]).includes(region) ? region : null,
    source: kind === 'news' ? field(formData, 'source', 120) || null : null,
  };
  if (!post.title || !post.body) redirect(`${back}?error=1`);

  const supabase = await createClient();
  const { data, error } = await supabase.from('hub_posts').insert(post).select('id').single();
  if (error || !data) redirect(`${back}?error=1`);
  redirect(kind === 'forum' ? `/${locale}/hub/forum/${data.id}` : back);
}

export async function createReply(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await hubUser(locale);
  const postId = field(formData, 'post_id', 40);
  const body = field(formData, 'body', 3000);
  const back = `/${locale}/hub/forum/${postId}`;
  if (!body) redirect(back);

  const supabase = await createClient();
  await supabase.from('hub_replies').insert({ post_id: postId, author_id: user.id, body });
  redirect(`${back}#replies`);
}

// Guide accepts (with time and link) or declines a traveller's call request.
export async function respondToCall(formData: FormData) {
  const locale = localeFrom(formData);
  await hubUser(locale);
  const decision = formData.get('decision') === 'accept' ? 'accepted' : 'declined';
  const scheduled = field(formData, 'scheduled_at', 30);
  const link = field(formData, 'meeting_link', 300);

  const update: Record<string, string | null> = { status: decision };
  if (decision === 'accepted') {
    const when = scheduled ? new Date(scheduled) : null;
    update.scheduled_at = when && !Number.isNaN(when.getTime()) ? when.toISOString() : null;
    update.meeting_link = /^https:\/\/\S+$/i.test(link) ? link : null;
  }

  // RLS only lets the guide who received the request update it.
  const supabase = await createClient();
  await supabase.from('call_requests').update(update).eq('id', field(formData, 'call_id', 40));
  redirect(`/${locale}/hub#calls`);
}
