// Prices are set in US dollars; Tanzanian visitors also see an approximate shilling amount
// once the exchange rate is configured (USD_TZS_RATE on the payments Edge Function).

/** "$4,200" */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Sample group trips have no real price (the column cannot be empty, so it holds 0). Show
 * "Price on request" for them instead of "$0".
 */
export function groupPriceOnRequest(trip: { price_per_person_usd: number; guides?: { is_sample?: boolean | null } | null }): boolean {
  return Number(trip.price_per_person_usd) === 0 && trip.guides?.is_sample === true;
}

/** "≈ TSh 10,920,000" (rounded to the nearest 1,000), or null when no rate is set. */
export function approxTzs(usd: number, rate: number | null | undefined): string | null {
  if (!rate || rate <= 0) return null;
  return `≈ TSh ${(Math.round((usd * rate) / 1000) * 1000).toLocaleString('en-US')}`;
}
