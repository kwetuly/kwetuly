// Server-side check and clean-up of uploaded photos (slice S4, security review M1). Used by the
// `media-finish` Edge Function before a photo is copied to a bucket the public can read.
// It reads the file's own bytes (never the declared type or the name), accepts only still JPEG and
// WebP, removes metadata blocks (EXIF, XMP, IPTC, comments) without decoding the picture, and reads
// the real width and height from the file.
//
// This file has NO imports on purpose: the Edge Function keeps a byte-identical copy at
// supabase/functions/_shared/image-bytes.ts (Deno cannot import from packages/), and
// image-bytes.test.ts fails if the two drift apart. Edit this file, then copy it.

export type ImageBytesType = 'image/jpeg' | 'image/webp';
export type ImageBytesProblem = 'type' | 'corrupt' | 'animated';
export type CleanImageBytes = { ok: true; mime: ImageBytesType; width: number; height: number; bytes: Uint8Array; removedBytes: number } | { ok: false; problem: ImageBytesProblem };

/** JPEG starts FF D8 FF; WebP starts "RIFF", four size bytes, "WEBP". */
export function sniffImageBytes(b: Uint8Array): ImageBytesType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  const ascii = (at: number, text: string) => b.length >= at + text.length && [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// JPEG segments kept: APP0 (JFIF), APP2 (ICC colour profile), APP14 (Adobe colour info) and every
// non-APP segment. Removed: APP1 (EXIF, XMP), APP3-APP13 and APP15 (IPTC and maker data), COM.
const JPEG_KEEP_APP = new Set([0xe0, 0xe2, 0xee]);
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function cleanJpeg(b: Uint8Array): CleanImageBytes {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let width = 0;
  let height = 0;
  let removed = 0;
  while (i < b.length) {
    if (b[i] !== 0xff) return { ok: false, problem: 'corrupt' };
    let j = i;
    while (j < b.length && b[j] === 0xff) j++;
    if (j >= b.length) return { ok: false, problem: 'corrupt' };
    const marker = b[j];
    if (marker === 0xd9) {
      parts.push(b.subarray(i, j + 1));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(b.subarray(i, j + 1));
      i = j + 1;
      continue;
    }
    if (j + 2 >= b.length) return { ok: false, problem: 'corrupt' };
    const length = (b[j + 1] << 8) | b[j + 2];
    const end = j + 1 + length;
    if (length < 2 || end > b.length) return { ok: false, problem: 'corrupt' };
    if (JPEG_SOF.has(marker)) {
      if (length < 7) return { ok: false, problem: 'corrupt' };
      height = (b[j + 4] << 8) | b[j + 5];
      width = (b[j + 6] << 8) | b[j + 7];
    }
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if ((isApp && !JPEG_KEEP_APP.has(marker)) || marker === 0xfe) {
      removed += end - i;
    } else {
      parts.push(b.subarray(i, end));
    }
    i = end;
    if (marker === 0xda) {
      // Start of scan: the compressed picture follows up to the end; copy it as it is.
      parts.push(b.subarray(i));
      break;
    }
  }
  if (!width || !height) return { ok: false, problem: 'corrupt' };
  return { ok: true, mime: 'image/jpeg', width, height, bytes: concat(parts), removedBytes: removed };
}

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

function cleanWebp(b: Uint8Array): CleanImageBytes {
  if (b.length < 20) return { ok: false, problem: 'corrupt' };
  const riffEnd = Math.min(b.length, 8 + u32(b, 4));
  const chunks: Uint8Array[] = [];
  let removed = 0;
  let width = 0;
  let height = 0;
  let picture = false;
  let vp8xAt = -1;
  let i = 12;
  while (i + 8 <= riffEnd) {
    const id = fourcc(b, i);
    const size = u32(b, i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > riffEnd) return { ok: false, problem: 'corrupt' };
    const d = i + 8;
    if (id === 'ANIM' || id === 'ANMF') return { ok: false, problem: 'animated' };
    if (id === 'EXIF' || id === 'XMP ') {
      removed += Math.min(end, riffEnd) - i;
    } else {
      if (id === 'VP8X') {
        if (size < 10) return { ok: false, problem: 'corrupt' };
        if (b[d] & 0x02) return { ok: false, problem: 'animated' };
        width = u24(b, d + 4) + 1;
        height = u24(b, d + 7) + 1;
        vp8xAt = chunks.reduce((n, c) => n + c.length, 0);
      } else if (id === 'VP8 ') {
        if (size < 10 || b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return { ok: false, problem: 'corrupt' };
        if (!width) {
          width = (b[d + 6] | (b[d + 7] << 8)) & 0x3fff;
          height = (b[d + 8] | (b[d + 9] << 8)) & 0x3fff;
        }
        picture = true;
      } else if (id === 'VP8L') {
        if (size < 5 || b[d] !== 0x2f) return { ok: false, problem: 'corrupt' };
        if (!width) {
          width = 1 + (((b[d + 2] & 0x3f) << 8) | b[d + 1]);
          height = 1 + (((b[d + 4] & 0x0f) << 10) | (b[d + 3] << 2) | ((b[d + 2] & 0xc0) >> 6));
        }
        picture = true;
      }
      chunks.push(b.slice(i, Math.min(end, riffEnd)));
    }
    i = end;
  }
  if (!picture || !width || !height) return { ok: false, problem: 'corrupt' };
  const body = concat(chunks);
  // The extended header must no longer announce EXIF (0x08) or XMP (0x04) data.
  if (vp8xAt >= 0) body[vp8xAt + 8] &= ~0x0c;
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  out.set(body, 12);
  const riffSize = out.length - 8;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  return { ok: true, mime: 'image/webp', width, height, bytes: out, removedBytes: removed };
}

/** Checks a stored photo and returns a copy without metadata, or the problem. */
export function cleanImageBytes(b: Uint8Array): CleanImageBytes {
  const type = sniffImageBytes(b);
  if (type === 'image/jpeg') return cleanJpeg(b);
  if (type === 'image/webp') return cleanWebp(b);
  return { ok: false, problem: 'type' };
}
