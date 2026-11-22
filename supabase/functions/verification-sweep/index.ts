// Deletes ID and role document files from the private `verification` bucket (security review H2, M11).
// Called every hour by pg_cron (private.run_verification_sweep, migration 20261122000000) with
// "Authorization: Bearer <VERIFICATION_SWEEP_SECRET>". verify_jwt is off for this function
// (supabase/config.toml): the secret, not a user token, is the check here.
//
//   POST {}                  normal run
//   POST { "dry_run": true } counts only: deletes nothing, expires nothing. Use it for the first runs on
//                            a project and after every migration that touches `verification` paths.
//
// Per run, in this order:
//   1. Documents nobody reviewed within private.waiting_limit_days() become 'expired' (LA4).
//   2. public.svc_verification_sweep_list() lists files whose account is gone, files with no document
//      row after 24 hours (old guide and business papers are kept), and files of withdrawn, expired,
//      rejected (30 days) and accepted (90 days) documents. Periods are proposals until legal confirms.
//   3. Circuit breaker (MA3): if the run would delete more than MAX_ORPHANS files without an account or
//      row, or more than MAX_SHARE of the bucket (and over MIN_BREAK files), it deletes NOTHING and
//      alerts every admin. Walter then checks with a dry run before anything is changed.
//   4. Deletes through the Storage API; marks removed_at only for files storage confirmed (LA7).
// Never deletes the file of a document that is still waiting.
//
// Secrets: VERIFICATION_SWEEP_SECRET (at least 32 random characters; also in Vault as verification_sweep_key).
// Logs only counts, never file names (they contain user ids).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string) => Deno.env.get(key) ?? '';
const BATCH = 100;
const MIN_SECRET_LENGTH = 32;
const MAX_ORPHANS = 50; // no_account + no_row in one run
const MAX_SHARE = 0.1; // of all files in the bucket
const MIN_BREAK = 20; // the share rule applies only above this many files

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
  const secret = env('VERIFICATION_SWEEP_SECRET');
  if (secret.length < MIN_SECRET_LENGTH) return json({ error: 'not_configured' }, 503);
  const given = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!sameSecret(given, secret)) return json({ error: 'forbidden' }, 403);
  const body = (await req.json().catch(() => ({}))) as { dry_run?: unknown };
  const dryRun = body.dry_run === true;

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  const { data: expired, error: expireError } = await db.rpc('svc_expire_stale_waiting', { p_dry_run: dryRun });
  if (expireError) {
    console.error('verification-sweep: expire failed');
    return json({ error: 'failed' }, 500);
  }

  const [{ data, error }, { data: bucketTotal, error: countError }] = await Promise.all([
    db.rpc('svc_verification_sweep_list', { p_limit: 500 }),
    db.rpc('svc_verification_bucket_count'),
  ]);
  if (error || countError) {
    console.error('verification-sweep: list failed');
    return json({ error: 'failed' }, 500);
  }
  const rows = (data ?? []) as { name: string; reason: string }[];
  const listed: Record<string, number> = {};
  for (const r of rows) listed[r.reason] = (listed[r.reason] ?? 0) + 1;
  const orphans = (listed.no_account ?? 0) + (listed.no_row ?? 0);
  const total = Number(bucketTotal ?? 0);
  const tripped = orphans > MAX_ORPHANS || (rows.length > MIN_BREAK && rows.length > total * MAX_SHARE);

  if (dryRun || tripped) {
    if (tripped && !dryRun) {
      await db.rpc('svc_verification_sweep_halted');
      console.error('verification-sweep: HALTED by circuit breaker', JSON.stringify({ listed, total }));
    } else {
      console.log('verification-sweep: dry run', JSON.stringify({ listed, total, expired }));
    }
    return json({ dry_run: dryRun, halted: tripped && !dryRun, would_break: tripped, bucket_total: total, would_expire: expired, listed });
  }

  const removed: Record<string, number> = {};
  let failed = 0;
  let marked = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data: gone, error: rmError } = await db.storage.from('verification').remove(batch.map((r) => r.name));
    if (rmError) {
      failed += batch.length;
      continue;
    }
    const goneNames = new Set((gone ?? []).map((o) => o.name));
    const confirmed = batch.filter((r) => goneNames.has(r.name));
    failed += batch.length - confirmed.length;
    for (const r of confirmed) removed[r.reason] = (removed[r.reason] ?? 0) + 1;
    if (confirmed.length) {
      // The database marks only rows whose file is really gone (LA7).
      const { data: n, error: markError } = await db.rpc('svc_verification_sweep_mark', { p_names: confirmed.map((r) => r.name) });
      if (markError) console.error('verification-sweep: mark failed');
      else marked += Number(n ?? 0);
    }
  }
  console.log('verification-sweep', JSON.stringify({ expired, listed, removed, marked, failed }));
  return json({ dry_run: false, halted: false, expired, listed, removed, marked, failed });
});
