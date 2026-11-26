'use server';

import { redirect } from 'next/navigation';
import { updateTag } from 'next/cache';
import {
  BUSINESS_LINK_KINDS,
  GUIDE_LINK_KINDS,
  PROFILE_LINK_COLUMNS,
  SWITCHED_GUIDE_LINK_KINDS,
  normaliseProfileLink,
  profileLinkErrorCode,
  type ProfileLinkErrorCode,
  type ProfileLinkKind,
} from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireOnboarded } from '@/lib/auth';
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

/** feature.profile_links, read fresh for a save (missing row = off, like private.feature_on). */
async function linksOn(supabase: Supabase): Promise<boolean> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'feature.profile_links').maybeSingle<{ value: { on?: unknown } | null }>();
  return data?.value?.on === true;
}

/**
 * The cleaned value of each field in `kinds`: null clears it. A field that is not a valid link is
 * left out of the patch (the saved link stays) and its error code is returned.
 */
function linkPatch(formData: FormData, kinds: readonly ProfileLinkKind[]): { patch: Record<string, string | null>; error: ProfileLinkErrorCode | null } {
  const patch: Record<string, string | null> = {};
  let error: ProfileLinkErrorCode | null = null;
  for (const kind of kinds) {
    const field = `link_${kind}`;
    if (!formData.has(field)) continue;
    const value = String(formData.get(field) ?? '').trim();
    if (!value) {
      patch[PROFILE_LINK_COLUMNS[kind]] = null;
      continue;
    }
    const result = normaliseProfileLink(kind, value);
    if (result.ok) patch[PROFILE_LINK_COLUMNS[kind]] = result.url;
    else error ??= profileLinkErrorCode(kind, result.reason);
  }
  return { patch, error };
}

/** Maps a database refusal to the page's error codes. */
function saveError(error: { message?: string; code?: string } | null): ProfileLinkErrorCode | null {
  if (!error) return null;
  if (error.message?.includes('profile_links_off')) return 'pl_off';
  if (error.message?.includes('guides_website_format') || error.message?.includes('website_not_allowed')) return 'pl_website_blocked';
  return 'pl_save';
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
  redirect(`/${locale}/dashboard/links?saved=guide`);
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
