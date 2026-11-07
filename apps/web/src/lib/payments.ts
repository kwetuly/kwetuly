import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import type { PayMethod } from '@kwetuly/shared';

// Deposits run through the `payments` Supabase Edge Function (Selcom). It stays switched off until
// the Selcom secrets are set there, and then the Pay buttons appear on their own.
const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payments`;

// The body may hold nested objects (the card billing address); it is sent once and never logged.
export async function callPayments(body: Record<string, unknown>, accessToken?: string) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return (await res.json().catch(() => ({}))) as { enabled?: boolean; url?: string; order_id?: string; status?: string; error?: string };
}

/**
 * Whether Selcom is set up, the shillings-per-dollar rate (null until configured), and the ways to pay
 * the Edge Function offers right now (mobile money, and card once Selcom has switched cards on).
 */
export async function paymentsConfig(): Promise<{ enabled: boolean; rate: number | null; methods: PayMethod[] }> {
  'use cache';
  cacheTag('payments-config');
  cacheLife('minutes');
  try {
    const result = (await callPayments({ action: 'config' })) as { enabled?: boolean; rate?: number | null; methods?: unknown };
    const enabled = Boolean(result.enabled);
    const listed = Array.isArray(result.methods) ? result.methods.filter((m): m is PayMethod => m === 'mobile_money' || m === 'card') : [];
    // An older Edge Function without `methods` takes mobile money only.
    const methods: PayMethod[] = !enabled ? [] : listed.length ? listed : ['mobile_money'];
    return { enabled, rate: typeof result.rate === 'number' && result.rate > 0 ? result.rate : null, methods };
  } catch {
    return { enabled: false, rate: null, methods: [] };
  }
}

export async function paymentsEnabled(): Promise<boolean> {
  return (await paymentsConfig()).enabled;
}

// Reasons the Edge Function gives when a deposit cannot be paid online at all: the Pay box is hidden.
const NOT_PAYABLE = new Set(['not_found', 'not_accepted', 'no_deposit', 'not_approved', 'already_paid', 'bad_request']);

/**
 * Whether the signed-in traveller can pay this deposit now: 'pay', 'review' (a payment is being
 * checked), or 'hidden' (unapproved guide or business, admin-made offer, unapproved or cancelled group).
 * If the check itself fails, show the box; checkout runs the same rules again.
 */
export async function depositPayable(kind: 'offer' | 'group', id: string, accessToken?: string): Promise<'pay' | 'review' | 'hidden'> {
  const result = await callPayments({ action: 'check', kind, id }, accessToken).catch(() => ({}) as { error?: string });
  if (result.error === 'under_review') return 'review';
  return result.error && NOT_PAYABLE.has(result.error) ? 'hidden' : 'pay';
}

/** Deposit in US dollars, as the Edge Function computes it (it converts to shillings). */
export const depositUsd = (total: number, percent: number) => Math.round(total * percent) / 100;
