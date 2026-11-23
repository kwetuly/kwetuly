'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function adminLocale(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  return locale;
}

export async function resolveReport(formData: FormData) {
  const locale = await adminLocale(formData);
  const supabase = await createClient();
  await supabase.from('message_reports').update({ resolved: true }).eq('id', String(formData.get('report_id') ?? ''));
  redirect(`/${locale}/admin/messages`);
}

export async function unlockConversation(formData: FormData) {
  const locale = await adminLocale(formData);
  const supabase = await createClient();
  // Business threads are never unlocked (the database refuses it too); guide threads only.
  const id = String(formData.get('conversation_id') ?? '');
  const { data: business, error } = await supabase.from('conversations').select('provider_id, was_business').eq('id', id).maybeSingle<{ provider_id: string | null; was_business: boolean }>();
  if (!error && (business?.provider_id || business?.was_business)) redirect(`/${locale}/admin/messages`);
  await supabase.from('conversations').update({ contact_unlocked: true }).eq('id', id);
  redirect(`/${locale}/admin/messages`);
}
