import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

// Deposits run through the `payments` Supabase Edge Function (Selcom). It stays switched off until
// the Selcom secrets are set there, and then the Pay buttons appear on their own.
const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payments`;

export async function callPayments(body: Record<string, string>, accessToken?: string) {
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

/** Whether Selcom is set up, and the shillings-per-dollar rate (null until configured). */
export async function paymentsConfig(): Promise<{ enabled: boolean; rate: number | null }> {
  'use cache';
  cacheTag('payments-config');
  cacheLife('minutes');
  try {
    const result = (await callPayments({ action: 'config' })) as { enabled?: boolean; rate?: number | null };
    return { enabled: Boolean(result.enabled), rate: typeof result.rate === 'number' && result.rate > 0 ? result.rate : null };
  } catch {
    return { enabled: false, rate: null };
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
