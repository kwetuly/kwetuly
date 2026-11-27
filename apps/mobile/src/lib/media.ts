import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';
import {
  MEDIA_COLUMNS,
  MEDIA_STAGING_BUCKET,
  PHOTO_CONSENT_VERSION,
  UPLOAD_SPECS,
  mediaErrorCode,
  mediaErrorCodes,
  type MediaErrorCode,
  type MediaField,
  type MediaItem,
  type MediaSubjectKind,
} from '@kwetuly/shared';
import { supabase } from './supabase';

// The one upload system in the app (slice S4), the same tables and rules as the website's
// apps/web/src/lib/media.ts: the database makes the row and checks the stored files; the files go
// to the PRIVATE `media-staging` bucket through signed upload URLs for exactly the row's two names,
// with progress. The `media-finish` Edge Function then checks the bytes, removes metadata and only
// then publishes the photo (security review M1).

export class MediaError extends Error {
  constructor(public code: MediaErrorCode) {
    super(code);
  }
}

const fail = (message: string | null | undefined): never => {
  throw new MediaError(mediaErrorCode(message));
};

export async function loadMedia(subjectKind: MediaSubjectKind, subjectId: string, fields: MediaField[]): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from('media')
    .select(MEDIA_COLUMNS)
    .eq('subject_kind', subjectKind)
    .eq('subject_id', subjectId)
    .in('field', fields)
    .not('state', 'in', '(removed,uploading)')
    .order('sort');
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaItem[];
}

export type UploadTarget = { id: string; bucket: string; url: string; thumbUrl: string };

async function sign(id: string, bucket: string, path: string, thumbPath: string): Promise<UploadTarget> {
  const storage = supabase.storage.from(bucket);
  const [main, thumb] = await Promise.all([storage.createSignedUploadUrl(path), storage.createSignedUploadUrl(thumbPath)]);
  if (main.error || thumb.error || !main.data || !thumb.data) fail(main.error?.message ?? thumb.error?.message);
  return { id, bucket, url: main.data!.signedUrl, thumbUrl: thumb.data!.signedUrl };
}

export async function startUpload(input: { field: MediaField; subjectKind: MediaSubjectKind; subjectId: string; mimeType: string }): Promise<UploadTarget> {
  const { data, error } = await supabase
    .rpc('start_media_upload', {
      p_field: input.field,
      p_subject_kind: input.subjectKind,
      p_subject_id: input.subjectId,
      p_ext: input.mimeType === 'image/webp' ? 'webp' : 'jpg',
      p_consent_version: UPLOAD_SPECS[input.field].needsConsent ? PHOTO_CONSENT_VERSION : null,
    })
    .single<{ id: string; bucket: string; path: string; thumb_path: string }>();
  if (error || !data) fail(error?.message);
  return sign(data!.id, MEDIA_STAGING_BUCKET, data!.path, data!.thumb_path);
}

/** New signed URLs for a row that is still uploading ("Try again"). */
export async function resumeUpload(id: string): Promise<UploadTarget> {
  const { data, error } = await supabase.from('media').select('id, field, path, thumb_path, state').eq('id', id).maybeSingle<{ id: string; field: MediaField; path: string; thumb_path: string; state: string }>();
  if (error) fail(error.message);
  if (!data || data.state !== 'uploading') throw new MediaError('file_missing');
  return sign(data.id, MEDIA_STAGING_BUCKET, data.path, data.thumb_path);
}

/** Sends one file to its signed URL with progress (0 to 1). A file already stored counts as done. */
export async function putFile(url: string, uri: string, mimeType: string, onProgress: (share: number) => void): Promise<void> {
  const task = createUploadTask(
    url,
    uri,
    { httpMethod: 'PUT', uploadType: FileSystemUploadType.BINARY_CONTENT, headers: { 'Content-Type': mimeType, 'x-upsert': 'false', 'cache-control': 'max-age=3600' } },
    (data) => onProgress(data.totalBytesExpectedToSend > 0 ? data.totalBytesSent / data.totalBytesExpectedToSend : 0),
  );
  let result;
  try {
    result = await task.uploadAsync();
  } catch {
    throw new MediaError('network');
  }
  if (!result) throw new MediaError('network');
  if (result.status >= 200 && result.status < 300) return;
  if (/Duplicate|already exists/i.test(result.body ?? '')) return;
  throw new MediaError(result.status === 413 ? 'file_too_big' : 'file_missing');
}

async function removeFiles(bucket: string | null | undefined, paths: string[] | null | undefined) {
  // If this fails the hourly sweep deletes the files.
  if (bucket && paths?.length) await supabase.storage.from(bucket).remove(paths).catch(() => undefined);
}

/** After both files are in staging: the media-finish function checks and publishes them (it reads the real size from the file). */
export async function finishUpload(id: string): Promise<{ item: MediaItem; replaced: string[] }> {
  const { data, error } = await supabase.functions.invoke('media-finish', { body: { id, placeholder: null } });
  let result = (data ?? {}) as { ok?: boolean; error?: string; replaced?: string[] };
  if (error) {
    const response = 'context' in error ? (error.context as Response | undefined) : undefined;
    result = ((await response?.json?.().catch(() => ({}))) ?? {}) as typeof result;
    if (!response) throw new MediaError('network');
  }
  if (result.ok !== true) {
    throw new MediaError((mediaErrorCodes as readonly string[]).includes(result.error ?? '') ? (result.error as MediaErrorCode) : 'generic');
  }
  const { data: row, error: readError } = await supabase.from('media').select(MEDIA_COLUMNS).eq('id', id).single<MediaItem>();
  if (readError || !row) fail(readError?.message);
  if (row!.state === 'removed') throw new MediaError('file_type');
  return { item: row!, replaced: result.replaced ?? [] };
}

export async function reorderMedia(subjectKind: MediaSubjectKind, subjectId: string, field: MediaField, ids: string[]) {
  const { error } = await supabase.rpc('reorder_media', { p_subject_kind: subjectKind, p_subject_id: subjectId, p_field: field, p_ids: ids });
  if (error) fail(error.message);
}

export async function removeMedia(id: string) {
  const { data, error } = await supabase.rpc('remove_my_media', { p_id: id }).single<{ bucket: string; staging: string; paths: string[] }>();
  if (error || !data) fail(error?.message);
  await removeFiles(data!.bucket, data!.paths);
  await removeFiles(data!.staging, data!.paths);
}
