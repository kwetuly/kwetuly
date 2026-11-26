'use server';

// Server actions for the one upload system (slice S4, migration 20261126000100_media_uploads.sql).
// They run with the signed-in person's own session: the database guard and the storage policies
// decide what is allowed, never this file. Files go from the browser straight to Storage through
// signed upload URLs made here for exactly the row's two names, so photos never pass through this server.
import {
  MEDIA_COLUMNS,
  PHOTO_CONSENT_VERSION,
  UPLOAD_SPECS,
  mediaErrorCode,
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

type Fail = { ok: false; error: MediaErrorCode };
export type UploadTarget = { ok: true; id: string; bucket: string; url: string; thumbUrl: string };

const fail = (message: string | null | undefined): Fail => ({ ok: false, error: mediaErrorCode(message) });

async function signTargets(supabase: Awaited<ReturnType<typeof createClient>>, id: string, bucket: string, path: string, thumbPath: string): Promise<UploadTarget | Fail> {
  const storage = supabase.storage.from(bucket);
  const [main, thumb] = await Promise.all([storage.createSignedUploadUrl(path), storage.createSignedUploadUrl(thumbPath)]);
  if (main.error || thumb.error || !main.data || !thumb.data) return fail(main.error?.message ?? thumb.error?.message);
  return { ok: true, id, bucket, url: main.data.signedUrl, thumbUrl: thumb.data.signedUrl };
}

/** Makes the row (state uploading) and returns two signed upload URLs. */
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
  return signTargets(supabase, data.id, data.bucket, data.path, data.thumb_path);
}

/** New signed URLs for a row that is still uploading ("Try again" after a dropped connection). */
export async function resumeUpload(id: string): Promise<UploadTarget | Fail> {
  if (!UUID.test(id)) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('media').select('id, field, path, thumb_path, state').eq('id', id).maybeSingle<{ id: string; field: MediaField; path: string; thumb_path: string; state: string }>();
  if (error) return fail(error.message);
  if (!data || data.state !== 'uploading') return { ok: false, error: 'file_missing' };
  return signTargets(supabase, data.id, UPLOAD_SPECS[data.field].bucket, data.path, data.thumb_path);
}

async function removeFiles(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string | null | undefined, paths: string[] | null | undefined) {
  // If this fails the hourly sweep deletes the files.
  if (bucket && paths?.length) await supabase.storage.from(bucket).remove(paths).catch(() => undefined);
}

/** After both files are stored: the database checks them and shows the photo. */
export async function finishUpload(input: { id: string; width: number; height: number; placeholder: string | null }): Promise<{ ok: true; item: MediaItem; replaced: string[] } | Fail> {
  if (!UUID.test(input.id)) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('finish_media_upload', { p_id: input.id, p_width: Math.round(input.width), p_height: Math.round(input.height), p_placeholder: input.placeholder })
    .single<{ state: string; replaced_bucket: string; replaced_paths: string[] }>();
  if (error || !data) return fail(error?.message);
  await removeFiles(supabase, data.replaced_bucket, data.replaced_paths);
  const { data: row, error: readError } = await supabase.from('media').select(MEDIA_COLUMNS).eq('id', input.id).single<MediaItem>();
  if (readError || !row) return fail(readError?.message);
  return { ok: true, item: row, replaced: data.replaced_paths ?? [] };
}

/** Saves the order; the first photo is the main photo. */
export async function reorderMedia(input: { subjectKind: MediaSubjectKind; subjectId: string; field: MediaField; ids: string[] }): Promise<{ ok: true } | Fail> {
  if (!mediaFields.includes(input.field) || !mediaSubjectKinds.includes(input.subjectKind) || !UUID.test(input.subjectId)) return { ok: false, error: 'not_yours' };
  if (!input.ids.length || input.ids.length > 20 || !input.ids.every((id) => UUID.test(id))) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reorder_media', { p_subject_kind: input.subjectKind, p_subject_id: input.subjectId, p_field: input.field, p_ids: input.ids });
  return error ? fail(error.message) : { ok: true };
}

/** Removes one of your photos (also a failed upload) and deletes its files. */
export async function removeMedia(id: string): Promise<{ ok: true } | Fail> {
  if (!UUID.test(id)) return { ok: false, error: 'not_yours' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('remove_my_media', { p_id: id }).single<{ bucket: string; paths: string[] }>();
  if (error || !data) return fail(error?.message);
  await removeFiles(supabase, data.bucket, data.paths);
  return { ok: true };
}
