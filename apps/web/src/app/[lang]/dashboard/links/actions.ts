'use server';

import { redirect } from 'next/navigation';
import { updateTag } from 'next/cache';
import { BUSINESS_LINK_KINDS, GUIDE_LINK_KINDS, SWITCHED_GUIDE_LINK_KINDS } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireOnboarded } from '@/lib/auth';
import { signupReturn } from '@/lib/guide-steps';
import { linkPatch, linkSaveError as saveError, linksOn } from '@/lib/profile-link-form';
import { createClient } from '@/lib/supabase/server';
import type { FormResult } from '@/components/keep-form';

// Saves a guide's or a business's profile links (slice S5). Everything is checked here again with the
// shared rules (the browser check is only a help), the database checks the stored form once more, and
// row level security limits each save to the caller's own guide profile or business.

type Supabase = Awaited<ReturnType<typeof createClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function localeOf(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
}

/** The signed-in, onboarded member, or a redirect to sign in. */
async function member(supabase: Supabase, locale: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/dashboard/links`)}`);
  await requireOnboarded(user.id, locale, `/${locale}/dashboard/links`);
  return user;
}

export async function saveGuideLinks(_previous: FormResult, formData: FormData): Promise<FormResult> {
  const locale = localeOf(formData);
  const supabase = await createClient();
  const user = await member(supabase, locale);

  const { data: guide } = await supabase.from('guides').select('id').eq('owner_id', user.id).maybeSingle<{ id: string }>();
  if (!guide) return { error: 'pl_save' };

  // While the switch is off only Instagram, Facebook and TikTok are saved (the others are not touched).
  const on = await linksOn(supabase);
  const kinds = on ? GUIDE_LINK_KINDS : GUIDE_LINK_KINDS.filter((kind) => !SWITCHED_GUIDE_LINK_KINDS.includes(kind));
  const { patch, error } = linkPatch(formData, kinds);

  if (Object.keys(patch).length > 0) {
    const { error: dbError } = await supabase.from('guides').update(patch).eq('id', guide.id).eq('owner_id', user.id);
    const refused = saveError(dbError);
    if (refused) return { error: refused };
    updateTag('guides');
  }
  if (error) return { error };
  // Reached from the "Your page" sign-up step: keep the way back (only the step name, never an address).
  const next = signupReturn(formData.get('next'));
  redirect(`/${locale}/dashboard/links?saved=guide${next ? `&next=${next}` : ''}`);
}

export async function saveBusinessLinks(_previous: FormResult, formData: FormData): Promise<FormResult> {
  const locale = localeOf(formData);
  const supabase = await createClient();
  const user = await member(supabase, locale);

  const providerId = String(formData.get('provider_id') ?? '');
  if (!UUID.test(providerId)) return { error: 'pl_save' };
  const { data: business } = await supabase.from('providers').select('id').eq('id', providerId).eq('owner_id', user.id).maybeSingle<{ id: string }>();
  if (!business) return { error: 'pl_save' };
  if (!(await linksOn(supabase))) return { error: 'pl_off' };

  const { patch, error } = linkPatch(formData, BUSINESS_LINK_KINDS);
  if (Object.keys(patch).length > 0) {
    const { error: dbError } = await supabase.from('providers').update(patch).eq('id', business.id).eq('owner_id', user.id);
    const refused = saveError(dbError);
    if (refused) return { error: refused };
    updateTag('businesses');
  }
  if (error) return { error };
  redirect(`/${locale}/dashboard/links?saved=business`);
}
