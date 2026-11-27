// Prepares a photo in the browser before upload (slice S4): decode (EXIF rotation applied), crop,
// shrink, and save as WebP, or JPEG where the browser cannot write WebP (older Safari). Redrawing on a
// canvas keeps only the pixels, so GPS location and camera data are never uploaded. If the browser
// cannot read the file (for example HEIC outside Safari), this throws and the caller stops: the
// original file is never uploaded.
import { MEDIA_THUMB_MAX_BYTES, cropRect, fitWithin, placeholderColour, thumbShapeOk, thumbSize, type CropRect, type MediaMime, type UploadFieldSpec } from '@kwetuly/shared';

export type EncodedImage = {
  main: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: MediaMime;
  /** Average colour, for the box shown while the photo loads. */
  placeholder: string | null;
};

export class DecodeError extends Error {}
/** The picture is too long and narrow for a thumbnail of the same shape (a wide panorama). */
export class TooThinError extends Error {}

const QUALITIES = [0.82, 0.72, 0.62, 0.5];

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new DecodeError('No canvas');
  context.imageSmoothingQuality = 'high';
  return { canvas, context };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws `source` (the part `rect` of the bitmap) at the given size, on white (JPEG has no transparency). */
function draw(bitmap: ImageBitmap, rect: CropRect, width: number, height: number) {
  const { canvas, context } = canvasOf(width, height);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
  return canvas;
}

/** Saves under `maxBytes`, trying lower quality first and then a smaller size. Keeps one type for both files. */
async function encodeUnder(bitmap: ImageBitmap, rect: CropRect, width: number, height: number, maxBytes: number, mime: MediaMime | null) {
  let w = width;
  let h = height;
  for (let round = 0; round < 4; round++) {
    const canvas = draw(bitmap, rect, w, h);
    for (const q of QUALITIES) {
      let blob = await toBlob(canvas, mime ?? 'image/webp', q);
      // A browser without WebP output returns PNG; use JPEG then.
      if (!blob || (mime === null && blob.type !== 'image/webp')) {
        mime = 'image/jpeg';
        blob = await toBlob(canvas, 'image/jpeg', q);
      }
      if (!blob) throw new DecodeError('Could not save the photo');
      const type = (blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg') as MediaMime;
      mime = type;
      if (blob.size <= maxBytes) return { blob: blob.type === type ? blob : new Blob([blob], { type }), width: w, height: h, mime: type, canvas };
    }
    w = Math.max(1, Math.round(w * 0.8));
    h = Math.max(1, Math.round(h * 0.8));
  }
  throw new DecodeError('Photo too large');
}

function averageColour(canvas: HTMLCanvasElement): string | null {
  try {
    const { context } = canvasOf(1, 1);
    context.drawImage(canvas, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return placeholderColour(r, g, b);
  } catch {
    return null;
  }
}

export async function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new DecodeError('Cannot read');
  }
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * Makes the stored photo and its thumbnail for one field. `crop` is in the source's pixels; a field
 * with a fixed crop and no crop given is cut around the centre.
 */
export async function encodeImage(file: Blob, spec: UploadFieldSpec, crop?: CropRect | null): Promise<EncodedImage> {
  let bitmap: ImageBitmap;
  try {
    // The default orientation setting applies the photo's EXIF rotation, so the picture stays upright.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new DecodeError('Cannot read');
  }
  try {
    const rect = crop ?? (spec.cropAspect && spec.cropFixed ? cropRect(bitmap.width, bitmap.height, spec.cropAspect) : { x: 0, y: 0, width: bitmap.width, height: bitmap.height });
    const size = fitWithin(rect.width, rect.height, spec.maxWidth, spec.maxHeight);
    const main = await encodeUnder(bitmap, rect, size.width, size.height, spec.maxBytes, null);
    const t = thumbSize(main.width, main.height, spec.thumbSide ?? 400);
    // A very long, thin picture cannot get a thumbnail of the same shape; the server would refuse it.
    if (!thumbShapeOk(main.width, main.height, t.width, t.height)) throw new TooThinError('Too thin');
    const thumb = await encodeUnder(bitmap, rect, t.width, t.height, MEDIA_THUMB_MAX_BYTES, main.mime);
    if (thumb.mime !== main.mime) throw new DecodeError('Mixed types');
    return { main: main.blob, thumb: thumb.blob, width: main.width, height: main.height, mime: main.mime, placeholder: averageColour(thumb.canvas) };
  } finally {
    bitmap.close();
  }
}
