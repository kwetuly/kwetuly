'use server';

// Server actions for the one upload system (slice S4, migration 20261126000100_media_uploads.sql).
// They run with the signed-in person's own session: the database guard and the storage policies
// decide what is allowed, never this file. Files go from the browser straight to the PRIVATE
// `media-staging` bucket through signed upload URLs for exactly the row's two names. Finishing goes
// through the `media-finish` Edge Function (the person's own token), which checks the bytes, removes
// metadata and only then publishes the photo (security review M1).
import {
  MEDIA_COLUMNS,
  MEDIA_STAGING_BUCKET,
  PHOTO_CONSENT_VERSION,
  UPLOAD_SPECS,
  mediaErrorCode,
  mediaErrorCodes,
  mediaFields,
  mediaSubjectKinds,
  type MediaErrorCode,
  type MediaField,
  type MediaItem,
  type MediaSubjectKind,
} from '@kwetuly/shared';
import { getCurrentUser } from './auth';
import { createClient } from './supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINISH_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/media-finish`;

type Fail = { ok: false; error: MediaErrorCode };
export type UploadTarget = { ok: true; id: string; bucket: string; url: string; thumbUrl: string };

const fail = (message: string | null | undefined): Fail => ({ ok: false, error: mediaErrorCode(message) });

async function signTargets(supabase: Awaited<ReturnType<typeof createClient>>, id: string, path: string, thumbPath: string): Promise<UploadTarget | Fail> {
  const storage = supabase.storage.from(MEDIA_STAGING_BUCKET);
  const [main, thumb] = await Promise.all([storage.createSignedUploadUrl(path), storage.createSignedUploadUrl(thumbPath)]);
  if (main.error || thumb.error || !main.data || !thumb.data) return fail(main.error?.message ?? thumb.error?.message);
  return { ok: true, id, bucket: MEDIA_STAGING_BUCKET, url: main.data.signedUrl, thumbUrl: thumb.data.signedUrl };
}

/** Makes the row (state uploading) and returns two signed upload URLs in the staging bucket. */
export async function startUpload(input: { field: MediaField; subjectKind: MediaSubjectKind; subjectId: string; mime: string; consent: boolean }): Promise<UploadTarget | Fail> {
  if (!mediaFields.includes(input.field) || !mediaSubjectKinds.includes(input.subjectKind) || !UUID.test(input.subjectId)) return { ok: false, error: 'not_yours' };
  if (input.mime !== 'image/webp' && input.mime !== 'image/jpeg') return { ok: false, error: 'file_type' };
  if (UPLOAD_SPECS[input.field].needsConsent && !input.consent) return { ok: false, error: 'generic' };
  if (!(await getCurrentUser())) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('start_media_upload', {
      p_field: input.field,
      p_subject_kind: input.subjectKind,
      p_subject_id: input.subjectId,
      p_ext: input.mime === 'image/webp' ? 'webp' : 'jpg',
      p_consent_version: UPLOAD_SPECS[input.field].needsConsent ? PHOTO_CONSENT_VERSION : null,
    })
    .single<{ id: string; bucket: string; path: string; thumb_path: string }>();
  if (error || !data) return fail(error?.message);
  return signTargets(supabase, data.id, data.path, data.thumb_path);
}

/** New signed URLs for a row that is still uploading ("Try again" after a dropped connection). */
export async function resumeUpload(id: string): Promise<UploadTarget | Fail> {
  if (!UUID.test(id)) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('media').select('id, path, thumb_path, state').eq('id', id).maybeSingle<{ id: string; path: string; thumb_path: string; state: string }>();
  if (error) return fail(error.message);
  if (!data || data.state !== 'uploading') return { ok: false, error: 'file_missing' };
  return signTargets(supabase, data.id, data.path, data.thumb_path);
}

async function removeFiles(supabase: Awaited<ReturnType<typeof createClient>>, buckets: (string | null | undefined)[], paths: string[] | null | undefined) {
  // If this fails the hourly sweep deletes the files.
  if (!paths?.length) return;
  for (const bucket of new Set(buckets.filter(Boolean) as string[])) await supabase.storage.from(bucket).remove(paths).catch(() => undefined);
}

/** After both files are in staging: the media-finish function checks and publishes them. */
export async function finishUpload(input: { id: string; placeholder: string | null }): Promise<{ ok: true; item: MediaItem; replaced: string[] } | Fail> {
  if (!UUID.test(input.id)) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { ok: false, error: 'not_yours' };
  let json: { ok?: boolean; error?: string; replaced?: string[] } = {};
  try {
    const res = await fetch(FINISH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: input.id, placeholder: input.placeholder }),
      cache: 'no-store',
    });
    json = ((await res.json().catch(() => ({}))) ?? {}) as typeof json;
  } catch {
    return { ok: false, error: 'network' };
  }
  if (json.ok !== true) {
    const code = (mediaErrorCodes as readonly string[]).includes(json.error ?? '') ? (json.error as MediaErrorCode) : 'generic';
    return { ok: false, error: code };
  }
  const { data: row, error: readError } = await supabase.from('media').select(MEDIA_COLUMNS).eq('id', input.id).single<MediaItem>();
  if (readError || !row) return fail(readError?.message);
  if (row.state === 'removed') return { ok: false, error: 'file_type' };
  return { ok: true, item: row, replaced: json.replaced ?? [] };
}

/** Saves the order; the first photo is the main photo. */
export async function reorderMedia(input: { subjectKind: MediaSubjectKind; subjectId: string; field: MediaField; ids: string[] }): Promise<{ ok: true } | Fail> {
  if (!mediaFields.includes(input.field) || !mediaSubjectKinds.includes(input.subjectKind) || !UUID.test(input.subjectId)) return { ok: false, error: 'not_yours' };
  if (!input.ids.length || input.ids.length > 20 || !input.ids.every((id) => UUID.test(id))) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reorder_media', { p_subject_kind: input.subjectKind, p_subject_id: input.subjectId, p_field: input.field, p_ids: input.ids });
  return error ? fail(error.message) : { ok: true };
}

/** Removes one of your photos (also a failed upload) and deletes its files in both places. */
export async function removeMedia(id: string): Promise<{ ok: true } | Fail> {
  if (!UUID.test(id)) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('remove_my_media', { p_id: id }).single<{ bucket: string; staging: string; paths: string[] }>();
  if (error || !data) return fail(error?.message);
  await removeFiles(supabase, [data.bucket, data.staging], data.paths);
  return { ok: true };
}
