// Tests for the Bank of Tanzania table reader. Run from the repository root:
//   npx vitest run --root supabase/functions/exchange-rates
// fixtures/bot-rates-2026-11-27.html is the real rates table (table#table1) saved unchanged from
// https://www.bot.go.tz/ExchangeRate/excRates?lang=en on 2026-11-27. No figure here is made up: every
// expected value below is copied from that saved page.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eastAfricaToday, parseBotDate, parseBotRates } from './parse.ts';

const fixture = readFileSync(new URL('./fixtures/bot-rates-2026-11-27.html', import.meta.url), 'utf8');
// 27 Nov 2026, 10:00 in Dar es Salaam.
const NOW = new Date('2026-11-27T07:00:00Z');

const row = (code: string, buying: string, selling: string, mean: string, date: string, sno = '1') =>
  `<tr><td>${sno}</td><td style="text-align:right">${code}</td><td>${buying}</td><td>${selling}</td><td>${mean}</td><td>${date}</td></tr>`;
const page = (...rows: string[]) => `<html><table class="x" id="table1"><thead></thead><tbody>${rows.join('')}</tbody></table></html>`;
const USD = row('USD', '2664.8416', '2691.49', '2678.1658', '27-Nov-26');

describe('parseBotRates on the saved Bank of Tanzania page', () => {
  const result = parseBotRates(fixture, NOW);

  it('reads the table', () => {
    expect(result.ok).toBe(true);
  });

  it('keeps the allow-listed currencies with the published figures', () => {
    if (!result.ok) throw new Error('parse failed');
    const by = Object.fromEntries(result.rates.map((r) => [r.currency, r]));
    expect(by.USD).toEqual({ currency: 'USD', buying: '2664.8416', selling: '2691.49', mean: '2678.1658', rate_date: '2026-11-27' });
    expect(by.EUR.mean).toBe('2941.1617');
    expect(by.JPY.mean).toBe('16.8174');
    expect(by.KES.mean).toBe('20.5617');
    expect(by.UGX.mean).toBe('0.6207');
    expect(result.rates).toHaveLength(37);
  });

  it('drops obsolete codes, GOLD and SDR', () => {
    if (!result.ok) throw new Error('parse failed');
    const codes = result.rates.map((r) => r.currency);
    for (const code of ['ATS', 'NLG', 'ZWD', 'MZM', 'CUC', 'SDR', 'GOLD']) expect(codes).not.toContain(code);
    expect(result.dropped).toBe(7);
    expect(result.refused).toBe(0);
  });

  it('refuses the whole page as too old a week later', () => {
    const later = parseBotRates(fixture, new Date('2026-12-05T07:00:00Z'));
    expect(later).toMatchObject({ ok: false, error: 'no_usd' });
  });

  it('accepts the page up to 7 days later', () => {
    expect(parseBotRates(fixture, new Date('2026-12-04T07:00:00Z')).ok).toBe(true);
  });

  it('refuses rows dated in the future (page read the day before)', () => {
    expect(parseBotRates(fixture, new Date('2026-11-26T07:00:00Z'))).toMatchObject({ ok: false, error: 'no_usd' });
  });
});

describe('parseBotRates strictness', () => {
  it('no table, or a changed table id', () => {
    expect(parseBotRates('<html><body>Maintenance</body></html>', NOW)).toMatchObject({ ok: false, error: 'no_table' });
    expect(parseBotRates(page(USD).replace('table1', 'table2'), NOW)).toMatchObject({ ok: false, error: 'no_table' });
  });

  it('empty table', () => {
    expect(parseBotRates(page(), NOW)).toMatchObject({ ok: false, error: 'no_rows' });
  });

  it('saves nothing without a good USD row', () => {
    const eur = row('EUR', '2926.529', '2955.7943', '2941.1617', '27-Nov-26');
    expect(parseBotRates(page(eur), NOW)).toMatchObject({ ok: false, error: 'no_usd' });
    expect(parseBotRates(page(eur, row('USD', '2664.8416', '2691.49', '9999', '27-Nov-26')), NOW)).toMatchObject({ ok: false, error: 'no_usd' });
  });

  it('refuses malformed cells', () => {
    const bad = [
      row('EUR', '2,926.529', '2955.7943', '2941.1617', '27-Nov-26'), // thousands separator
      row('EUR', '-2926.529', '2955.7943', '2941.1617', '27-Nov-26'),
      row('EUR', '2926.529', '2955.7943', '2941.1617', '2026-11-27'), // other date format
      row('EUR', '2926.529', '2955.7943', '2941.1617', '31-Nov-26'), // no such day
      row('EUR', '2926.529', '2955.7943', '2941.1617', '27-nov-26'),
      row('EUR', '2955.7943', '2926.529', '2941.1617', '27-Nov-26'), // buying above selling
      row('EUR', '2926.529', '2955.7943', '2950', '27-Nov-26'), // not the average
      row('EUR', '0', '0', '0', '27-Nov-26'),
      row('EUR', '2926.529', '2955.7943', '2941.1617', '27-Nov-26', 'x'),
      `<tr><td>1</td><td>EUR</td><td>2926.529</td><td>2955.7943</td><td>2941.1617</td></tr>`, // 5 cells
    ];
    for (const r of bad) {
      const res = parseBotRates(page(USD, r), NOW);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.rates.map((x) => x.currency)).toEqual(['USD']);
        expect(res.refused).toBe(1);
      }
    }
  });

  it('drops codes not on the allow-list and keeps only the first of a duplicate', () => {
    const res = parseBotRates(page(USD, row('XAU', '1', '1', '1', '27-Nov-26'), row('usd', '1', '1', '1', '27-Nov-26'), USD), NOW);
    expect(res).toMatchObject({ ok: true, dropped: 2, refused: 1 });
  });

  it('ignores markup inside cells and whitespace', () => {
    const res = parseBotRates(page(row(' <b>USD</b> ', '\n 2664.8416 ', '2691.49', '2678.1658', ' 27-Nov-26 ')), NOW);
    expect(res.ok && res.rates[0].mean).toBe('2678.1658');
  });
});

describe('dates', () => {
  it('reads dd-Mon-yy', () => {
    expect(parseBotDate('27-Nov-26')).toBe('2026-11-27');
    expect(parseBotDate('29-Feb-28')).toBe('2028-02-29');
    expect(parseBotDate('29-Feb-27')).toBeNull();
    expect(parseBotDate('7-Nov-26')).toBeNull();
  });

  it('East Africa day starts at 21:00 UTC', () => {
    expect(eastAfricaToday(new Date('2026-11-26T20:59:00Z'))).toBe('2026-11-26');
    expect(eastAfricaToday(new Date('2026-11-26T21:00:00Z'))).toBe('2026-11-27');
  });
});
