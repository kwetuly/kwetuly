import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_ICC_BYTES, cleanImageBytes, sniffImageBytes } from './image-bytes';

const bytes = (...parts: (number[] | string | Uint8Array)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : [...p])));
const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
const has = (b: Uint8Array, s: string) => text(b).includes(s);
const count = (b: Uint8Array, s: string) => text(b).split(s).length - 1;
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const seg = (marker: number, body: number[] | string | Uint8Array) => {
  const data = bytes(body);
  return bytes([0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 0xff], data);
};

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const JFIF = seg(0xe0, bytes('JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]));
const EXIF = seg(0xe1, 'Exif\0\0GPS 3.3869S 37.3466E');
const SOF0 = seg(0xc0, [0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const SOF2 = seg(0xc2, [0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const SOS = seg(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
// Compressed data with a stuffed byte (FF 00) and a restart marker (FF D0) inside.
const SCAN = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78];

// A tiny JPEG shape: SOI, APP0 JFIF, APP1 EXIF with a fake GPS text, COM, SOF0 (32 x 16), SOS, data, EOI.
const jpeg = () => bytes(SOI, JFIF, EXIF, seg(0xfe, 'made by a phone'), SOF0, SOS, SCAN, EOI);

// A tiny WebP shape: VP8X (EXIF flag set) 100 x 50, VP8L 100 x 50, EXIF chunk, optional extra chunks.
function webp({ animated = false, extra = [] as Uint8Array[] } = {}) {
  const vp8x = bytes('VP8X', le32(10), [animated ? 0x02 : 0x08, 0, 0, 0, 99, 0, 0, 49, 0, 0]);
  const vp8l = bytes('VP8L', le32(5), [0x2f, 0x63, 0x40, 0x0c, 0x00], [0]);
  const exif = bytes('EXIF', le32(12), 'GPS 3.3869S ');
  const body = bytes(vp8x, vp8l, exif, ...extra);
  return bytes('RIFF', le32(4 + body.length), 'WEBP', body);
}

function cleaned(b: Uint8Array) {
  const result = cleanImageBytes(b);
  if (!result.ok) throw new Error(result.problem);
  return result;
}

describe('image bytes: type', () => {
  it('reads the real type from the first bytes', () => {
    expect(sniffImageBytes(jpeg())).toBe('image/jpeg');
    expect(sniffImageBytes(webp())).toBe('image/webp');
    expect(sniffImageBytes(bytes('<svg onload="x">'))).toBeNull();
    expect(sniffImageBytes(bytes([0x89], 'PNG'))).toBeNull();
    expect(cleanImageBytes(bytes('GIF89a')).ok).toBe(false);
  });
});

describe('image bytes: JPEG', () => {
  it('removes EXIF and comments, keeps the picture and its data, reads the size', () => {
    const result = cleaned(jpeg());
    expect([result.width, result.height]).toEqual([32, 16]);
    expect(has(result.bytes, 'Exif')).toBe(false);
    expect(has(result.bytes, 'GPS')).toBe(false);
    expect(has(result.bytes, 'made by a phone')).toBe(false);
    expect(has(result.bytes, 'JFIF')).toBe(true);
    expect([...result.bytes.slice(-10)]).toEqual([...SCAN, ...EOI]);
    expect(result.removedBytes).toBeGreaterThan(0);
  });

  it('cuts everything after the end of the image (a ZIP appended to the picture)', () => {
    const result = cleaned(bytes(jpeg(), 'PK\u0003\u0004secret.txt', [0, 1, 2, 3]));
    expect(has(result.bytes, 'PK')).toBe(false);
    expect([...result.bytes.slice(-2)]).toEqual(EOI);
  });

  it('removes an APP1 hidden between progressive scans', () => {
    const result = cleaned(bytes(SOI, JFIF, SOF2, SOS, SCAN, EXIF, SOS, SCAN, EOI));
    expect(has(result.bytes, 'Exif')).toBe(false);
    expect(count(result.bytes, 'ÿÚ')).toBe(2);
  });

  it('removes MPF and the extra picture after the end', () => {
    const mpf = seg(0xe2, 'MPF\0II*\0extra');
    const result = cleaned(bytes(SOI, JFIF, mpf, SOF0, SOS, SCAN, EOI, SOI, EXIF, SOF0, SOS, SCAN, EOI));
    expect(has(result.bytes, 'MPF')).toBe(false);
    expect(has(result.bytes, 'Exif')).toBe(false);
    expect(count(result.bytes, 'ÿØ')).toBe(1);
  });

  it('keeps APP0, APP2 and APP14 only with the right start; drops JFXX', () => {
    const jfxx = seg(0xe0, bytes('JFXX\0', [0x10], 'thumbnail'));
    const icc = seg(0xe2, bytes('ICC_PROFILE\0', [1, 1], 'colours'));
    const adobe = seg(0xee, bytes('Adobe', [0, 100, 0, 0, 0, 0, 1]));
    const fakeAdobe = seg(0xee, 'NotAdobe');
    const result = cleaned(bytes(SOI, JFIF, jfxx, icc, adobe, fakeAdobe, SOF0, SOS, SCAN, EOI));
    expect(has(result.bytes, 'JFXX')).toBe(false);
    expect(has(result.bytes, 'thumbnail')).toBe(false);
    expect(has(result.bytes, 'ICC_PROFILE')).toBe(true);
    expect(count(result.bytes, 'Adobe')).toBe(1);
    expect(has(result.bytes, 'NotAdobe')).toBe(false);
  });

  it('caps the colour profile at 256 KB', () => {
    const big = seg(0xe2, bytes('ICC_PROFILE\0', new Uint8Array(65533 - 12)));
    const result = cleaned(bytes(SOI, JFIF, big, big, big, big, big, SOF0, SOS, SCAN, EOI));
    expect(count(result.bytes, 'ICC_PROFILE')).toBe(Math.floor(MAX_ICC_BYTES / 65535));
  });

  it('keeps DHT, DQT, DRI, DAC and DNL; refuses any other marker (L-a)', () => {
    const dqt = seg(0xdb, [0x00, ...new Array(64).fill(1)]);
    const dht = seg(0xc4, [0x00, ...new Array(16).fill(0)]);
    const dri = seg(0xdd, [0x00, 0x04]);
    const dac = seg(0xcc, [0x00, 0x10]);
    const dnl = seg(0xdc, [0x00, 0x10]);
    const result = cleaned(bytes(SOI, JFIF, dqt, dht, dri, dac, SOF0, SOS, SCAN, dnl, EOI));
    for (const marker of [0xdb, 0xc4, 0xdd, 0xcc, 0xdc]) expect(count(result.bytes, String.fromCharCode(0xff, marker))).toBe(1);
    // DHP (0xDE), EXP (0xDF), JPG (0xC8) and the JPG extensions (0xF0-0xFD) are not used by photos.
    for (const marker of [0xde, 0xdf, 0xc8, 0xf0, 0xf7, 0xfd]) {
      expect(cleanImageBytes(bytes(SOI, JFIF, seg(marker, [0, 0, 0]), SOF0, SOS, SCAN, EOI)), marker.toString(16)).toEqual({ ok: false, problem: 'corrupt' });
    }
  });

  it('refuses files without a frame, a broken length, or no end', () => {
    expect(cleanImageBytes(bytes(SOI, SOS, SCAN, EOI))).toEqual({ ok: false, problem: 'corrupt' });
    expect(cleanImageBytes(bytes(SOI, [0xff, 0xe1, 0x7f, 0xff, 0x00]))).toEqual({ ok: false, problem: 'corrupt' });
    expect(cleanImageBytes(bytes(SOI, JFIF, SOF0, SOS, SCAN))).toEqual({ ok: false, problem: 'corrupt' });
  });
});

describe('image bytes: WebP', () => {
  it('removes EXIF, sets the flags to what is left, fixes the size field, reads the size', () => {
    const result = cleaned(webp());
    expect([result.width, result.height]).toEqual([100, 50]);
    expect(has(result.bytes, 'EXIF')).toBe(false);
    expect(has(result.bytes, 'GPS')).toBe(false);
    expect(result.bytes[20]).toBe(0);
    const riff = result.bytes[4] | (result.bytes[5] << 8) | (result.bytes[6] << 16) | (result.bytes[7] << 24);
    expect(riff).toBe(result.bytes.length - 8);
  });

  it('drops unknown chunks, keeps ICCP and sets its flag, cuts data after the RIFF end', () => {
    const unknown = bytes('ABCD', le32(4), 'hide');
    const xmp = bytes('XMP ', le32(4), 'xmpd');
    const iccp = bytes('ICCP', le32(4), 'icc!');
    const file = bytes(webp({ extra: [unknown, xmp, iccp] }), 'PK trailing');
    const result = cleaned(file);
    expect(has(result.bytes, 'ABCD')).toBe(false);
    expect(has(result.bytes, 'hide')).toBe(false);
    expect(has(result.bytes, 'XMP')).toBe(false);
    expect(has(result.bytes, 'PK')).toBe(false);
    expect(has(result.bytes, 'ICCP')).toBe(true);
    expect(result.bytes[20]).toBe(0x20);
  });

  it('refuses a second picture or alpha chunk (L-b)', () => {
    const vp8l = bytes('VP8L', le32(5), [0x2f, 0x63, 0x40, 0x0c, 0x00], [0]);
    const alph = bytes('ALPH', le32(2), [0, 0]);
    expect(cleanImageBytes(webp({ extra: [vp8l] }))).toEqual({ ok: false, problem: 'corrupt' });
    expect(cleanImageBytes(webp({ extra: [alph, alph] }))).toEqual({ ok: false, problem: 'corrupt' });
    expect(cleanImageBytes(webp({ extra: [alph] })).ok).toBe(true);
  });

  it('refuses animation and files without a picture', () => {
    expect(cleanImageBytes(webp({ animated: true }))).toEqual({ ok: false, problem: 'animated' });
    expect(cleanImageBytes(bytes('RIFF', le32(14), 'WEBP', 'EXIF', le32(2), 'ab'))).toEqual({ ok: false, problem: 'corrupt' });
  });
});

describe('image bytes: copy', () => {
  it('supabase/functions/_shared/image-bytes.ts is identical to this file', () => {
    const here = readFileSync(new URL('./image-bytes.ts', import.meta.url), 'utf8');
    const copy = readFileSync(new URL('../../../supabase/functions/_shared/image-bytes.ts', import.meta.url), 'utf8');
    expect(copy).toBe(here);
  });
});
