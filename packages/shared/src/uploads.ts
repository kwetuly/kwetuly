// One upload system (design docs/team/design-2026-11-24.md, section 9.2). The per-field rules live here
// once and are used by the website, the app and (mirrored) the SQL in
// supabase/migrations/20261126000100_media_uploads.sql; uploads.test.ts fails if they drift apart.

export const mediaFields = ['avatar', 'cover', 'gallery', 'product'] as const;
export type MediaField = (typeof mediaFields)[number];

/** Every field a person can upload to. Documents go to person_documents (private `verification` bucket), not to `media`. */
export const uploadFields = [...mediaFields, 'document'] as const;
export type UploadField = (typeof uploadFields)[number];

export const mediaSubjectKinds = ['guide', 'provider', 'listing'] as const;
export type MediaSubjectKind = (typeof mediaSubjectKinds)[number];

/** uploading: row made, file not confirmed. live: shown at once, not checked yet. pending: waits for approval (products). */
export const mediaStates = ['uploading', 'live', 'pending', 'checked', 'removed'] as const;
export type MediaState = (typeof mediaStates)[number];

export const mediaRemovedReasons = ['owner', 'replaced', 'not_finished', 'subject_gone', 'refused', 'admin', 'report'] as const;
export type MediaRemovedReason = (typeof mediaRemovedReasons)[number];

/** Stored image types. WebP first; JPEG only when the browser or phone cannot write WebP. */
export const mediaMimeTypes = ['image/webp', 'image/jpeg'] as const;
export type MediaMime = (typeof mediaMimeTypes)[number];

export type MediaBucket = 'media' | 'media-pending' | 'verification';

/** Private bucket every photo is uploaded to first. The media-finish Edge Function checks the bytes and copies it to the field's bucket (security review M1). */
export const MEDIA_STAGING_BUCKET = 'media-staging';

const MB = 1024 * 1024;

export type UploadFieldSpec = {
  field: UploadField;
  /** Files kept at once. Documents: open (not removed) documents per person. */
  maxCount: number;
  /** Types a person may pick. HEIC is converted on the phone; browsers that cannot read it refuse it. */
  accept: readonly string[];
  /** Largest stored size, in px. Images are never made bigger. */
  maxWidth: number;
  maxHeight: number;
  /** Longest side of the thumbnail, or null for none. */
  thumbSide: number | null;
  /** Largest stored file, in bytes. */
  maxBytes: number;
  /** Width / height of the crop. Null: no crop. */
  cropAspect: number | null;
  /** True: the person must crop to cropAspect. False: cropAspect is only a suggestion. */
  cropFixed: boolean;
  bucket: MediaBucket;
  /** When the public sees it. */
  shown: 'at_once' | 'after_approval' | 'never';
  /** Which subjects the field belongs to. */
  subjects: readonly MediaSubjectKind[];
  /** True: the uploader ticks "The people in this photo agreed to it being shown." */
  needsConsent: boolean;
};

const IMAGE_IN = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

export const UPLOAD_SPECS: Record<UploadField, UploadFieldSpec> = {
  avatar: { field: 'avatar', maxCount: 1, accept: IMAGE_IN, maxWidth: 800, maxHeight: 800, thumbSide: 200, maxBytes: 1 * MB, cropAspect: 1, cropFixed: true, bucket: 'media', shown: 'at_once', subjects: ['guide', 'provider'], needsConsent: false },
  cover: { field: 'cover', maxCount: 1, accept: IMAGE_IN, maxWidth: 2000, maxHeight: 667, thumbSide: 800, maxBytes: 2 * MB, cropAspect: 3, cropFixed: true, bucket: 'media', shown: 'at_once', subjects: ['guide', 'provider'], needsConsent: true },
  gallery: { field: 'gallery', maxCount: 12, accept: IMAGE_IN, maxWidth: 1600, maxHeight: 1600, thumbSide: 400, maxBytes: 2 * MB, cropAspect: null, cropFixed: false, bucket: 'media', shown: 'at_once', subjects: ['guide', 'provider'], needsConsent: true },
  product: { field: 'product', maxCount: 10, accept: IMAGE_IN, maxWidth: 1600, maxHeight: 1600, thumbSide: 400, maxBytes: 2 * MB, cropAspect: 1, cropFixed: false, bucket: 'media-pending', shown: 'after_approval', subjects: ['listing'], needsConsent: true },
  document: { field: 'document', maxCount: 20, accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], maxWidth: 2400, maxHeight: 2400, thumbSide: null, maxBytes: 15 * MB, cropAspect: null, cropFixed: false, bucket: 'verification', shown: 'never', subjects: [], needsConsent: false },
};

/** Largest thumbnail file, in bytes (same number as private.media_thumb_max_bytes()). */
export const MEDIA_THUMB_MAX_BYTES = 300 * 1024;

/** Largest file a person may pick before it is shrunk on their device. Bigger files are refused at once. */
export const MAX_PICKED_BYTES = 40 * MB;

/** Uploads that run at the same time; the rest wait. */
export const UPLOAD_CONCURRENCY = 2;

/** Version of the photo consent line. Change it when the wording changes, so new uploads record the new text. */
export const PHOTO_CONSENT_VERSION = 'photo-consent-2026-11';

/** Width and height kept on the server are bounded for layout only. */
export const MEDIA_MAX_SIDE = 4000;

export function uploadSpec(field: UploadField): UploadFieldSpec {
  return UPLOAD_SPECS[field];
}

/** The state a finished upload gets: products wait for approval, everything else is shown at once. */
export function finishedState(field: MediaField): 'live' | 'pending' {
  return UPLOAD_SPECS[field].shown === 'after_approval' ? 'pending' : 'live';
}

export function mediaExt(mime: MediaMime): 'webp' | 'jpg' {
  return mime === 'image/webp' ? 'webp' : 'jpg';
}

/** Storage object names: {owner}/{id}.{ext} and {owner}/{id}-thumb.{ext}. */
export function mediaPaths(ownerId: string, id: string, mime: MediaMime): { path: string; thumbPath: string } {
  const ext = mediaExt(mime);
  return { path: `${ownerId}/${id}.${ext}`, thumbPath: `${ownerId}/${id}-thumb.${ext}` };
}

/** Public URL of an object in the public `media` bucket. */
export function mediaPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** How many more files the field takes. */
export function remainingSlots(field: UploadField, used: number): number {
  return Math.max(0, UPLOAD_SPECS[field].maxCount - Math.max(0, used));
}

export type PickedFileProblem = 'type' | 'too_big' | 'empty';

/** Quick check of a picked file before any work. The real checks are on the server. */
export function checkPickedFile(file: { type?: string | null; size?: number | null }, field: UploadField): PickedFileProblem | null {
  const size = file.size ?? 0;
  if (size <= 0) return 'empty';
  if (size > MAX_PICKED_BYTES) return 'too_big';
  const type = (file.type ?? '').toLowerCase();
  // Some phones give no type for HEIC; the decoder decides then.
  if (type && !UPLOAD_SPECS[field].accept.includes(type)) return 'type';
  return null;
}

/** The `accept` attribute for a file input. */
export function acceptAttribute(field: UploadField): string {
  const types = [...UPLOAD_SPECS[field].accept];
  if (types.includes('image/heic')) types.push('.heic', '.heif');
  return types.join(',');
}

/** Size that fits inside maxWidth x maxHeight with the same shape, never bigger than the source. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Thumbnail size: longest side at most `side`. */
export function thumbSize(width: number, height: number, side: number): { width: number; height: number } {
  return fitWithin(width, height, side, side);
}

export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * The part of the source picture to keep for a crop of shape `aspect` (width / height).
 * zoom 1 = the largest crop that fits; 2 = half as wide. panX and panY go from -1 (left, top) to
 * 1 (right, bottom); 0 is the centre. Used by the website's crop dialog and the app's crop step.
 */
export function cropRect(sourceWidth: number, sourceHeight: number, aspect: number, zoom = 1, panX = 0, panY = 0): CropRect {
  const z = Math.min(4, Math.max(1, zoom));
  let width = sourceWidth;
  let height = width / aspect;
  if (height > sourceHeight) {
    height = sourceHeight;
    width = height * aspect;
  }
  width /= z;
  height /= z;
  const clamp = (v: number) => Math.min(1, Math.max(-1, v));
  const x = ((sourceWidth - width) / 2) * (1 + clamp(panX));
  const y = ((sourceHeight - height) / 2) * (1 + clamp(panY));
  return { x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/** Width or height to send to the server: a whole number from 1 to 4000. */
export function clampSide(value: number): number {
  return Math.min(MEDIA_MAX_SIDE, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)));
}

export const PLACEHOLDER_PATTERN = /^#[0-9a-f]{6}$/;

/** "#rrggbb" from 0-255 channels, for the box shown before a photo loads. */
export function placeholderColour(r: number, g: number, b: number): string {
  const hex = (v: number) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Moves one item to a new position (for "Move earlier" and "Move later"). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const target = Math.min(list.length - 1, Math.max(0, to));
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(target, 0, item);
  return copy;
}

/** "Make main photo": the main photo is always the first one. */
export function makeMain<T extends { id: string }>(list: readonly T[], id: string): T[] {
  const index = list.findIndex((item) => item.id === id);
  return index <= 0 ? [...list] : moveItem(list, index, 0);
}

/** A row of public.media as screens read it. */
export type MediaItem = {
  id: string;
  field: MediaField;
  path: string;
  thumb_path: string | null;
  mime: MediaMime | null;
  width: number | null;
  height: number | null;
  placeholder: string | null;
  sort: number;
  is_main: boolean;
  state: MediaState;
};

export const MEDIA_COLUMNS = 'id, field, path, thumb_path, mime, width, height, placeholder, sort, is_main, state';

/** Error codes the database raises (in the message) that screens turn into polite texts. */
export const mediaErrorCodes = ['too_many', 'rate_limited', 'not_yours', 'not_onboarded', 'file_missing', 'file_too_big', 'file_type', 'file_cache', 'bad_size', 'busy'] as const;
export type MediaErrorCode = (typeof mediaErrorCodes)[number] | 'network' | 'decode' | 'generic';

/** Reads our error code from a database or storage error message. */
export function mediaErrorCode(message: string | null | undefined): MediaErrorCode {
  const text = message ?? '';
  for (const code of mediaErrorCodes) if (text.includes(`media:${code}`)) return code;
  if (/fetch|network|timeout/i.test(text)) return 'network';
  return 'generic';
}
