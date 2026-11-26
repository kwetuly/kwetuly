import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanImageBytes, sniffImageBytes } from './image-bytes';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const has = (b: Uint8Array, text: string) => new TextDecoder('latin1').decode(b).includes(text);
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

// A tiny JPEG shape: SOI, APP0 JFIF, APP1 EXIF with a fake GPS text, COM, SOF0 (32 x 16), SOS, data, EOI.
function jpeg() {
  const exifBody = bytes('Exif', [0, 0], 'GPS 3.3869S 37.3466E');
  const com = bytes('made by a phone');
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x10], 'JFIF', [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xe1, 0x00, exifBody.length + 2], [...exifBody],
    [0xff, 0xfe, 0x00, com.length + 2], [...com],
    [0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00],
    [0x12, 0x34, 0x56, 0xff, 0x00, 0x78],
    [0xff, 0xd9],
  );
}

// A tiny WebP shape: VP8X (EXIF flag set) 100 x 50, VP8L 100 x 50, EXIF chunk.
function webp({ animated = false } = {}) {
  const vp8x = bytes('VP8X', le32(10), [animated ? 0x02 : 0x08, 0, 0, 0, 99, 0, 0, 49, 0, 0]);
  const vp8l = bytes('VP8L', le32(5), [0x2f, 0x63, 0x40, 0x0c, 0x00], [0]);
  const exif = bytes('EXIF', le32(12), 'GPS 3.3869S ');
  const body = new Uint8Array([...vp8x, ...vp8l, ...exif]);
  return bytes('RIFF', le32(4 + body.length), 'WEBP', [...body]);
}

describe('image bytes', () => {
  it('reads the real type from the first bytes', () => {
    expect(sniffImageBytes(jpeg())).toBe('image/jpeg');
    expect(sniffImageBytes(webp())).toBe('image/webp');
    expect(sniffImageBytes(bytes('<svg onload="x">'))).toBeNull();
    expect(sniffImageBytes(bytes([0x89], 'PNG'))).toBeNull();
    expect(cleanImageBytes(bytes('GIF89a')).ok).toBe(false);
  });

  it('JPEG: removes EXIF and comments, keeps the picture, reads the size', () => {
    const result = cleanImageBytes(jpeg());
    if (!result.ok) throw new Error(result.problem);
    expect([result.width, result.height]).toEqual([32, 16]);
    expect(has(result.bytes, 'Exif')).toBe(false);
    expect(has(result.bytes, 'GPS')).toBe(false);
    expect(has(result.bytes, 'made by a phone')).toBe(false);
    expect(has(result.bytes, 'JFIF')).toBe(true);
    expect([...result.bytes.slice(-8)]).toEqual([0x12, 0x34, 0x56, 0xff, 0x00, 0x78, 0xff, 0xd9]);
    expect(result.removedBytes).toBeGreaterThan(0);
  });

  it('JPEG: refuses a file without a frame header or with a broken length', () => {
    expect(cleanImageBytes(bytes([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0xff, 0xd9]))).toEqual({ ok: false, problem: 'corrupt' });
    expect(cleanImageBytes(bytes([0xff, 0xd8, 0xff, 0xe1, 0x7f, 0xff, 0x00]))).toEqual({ ok: false, problem: 'corrupt' });
  });

  it('WebP: removes EXIF, clears the flag, fixes the size field, reads the size', () => {
    const result = cleanImageBytes(webp());
    if (!result.ok) throw new Error(result.problem);
    expect([result.width, result.height]).toEqual([100, 50]);
    expect(has(result.bytes, 'EXIF')).toBe(false);
    expect(has(result.bytes, 'GPS')).toBe(false);
    expect(result.bytes[20] & 0x0c).toBe(0);
    const riff = result.bytes[4] | (result.bytes[5] << 8) | (result.bytes[6] << 16) | (result.bytes[7] << 24);
    expect(riff).toBe(result.bytes.length - 8);
  });

  it('WebP: refuses animation and files without a picture', () => {
    expect(cleanImageBytes(webp({ animated: true }))).toEqual({ ok: false, problem: 'animated' });
    expect(cleanImageBytes(bytes('RIFF', le32(14), 'WEBP', 'EXIF', le32(2), 'ab'))).toEqual({ ok: false, problem: 'corrupt' });
  });

  it('supabase/functions/_shared/image-bytes.ts is identical to this file', () => {
    const here = readFileSync(new URL('./image-bytes.ts', import.meta.url), 'utf8');
    const copy = readFileSync(new URL('../../../supabase/functions/_shared/image-bytes.ts', import.meta.url), 'utf8');
    expect(copy).toBe(here);
  });
});
