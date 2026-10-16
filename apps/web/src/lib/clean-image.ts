// Photos from phones carry hidden data (EXIF/XMP): GPS location, camera serial number, time taken.
// Redrawing the picture on a canvas and saving a new file keeps only the pixels, so that data is
// never uploaded. This runs for every photo, whatever its size.

/** Image types the browser may be able to redraw. GIFs are left alone (redrawing would stop the animation). */
export function needsCleaning(file: Blob) {
  return file.type.startsWith('image/') && file.type !== 'image/gif';
}

/**
 * Returns a fresh JPEG (or PNG for PNG input, to keep transparency) without any metadata,
 * shrunk so the longest side is at most `maxSide` px. Throws if the browser cannot read the image
 * (for example HEIC outside Safari): the caller must then stop the upload, never send the original.
 */
export async function cleanImage(file: Blob, { maxSide, quality = 0.85 }: { maxSide: number; quality?: number }): Promise<Blob> {
  // The default orientation setting applies the photo's EXIF rotation, so the picture stays upright.
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas');
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    if (type === 'image/jpeg') {
      // JPEG has no transparency; use white instead of black behind see-through parts.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) throw new Error('Could not save the photo');
    return blob;
  } finally {
    bitmap.close();
  }
}
