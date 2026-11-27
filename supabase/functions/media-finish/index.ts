// Finishes a photo upload (slice S4, security review M1). Called by the website (server action) and
// the app with the person's own token; verify_jwt is on and the token is checked again here.
//
//   POST { "id": "<media id>", "placeholder": "#rrggbb" | null }
//
// 1. Claims the row (public.svc_claim_media): it must be the caller's, still uploading, and not
//    claimed by another call in the last 5 minutes. Every failure after this ends the claim.
// 2. Downloads the photo and its thumbnail from the private `media-staging` bucket.
// 3. Reads the files' own bytes (_shared/image-bytes.ts): only still JPEG (FF D8 FF) or WebP
//    (RIFF....WEBP) of the type the name says; removes metadata blocks (EXIF, XMP, IPTC, comments)
//    without decoding the picture; reads the real width and height. A full decode and re-encode is
//    not done here (no image library fits the Edge Function CPU limit); the browser and the app
//    already redraw every photo, and this check makes sure what is published has no metadata.
// 4. Writes the cleaned files to the field's bucket (`media`, or `media-pending` for products) with
//    cache 'max-age=3600', then public.svc_finish_media() checks the stored objects and sets the state.
// 5. Deletes the staging copies and, for a new cover or avatar, the files it replaced.
// Refused files are deleted at once and the row becomes 'removed' (reason 'refused').
// Logs only codes, never names or ids.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cleanImageBytes } from '../_shared/image-bytes.ts';

const env = (key: string) => Deno.env.get(key) ?? '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGING = 'media-staging';
const MAX_BYTES: Record<string, number> = { avatar: 1048576, cover: 2097152, gallery: 2097152, product: 2097152 };
const THUMB_MAX = 307200;
// Longest side of the thumbnail per field (packages/shared/src/uploads.ts, thumbSide).
const THUMB_SIDE: Record<string, number> = { avatar: 200, cover: 800, gallery: 400, product: 400 };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ error: 'not_yours' }, 401);

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; placeholder?: unknown };
  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null;
  const placeholder = typeof body.placeholder === 'string' && /^#[0-9a-f]{6}$/.test(body.placeholder) ? body.placeholder : null;
  if (!id) return json({ error: 'not_yours' }, 400);

  // N3: claim the row first (owner, still uploading, no other claim in the last 5 minutes). Only the
  // claimant writes; while the claim is open the staging files cannot be deleted or replaced.
  const { data: claim, error: claimError } = await db
    .rpc('svc_claim_media', { p_id: id, p_user: user.id })
    .single<{ claimed: boolean; claim_id: string | null; state: string; field: string; path: string; thumb_path: string }>();
  if (claimError || !claim) {
    const code = /media:(\w+)/.exec(claimError?.message ?? '')?.[1] ?? 'generic';
    return json({ error: code }, code === 'not_yours' ? 403 : 409);
  }
  if (!claim.claimed) return claim.state === 'removed' ? json({ error: 'file_missing' }, 409) : json({ ok: true, state: claim.state });
  const row = claim;

  const staging = db.storage.from(STAGING);
  const dropStaging = () => staging.remove([row.path, row.thumb_path]).catch(() => undefined);
  // L-c: only this call's claim id can end or use the claim.
  const claimId = row.claim_id;
  const release = () => db.rpc('svc_release_media', { p_id: id, p_user: user.id, p_claim: claimId });
  const refuse = async (code: string) => {
    await db.rpc('svc_refuse_media', { p_id: id, p_user: user.id, p_claim: claimId });
    await dropStaging();
    console.log('media-finish: refused', code);
    return json({ error: code }, 422);
  };

  const [main, thumb] = await Promise.all([staging.download(row.path), staging.download(row.thumb_path)]);
  if (main.error || thumb.error || !main.data || !thumb.data) {
    await release();
    return json({ error: 'file_missing' }, 409);
  }
  const mainBytes = new Uint8Array(await main.data.arrayBuffer());
  const thumbBytes = new Uint8Array(await thumb.data.arrayBuffer());
  if (mainBytes.length > (MAX_BYTES[row.field] ?? 0) || thumbBytes.length > THUMB_MAX) return refuse('file_too_big');

  const expected = row.path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const cleanMain = cleanImageBytes(mainBytes);
  const cleanThumb = cleanImageBytes(thumbBytes);
  if (!cleanMain.ok || !cleanThumb.ok) return refuse('file_type');
  if (cleanMain.mime !== expected || cleanThumb.mime !== expected) return refuse('file_type');
  if (cleanMain.width > 4000 || cleanMain.height > 4000) return refuse('bad_size');
  // N2: the thumbnail is small (the field's thumbnail size, at most 800 px) and the same shape as the photo.
  if (Math.max(cleanThumb.width, cleanThumb.height) > (THUMB_SIDE[row.field] ?? 400)) return refuse('bad_size');
  // A very long, thin picture (a wide panorama) cannot get a thumbnail of the same shape: the screen
  // then asks the person to crop it ('too_thin').
  const ratio = cleanMain.width / cleanMain.height;
  if (Math.abs(cleanThumb.width / cleanThumb.height - ratio) / ratio > 0.02) return refuse('too_thin');

  const bucket = row.field === 'product' ? 'media-pending' : 'media';
  const target = db.storage.from(bucket);
  // upsert: an earlier claim that failed halfway may have left a file (it was removed again, N4).
  const options = { contentType: expected, cacheControl: '3600', upsert: true };
  const [putMain, putThumb] = await Promise.all([target.upload(row.path, cleanMain.bytes, options), target.upload(row.thumb_path, cleanThumb.bytes, options)]);
  if (putMain.error || putThumb.error) {
    // N4: never leave one of the two in the public bucket.
    await target.remove([row.path, row.thumb_path]).catch(() => undefined);
    await release();
    console.error('media-finish: write failed');
    return json({ error: 'network' }, 502);
  }

  const { data: done, error: finishError } = await db
    .rpc('svc_finish_media', { p_id: id, p_user: user.id, p_claim: claimId, p_width: cleanMain.width, p_height: cleanMain.height, p_placeholder: placeholder })
    .single<{ state: string; replaced_bucket: string; replaced_paths: string[] }>();
  if (finishError || !done) {
    // Not shown: take the copies out of the field's bucket again.
    await target.remove([row.path, row.thumb_path]).catch(() => undefined);
    await release();
    const code = /media:(\w+)/.exec(finishError?.message ?? '')?.[1] ?? 'generic';
    console.error('media-finish: finish failed', code);
    return json({ error: code }, 409);
  }
  await dropStaging();
  if (done.replaced_paths?.length) await db.storage.from(done.replaced_bucket).remove(done.replaced_paths).catch(() => undefined);
  return json({ ok: true, state: done.state, replaced: done.replaced_paths ?? [] });
});
