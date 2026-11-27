// Server-side check and clean-up of uploaded photos (slice S4, security review M1 and N1). Used by
// the `media-finish` Edge Function before a photo is copied to a bucket the public can read.
// It reads the file's own bytes (never the declared type or the name), accepts only still JPEG and
// WebP, keeps only the parts needed to show the picture (allow-list), and reads the real width and
// height from the file. The picture data itself is not decoded.
//
// JPEG: every segment is walked, also those between progressive scans (the compressed data after
// each start-of-scan is followed until the next marker). Kept: SOFn, DHT, DQT, DRI, SOS, DAC and DNL;
// APP0 only if it starts "JFIF\0", APP2 only if it starts "ICC_PROFILE\0" (at most 256 KB in total),
// APP14 only if it starts "Adobe". Dropped: every other APP segment (EXIF, XMP, JFXX thumbnails, MPF
// extra images, IPTC, maker data) and comments. Any other marker is refused. Everything after the
// end-of-image marker is cut (for example a file appended to the picture).
// WebP: kept chunks VP8X, "VP8 ", VP8L, ALPH and ICCP (at most 256 KB); every other chunk is
// dropped and VP8X's flags are set to what is left. Animated pictures, and more than one VP8X,
// "VP8 ", VP8L or ALPH chunk, are refused.
//
// This file has NO imports on purpose: the Edge Function keeps a byte-identical copy at
// supabase/functions/_shared/image-bytes.ts (Deno cannot import from packages/), and
// image-bytes.test.ts fails if the two drift apart. Edit this file, then copy it.

export type ImageBytesType = 'image/jpeg' | 'image/webp';
export type ImageBytesProblem = 'type' | 'corrupt' | 'animated';
export type CleanImageBytes = { ok: true; mime: ImageBytesType; width: number; height: number; bytes: Uint8Array; removedBytes: number } | { ok: false; problem: ImageBytesProblem };

/** Largest colour profile kept, in bytes. */
export const MAX_ICC_BYTES = 256 * 1024;

/** JPEG starts FF D8 FF; WebP starts "RIFF", four size bytes, "WEBP". */
export function sniffImageBytes(b: Uint8Array): ImageBytesType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (startsWith(b, 0, 'RIFF') && startsWith(b, 8, 'WEBP')) return 'image/webp';
  return null;
}

function startsWith(b: Uint8Array, at: number, text: string): boolean {
  if (b.length < at + text.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
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

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
// Non-APP segments a picture may have: SOFn, DHT, DAC, SOS, DQT, DNL, DRI. Any other marker is refused.
const JPEG_ALLOWED = new Set([...JPEG_SOF, 0xc4, 0xcc, 0xda, 0xdb, 0xdc, 0xdd]);

function cleanJpeg(b: Uint8Array): CleanImageBytes {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let width = 0;
  let height = 0;
  let removed = 0;
  let icc = 0;
  let ended = false;
  while (i < b.length) {
    if (b[i] !== 0xff) return { ok: false, problem: 'corrupt' };
    let j = i;
    while (j < b.length && b[j] === 0xff) j++;
    if (j >= b.length) return { ok: false, problem: 'corrupt' };
    const marker = b[j];
    if (marker === 0xd9) {
      parts.push(new Uint8Array([0xff, 0xd9]));
      ended = true;
      break;
    }
    if (marker === 0x00 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Not valid between segments.
      return { ok: false, problem: 'corrupt' };
    }
    if (j + 2 >= b.length) return { ok: false, problem: 'corrupt' };
    const length = (b[j + 1] << 8) | b[j + 2];
    const end = j + 1 + length;
    if (length < 2 || end > b.length) return { ok: false, problem: 'corrupt' };
    const data = j + 3;
    if (JPEG_SOF.has(marker)) {
      if (length < 7) return { ok: false, problem: 'corrupt' };
      height = (b[data + 1] << 8) | b[data + 2];
      width = (b[data + 3] << 8) | b[data + 4];
    }
    let keep = true;
    if (marker < 0xe0 && !JPEG_ALLOWED.has(marker)) return { ok: false, problem: 'corrupt' };
    if (marker > 0xef && marker !== 0xfe) return { ok: false, problem: 'corrupt' };
    if (marker >= 0xe0 && marker <= 0xef) {
      if (marker === 0xe0) keep = startsWith(b, data, 'JFIF\0');
      else if (marker === 0xe2) keep = startsWith(b, data, 'ICC_PROFILE\0') && icc + length <= MAX_ICC_BYTES;
      else if (marker === 0xee) keep = startsWith(b, data, 'Adobe');
      else keep = false;
      if (keep && marker === 0xe2) icc += length;
    } else if (marker === 0xfe) {
      keep = false;
    }
    if (keep) parts.push(b.subarray(j - 1, end));
    else removed += end - i;
    i = end;
    if (marker === 0xda) {
      // Compressed picture data follows until the next real marker. FF 00 (a stuffed byte) and
      // FF D0-D7 (restart markers) belong to it.
      let k = i;
      while (k < b.length) {
        if (b[k] === 0xff && k + 1 < b.length) {
          const next = b[k + 1];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            k += 2;
            continue;
          }
          if (next === 0xff) {
            k += 1;
            continue;
          }
          break;
        }
        k++;
      }
      if (k >= b.length) return { ok: false, problem: 'corrupt' };
      parts.push(b.subarray(i, k));
      i = k;
    }
  }
  if (!ended || !width || !height) return { ok: false, problem: 'corrupt' };
  const out = concat(parts);
  return { ok: true, mime: 'image/jpeg', width, height, bytes: out, removedBytes: b.length - out.length };
}

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

const WEBP_KEEP = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ICCP']);

function cleanWebp(b: Uint8Array): CleanImageBytes {
  if (b.length < 20) return { ok: false, problem: 'corrupt' };
  const riffEnd = 8 + u32(b, 4);
  if (riffEnd > b.length || riffEnd < 20) return { ok: false, problem: 'corrupt' };
  const chunks: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  let picture = false;
  let alpha = false;
  let seenAlph = false;
  let icc = false;
  let vp8xAt = -1;
  let at = 0;
  let i = 12;
  while (i + 8 <= riffEnd) {
    const id = fourcc(b, i);
    const size = u32(b, i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > riffEnd) return { ok: false, problem: 'corrupt' };
    const d = i + 8;
    if (id === 'ANIM' || id === 'ANMF') return { ok: false, problem: 'animated' };
    // One picture only: a second VP8, VP8L or ALPH chunk could hide another image.
    if ((id === 'VP8 ' || id === 'VP8L') && picture) return { ok: false, problem: 'corrupt' };
    if (id === 'ALPH' && seenAlph) return { ok: false, problem: 'corrupt' };
    if (id === 'ALPH') seenAlph = true;
    let keep = WEBP_KEEP.has(id);
    if (id === 'VP8X') {
      if (size < 10 || vp8xAt >= 0) return { ok: false, problem: 'corrupt' };
      if (b[d] & 0x02) return { ok: false, problem: 'animated' };
      width = u24(b, d + 4) + 1;
      height = u24(b, d + 7) + 1;
      vp8xAt = at;
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
      alpha = alpha || (b[d + 4] & 0x10) !== 0;
    } else if (id === 'ALPH') {
      alpha = true;
    } else if (id === 'ICCP') {
      keep = size <= MAX_ICC_BYTES && !icc;
      icc = icc || keep;
    }
    if (keep) {
      const chunk = b.slice(i, Math.min(end, riffEnd));
      chunks.push(chunk);
      at += chunk.length;
    }
    i = end;
  }
  if (!picture || !width || !height) return { ok: false, problem: 'corrupt' };
  const body = concat(chunks);
  // VP8X flags describe only what is left: ICC (0x20) and alpha (0x10); never EXIF, XMP or animation.
  if (vp8xAt >= 0) body[vp8xAt + 8] = (icc ? 0x20 : 0) | (alpha ? 0x10 : 0);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  out.set(body, 12);
  const riffSize = out.length - 8;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  return { ok: true, mime: 'image/webp', width, height, bytes: out, removedBytes: b.length - out.length };
}

/** Checks a stored photo and returns a copy without metadata or extra data, or the problem. */
export function cleanImageBytes(b: Uint8Array): CleanImageBytes {
  const type = sniffImageBytes(b);
  if (type === 'image/jpeg') return cleanJpeg(b);
  if (type === 'image/webp') return cleanWebp(b);
  return { ok: false, problem: 'type' };
}
