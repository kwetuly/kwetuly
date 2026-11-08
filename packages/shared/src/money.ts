// Prices are set in US dollars; Tanzanian visitors also see an approximate shilling amount
// once the exchange rate is configured (USD_TZS_RATE on the payments Edge Function).

/** "$4,200" */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * A group trip with no price (0 or missing) shows "Price on request" instead of "$0", the same for
 * travellers, the organiser and sample trips (whose column cannot be empty, so it holds 0).
 * Traveller organisers may enter 0 because their groups share costs directly.
 */
export function groupPriceOnRequest(trip: { price_per_person_usd: number | null | undefined; guides?: { is_sample?: boolean | null } | null }): boolean {
  const price = Number(trip.price_per_person_usd);
  return !Number.isFinite(price) || price <= 0;
}

/** "≈ TSh 10,920,000" (rounded to the nearest 1,000), or null when no rate is set. */
export function approxTzs(usd: number, rate: number | null | undefined): string | null {
  if (!rate || rate <= 0) return null;
  return `≈ TSh ${(Math.round((usd * rate) / 1000) * 1000).toLocaleString('en-US')}`;
}
