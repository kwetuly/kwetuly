// Strict reader for the Bank of Tanzania indicative rates table (slice S48, design section 12.3).
// The page has no API: only the HTML table with id "table1" is read, row by row, and every cell must
// match its pattern exactly, or the row is refused. Only allow-listed currencies are kept (obsolete
// codes, GOLD and SDR are dropped). Pure function: no network, no clock (the caller passes `now`).
//
// Checks here (the database checks them again in public.svc_exchange_rates_save):
//   - code [A-Z]{3}; buying, selling and mean are plain decimals; date dd-Mon-yy
//   - buying <= mean <= selling, and mean is the average of buying and selling (rounding allowed)
//   - date not after today and at most 7 days old (East Africa time)
//   - a USD row must be there and pass; otherwise nothing is returned (error 'no_usd')
// The 15% jump check needs the stored history and is done in the database.
import { isBotCurrency } from '../_shared/currencies.ts';

export type ParsedRate = {
  currency: string;
  buying: string; // decimal text exactly as published
  selling: string;
  mean: string;
  rate_date: string; // yyyy-mm-dd
};

export type ParseResult =
  | { ok: true; rates: ParsedRate[]; dropped: number; refused: number }
  | { ok: false; error: 'no_table' | 'no_rows' | 'no_usd'; dropped: number; refused: number };

export const MAX_AGE_DAYS = 7;
const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};
const SNO = /^\d{1,3}$/;
const CODE = /^[A-Z]{3}$/;
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;
const DATE = /^(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/;

/** Today's date in Dar es Salaam (UTC+3 all year, no summer time), as yyyy-mm-dd. */
export function eastAfricaToday(now: Date): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "27-Nov-26" -> "2026-11-27"; null if it is not a real calendar date. */
export function parseBotDate(text: string): string | null {
  const m = DATE.exec(text);
  if (!m) return null;
  const iso = `20${m[3]}-${MONTHS[m[2]]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

const cellText = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Mean must lie between buying and selling and be their average to within rounding. */
function meanFits(buying: number, selling: number, mean: number): boolean {
  if (!(buying > 0 && selling > 0 && mean > 0)) return false;
  if (buying > selling || mean < buying || mean > selling) return false;
  return Math.abs(mean - (buying + selling) / 2) <= Math.max(0.0005, mean * 0.0001);
}

export function parseBotRates(html: string, now: Date): ParseResult {
  let dropped = 0;
  let refused = 0;
  const start = html.search(/<table\b[^>]*\bid="table1"[^>]*>/i);
  if (start < 0) return { ok: false, error: 'no_table', dropped, refused };
  const end = html.indexOf('</table>', start);
  if (end < 0) return { ok: false, error: 'no_table', dropped, refused };
  const table = html.slice(start, end);
  const bodyStart = table.search(/<tbody\b[^>]*>/i);
  const bodyEnd = table.search(/<\/tbody>/i);
  if (bodyStart < 0 || bodyEnd < bodyStart) return { ok: false, error: 'no_table', dropped, refused };
  const body = table.slice(bodyStart, bodyEnd);

  const today = eastAfricaToday(now);
  const oldest = addDays(today, -MAX_AGE_DAYS);
  const seen = new Set<string>();
  const rates: ParsedRate[] = [];
  let rows = 0;

  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    rows++;
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => cellText(c[1]));
    if (cells.length !== 6) {
      refused++;
      continue;
    }
    const [sno, code, buying, selling, mean, dateText] = cells;
    if (!SNO.test(sno)) {
      refused++;
      continue;
    }
    // GOLD and other non-currency rows fail the code pattern; they are dropped, not an error.
    if (!CODE.test(code) || !isBotCurrency(code)) {
      dropped++;
      continue;
    }
    const date = parseBotDate(dateText);
    if (
      !DECIMAL.test(buying) || !DECIMAL.test(selling) || !DECIMAL.test(mean) ||
      !meanFits(Number(buying), Number(selling), Number(mean)) ||
      date === null || date > today || date < oldest ||
      seen.has(code)
    ) {
      refused++;
      continue;
    }
    seen.add(code);
    rates.push({ currency: code, buying, selling, mean, rate_date: date });
  }

  if (rows === 0) return { ok: false, error: 'no_rows', dropped, refused };
  if (!seen.has('USD')) return { ok: false, error: 'no_usd', dropped, refused };
  return { ok: true, rates, dropped, refused };
}
