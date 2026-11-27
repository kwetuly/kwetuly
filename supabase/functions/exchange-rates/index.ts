// Reads the Bank of Tanzania indicative exchange rates and stores them (slice S48, design section 12.3).
// Display only: these rates are used for the grey "about" estimate, never to charge or settle.
//
// Callers (verify_jwt is off for this function in supabase/config.toml; the function checks itself):
//   - pg_cron at 10:00 and 16:00 East Africa time (private.run_exchange_rates_fetch, see the header of
//     migration 20261203030000_exchange_rates.sql) with header "x-exchange-rates-key: <EXCHANGE_RATES_SECRET>".
//   - An admin's "Fetch now": "Authorization: Bearer <the admin's own access token>". The database
//     (public.admin_rates_fetch_request) checks the admin role and a two-step (aal2) session, and allows
//     one admin fetch every 2 minutes.
//
// Steps: GET the page (20 s timeout, 3 tries, waits 30 s and 120 s, generic User-Agent); parse.ts reads
// the table strictly and keeps allow-listed currencies only; public.svc_exchange_rates_save checks every
// row again, marks jumps over 15% as suspect and alerts admins. Without a good USD row nothing is saved.
//
// Secrets: EXCHANGE_RATES_SECRET (at least 32 random characters; also in Vault as exchange_rates_key).
// Walter adds them by following supabase/README-exchange-rates.md. Logs counts and error codes only,
// never page content or tokens.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BOT_RATES_URL } from '../_shared/currencies.ts';
import { parseBotRates } from './parse.ts';

const env = (key: string) => Deno.env.get(key) ?? '';
const MIN_SECRET_LENGTH = 32;
const TIMEOUT_MS = 20_000;
const WAITS_MS = [30_000, 120_000]; // before the 2nd and 3rd try
const MAX_BYTES = 2_000_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; rates-reader/1.0)';

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FetchResult = { ok: true; html: string } | { ok: false; error: 'timeout' | 'network' | 'http_status' | 'not_html' | 'too_large' };

async function fetchOnce(): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BOT_RATES_URL, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      await res.body?.cancel();
      return { ok: false, error: 'http_status' };
    }
    if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) {
      await res.body?.cancel();
      return { ok: false, error: 'not_html' };
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) {
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
      if (size > MAX_BYTES) {
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

async function fetchWithRetries(): Promise<FetchResult> {
  let last: FetchResult = { ok: false, error: 'network' };
  for (let attempt = 0; attempt <= WAITS_MS.length; attempt++) {
    if (attempt > 0) await sleep(WAITS_MS[attempt - 1]);
    last = await fetchOnce();
    // Only a failure to connect is worth another try; a page that answered stays as it is.
    if (last.ok || (last.error !== 'timeout' && last.error !== 'network' && last.error !== 'http_status')) return last;
  }
  return last;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
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
    if (!sameSecret(givenKey, secret)) return json({ error: 'forbidden' }, 403);
    trigger = 'cron';
  } else {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    if (!token || !anonKey) return json({ error: 'forbidden' }, 403);
    const asUser = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await asUser.rpc('admin_rates_fetch_request');
    if (error || typeof data !== 'string') {
      return json({ error: error?.code === 'P0001' ? 'too_soon' : 'forbidden' }, error?.code === 'P0001' ? 429 : 403);
    }
    trigger = 'admin';
    requestedBy = data;
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const failed = async (code: string) => {
    const { error } = await db.rpc('svc_exchange_fetch_failed', { p_error: code, p_trigger: trigger, p_requested_by: requestedBy });
    if (error) console.error('exchange-rates: log failed');
    console.error('exchange-rates', JSON.stringify({ trigger, ok: false, error: code }));
    return json({ ok: false, error: code }, 502);
  };

  const page = await fetchWithRetries();
  if (!page.ok) return failed(page.error);

  const parsed = parseBotRates(page.html, new Date());
  if (!parsed.ok) return failed(parsed.error);

  const { data, error } = await db.rpc('svc_exchange_rates_save', {
    p_rows: parsed.rates,
    p_trigger: trigger,
    p_requested_by: requestedBy,
    p_dropped: parsed.dropped,
    p_refused: parsed.refused,
  });
  if (error) {
    console.error('exchange-rates: save failed');
    return json({ ok: false, error: 'save_failed' }, 500);
  }
  console.log('exchange-rates', JSON.stringify({ trigger, result: data }));
  return json(data);
});
