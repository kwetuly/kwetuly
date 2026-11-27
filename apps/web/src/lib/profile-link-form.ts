import 'server-only';
import { PROFILE_LINK_COLUMNS, normaliseProfileLink, profileLinkErrorCode, type ProfileLinkErrorCode, type ProfileLinkKind } from '@kwetuly/shared';
import type { createClient } from '@/lib/supabase/server';

// Profile link form handling (slice S5), shared by /dashboard/links and the "Your page" sign-up step
// (slice S8). Everything is checked here with the shared rules (the browser check is only a help),
// and the database checks the stored form once more.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** feature.profile_links, read fresh for a save (missing row = off, like private.feature_on). */
export async function linksOn(supabase: Supabase): Promise<boolean> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'feature.profile_links').maybeSingle<{ value: { on?: unknown } | null }>();
  return data?.value?.on === true;
}

/**
 * The cleaned value of each field in `kinds` that the form carries: null clears it. A field that is
 * not a valid link is left out of the patch (the saved link stays) and its error code is returned.
 */
export function linkPatch(formData: FormData, kinds: readonly ProfileLinkKind[]): { patch: Record<string, string | null>; error: ProfileLinkErrorCode | null } {
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

/** Maps a database refusal of a link to the page's error codes. */
export function linkSaveError(error: { message?: string; code?: string } | null): ProfileLinkErrorCode | null {
  if (!error) return null;
  if (error.message?.includes('profile_links_off')) return 'pl_off';
  if (error.message?.includes('guides_website_format') || error.message?.includes('website_not_allowed')) return 'pl_website_blocked';
  return 'pl_save';
}
