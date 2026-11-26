// Deletes photo files from the `media` and `media-pending` buckets (slice S4, migration
// 20261126000100_media_uploads.sql). Called every hour by pg_cron (private.media_sweep) with
// "Authorization: Bearer <MEDIA_SWEEP_SECRET>". verify_jwt is off for this function
// (supabase/config.toml): the secret, not a user token, is the check here. Same pattern as
// verification-sweep.
//
//   POST {}                  normal run
//   POST { "dry_run": true } counts only, deletes nothing. Use it for the first runs on a project.
//
// public.svc_media_sweep_list() lists files of removed photos, files no row names after 24 hours, and
// files whose account is gone. Circuit breaker: if a run would delete more than MAX_ORPHANS files
// without a row or account, or more than MAX_SHARE of all files (above MIN_BREAK), it deletes nothing
// and says so in the log; Walter then checks with a dry run. Logs only counts, never file names.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string) => Deno.env.get(key) ?? '';
const BATCH = 100;
const MIN_SECRET_LENGTH = 32;
const MAX_ORPHANS = 100;
const MAX_SHARE = 0.2;
const MIN_BREAK = 50;

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = env('MEDIA_SWEEP_SECRET');
  if (secret.length < MIN_SECRET_LENGTH) return json({ error: 'not_configured' }, 503);
  const given = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!sameSecret(given, secret)) return json({ error: 'forbidden' }, 403);
  const body = (await req.json().catch(() => ({}))) as { dry_run?: unknown };
  const dryRun = body.dry_run === true;

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const [{ data, error }, { data: totalData, error: countError }] = await Promise.all([
    db.rpc('svc_media_sweep_list', { p_limit: 500 }),
    db.rpc('svc_media_bucket_count'),
  ]);
  if (error || countError) {
    console.error('media-sweep: list failed');
    return json({ error: 'failed' }, 500);
  }
  const rows = (data ?? []) as { bucket_id: string; name: string; reason: string }[];
  const listed: Record<string, number> = {};
  for (const r of rows) listed[r.reason] = (listed[r.reason] ?? 0) + 1;
  const orphans = (listed.no_account ?? 0) + (listed.no_row ?? 0);
  const total = Number(totalData ?? 0);
  const tripped = orphans > MAX_ORPHANS || (rows.length > MIN_BREAK && rows.length > total * MAX_SHARE);

  if (dryRun || tripped) {
    if (tripped && !dryRun) console.error('media-sweep: HALTED by circuit breaker', JSON.stringify({ listed, total }));
    else console.log('media-sweep: dry run', JSON.stringify({ listed, total }));
    return json({ dry_run: dryRun, halted: tripped && !dryRun, would_break: tripped, bucket_total: total, listed });
  }

  let removed = 0;
  let failed = 0;
  for (const bucket of ['media', 'media-pending']) {
    const names = rows.filter((r) => r.bucket_id === bucket).map((r) => r.name);
    for (let i = 0; i < names.length; i += BATCH) {
      const batch = names.slice(i, i + BATCH);
      const { data: gone, error: rmError } = await db.storage.from(bucket).remove(batch);
      if (rmError) {
        failed += batch.length;
        continue;
      }
      removed += (gone ?? []).length;
      failed += batch.length - (gone ?? []).length;
    }
  }
  console.log('media-sweep', JSON.stringify({ listed, removed, failed }));
  return json({ dry_run: false, halted: false, listed, removed, failed });
});
