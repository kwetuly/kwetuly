import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { MEDIA_THUMB_MAX_BYTES, cropRect, fitWithin, thumbShapeOk, thumbSize, type CropRect, type MediaMime, type UploadFieldSpec } from '@kwetuly/shared';

/** The picture is too long and narrow for a thumbnail of the same shape (a wide panorama). */
export class TooThinPhotoError extends Error {}

export type CleanPhoto = { uri: string; mimeType: 'image/jpeg' };

/**
 * Saves a new JPEG from a picked photo, shrunk so its longest side is at most `maxSide` px (when
 * given). Saving a new file keeps only the pixels, so the camera's hidden data (GPS location,
 * device, time) is never uploaded. The image picker alone does not do this: on Android it copies
 * that data into its compressed copy. Throws if the photo cannot be read; callers must then stop,
 * never upload the original.
 */
export async function cleanPhoto(asset: { uri: string; width: number; height: number }, { maxSide, compress = 0.85 }: { maxSide?: number; compress?: number } = {}): Promise<CleanPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (maxSide && Math.max(asset.width, asset.height) > maxSide) context.resize(asset.width >= asset.height ? { width: maxSide } : { height: maxSide });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}

export type CleanUploadFile = { uri: string; width: number; height: number; bytes: number };
export type CleanUpload = { main: CleanUploadFile; thumb: CleanUploadFile; mimeType: MediaMime };

const QUALITIES = [0.82, 0.72, 0.62, 0.5];

/** Renders the part `rect` at `width` x `height` and saves it under `maxBytes` (lower quality, then smaller). */
async function saveUnder(uri: string, rect: CropRect, width: number, height: number, maxBytes: number, format: SaveFormat): Promise<CleanUploadFile> {
  let w = width;
  let h = height;
  for (let round = 0; round < 4; round++) {
    const image = await ImageManipulator.manipulate(uri).crop({ originX: rect.x, originY: rect.y, width: rect.width, height: rect.height }).resize({ width: w, height: h }).renderAsync();
    for (const compress of QUALITIES) {
      const saved = await image.saveAsync({ compress, format });
      const bytes = new File(saved.uri).size;
      if (bytes > 0 && bytes <= maxBytes) return { uri: saved.uri, width: saved.width, height: saved.height, bytes };
    }
    w = Math.max(1, Math.round(w * 0.8));
    h = Math.max(1, Math.round(h * 0.8));
  }
  throw new Error('Photo too large');
}

/**
 * For the one upload system (slice S4): a cleaned photo and its thumbnail for one field, as WebP, or
 * JPEG on a phone that cannot write WebP. Crops to `crop` (source pixels) or, for a fixed-shape field,
 * around the centre. Like cleanPhoto, only pixels are kept (no location data); throws if the photo
 * cannot be read, and the caller must then stop.
 */
export async function cleanPhotoForUpload(asset: { uri: string; width: number; height: number }, spec: UploadFieldSpec, crop?: CropRect | null): Promise<CleanUpload> {
  const rect = crop ?? (spec.cropAspect && spec.cropFixed ? cropRect(asset.width, asset.height, spec.cropAspect) : { x: 0, y: 0, width: asset.width, height: asset.height });
  const size = fitWithin(rect.width, rect.height, spec.maxWidth, spec.maxHeight);
  const t = thumbSize(size.width, size.height, spec.thumbSide ?? 400);
  // A very long, thin picture cannot get a thumbnail of the same shape; the server would refuse it.
  if (!thumbShapeOk(size.width, size.height, t.width, t.height)) throw new TooThinPhotoError('Too thin');
  for (const [format, mimeType] of [
    [SaveFormat.WEBP, 'image/webp'],
    [SaveFormat.JPEG, 'image/jpeg'],
  ] as const) {
    try {
      const main = await saveUnder(asset.uri, rect, size.width, size.height, spec.maxBytes, format);
      const thumb = await saveUnder(asset.uri, rect, t.width, t.height, MEDIA_THUMB_MAX_BYTES, format);
      return { main, thumb, mimeType };
    } catch (error) {
      if (format === SaveFormat.JPEG) throw error;
    }
  }
  throw new Error('Could not save the photo');
}
