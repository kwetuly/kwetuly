// Profile links (slice S5): the links on a guide's page, the guide's and business owner's own links,
// and the feature.profile_links switch. Saves go straight to Supabase with the signed-in session, so
// row level security limits them to the caller's own guide profile or business, and the database
// checks every link's stored form (supabase/migrations/20261126000200_profile_links.sql). The app
// cleans each link first with the same shared rules.
import {
  BUSINESS_LINK_KINDS,
  GUIDE_LINK_KINDS,
  PROFILE_LINK_COLUMNS,
  SWITCHED_GUIDE_LINK_KINDS,
  normaliseProfileLink,
  profileLinkErrorCode,
  type ProfileLinkColumn,
  type ProfileLinkErrorCode,
  type ProfileLinkKind,
} from '@kwetuly/shared';
import { supabase } from './supabase';

export type LinkRow = Partial<Record<ProfileLinkColumn, string | null>>;

const SOCIAL_COLUMNS = 'instagram_url, facebook_url, tiktok_url';
const NEW_COLUMNS = 'google_business_url, youtube_url';

/** feature.profile_links: a missing row is off, like private.feature_on. */
export async function profileLinksOn(): Promise<boolean> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'feature.profile_links').maybeSingle<{ value: { on?: unknown } | null }>();
  return data?.value?.on === true;
}

/**
 * An approved guide's stored links for their public page. Until 20261126000200 is applied the new
 * columns do not exist, so the old three are read and the screen keeps working.
 */
export async function getGuideLinks(guideId: string): Promise<LinkRow> {
  const full = await supabase
    .from('guides')
    .select(`${SOCIAL_COLUMNS}, ${NEW_COLUMNS}, website`)
    .eq('id', guideId)
    .eq('verification_status', 'approved')
    .maybeSingle<LinkRow>();
  if (!full.error) return full.data ?? {};
  const old = await supabase.from('guides').select(SOCIAL_COLUMNS).eq('id', guideId).eq('verification_status', 'approved').maybeSingle<LinkRow>();
  if (old.error) throw new Error(old.error.message);
  return old.data ?? {};
}

export type MyLinks = {
  on: boolean;
  guide: (LinkRow & { id: string }) | null;
  businesses: (LinkRow & { id: string; business_name: string })[];
};

/** The signed-in member's own guide profile and businesses, with their links. */
export async function getMyLinks(userId: string): Promise<MyLinks> {
  const [guide, providers, on] = await Promise.all([
    supabase.from('guides').select(`id, ${SOCIAL_COLUMNS}, ${NEW_COLUMNS}, website`).eq('owner_id', userId).maybeSingle<LinkRow & { id: string }>(),
    supabase.from('providers').select(`id, business_name, ${SOCIAL_COLUMNS}, ${NEW_COLUMNS}`).eq('owner_id', userId).order('created_at').limit(10),
    profileLinksOn(),
  ]);
  if (guide.error) throw new Error(guide.error.message);
  if (providers.error) throw new Error(providers.error.message);
  return { on, guide: guide.data ?? null, businesses: (providers.data ?? []) as MyLinks['businesses'] };
}

export type SaveResult = { ok: true } | { ok: false; error: ProfileLinkErrorCode; kind?: ProfileLinkKind };

/** Cleans each typed link; empty clears it. Stops at the first link that is not valid. */
function linkPatch(values: Partial<Record<ProfileLinkKind, string>>, kinds: readonly ProfileLinkKind[]): { ok: true; patch: Record<string, string | null> } | (SaveResult & { ok: false }) {
  const patch: Record<string, string | null> = {};
  for (const kind of kinds) {
    if (!(kind in values)) continue;
    const value = (values[kind] ?? '').trim();
    if (!value) {
      patch[PROFILE_LINK_COLUMNS[kind]] = null;
      continue;
    }
    const result = normaliseProfileLink(kind, value);
    if (!result.ok) return { ok: false, error: profileLinkErrorCode(kind, result.reason), kind };
    patch[PROFILE_LINK_COLUMNS[kind]] = result.url;
  }
  return { ok: true, patch };
}

const dbError = (error: { message?: string } | null): SaveResult => (error ? { ok: false, error: error.message?.includes('profile_links_off') ? 'pl_off' : 'pl_save' } : { ok: true });

/** Saves the guide's links. While the switch is off only Instagram, Facebook and TikTok are written. */
export async function saveGuideLinks(guideId: string, values: Partial<Record<ProfileLinkKind, string>>, on: boolean): Promise<SaveResult> {
  const kinds = on ? GUIDE_LINK_KINDS : GUIDE_LINK_KINDS.filter((kind) => !SWITCHED_GUIDE_LINK_KINDS.includes(kind));
  const cleaned = linkPatch(values, kinds);
  if (!cleaned.ok) return cleaned;
  if (Object.keys(cleaned.patch).length === 0) return { ok: true };
  const { error } = await supabase.from('guides').update(cleaned.patch).eq('id', guideId);
  return dbError(error);
}

/** Saves one business's links (only while the switch is on). */
export async function saveBusinessLinks(providerId: string, values: Partial<Record<ProfileLinkKind, string>>, on: boolean): Promise<SaveResult> {
  if (!on) return { ok: false, error: 'pl_off' };
  const cleaned = linkPatch(values, BUSINESS_LINK_KINDS);
  if (!cleaned.ok) return cleaned;
  if (Object.keys(cleaned.patch).length === 0) return { ok: true };
  const { error } = await supabase.from('providers').update(cleaned.patch).eq('id', providerId);
  return dbError(error);
}
