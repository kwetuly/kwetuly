import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { isNotAppliedError, tanzaniaToday } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminMenu } from '../admin-menu';
import { activateReservationRate, endReservationRate, newReservationRateVersion, saveReservationRate } from './actions';

export const metadata: Metadata = { title: 'Prices', robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Walter's price grid (docs/team/plan-paid-verification-2026-11-21.md, section 2.2): services by account
// type. The reservation commission rates (price_list, migration 20261122200000) can be saved; the rest
// of the grid stays read-only until migration C. Every cell says "not set" until Walter types a value:
// no amount is invented here. Admin texts are English only.
const TYPES = ['Porter', 'Cook', 'Driver', 'Assistant guide', 'Guide', 'Business (per type)'] as const;

type Cell = 'open' | 'n/a';
const ROWS: { service: string; periods: string; status: string; cells: Cell[] }[] = [
  { service: 'Verification subscription', periods: 'month, year', status: 'Legal hold for crew until gate 6.3; open for guide and business after gate 6.1', cells: ['open', 'open', 'open', 'open', 'open', 'open'] },
  { service: '"Checked by Kwetuly" business badge', periods: 'year', status: 'Moves into this table from the badge fee setting', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'open'] },
  { service: 'Extra checks (video interview, references, certificates)', periods: 'once or year', status: 'Walter decides if separate from verification', cells: ['open', 'open', 'open', 'open', 'open', 'open'] },
  { service: 'Crew team seats paid by the guide or operator', periods: 'year', status: 'Optional', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'open', 'open'] },
  { service: 'Prep calls', periods: 'percent', status: 'Proposal (decision 32 pattern)', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'open', 'n/a'] },
  { service: 'Deposit commission', periods: 'percent', status: 'Working number (decision 26)', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'open', 'open'] },
  { service: 'Classes share', periods: 'percent', status: 'After classes start', cells: ['n/a', 'open', 'n/a', 'n/a', 'open', 'open'] },
  { service: 'Business referral commission (default shown only)', periods: 'percent', status: 'Stays per agreement', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'open'] },
  { service: 'Contact unlock for operators', periods: 'once', status: 'Legal hold (decision 17)', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'open'] },
  { service: 'Job post by a guide or business', periods: 'once', status: 'Walter decides; never paid by the job seeker', cells: ['n/a', 'n/a', 'n/a', 'n/a', 'open', 'open'] },
];

const OK_TEXT: Record<string, string> = {
  saved: 'Saved as a draft. Nothing changes for businesses until you activate it.',
  activated: 'Activated. It applies to new reservations from its start date.',
  version: 'New draft made from the current rate. Change it and activate it from a date.',
  ended: 'End date saved. From that date this type has no rate and cannot take new reservations.',
};
const ERROR_TEXT: Record<string, string> = {
  not_admin: 'Only admins with two-step sign-in can change prices.',
  not_draft: 'Only drafts can be changed. Make a new version instead.',
  past_date: 'The start date must be today or later (Tanzania date).',
  no_value: 'Type the amount or percent first.',
  no_max_guests: 'Type the most guests counted per reservation first.',
  overlap: 'Another active rate for the same type starts on or after this date.',
  draft_exists: 'There is already a draft for this rate. Change that one.',
  end_date: 'The end date must be today or later and after the start date.',
  out_of_range: 'That value is outside the allowed range.',
  confirm: 'Tick the box to confirm the values first.',
  not_found: 'This rate was not found. Reload the page.',
  failed: 'That did not work. Please try again.',
};

const SERVICE_LABEL: Record<string, string> = {
  reservation_commission: 'Reservation commission',
  reservation_unpriced_fee: 'Fee per person, service with no listed price',
  verification: 'Verification',
  business_badge: '"Checked by Kwetuly" badge',
};
const TYPE_LABEL: Record<string, string> = { restaurant: 'Restaurant', spa: 'Spa and massage', salon: 'Salon' };
const ACCOUNT_LABEL: Record<string, string> = { porter: 'Porter', cook: 'Cook', driver: 'Driver', assistant_guide: 'Assistant guide', guide: 'Guide', business: 'Business' };
const FEE_CODES = new Set(['verification', 'business_badge']);

type PriceRow = {
  id: string;
  account_type: string;
  business_type: string | null;
  service_code: string;
  period: string;
  amount_tzs: number | null;
  percent: number | null;
  max_guests_counted: number | null;
  active_from: string | null;
  active_to: string | null;
  status: 'draft' | 'active' | 'legal_hold';
  note: string | null;
  editable: boolean;
};
type LogRow = { id: number; price_id: string | null; action: string; actor_name: string; created_at: string };

const tzs = (n: number) => `TSh ${n.toLocaleString('en-US')}`;

function basis(row: PriceRow): string {
  if (FEE_CODES.has(row.service_code)) return `TZS per ${row.period}, paid to Kwetuly by Lipa number`;
  if (row.service_code === 'reservation_unpriced_fee') return 'TZS per person served';
  if (row.period === 'percent') return 'Percent of the listed service price';
  return 'TZS per guest who came';
}

function valueText(row: PriceRow): string {
  if (row.period === 'percent') return row.percent == null ? 'not set' : `${row.percent}%`;
  if (row.amount_tzs == null) return 'not set';
  if (FEE_CODES.has(row.service_code)) return `${tzs(row.amount_tzs)} per ${row.period}`;
  const per = row.service_code === 'reservation_unpriced_fee' ? 'per person' : 'per guest';
  return `${tzs(row.amount_tzs)} ${per}${row.max_guests_counted ? `, up to ${row.max_guests_counted} guests counted` : ''}`;
}

function statusText(row: PriceRow, today: string): string {
  if (row.status === 'draft') return 'Draft';
  if (row.status === 'legal_hold') return 'Legal hold';
  if (row.active_from && row.active_from > today) return `Active from ${row.active_from}`;
  if (row.active_to && row.active_to <= today) return `Ended ${row.active_to}`;
  return row.active_to ? `In use, ends ${row.active_to}` : 'In use';
}

export default async function PricesPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Prices</h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Content locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/prices`} />
        </div>
      </div>
    </div>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: SearchParams }) {
  await requireAdmin(locale);
  const params = await searchParams;
  // Own keys only, so "?ok=constructor" cannot reach Object.prototype (security review L6).
  const ok = typeof params.ok === 'string' && Object.hasOwn(OK_TEXT, params.ok) ? OK_TEXT[params.ok] : '';
  const error = typeof params.e === 'string' && Object.hasOwn(ERROR_TEXT, params.e) ? ERROR_TEXT[params.e] : '';
  return (
    <div className="mt-4 space-y-10">
      {ok && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{ok}</p>}
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
      <ReservationRates locale={locale} />
      <Grid />
    </div>
  );
}

async function ReservationRates({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const [rows, log] = await Promise.all([
    supabase.rpc('admin_price_rows'),
    supabase.rpc('admin_price_log', { p_limit: 20 }),
  ]);
  if (rows.error) {
    return (
      <section aria-labelledby="reservation-rates" role="alert" className="card space-y-3">
        <h2 id="reservation-rates" className="text-xl font-bold">Reservation commission</h2>
        <p>{isNotAppliedError(rows.error) ? 'Reservation rates open soon: the reservation migration is not on this database yet.' : 'Sorry, the rates could not be loaded. Please try again.'}</p>
        <Link href={`/${locale}/admin/prices`} className="btn-outline">Try again</Link>
      </section>
    );
  }
  const today = tanzaniaToday();
  const rates = ((rows.data ?? []) as PriceRow[]).filter((r) => r.editable);
  const logRows = (log.data ?? []) as LogRow[];

  return (
    <section aria-labelledby="reservation-rates" className="space-y-4">
      <h2 id="reservation-rates" className="text-xl font-bold">Reservation commission</h2>
      <p className="text-sm text-muted">
        One rate per business type. The business pays Kwetuly this for each reservation that takes place; nothing is added to the
        guest&apos;s price, and Kwetuly charges nobody from this page. No rate in use for a type means its businesses cannot take
        reservations. A rate in use cannot be edited: make a new version and activate it from a date. Every save is logged below.
      </p>
      <ul className="space-y-4">
        {rates.map((row) => (
          <li key={row.id} id={`price-${row.id}`} className="card space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {SERVICE_LABEL[row.service_code] ?? row.service_code}
                {' · '}
                {FEE_CODES.has(row.service_code)
                  ? `${ACCOUNT_LABEL[row.account_type] ?? row.account_type}, per ${row.period}`
                  : row.business_type ? (TYPE_LABEL[row.business_type] ?? row.business_type) : 'Spa and salon'}
              </h3>
              <span className="text-sm font-semibold">{statusText(row, today)}</span>
            </div>
            <p className="text-sm text-muted">{basis(row)}. Now: <strong className="text-ink">{valueText(row)}</strong>{row.active_from ? `, from ${row.active_from}` : ''}</p>

            {row.status === 'draft' && <DraftForm row={row} locale={locale} today={today} />}

            {row.status === 'active' && (!row.active_to || row.active_to > today) && (
              <div className="flex flex-wrap gap-3">
                <form action={newReservationRateVersion}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="price_id" value={row.id} />
                  <button type="submit" className="btn-outline">Make a new version</button>
                </form>
                <form action={endReservationRate} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="price_id" value={row.id} />
                  <label className="text-sm">
                    <span className="block font-semibold">End on</span>
                    <input type="date" name="active_to" min={today} required className="rounded-[5px] border border-line px-2 py-1.5" />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="confirm" value="yes" required />
                    <span>Businesses of this type stop taking new reservations on that date</span>
                  </label>
                  <button type="submit" className="btn-outline">Save end date</button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Change log (latest 20)</summary>
        {logRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No changes yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {logRows.map((l) => (
              <li key={l.id}>
                {new Date(l.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}: {l.action} by {l.actor_name}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}

function DraftForm({ row, locale, today }: { row: PriceRow; locale: Locale; today: string }) {
  const percent = row.period === 'percent';
  const perGuest = row.service_code === 'reservation_commission' && row.period === 'once';
  const complete = (percent ? row.percent != null : row.amount_tzs != null) && !!row.active_from && (!perGuest || row.max_guests_counted != null);
  return (
    <div className="space-y-3">
      <form action={saveReservationRate} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="price_id" value={row.id} />
        <input type="hidden" name="period" value={row.period} />
        {percent ? (
          <label className="text-sm">
            <span className="block font-semibold">Percent of the listed price</span>
            <input name="percent" inputMode="decimal" defaultValue={row.percent ?? ''} placeholder="not set" className="w-32 rounded-[5px] border border-line px-2 py-1.5" />
          </label>
        ) : (
          <label className="text-sm">
            <span className="block font-semibold">{perGuest ? 'TZS per guest who came' : 'TZS per person served'}</span>
            <input name="amount_tzs" inputMode="numeric" defaultValue={row.amount_tzs ?? ''} placeholder="not set" className="w-40 rounded-[5px] border border-line px-2 py-1.5" />
          </label>
        )}
        {perGuest && (
          <label className="text-sm">
            <span className="block font-semibold">Most guests counted per reservation</span>
            <input name="max_guests" inputMode="numeric" defaultValue={row.max_guests_counted ?? ''} placeholder="not set" className="w-24 rounded-[5px] border border-line px-2 py-1.5" />
          </label>
        )}
        <label className="text-sm">
          <span className="block font-semibold">Starts on (Tanzania date)</span>
          <input type="date" name="active_from" min={today} defaultValue={row.active_from ?? ''} className="rounded-[5px] border border-line px-2 py-1.5" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block font-semibold">Note for admins (not shown to businesses)</span>
          <input name="note" maxLength={300} defaultValue={row.note ?? ''} className="w-full rounded-[5px] border border-line px-2 py-1.5" />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-outline">Save draft</button>
        </div>
      </form>
      {complete && (
        <form action={activateReservationRate} className="flex flex-wrap items-center gap-3 rounded-[5px] bg-sand p-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="price_id" value={row.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" value="yes" required />
            <span>I checked: {valueText(row)}, from {row.active_from}. It cannot be edited once active.</span>
          </label>
          <button type="submit" className="btn">Activate</button>
        </form>
      )}
    </div>
  );
}

function Grid() {
  return (
    <section aria-labelledby="other-prices" className="space-y-4">
      <h2 id="other-prices" className="text-xl font-bold">Other prices</h2>
      <p id="prices-soon" className="rounded-[5px] bg-sand p-3 font-semibold">Price saving opens soon for these (test prices only).</p>
      <p className="text-sm text-muted">
        Amounts in TZS. A new price applies to new subscriptions and renewals only. Nothing on this page can switch on live charging.
        Cheaper-ranked types (porter, then guide, then business) should never pay more than higher-ranked ones for the same service; the page will warn, not block.
      </p>
      <div className="overflow-x-auto rounded-[5px] border border-line bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <caption className="sr-only">Prices by service and account type. Every price is not set.</caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="p-3 font-semibold">Service</th>
              {TYPES.map((type) => (
                <th key={type} scope="col" className="p-3 font-semibold">{type}</th>
              ))}
              <th scope="col" className="p-3 font-semibold">Period</th>
              <th scope="col" className="p-3 font-semibold">Status today</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.service} className="border-t border-line align-top">
                <th scope="row" className="p-3 font-semibold">{row.service}</th>
                {row.cells.map((cell, i) => (
                  <td key={TYPES[i]} className="p-3">
                    {cell === 'n/a' ? (
                      <span className="text-muted">n/a</span>
                    ) : (
                      <label className="block">
                        <span className="sr-only">{`${row.service}, ${TYPES[i]}`}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled
                          placeholder="not set"
                          aria-describedby="prices-soon"
                          className="w-28 rounded-[5px] border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted disabled:cursor-not-allowed"
                        />
                      </label>
                    )}
                  </td>
                ))}
                <td className="p-3 text-muted">{row.periods}</td>
                <td className="p-3 text-muted">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn" disabled aria-describedby="prices-soon">Save prices</button>
    </section>
  );
}
