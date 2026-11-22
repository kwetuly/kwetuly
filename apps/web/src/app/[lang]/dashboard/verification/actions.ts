'use server';

import { refresh } from 'next/cache';
import { VERIFICATION_NOTICE_VERSION } from '@kwetuly/shared';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Identity numbers (NIDA, passport, TIN) go only through the `identifiers` Edge Function, called from
// this server with the person's own token (never a service key here; security review M4). The number
// is sent once and never kept, logged or returned; the function answers with the last 3 characters.
// While its keys are not set it answers 503 not_configured, and the screen says "opens soon".
const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/identifiers`;

export type IdentifierResult = { ok: true; field: string; last3?: string; cleared?: boolean } | { ok: false; field: string; error: string } | null;

const FIELDS = new Set(['nida', 'passport', 'business_tin']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function callIdentifiers(body: Record<string, string | null>): Promise<{ status: number; json: Record<string, unknown> }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, json: { error: 'sign_in' } };
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return { status: res.status, json: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
  } catch {
    return { status: 0, json: { error: 'network' } };
  }
}

/** A 503, or a function that is not deployed yet (404 without our own error code): number saving opens soon. */
function errorCode(status: number, json: Record<string, unknown>): string {
  const code = typeof json.error === 'string' ? json.error : '';
  if (status === 503 || code === 'not_configured' || (status === 404 && !code)) return 'not_configured';
  return code || 'failed';
}

export async function saveIdentifier(_previous: IdentifierResult, formData: FormData): Promise<IdentifierResult> {
  const field = String(formData.get('field') ?? '');
  if (!FIELDS.has(field)) return { ok: false, field, error: 'bad_request' };
  if (!(await getCurrentUser())) return { ok: false, field, error: 'sign_in' };
  if (formData.get('consent') !== 'yes') return { ok: false, field, error: 'consent' };
  const clear = formData.get('intent') === 'clear';
  const providerId = field === 'business_tin' ? String(formData.get('provider_id') ?? '') : null;
  if (providerId !== null && !UUID.test(providerId)) return { ok: false, field, error: 'bad_request' };

  const body: Record<string, string | null> = clear
    ? { action: 'clear', field, provider_id: providerId }
    : {
        action: 'set',
        field,
        provider_id: providerId,
        value: String(formData.get('value') ?? '').slice(0, 40),
        country: field === 'passport' ? String(formData.get('country') ?? '').slice(0, 2) : null,
        valid_until: field === 'passport' ? String(formData.get('valid_until') ?? '').slice(0, 10) : null,
        notice_version: VERIFICATION_NOTICE_VERSION,
      };
  if (!clear && !body.value?.trim()) return { ok: false, field, error: 'empty' };
  const { status, json } = await callIdentifiers(body);
  if (status !== 200 || json.ok !== true) return { ok: false, field, error: errorCode(status, json) };
  refresh();
  return clear ? { ok: true, field, cleared: true } : { ok: true, field, last3: typeof json.last3 === 'string' ? json.last3 : undefined };
}
