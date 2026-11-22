import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { AdminMenu } from '../admin-menu';

export const metadata: Metadata = { title: 'Prices', robots: { index: false } };

// Walter's price grid (docs/team/plan-paid-verification-2026-11-21.md, section 2.2): services by account
// type. Shown so the page exists in the menu; nothing can be saved yet because the price_list table does
// not exist. Every cell says "not set" on purpose: no amount is invented here. Admin texts are English only.
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

export default async function PricesPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Prices</h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Grid locale={locale} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/prices`} />
        </div>
      </div>
    </div>
  );
}

async function Grid({ locale }: { locale: Locale }) {
  await requireAdmin(locale);
  return (
    <div className="mt-4 space-y-4">
      <p id="prices-soon" className="rounded-[5px] bg-sand p-3 font-semibold">Price saving opens soon (test prices only).</p>
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
    </div>
  );
}
