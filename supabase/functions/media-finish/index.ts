// Finishes a photo upload (slice S4, security review M1). Called by the website (server action) and
// the app with the person's own token; verify_jwt is on and the token is checked again here.
//
//   POST { "id": "<media id>", "placeholder": "#rrggbb" | null }
//
// 1. The row must be the caller's and still uploading.
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

  const { data: row, error: rowError } = await db.from('media').select('id, owner_id, field, path, thumb_path, state').eq('id', id).maybeSingle();
  if (rowError) return json({ error: 'generic' }, 500);
  if (!row || row.owner_id !== user.id) return json({ error: 'not_yours' }, 403);
  if (row.state !== 'uploading') return json({ ok: true, state: row.state });

  const staging = db.storage.from(STAGING);
  const dropStaging = () => staging.remove([row.path, row.thumb_path]).catch(() => undefined);
  const refuse = async (code: string) => {
    await db.rpc('svc_refuse_media', { p_id: id, p_user: user.id });
    await dropStaging();
    console.log('media-finish: refused', code);
    return json({ error: code }, 422);
  };

  const [main, thumb] = await Promise.all([staging.download(row.path), staging.download(row.thumb_path)]);
  if (main.error || thumb.error || !main.data || !thumb.data) return json({ error: 'file_missing' }, 409);
  const mainBytes = new Uint8Array(await main.data.arrayBuffer());
  const thumbBytes = new Uint8Array(await thumb.data.arrayBuffer());
  if (mainBytes.length > (MAX_BYTES[row.field] ?? 0) || thumbBytes.length > THUMB_MAX) return refuse('file_too_big');

  const expected = row.path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const cleanMain = cleanImageBytes(mainBytes);
  const cleanThumb = cleanImageBytes(thumbBytes);
  if (!cleanMain.ok || !cleanThumb.ok) return refuse('file_type');
  if (cleanMain.mime !== expected || cleanThumb.mime !== expected) return refuse('file_type');
  if (cleanMain.width > 4000 || cleanMain.height > 4000) return refuse('bad_size');

  const bucket = row.field === 'product' ? 'media-pending' : 'media';
  const target = db.storage.from(bucket);
  // upsert: a retry after a lost answer may find the files already written.
  const options = { contentType: expected, cacheControl: '3600', upsert: true };
  const [putMain, putThumb] = await Promise.all([target.upload(row.path, cleanMain.bytes, options), target.upload(row.thumb_path, cleanThumb.bytes, options)]);
  if (putMain.error || putThumb.error) {
    console.error('media-finish: write failed');
    return json({ error: 'network' }, 502);
  }

  const { data: done, error: finishError } = await db
    .rpc('svc_finish_media', { p_id: id, p_user: user.id, p_width: cleanMain.width, p_height: cleanMain.height, p_placeholder: placeholder })
    .single<{ state: string; replaced_bucket: string; replaced_paths: string[] }>();
  if (finishError || !done) {
    // Not shown: take the copies out of the field's bucket again.
    await target.remove([row.path, row.thumb_path]).catch(() => undefined);
    const code = /media:(\w+)/.exec(finishError?.message ?? '')?.[1] ?? 'generic';
    console.error('media-finish: finish failed', code);
    return json({ error: code }, 409);
  }
  await dropStaging();
  if (done.replaced_paths?.length) await db.storage.from(done.replaced_bucket).remove(done.replaced_paths).catch(() => undefined);
  return json({ ok: true, state: done.state, replaced: done.replaced_paths ?? [] });
});
