import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { Suspense } from 'react';
import { formatTzsAmount, lipaAdminText, type LipaAdminText, type PaymentPurpose } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/components/submit-button';
import { AdminMenu } from '../admin-menu';
import { confirmClaim, rejectClaim, wrongAmount } from './actions';

export const metadata: Metadata = { title: 'Payments to confirm', robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
type Row = {
  claim_id: string; reference: string; purpose: PaymentPurpose; account_type: string | null; period: string | null;
  amount_tzs: number; amount_usd: number | null; received_before_tzs: number | null; payer_name: string; network: string;
  transaction_id: string; payer_phone: string | null; claim_status: string; reason_code: string | null; admin_note: string | null;
  received_tzs: number | null; order_status: string; submitted_at: string;
};
const TABS = ['waiting', 'wrong_amount', 'recent'] as const;

// The confirmation queue. Walter checks each claim on the Lipa statement, then confirms, rejects or
// marks a wrong amount. Phones are shown in full here only (to match the statement); never shared.
export default async function AdminPaymentsPage({ searchParams }: { searchParams: Search }) {
  const locale = await getLocale();
  const a = lipaAdminText(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">{a.admin}</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{a.queueTitle}</h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Queue locale={locale} a={a} searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/payments`} />
        </div>
      </div>
    </div>
  );
}

async function Queue({ locale, a, searchParams }: { locale: Locale; a: LipaAdminText; searchParams: Search }) {
  await requireAdmin(locale);
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? 'waiting';
  const ok = typeof sp.ok === 'string' && Object.hasOwn(a.ok, sp.ok) ? a.ok[sp.ok as keyof LipaAdminText['ok']] : '';
  const err = typeof sp.e === 'string' && Object.hasOwn(a.errors, sp.e) ? a.errors[sp.e as keyof LipaAdminText['errors']] : '';
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_payment_queue', { p_status: tab });
  const rows = (data ?? []) as Row[];
  const base = `/${locale}/admin/payments`;
  return (
    <div className="mt-4 space-y-6">
      <p className="text-sm text-muted">{a.queueIntro}</p>
      {ok && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{ok}</p>}
      {err && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{err}</p>}
      <nav aria-label={a.status} className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`${base}?tab=${t}`} aria-current={t === tab ? 'page' : undefined} className={t === tab ? 'btn' : 'btn-outline'}>{a.tabs[t]}</Link>
        ))}
      </nav>
      {error ? (
        <p role="alert" className="card">{a.errors.failed}</p>
      ) : rows.length === 0 ? (
        <p className="card text-muted">{a.empty}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const before = r.received_before_tzs ?? 0;
            const deposit = r.purpose === 'offer_deposit' || r.purpose === 'group_deposit';
            return (
              <li key={r.claim_id} className="card space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold"><span className="font-mono">{r.reference}</span> · {a.purposes[r.purpose]}{r.period ? ` (${r.period})` : ''}</h2>
                  <span className="text-xl font-extrabold tabular-nums">{formatTzsAmount(r.amount_tzs)}</span>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline font-semibold">{a.payer}: </dt><dd className="inline">{r.payer_name}</dd></div>
                  <div><dt className="inline font-semibold">{a.network}: </dt><dd className="inline">{a.networks[r.network as keyof LipaAdminText['networks']] ?? r.network}</dd></div>
                  <div><dt className="inline font-semibold">{a.transactionId}: </dt><dd className="inline font-mono">{r.transaction_id}</dd></div>
                  <div><dt className="inline font-semibold">{a.phone}: </dt><dd className="inline font-mono">{r.payer_phone ?? '-'}</dd></div>
                  <div><dt className="inline font-semibold">{a.submitted}: </dt><dd className="inline">{new Date(r.submitted_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}</dd></div>
                  <div><dt className="inline font-semibold">{a.status}: </dt><dd className="inline">{r.claim_status}{r.received_tzs ? `, ${formatTzsAmount(r.received_tzs)}` : ''}</dd></div>
                  {before > 0 && <div><dt className="inline font-semibold">{a.receivedBefore}: </dt><dd className="inline">{formatTzsAmount(before)}</dd></div>}
                </dl>
                {deposit && <p className="rounded-[5px] bg-sand p-2 text-sm font-semibold">{a.depositWarning}</p>}
                {r.claim_status === 'waiting' && (
                  <div className="grid gap-4 lg:grid-cols-3">
                    <form action={confirmClaim} className="space-y-2 rounded-[5px] bg-mint p-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="claim" value={r.claim_id} />
                      <input type="hidden" name="key" value={randomUUID()} />
                      <label className="block text-sm"><span className="block font-semibold">{a.received}</span>
                        <input name="received" inputMode="numeric" required defaultValue={String(r.amount_tzs - before)} className="field" />
                      </label>
                      <label className="block text-sm"><span className="block font-semibold">{a.note}</span>
                        <input name="note" maxLength={200} className="field" />
                      </label>
                      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="found" value="yes" required className="mt-1" /> <span>{a.foundIt}</span></label>
                      <SubmitButton className="btn w-full">{a.confirm}</SubmitButton>
                    </form>
                    <form action={wrongAmount} className="space-y-2 rounded-[5px] bg-sand p-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="claim" value={r.claim_id} />
                      <label className="block text-sm"><span className="block font-semibold">{a.received}</span>
                        <input name="received" inputMode="numeric" required className="field" />
                      </label>
                      <label className="block text-sm"><span className="block font-semibold">{a.note}</span>
                        <input name="note" maxLength={200} className="field" />
                      </label>
                      <SubmitButton className="btn-outline w-full">{a.wrongAmount}</SubmitButton>
                    </form>
                    <form action={rejectClaim} className="space-y-2 rounded-[5px] bg-surface p-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="claim" value={r.claim_id} />
                      <label className="block text-sm"><span className="block font-semibold">{a.reason}</span>
                        <select name="reason" required className="field">
                          {(Object.keys(a.reasons) as (keyof LipaAdminText['reasons'])[]).map((k) => <option key={k} value={k}>{a.reasons[k]}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm"><span className="block font-semibold">{a.note}</span>
                        <input name="note" maxLength={200} className="field" />
                      </label>
                      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="close" value="yes" className="mt-1" /> <span>{a.closeOrder}</span></label>
                      {before > 0 && <p className="text-xs font-semibold text-red-800">{a.refundWarning}</p>}
                      <SubmitButton className="btn-outline w-full">{a.reject}</SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
