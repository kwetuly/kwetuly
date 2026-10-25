import { PACKAGE_COLUMNS, type GuidePackage, type PackageKind } from '@kwetuly/shared';
import { supabase } from '@/lib/supabase';

// Guide packages, the same rules as the website: visitors only get approved packages of approved
// guides; a guide sees and edits their own; the database keeps new or changed packages for review.

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getGuidePackages(guideId: string): Promise<GuidePackage[]> {
  const { data, error } = await supabase
    .from('guide_packages')
    .select(PACKAGE_COLUMNS)
    .eq('guide_id', guideId)
    .eq('status', 'approved')
    .order('sort_order')
    .order('created_at');
  check(error);
  return (data ?? []) as GuidePackage[];
}

export async function listMyPackages(guideId: string): Promise<GuidePackage[]> {
  const { data, error } = await supabase.from('guide_packages').select(PACKAGE_COLUMNS).eq('guide_id', guideId).order('sort_order').order('created_at');
  check(error);
  return (data ?? []) as GuidePackage[];
}

export type PackageInput = {
  kind: PackageKind;
  title: string;
  summary: string;
  details: string | null;
  duration_hours: number | null;
  duration_days: number | null;
  price_usd: number | null;
  price_per: 'person' | 'group';
  max_group: number | null;
  includes: string[];
  meeting_point: string | null;
  status: 'draft' | 'pending';
};

/** Saves a package and its optional photo (uploaded to the guide's own avatars folder). */
export async function savePackage(guideId: string, userId: string, input: PackageInput, id?: string, photo?: { uri: string; mimeType: string }) {
  const row: Record<string, unknown> = { ...input };
  if (photo) {
    const path = `${userId}/package-${Date.now()}.jpg`;
    const body = await (await fetch(photo.uri)).arrayBuffer();
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, body, { contentType: photo.mimeType });
    check(uploadError);
    row.photo_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }
  const { error } = id
    ? await supabase.from('guide_packages').update(row).eq('id', id).eq('guide_id', guideId)
    : await supabase.from('guide_packages').insert({ ...row, guide_id: guideId });
  check(error);
}

export async function deletePackage(id: string) {
  const { error } = await supabase.from('guide_packages').delete().eq('id', id);
  check(error);
}

export type PackageWithGuide = GuidePackage & { guides: { id: string; display_name: string; slug: string } | null };

// Approved packages from all public guides, optionally of one kind, for the catalogue.
export async function listPackages(kind?: string): Promise<PackageWithGuide[]> {
  let query = supabase
    .from('guide_packages')
    .select(`${PACKAGE_COLUMNS}, guides!inner(id, display_name, slug, visibility)`)
    .eq('status', 'approved')
    .eq('guides.visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(60);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  check(error);
  return (data ?? []) as unknown as PackageWithGuide[];
}
