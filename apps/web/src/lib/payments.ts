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

export async function paymentsEnabled(): Promise<boolean> {
  'use cache';
  cacheTag('payments-config');
  cacheLife('minutes');
  try {
    return Boolean((await callPayments({ action: 'config' })).enabled);
  } catch {
    return false;
  }
}

/** Deposit in US dollars, as the Edge Function computes it (it converts to shillings). */
export const depositUsd = (total: number, percent: number) => Math.round(total * percent) / 100;
