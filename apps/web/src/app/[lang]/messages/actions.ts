'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireOnboarded } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
}

// Open (or create) the traveller's conversation with a guide.
export async function startConversation(formData: FormData) {
  const locale = localeFrom(formData);
  const guideId = String(formData.get('guide_id') ?? '');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, `/${locale}/messages`);

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('traveler_id', user.id)
    .eq('guide_id', guideId)
    .maybeSingle();
  if (existing) redirect(`/${locale}/messages/${existing.id}`);

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ traveler_id: user.id, guide_id: guideId })
    .select('id')
    .single();
  if (error || !created) redirect(`/${locale}/messages`);
  redirect(`/${locale}/messages/${created.id}`);
}

// Returns { ok: false } when the message could not be saved, so the composer keeps the text.
export async function sendMessage(formData: FormData): Promise<{ ok: false } | void> {
  const locale = localeFrom(formData);
  const conversationId = String(formData.get('conversation_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  const back = `/${locale}/messages/${conversationId}`;
  if (!body) redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, back);

  // The database hides contact details and alerts the other person.
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body });
  if (error) return { ok: false };
  redirect(`${back}#end`);
}

export async function reportMessage(formData: FormData) {
  const locale = localeFrom(formData);
  const conversationId = String(formData.get('conversation_id') ?? '');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  await supabase.from('message_reports').insert({
    message_id: String(formData.get('message_id') ?? ''),
    reporter_id: user.id,
    reason: String(formData.get('reason') ?? '').slice(0, 500) || null,
  });
  redirect(`/${locale}/messages/${conversationId}?reported=1`);
}
