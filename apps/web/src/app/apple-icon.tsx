import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS rounds the corners itself, so the square is left square.
export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={180} rounded={false} />, size);
}
