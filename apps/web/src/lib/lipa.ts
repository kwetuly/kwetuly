import 'server-only';
import { headers } from 'next/headers';
import { parseMethodRows, viewerCurrency, type PaymentMethodRow, type PaymentPurpose } from '@kwetuly/shared';
import { createClient } from '@/lib/supabase/server';

// Server helpers for paying Kwetuly (Lipa numbers now; hosted providers later). The database decides
// which methods are live (public.payment_methods_for); the website only shows that answer. Nothing
// here changes money state: orders and claims go through the database functions, which compute every
// amount themselves, and only an admin confirmation makes anything paid.

/** The chooser rows for a purpose on the website, or null when they could not be loaded. */
export async function paymentMethods(purpose: PaymentPurpose): Promise<PaymentMethodRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('payment_methods_for', { p_purpose: purpose, p_platform: 'web' });
  if (error) return null;
  return parseMethodRows(data);
}

/** The admin-typed deposit rate (TZS per USD) with its source and date, or null. Display only here. */
export async function manualRate(): Promise<{ rate: string; source: string; asOf: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'payments.manual_usd_tzs_rate').maybeSingle<{ value: { rate?: unknown; source?: unknown; as_of?: unknown } }>();
  const v = data?.value;
  return v && typeof v.rate === 'string' && typeof v.source === 'string' && typeof v.as_of === 'string' ? { rate: v.rate, source: v.source, asOf: v.as_of } : null;
}

/**
 * The viewer's own currency for an estimate. Only shown when an admin has typed a rate for it in
 * site_settings 'payments.display_rates' ({"EUR": {"per_usd": "0.92", "source": "...", "as_of": "..."}});
 * none is seeded, so by default only TZS and USD are shown.
 */
export async function localEstimateRate(locale: string): Promise<{ currency: string; perUsd: string; source: string } | null> {
  const country = (await headers()).get('x-vercel-ip-country');
  const currency = viewerCurrency(country, locale);
  if (!currency || currency === 'USD') return null;
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'payments.display_rates').maybeSingle<{ value: Record<string, { per_usd?: unknown; source?: unknown }> }>();
  const r = data?.value?.[currency];
  return r && typeof r.per_usd === 'string' && /^\d{1,6}(\.\d{1,6})?$/.test(r.per_usd) && typeof r.source === 'string'
    ? { currency, perUsd: r.per_usd, source: r.source }
    : null;
}
