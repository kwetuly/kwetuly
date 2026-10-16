import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { commissionSplit } from '@rafrika/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { saveAgreement, setSalesStatus } from '../actions';

export const metadata: Metadata = { title: 'Commissions', robots: { index: false } };

type Agreement = { provider_id: string; rafrika_pct: number; guide_pct: number; signed_on: string | null; notes: string | null; active: boolean };
type Business = { id: string; business_name: string; base_region: string };
type Sale = { id: string; provider_id: string; code: string; guide_id: string | null; sale_date: string; amount_tzs: number; status: string; guides: { display_name: string } | null };

// Admin only: each business's commission agreement, and a monthly statement of referral sales
// with what each business owes Rafrika and the guides' shares.
export default async function CommissionsPage({ searchParams }: PageProps<'/[lang]/admin/commissions'>) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
      <h1 className="mt-2 text-3xl font-bold">Commissions</h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Content locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') return <p className="mt-6">Admins only.</p>;
  const params = await searchParams;
  const month = typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const previous = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  const supabase = await createClient();
  const [{ data: businesses }, { data: agreements }, { data: sales }] = await Promise.all([
    supabase.from('providers').select('id, business_name, base_region').eq('verification_status', 'approved').order('business_name').returns<Business[]>(),
    supabase.from('business_agreements').select('provider_id, rafrika_pct, guide_pct, signed_on, notes, active').returns<Agreement[]>(),
    supabase
      .from('referral_sales')
      .select('id, provider_id, code, guide_id, sale_date, amount_tzs, status, guides(display_name)')
      .gte('sale_date', `${month}-01`)
      .lt('sale_date', end)
      .order('sale_date')
      .returns<Sale[]>(),
  ]);
  const byProvider = new Map((agreements ?? []).map((a) => [a.provider_id, a]));
  const money = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
  const monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01`));

  // Statement per business, and what each guide is owed this month.
  const statement = (businesses ?? [])
    .map((b) => {
      const rows = (sales ?? []).filter((s) => s.provider_id === b.id);
      const agreement = byProvider.get(b.id) ?? null;
      const total = rows.reduce((sum, s) => sum + Number(s.amount_tzs), 0);
      const split = rows.reduce(
        (acc, s) => {
          const one = commissionSplit(Number(s.amount_tzs), agreement);
          return { rafrika: acc.rafrika + one.rafrika, guide: acc.guide + one.guide };
        },
        { rafrika: 0, guide: 0 },
      );
      return { business: b, rows, agreement, total, split };
    })
    .filter((x) => x.rows.length > 0);
  const guideTotals = new Map<string, number>();
  for (const s of sales ?? []) {
    if (!s.guides) continue;
    const share = commissionSplit(Number(s.amount_tzs), byProvider.get(s.provider_id) ?? null).guide;
    guideTotals.set(s.guides.display_name, (guideTotals.get(s.guides.display_name) ?? 0) + share);
  }

  return (
    <>
      {params.error && <p className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">Could not save. Rafrika’s share plus the guide’s share must be 100% or less.</p>}

      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold">Statement for {monthName}</h2>
          <Link href={`/${locale}/admin/commissions?month=${previous}`} className="btn-outline ml-auto px-3 py-1.5 text-sm">Previous month</Link>
          <Link href={`/${locale}/admin/commissions?month=${next}`} className="btn-outline px-3 py-1.5 text-sm">Next month</Link>
        </div>
        {statement.length === 0 && <p className="mt-3 text-muted">No referral sales recorded this month.</p>}
        <ul className="mt-4 space-y-4">
          {statement.map(({ business, rows, agreement, total, split }) => (
            <li key={business.id} className="card space-y-2">
              <h3 className="text-lg font-bold">{business.business_name}</h3>
              <p className="text-sm">
                {rows.length} sales · TSh {money.format(total)} ·{' '}
                {agreement ? (
                  <>
                    Rafrika {Number(agreement.rafrika_pct)}% = <strong>TSh {money.format(split.rafrika)}</strong> · guides {Number(agreement.guide_pct)}% = <strong>TSh {money.format(split.guide)}</strong>
                  </>
                ) : (
                  <span className="text-red-800">no agreement recorded</span>
                )}
              </p>
              <ul className="text-sm text-muted">
                {rows.map((s) => (
                  <li key={s.id}>
                    {s.sale_date} · {s.code} · {s.guides?.display_name ?? 'unknown code'} · TSh {money.format(Number(s.amount_tzs))} · {s.status}
                  </li>
                ))}
              </ul>
              <form action={setSalesStatus} className="flex gap-2 pt-1">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="provider_id" value={business.id} />
                <input type="hidden" name="month" value={month} />
                <button name="status" value="invoiced" className="btn-outline px-3 py-1.5 text-sm">Mark invoiced</button>
                <button name="status" value="paid" className="btn px-3 py-1.5 text-sm">Mark paid</button>
              </form>
            </li>
          ))}
        </ul>
        {guideTotals.size > 0 && (
          <div className="card mt-4">
            <h3 className="font-bold">Guides’ shares this month</h3>
            <ul className="mt-2 text-sm">
              {[...guideTotals].map(([name, amount]) => (
                <li key={name}>
                  {name}: TSh {money.format(amount)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Agreements</h2>
        <p className="mt-1 text-sm text-muted">Enter the shares from each signed agreement. Travellers see a commission note on businesses with an active agreement.</p>
        <ul className="mt-4 space-y-3">
          {(businesses ?? []).map((b) => {
            const a = byProvider.get(b.id);
            return (
              <li key={b.id}>
                <form action={saveAgreement} className="card grid gap-3 sm:grid-cols-6 sm:items-end">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="provider_id" value={b.id} />
                  <p className="font-bold sm:col-span-6">
                    {b.business_name} <span className="font-normal text-muted">· {b.base_region}</span>
                  </p>
                  <label className="block">
                    <span className="label">Rafrika %</span>
                    <input className="field" name="rafrika_pct" type="number" min={0} max={100} step="0.5" defaultValue={a?.rafrika_pct ?? ''} />
                  </label>
                  <label className="block">
                    <span className="label">Guide %</span>
                    <input className="field" name="guide_pct" type="number" min={0} max={100} step="0.5" defaultValue={a?.guide_pct ?? ''} />
                  </label>
                  <label className="block">
                    <span className="label">Signed on</span>
                    <input className="field" name="signed_on" type="date" defaultValue={a?.signed_on ?? ''} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="label">Notes</span>
                    <input className="field" name="notes" maxLength={2000} defaultValue={a?.notes ?? ''} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={a?.active ?? true} className="size-4 accent-forest" /> Active
                  </label>
                  <button className="btn-outline px-4 py-2 text-sm sm:col-span-6 sm:w-fit">Save agreement</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
