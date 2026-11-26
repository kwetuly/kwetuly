import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { uploadsText } from './dictionaries/uploads';
import {
  MEDIA_STAGING_BUCKET,
  MEDIA_THUMB_MAX_BYTES,
  PHOTO_CONSENT_VERSION,
  UPLOAD_SPECS,
  acceptAttribute,
  checkPickedFile,
  clampSide,
  cropRect,
  finishedState,
  fitWithin,
  makeMain,
  mediaErrorCode,
  mediaErrorCodes,
  mediaFields,
  mediaPaths,
  mediaPublicUrl,
  mediaRemovedReasons,
  mediaStates,
  mediaSubjectKinds,
  moveItem,
  placeholderColour,
  remainingSlots,
  thumbSize,
} from './uploads';

const sql = readFileSync(new URL('../../../supabase/migrations/20261126000100_media_uploads.sql', import.meta.url), 'utf8');
const quoted = (block: string) => [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const caseValues = (fn: string) => {
  const body = sql.match(new RegExp(`function private\\.${fn}\\(p_field public\\.media_field\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`))![1];
  return Object.fromEntries([...body.matchAll(/when '([a-z]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
};

describe('uploads match the media migration', () => {
  it('enums', () => {
    expect(quoted(sql.match(/create type public\.media_field as enum \(([^)]*)\)/)![1])).toEqual([...mediaFields]);
    expect(quoted(sql.match(/create type public\.media_subject_kind as enum \(([^)]*)\)/)![1])).toEqual([...mediaSubjectKinds]);
    expect(quoted(sql.match(/create type public\.media_state as enum \(([^)]*)\)/)![1])).toEqual([...mediaStates]);
    expect(quoted(sql.match(/removed_reason text check \(removed_reason in \(([^)]*)\)/)![1])).toEqual([...mediaRemovedReasons]);
  });
  it('counts and sizes per field', () => {
    const max = caseValues('media_field_max');
    const bytes = caseValues('media_field_max_bytes');
    for (const f of mediaFields) {
      expect(max[f]).toBe(UPLOAD_SPECS[f].maxCount);
      expect(bytes[f]).toBe(UPLOAD_SPECS[f].maxBytes);
    }
    expect(sql).toContain(`select ${MEDIA_THUMB_MAX_BYTES}::bigint;`);
  });
  it('buckets, finished state and stored types', () => {
    expect(sql).toContain("select case p_field when 'product' then 'media-pending' else 'media' end;");
    expect(sql).toContain("select case p_field when 'product' then 'pending' else 'live' end::public.media_state;");
    for (const f of mediaFields) {
      expect(UPLOAD_SPECS[f].bucket).toBe(f === 'product' ? 'media-pending' : 'media');
      expect(finishedState(f)).toBe(f === 'product' ? 'pending' : 'live');
    }
    const limit = Math.max(...mediaFields.map((f) => UPLOAD_SPECS[f].maxBytes));
    expect(sql).toContain(`('media', 'media', true, ${limit}, array['image/webp', 'image/jpeg'])`);
    expect(sql).toContain(`('media-pending', 'media-pending', false, ${limit}, array['image/webp', 'image/jpeg'])`);
  });
  it('error codes the screens know are raised by the migration', () => {
    // Raised as 'media:<code>', or returned as a reason by private.media_object_check() and raised as 'media:%'.
    for (const code of mediaErrorCodes) expect(sql.includes(`media:${code}`) || sql.includes(`'${code}'`), code).toBe(true);
  });
  it('uploads go to the private staging bucket only (review M1) and finished files carry the cache header (M4)', () => {
    expect(sql).toContain(`('${MEDIA_STAGING_BUCKET}', '${MEDIA_STAGING_BUCKET}', false, 2097152, array['image/webp', 'image/jpeg'])`);
    expect(sql).toContain("with check (bucket_id = 'media-staging'");
    expect(sql).toContain("is distinct from 'max-age=3600'");
    expect(sql).not.toMatch(/grant [^;]*finish_media[^;]* to authenticated/);
  });
  it('the media-finish function uses the same sizes per field', () => {
    const fn = readFileSync(new URL('../../../supabase/functions/media-finish/index.ts', import.meta.url), 'utf8');
    const table = (name: string) => Object.fromEntries([...fn.match(new RegExp(`const ${name}: Record<string, number> = \\{([^}]*)\\}`))![1].matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    const bytes = table('MAX_BYTES');
    const thumbs = table('THUMB_SIDE');
    for (const f of mediaFields) {
      expect(bytes[f]).toBe(UPLOAD_SPECS[f].maxBytes);
      expect(thumbs[f]).toBe(UPLOAD_SPECS[f].thumbSide);
      expect(thumbs[f]).toBeLessThanOrEqual(800);
    }
    expect(fn).toContain(`const THUMB_MAX = ${MEDIA_THUMB_MAX_BYTES};`);
  });
  it('consent version fits the SQL pattern', () => {
    expect(PHOTO_CONSENT_VERSION).toMatch(/^[A-Za-z0-9._-]{1,40}$/);
  });
  it('the migration stays under 60 KB', () => {
    expect(Buffer.byteLength(sql, 'utf8')).toBeLessThan(60 * 1024);
  });
});

describe('field specs', () => {
  it('counts from the brief', () => {
    expect(UPLOAD_SPECS.avatar).toMatchObject({ maxCount: 1, cropAspect: 1, cropFixed: true });
    expect(UPLOAD_SPECS.cover).toMatchObject({ maxCount: 1, cropAspect: 3, cropFixed: true, maxWidth: 2000, maxHeight: 667 });
    expect(UPLOAD_SPECS.gallery).toMatchObject({ maxCount: 12, cropAspect: null });
    expect(UPLOAD_SPECS.product).toMatchObject({ maxCount: 10, shown: 'after_approval' });
    expect(UPLOAD_SPECS.document).toMatchObject({ bucket: 'verification', shown: 'never' });
  });
  it('remaining slots', () => {
    expect(remainingSlots('gallery', 10)).toBe(2);
    expect(remainingSlots('gallery', 14)).toBe(0);
    expect(remainingSlots('cover', 0)).toBe(1);
  });
  it('picked file checks', () => {
    expect(checkPickedFile({ type: 'image/jpeg', size: 5_000_000 }, 'gallery')).toBeNull();
    expect(checkPickedFile({ type: 'image/gif', size: 5_000 }, 'gallery')).toBe('type');
    expect(checkPickedFile({ type: 'image/jpeg', size: 50 * 1024 * 1024 }, 'gallery')).toBe('too_big');
    expect(checkPickedFile({ type: '', size: 10 }, 'gallery')).toBeNull();
    expect(checkPickedFile({ type: 'image/jpeg', size: 0 }, 'gallery')).toBe('empty');
    expect(checkPickedFile({ type: 'application/pdf', size: 10 }, 'document')).toBeNull();
    expect(acceptAttribute('gallery')).toContain('.heic');
  });
});

describe('paths and urls', () => {
  it('paths follow the SQL shape', () => {
    const { path, thumbPath } = mediaPaths('u1', 'm1', 'image/webp');
    expect(path).toBe('u1/m1.webp');
    expect(thumbPath).toBe('u1/m1-thumb.webp');
    expect(mediaPaths('u1', 'm1', 'image/jpeg').path).toBe('u1/m1.jpg');
  });
  it('public url', () => {
    expect(mediaPublicUrl('https://x.supabase.co/', 'u1/m1.webp')).toBe('https://x.supabase.co/storage/v1/object/public/media/u1/m1.webp');
  });
});

describe('sizes and crops', () => {
  it('never makes a photo bigger', () => {
    expect(fitWithin(4000, 3000, 1600, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600, 1600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(6000, 2000, 2000, 667)).toEqual({ width: 2000, height: 667 });
    expect(thumbSize(1600, 1200, 400)).toEqual({ width: 400, height: 300 });
  });
  it('crop is centred, fits and keeps the shape', () => {
    expect(cropRect(3000, 2000, 3)).toEqual({ x: 0, y: 500, width: 3000, height: 1000 });
    expect(cropRect(1000, 2000, 1)).toEqual({ x: 0, y: 500, width: 1000, height: 1000 });
    const zoomed = cropRect(3000, 2000, 3, 2, -1, 1);
    expect(zoomed).toEqual({ x: 0, y: 1500, width: 1500, height: 500 });
    const wild = cropRect(1200, 800, 1, 9, 5, -5);
    expect(wild.width).toBe(200);
    expect(wild.x + wild.width).toBeLessThanOrEqual(1200);
    expect(wild.y).toBe(0);
  });
  it('clamps sides and makes colours', () => {
    expect(clampSide(0)).toBe(1);
    expect(clampSide(9000)).toBe(4000);
    expect(clampSide(Number.NaN)).toBe(1);
    expect(placeholderColour(255, 0, 16.4)).toBe('#ff0010');
  });
});

describe('ordering', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('moves and makes main', () => {
    expect(moveItem(items, 2, 0).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(moveItem(items, 0, 9).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(makeMain(items, 'b').map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(makeMain(items, 'x').map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
  it('reads error codes', () => {
    expect(mediaErrorCode('ERROR: media:too_many')).toBe('too_many');
    expect(mediaErrorCode('Failed to fetch')).toBe('network');
    expect(mediaErrorCode(null)).toBe('generic');
  });
});

describe('texts', () => {
  it('Kiswahili has every key and placeholders match', () => {
    const en = uploadsText('en');
    const sw = uploadsText('sw');
    const flat = (o: object, prefix = ''): Record<string, string> =>
      Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => (typeof v === 'string' ? { ...acc, [prefix + k]: v } : { ...acc, ...flat(v, `${prefix}${k}.`) }), {});
    const a = flat(en);
    const b = flat(sw);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    for (const key of Object.keys(a)) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(b[key]), key).toEqual(ph(a[key]));
      // No all caps (file type names such as JPEG and HEIC are fine).
      expect(a[key].replace(/\b(JPEG|HEIC|PNG|MB)\b/g, '')).not.toMatch(/[A-Z]{3,}/);
    }
    expect(uploadsText('fr')).toBe(en);
  });
});
