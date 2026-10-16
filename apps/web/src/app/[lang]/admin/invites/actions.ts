'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { generateInviteCode } from '@/lib/invite';
import { createClient } from '@/lib/supabase/server';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
}

async function requireAdminAction(locale: string) {
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
}

export type CreateInviteState = { code?: string; label?: string; error?: string } | null;

// Add an invite code. The new code is returned to this one page view only (never put in the URL,
// a log or analytics); the database keeps its hash. Admins may type their own code (10+ characters),
// e.g. to keep a code already handed out; otherwise a random one is made.
export async function createInviteCode(_prev: CreateInviteState, formData: FormData): Promise<CreateInviteState> {
  const locale = localeFrom(formData);
  await requireAdminAction(locale);

  const label = String(formData.get('label') ?? '').trim().slice(0, 80);
  const typed = String(formData.get('code') ?? '').trim();
  if (typed && (typed.length < 10 || typed.length > 64)) return { error: 'Your own code needs 10 to 64 characters. Leave it empty for a random one.' };
  const maxRaw = String(formData.get('max_uses') ?? '').trim();
  const maxUses = maxRaw ? Number.parseInt(maxRaw, 10) : null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)) return { error: 'Uses must be a whole number from 1 to 100000, or empty for no limit.' };

  const code = typed || generateInviteCode();
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_create_invite_code', { p_code: code, p_label: label, p_max_uses: maxUses });
  if (error) return { error: error.code === '23505' ? 'That code already exists.' : 'Could not add the code. Try again.' };
  revalidatePath(`/${locale}/admin/invites`);
  return { code, label };
}

export async function setInviteCodeActive(formData: FormData) {
  const locale = localeFrom(formData);
  await requireAdminAction(locale);
  const id = String(formData.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect(`/${locale}/admin/invites`);
  const supabase = await createClient();
  await supabase.rpc('admin_set_invite_code_active', { p_id: id, p_active: formData.get('active') === 'true' });
  redirect(`/${locale}/admin/invites`);
}

// The switch for the whole gate. Off = anyone can sign up (public launch).
export async function setInviteOnly(formData: FormData) {
  const locale = localeFrom(formData);
  await requireAdminAction(locale);
  const supabase = await createClient();
  await supabase.from('site_settings').upsert({ key: 'invite_only', value: { enabled: formData.get('enabled') === 'true' } });
  revalidateTag('settings', 'max');
  redirect(`/${locale}/admin/invites`);
}
