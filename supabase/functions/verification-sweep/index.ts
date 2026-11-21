// Deletes ID and role document files from the private `verification` bucket (security review H2, M11).
// Called every hour by pg_cron (private.run_verification_sweep, migration 20261122000000) with
// "Authorization: Bearer <VERIFICATION_SWEEP_SECRET>". Deploy with --no-verify-jwt: the secret, not a
// user token, is the check here.
//
// Deletes, per public.svc_verification_sweep_list():
//   - files whose owner's account no longer exists (deleted in the app or by an admin in the dashboard)
//   - files with no person_documents row after 24 hours (old guide and business papers are kept)
//   - files of withdrawn, rejected (30 days) and accepted (90 days) documents; the row and dates stay
//     and get removed_at. Periods are proposals until legal and the advocate confirm them.
// Never deletes the file of a document that is still waiting.
//
// Secrets: VERIFICATION_SWEEP_SECRET (random, also stored in Vault as verification_sweep_key).
// Logs only counts, never file names (they contain user ids).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string) => Deno.env.get(key) ?? '';
const BATCH = 100;

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
  const given = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret) return json({ error: 'not_configured' }, 503);
  if (!sameSecret(given, secret)) return json({ error: 'forbidden' }, 403);

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data, error } = await db.rpc('svc_verification_sweep_list', { p_limit: 500 });
  if (error) {
    console.error('verification-sweep: list failed');
    return json({ error: 'failed' }, 500);
  }
  const rows = (data ?? []) as { name: string; reason: string }[];
  const counts: Record<string, number> = {};
  let removed = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const names = batch.map((r) => r.name);
    const { data: gone, error: rmError } = await db.storage.from('verification').remove(names);
    if (rmError) {
      failed += names.length;
      continue;
    }
    const goneNames = new Set((gone ?? []).map((o) => o.name));
    // Mark rows for every file that is no longer there (removed now, or already missing).
    const { error: markError } = await db.rpc('svc_verification_sweep_mark', { p_names: names });
    if (markError) failed += names.length;
    for (const r of batch) {
      if (goneNames.has(r.name)) {
        removed++;
        counts[r.reason] = (counts[r.reason] ?? 0) + 1;
      }
    }
  }
  console.log('verification-sweep', JSON.stringify({ listed: rows.length, removed, failed, counts }));
  return json({ listed: rows.length, removed, failed, counts });
});
