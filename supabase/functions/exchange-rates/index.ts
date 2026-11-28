// Reads the Bank of Tanzania indicative exchange rates and stores them (slice S48, design section 12.3).
// Display only: these rates are used for the grey "about" estimate, never to charge or settle.
//
// Callers (verify_jwt is off for this function in supabase/config.toml; the function checks itself):
//   - pg_cron at 10:00 and 16:00 East Africa time (private.run_exchange_rates_fetch, migration
//     20261203030000_exchange_rates.sql) with header "x-exchange-rates-key: <EXCHANGE_RATES_SECRET>".
//   - An admin's "Fetch now": "Authorization: Bearer <the admin's own access token>". The database
//     (public.admin_rates_fetch_request) checks the admin role and a two-step (aal2) session, records
//     the request at once and allows one admin request every 2 minutes.
//
// The call is answered at once (202) and the work goes on in EdgeRuntime.waitUntil. Everything fits in
// DEADLINE_MS (well under the 150 s wall-clock limit): up to 3 tries of at most 20 s each, with 15 s and
// 45 s waits. A try that would pass the deadline is not started, and the failure is logged first.
// The result is in the fetch log (public.admin_exchange_fetch_log), not in the answer.
//
// Steps: GET the page (no redirects followed, 2 MB cap, generic User-Agent); parse.ts reads the table
// strictly and keeps allow-listed currencies only; public.svc_exchange_rates_save checks every row again,
// marks jumps over 15% as suspect and alerts admins. Without a good USD row nothing is saved.
//
// S49: call "Fetch now" from the server (a Next server action that passes the signed-in admin's own
// access token), not from the browser. OPTIONS and CORS headers are answered like media-finish only so
// that a browser call fails cleanly; every call still needs the secret or an admin's token.
//
// Answers: 202 {"accepted":true}; 403 {"error":"forbidden"}; 429 {"error":"too_soon"} (an admin request
// less than 2 minutes ago); 503 {"error":"not_configured"}; 405 {"error":"method"}.
//
// Secrets: EXCHANGE_RATES_SECRET (at least 32 random characters; also in Vault as exchange_rates_key).
// Walter adds them by following supabase/README-exchange-rates.md. Logs counts and error codes only,
// never page content or tokens.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { BOT_RATES_URL } from '../_shared/currencies.ts';
import { MAX_PAGE_BYTES, parseBotRates } from './parse.ts';

// Provided by the Supabase Edge Runtime (typed here so no unpinned type import is needed).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const env = (key: string) => Deno.env.get(key) ?? '';
const MIN_SECRET_LENGTH = 32;
const TRY_TIMEOUT_MS = 20_000;
const WAITS_MS = [15_000, 45_000]; // before the 2nd and 3rd try
const DEADLINE_MS = 125_000; // all tries; parsing and saving take a few seconds more
const USER_AGENT = 'Mozilla/5.0 (compatible; rates-reader/1.0)';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Compares SHA-256 digests (fixed length), so neither the content nor the length of the secret leaks. */
async function sameSecret(given: string, secret: string): Promise<boolean> {
  if (!given || !secret) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(secret)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FetchError = 'timeout' | 'network' | 'http_status' | 'redirect' | 'not_html' | 'too_large';
type FetchResult = { ok: true; html: string } | { ok: false; error: FetchError };

async function fetchOnce(timeoutMs: number): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BOT_RATES_URL, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'manual', // a moved page is a changed page: never follow it elsewhere
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      return { ok: false, error: 'redirect' };
    }
    if (!res.ok) {
      await res.body?.cancel();
      return { ok: false, error: 'http_status' };
    }
    if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) {
      await res.body?.cancel();
      return { ok: false, error: 'not_html' };
    }
    if (Number(res.headers.get('content-length') ?? '0') > MAX_PAGE_BYTES) {
      await res.body?.cancel();
      return { ok: false, error: 'too_large' };
    }
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: 'network' };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAGE_BYTES) {
        await reader.cancel();
        return { ok: false, error: 'too_large' };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return { ok: true, html: new TextDecoder('utf-8').decode(bytes) };
  } catch (e) {
    return { ok: false, error: e instanceof DOMException && e.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetries(started: number): Promise<FetchResult> {
  let last: FetchResult = { ok: false, error: 'timeout' };
  for (let attempt = 0; attempt <= WAITS_MS.length; attempt++) {
    if (attempt > 0) {
      // Do not start a try (wait included) that cannot finish before the deadline.
      if (Date.now() - started + WAITS_MS[attempt - 1] + 5_000 > DEADLINE_MS) return last;
      await sleep(WAITS_MS[attempt - 1]);
    }
    const left = DEADLINE_MS - (Date.now() - started);
    if (left < 5_000) return last;
    last = await fetchOnce(Math.min(TRY_TIMEOUT_MS, left));
    // Only a failure to connect is worth another try; a page that answered stays as it is.
    if (last.ok || (last.error !== 'timeout' && last.error !== 'network' && last.error !== 'http_status')) return last;
  }
  return last;
}

type Db = ReturnType<typeof createClient>;

async function run(db: Db, trigger: 'cron' | 'admin', requestedBy: string | null, started: number): Promise<void> {
  const failed = async (code: string) => {
    const { error } = await db.rpc('svc_exchange_fetch_failed', { p_error: code, p_trigger: trigger, p_requested_by: requestedBy });
    console.error('exchange-rates', JSON.stringify({ trigger, ok: false, error: code, logged: !error }));
  };
  try {
    const page = await fetchWithRetries(started);
    if (!page.ok) return await failed(page.error);
    const parsed = parseBotRates(page.html, new Date());
    if (!parsed.ok) return await failed(parsed.error);
    const { data, error } = await db.rpc('svc_exchange_rates_save', {
      p_rows: parsed.rates,
      p_trigger: trigger,
      p_requested_by: requestedBy,
      p_dropped: parsed.dropped,
      p_refused: parsed.refused,
    });
    if (error) return await failed('save_failed');
    console.log('exchange-rates', JSON.stringify({ trigger, result: data }));
  } catch {
    await failed('unexpected');
  }
}

Deno.serve(async (req) => {
  const started = Date.now();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = env('SUPABASE_ANON_KEY');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 503);

  // Who is calling: the cron secret, or an admin's own token.
  let trigger: 'cron' | 'admin';
  let requestedBy: string | null = null;
  const givenKey = req.headers.get('x-exchange-rates-key') ?? '';
  if (givenKey) {
    const secret = env('EXCHANGE_RATES_SECRET');
    if (secret.length < MIN_SECRET_LENGTH) return json({ error: 'not_configured' }, 503);
    if (!(await sameSecret(givenKey, secret))) return json({ error: 'forbidden' }, 403);
    trigger = 'cron';
  } else {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    if (!token || !anonKey) return json({ error: 'forbidden' }, 403);
    const asUser = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    // Records the request (the 2-minute limit counts it at once) and returns the admin's id.
    const { data, error } = await asUser.rpc('admin_rates_fetch_request');
    if (error || typeof data !== 'string') {
      const tooSoon = error?.code === 'P0001';
      return json({ error: tooSoon ? 'too_soon' : 'forbidden' }, tooSoon ? 429 : 403);
    }
    trigger = 'admin';
    requestedBy = data;
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const work = run(db, trigger, requestedBy, started);
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    // Only local runs lack the Edge Runtime; on a hosted project this would block the answer.
    if (!/^https?:\/\/(localhost|127\.0\.0\.1|kong)(:\d+)?(\/|$)/.test(url)) {
      console.warn('exchange-rates: EdgeRuntime.waitUntil missing on a hosted project; working before answering');
    }
    await work;
  }
  return json({ accepted: true }, 202);
});
