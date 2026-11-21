// NIDA, passport and TIN numbers: the ONLY place they are encrypted or decrypted (security review M4).
// Used by both the website and the app with the signed-in person's own token. No service role key
// on the web host; the keys and the service role key live only in Supabase Edge Function secrets.
//
//   POST { action: "set", field, value, country?, valid_until?, provider_id?, notice_version } + user token
//        → { ok, last3 }            owner writes their own number (business_tin: their own business)
//   POST { action: "clear", field, provider_id? } + user token → { ok }
//   POST { action: "read", field, user_id?, provider_id?, reason } + admin token (two-step, aal2)
//        → { value }                logged as identifier_viewed BEFORE decrypting; shown once
//
// fields: "nida" | "passport" | "tin" | "business_tin"
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets). Without the keys every call answers 503.
//   IDENTIFIER_ENC_KEY_V1        32 random bytes, base64 (AES-256-GCM)
//   IDENTIFIER_ENC_KEY_ACTIVE    "1"
//   IDENTIFIER_HMAC_KEY_V1       32 random bytes, base64 (HMAC-SHA256, duplicate flag)
//   IDENTIFIER_HMAC_KEY_ACTIVE   "1"
//   IDENTIFIERS_ALLOWED_ORIGINS  comma-separated website origins for browser calls (default https://kwetuly.com)
//
// Never log a request body, a response body, a number, a cipher or a token. Errors are generic codes.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseIdentifier, type IdentifierField } from '../_shared/identifier-formats.ts';
import { bytesToB64, b64Decode, CryptoConfigError, decryptIdentifier, encryptIdentifier, hashIdentifier, loadKeyRing, type KeyRing } from './crypto.ts';

const env = (key: string) => Deno.env.get(key);
const FIELDS: IdentifierField[] = ['nida', 'passport', 'tin', 'business_tin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTICE = /^[A-Za-z0-9._-]{1,40}$/;
const ORIGINS = (env('IDENTIFIERS_ALLOWED_ORIGINS') ?? 'https://kwetuly.com').split(',').map((s) => s.trim()).filter(Boolean);

function headers(req: Request): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  const origin = req.headers.get('Origin');
  if (origin && ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return h;
}

let ringPromise: Promise<KeyRing> | null = null;
const keyRing = () => (ringPromise ??= loadKeyRing(env).catch((err) => {
  ringPromise = null;
  throw err;
}));

const db = () => createClient(env('SUPABASE_URL') ?? '', env('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

// The token was verified by auth.getUser() first; this only reads its aal claim.
function aalOf(token: string): string {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4))).aal ?? '');
  } catch {
    return '';
  }
}

// Database errors are short codes from the svc_* functions; anything else becomes "failed".
function dbError(message: string | undefined): { code: string; status: number } {
  for (const [code, status] of [['rate_limited', 429], ['forbidden', 403], ['not_onboarded', 403], ['reason_required', 400], ['not_found', 404], ['bad_field', 400]] as const) {
    if (message?.includes(code)) return { code, status };
  }
  return { code: 'failed', status: 500 };
}

function tzToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const h = headers(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);

  let ring: KeyRing;
  try {
    ring = await keyRing();
  } catch (err) {
    console.error('identifiers: keys not configured', err instanceof CryptoConfigError ? err.message : 'unknown');
    return reply({ error: 'not_configured' }, 503);
  }

  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const client = db();
  const { data: auth } = token ? await client.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return reply({ error: 'sign_in' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? '');
  const field = String(body.field ?? '') as IdentifierField;
  if (!FIELDS.includes(field)) return reply({ error: 'bad_request' }, 400);
  const providerId = body.provider_id == null ? null : String(body.provider_id);
  if (providerId !== null && !UUID.test(providerId)) return reply({ error: 'bad_request' }, 400);
  if ((field === 'business_tin') !== (providerId !== null)) return reply({ error: 'bad_request' }, 400);

  // ---- owner: set or clear their own number (never a user_id from the body) ----
  if (action === 'set' || action === 'clear') {
    const subject = field === 'business_tin' ? providerId! : user.id;
    let args: Record<string, unknown> = {
      p_actor: user.id, p_user: user.id, p_provider: providerId, p_field: field,
      p_cipher: null, p_last3: null, p_hmac: null, p_hmac_version: null, p_key_version: null,
      p_country: null, p_valid_until: null, p_notice_version: null,
    };
    let last3: string | null = null;
    if (action === 'set') {
      const notice = String(body.notice_version ?? '');
      if (!NOTICE.test(notice)) return reply({ error: 'bad_request' }, 400);
      const parsed = parseIdentifier(field, String(body.value ?? ''), body.country == null ? null : String(body.country));
      if (!parsed.ok) return reply({ error: parsed.error }, 400);
      let validUntil: string | null = null;
      let country: string | null = null;
      if (field === 'passport') {
        validUntil = String(body.valid_until ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(Date.parse(validUntil))) return reply({ error: 'valid_until' }, 400);
        if (validUntil < tzToday()) return reply({ error: 'expired' }, 400);
        country = parsed.hmacInput!.split('|')[1];
      }
      const cipher = await encryptIdentifier(ring, subject, field, parsed.value);
      const hashed = parsed.hmacInput ? await hashIdentifier(ring, parsed.hmacInput) : null;
      last3 = parsed.last3;
      args = {
        ...args,
        p_cipher: bytesToB64(cipher), p_last3: parsed.last3,
        p_hmac: hashed ? bytesToB64(hashed.hash) : null, p_hmac_version: hashed?.version ?? null,
        p_key_version: ring.encActive, p_country: country, p_valid_until: validUntil, p_notice_version: notice,
      };
    }
    const { error } = await client.rpc('svc_identifier_set', args);
    if (error) {
      const e = dbError(error.message);
      console.error('identifiers: write refused', e.code);
      return reply({ error: e.code }, e.status);
    }
    return reply(action === 'set' ? { ok: true, last3 } : { ok: true });
  }

  // ---- admin: one full read, logged before decrypting (M5) ----
  if (action === 'read') {
    const userId = body.user_id == null ? null : String(body.user_id);
    if (field !== 'business_tin' && (!userId || !UUID.test(userId))) return reply({ error: 'bad_request' }, 400);
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 5 || reason.length > 300) return reply({ error: 'reason_required' }, 400);
    if (aalOf(token) !== 'aal2') return reply({ error: 'two_step_required' }, 403);
    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return reply({ error: 'forbidden' }, 403);

    // Returns { cipher } or { error }; a refused read is logged and alerted in the database (MA2).
    const { data, error } = await client.rpc('svc_identifier_cipher_for_read', {
      p_actor: user.id, p_actor_aal: 'aal2', p_user: field === 'business_tin' ? null : userId,
      p_provider: providerId, p_field: field, p_reason: reason,
    });
    const result = (data ?? {}) as { cipher?: string; error?: string };
    const cipherB64 = result.cipher;
    if (error || typeof cipherB64 !== 'string') {
      const e = dbError(error?.message ?? result.error ?? 'not_found');
      console.error('identifiers: read refused', e.code);
      return reply({ error: e.code }, e.status);
    }
    try {
      const subject = field === 'business_tin' ? providerId! : userId!;
      return reply({ value: await decryptIdentifier(ring, subject, field, b64Decode(cipherB64)) });
    } catch {
      console.error('identifiers: decrypt failed');
      return reply({ error: 'failed' }, 500);
    }
  }

  return reply({ error: 'bad_request' }, 400);
});
