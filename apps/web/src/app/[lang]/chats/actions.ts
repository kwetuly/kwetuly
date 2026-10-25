'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const localeOf = (formData: FormData): Locale => {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
};
const field = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export async function createChat(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const name = field(formData, 'name', 80);
  if (!name) redirect(`/${locale}/chats?error=1`);

  const id = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from('group_chats').insert({ id, name, created_by: user.id });
  redirect(error ? `/${locale}/chats?error=1` : `/${locale}/chats/${id}`);
}

// Accepts a bare invite code or a full invite link.
export async function joinChat(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const raw = field(formData, 'code', 300);
  const code = raw.split('/').filter(Boolean).pop() ?? '';
  if (!/^[0-9a-f]{18}$/.test(code)) redirect(`/${locale}/chats?joinError=1`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_group_chat', { p_code: code });
  redirect(error || !data ? `/${locale}/chats?joinError=1` : `/${locale}/chats/${data}`);
}

// Text and/or a photo/video the browser already uploaded to this chat's folder.
// Returns { ok: false } when the message could not be saved, so the composer keeps the text.
export async function sendChatMessage(formData: FormData): Promise<{ ok: false } | void> {
  const locale = localeOf(formData);
  await requireUser(locale);
  const chatId = field(formData, 'chat_id', 40);
  if (!isId(chatId)) redirect(`/${locale}/chats`);
  const body = field(formData, 'body', 4000);
  const mediaPath = field(formData, 'media_path', 300) || null;
  const mediaType = field(formData, 'media_type', 10);
  const media = mediaPath && mediaPath.startsWith(`${chatId}/`) && (mediaType === 'image' || mediaType === 'video');
  if (!body && !media) redirect(`/${locale}/chats/${chatId}`);

  const supabase = await createClient();
  const { error } = await supabase.from('group_chat_messages').insert({
    chat_id: chatId,
    body: body || null,
    media_path: media ? mediaPath : null,
    media_type: media ? mediaType : null,
    share_public: formData.get('share_public') === 'on',
    // The database fills in the real sender from the session.
    sender_id: (await supabase.auth.getUser()).data.user!.id,
    sender_name: 'self',
  });
  if (error) return { ok: false };
  redirect(`/${locale}/chats/${chatId}#end`);
}

// The sender says whether Kwetuly may use their photo, video or tip publicly.
export async function setShareConsent(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const chatId = field(formData, 'chat_id', 40);
  const supabase = await createClient();
  await supabase
    .from('group_chat_messages')
    .update({ share_public: formData.get('share_public') === 'true' })
    .eq('id', field(formData, 'message_id', 40));
  // Consent changes take effect on the public gallery immediately, not after the cache refreshes.
  updateTag('moments');
  redirect(`/${locale}/chats/${chatId}#m-${field(formData, 'message_id', 40)}`);
}

// Anyone in the chat can block public use of an item they appear in (or allow it again).
export async function setObjection(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const chatId = field(formData, 'chat_id', 40);
  const messageId = field(formData, 'message_id', 40);
  const supabase = await createClient();
  if (formData.get('object') === 'true') {
    await supabase.from('group_chat_objections').insert({ message_id: messageId, user_id: user.id });
  } else {
    await supabase.from('group_chat_objections').delete().eq('message_id', messageId).eq('user_id', user.id);
  }
  // Consent changes take effect on the public gallery immediately, not after the cache refreshes.
  updateTag('moments');
  redirect(`/${locale}/chats/${chatId}#m-${messageId}`);
}

export async function leaveChat(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const supabase = await createClient();
  await supabase.from('group_chat_members').delete().eq('chat_id', field(formData, 'chat_id', 40)).eq('user_id', user.id);
  redirect(`/${locale}/chats`);
}

// Senders can delete their own message; a photo or video is removed from storage too.
export async function deleteChatMessage(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const chatId = field(formData, 'chat_id', 40);
  const messageId = field(formData, 'message_id', 40);
  const supabase = await createClient();
  const { data: message } = await supabase
    .from('group_chat_messages')
    .select('media_path')
    .eq('id', messageId)
    .eq('sender_id', user.id)
    .maybeSingle();
  if (message?.media_path) await supabase.storage.from('chat-media').remove([message.media_path]);
  await supabase.from('group_chat_messages').delete().eq('id', messageId).eq('sender_id', user.id);
  updateTag('moments');
  redirect(`/${locale}/chats/${chatId}`);
}

// Turn chat alerts (push and email) off or on for yourself.
export async function setMuted(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const chatId = field(formData, 'chat_id', 40);
  if (!isId(chatId)) redirect(`/${locale}/chats`);
  const supabase = await createClient();
  await supabase.from('group_chat_members').update({ muted: formData.get('muted') === 'true' }).eq('chat_id', chatId).eq('user_id', user.id);
  redirect(`/${locale}/chats/${chatId}`);
}
