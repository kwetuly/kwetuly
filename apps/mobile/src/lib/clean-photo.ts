import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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
