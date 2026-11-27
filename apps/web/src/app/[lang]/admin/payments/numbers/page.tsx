import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LIPA_NETWORKS, PAYMENT_METHODS, fillText, lipaAdminText, parseProviderSettings, tanzaniaToday, type LipaAdminText } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/components/submit-button';
import { AdminMenu } from '../../admin-menu';
import { saveNumber, saveProviders, saveRate } from '../actions';

export const metadata: Metadata = { title: 'Payment numbers', robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
type NumberRow = { id: string; network: string; lipa_number: string; business_name: string; bank_name: string | null; menu_hint: string | null; is_on: boolean; sort: number };

// Walter's own Lipa numbers, which provider takes each payment method, and the deposit rate. Nothing
// is seeded: every field starts empty and is typed by an admin.
export default async function PaymentNumbersPage({ searchParams }: { searchParams: Search }) {
  const locale = await getLocale();
  const a = lipaAdminText(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin/payments`} className="text-sm font-semibold text-forest underline">{a.menuQueue}</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{a.numbersTitle}</h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Content locale={locale} a={a} searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/payments/numbers`} />
        </div>
      </div>
    </div>
  );
}

function NumberForm({ locale, a, row }: { locale: Locale; a: LipaAdminText; row?: NumberRow }) {
  return (
    <form action={saveNumber} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <label className="text-sm"><span className="block font-semibold">{a.network}</span>
        <select name="network" defaultValue={row?.network ?? 'mpesa'} className="field">
          {LIPA_NETWORKS.map((n) => <option key={n} value={n}>{a.networks[n]}</option>)}
        </select>
      </label>
      <label className="text-sm"><span className="block font-semibold">{a.lipaNumber}</span>
        <input name="lipa_number" required inputMode="numeric" pattern="[0-9 \-]{4,20}" defaultValue={row?.lipa_number ?? ''} className="field font-mono" />
      </label>
      <label className="text-sm sm:col-span-2"><span className="block font-semibold">{a.businessName}</span>
        <input name="business_name" required minLength={2} maxLength={80} defaultValue={row?.business_name ?? ''} className="field" />
      </label>
      <label className="text-sm"><span className="block font-semibold">{a.bankName}</span>
        <input name="bank_name" maxLength={60} defaultValue={row?.bank_name ?? ''} className="field" />
      </label>
      <label className="text-sm"><span className="block font-semibold">{a.menuHint}</span>
        <input name="menu_hint" maxLength={40} defaultValue={row?.menu_hint ?? ''} className="field font-mono" />
      </label>
      <label className="text-sm"><span className="block font-semibold">{a.sort}</span>
        <input name="sort" type="number" min={0} max={99} defaultValue={row?.sort ?? 0} className="field" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_on" value="yes" defaultChecked={row?.is_on ?? false} /> {a.on}</label>
      <div className="sm:col-span-2"><SubmitButton className="btn">{row ? a.save : a.addNumber}</SubmitButton></div>
    </form>
  );
}

async function Content({ locale, a, searchParams }: { locale: Locale; a: LipaAdminText; searchParams: Search }) {
  await requireAdmin(locale);
  const sp = await searchParams;
  const supabase = await createClient();
  const [numbers, settings] = await Promise.all([
    supabase.rpc('admin_payment_numbers'),
    supabase.from('site_settings').select('key, value').in('key', ['payments.providers', 'payments.manual_usd_tzs_rate']),
  ]);
  const rows = (numbers.data ?? []) as NumberRow[];
  const byKey = Object.fromEntries(((settings.data ?? []) as { key: string; value: unknown }[]).map((s) => [s.key, s.value]));
  const providers = parseProviderSettings(byKey['payments.providers']);
  const rate = byKey['payments.manual_usd_tzs_rate'] as { rate?: string; source?: string; as_of?: string } | undefined;
  const err = typeof sp.e === 'string' && Object.hasOwn(a.errors, sp.e) ? a.errors[sp.e as keyof LipaAdminText['errors']] : '';
  return (
    <div className="mt-4 space-y-10">
      {sp.ok === 'saved' && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{a.saved}</p>}
      {err && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{err}</p>}
      <section className="space-y-4" aria-labelledby="numbers">
        <h2 id="numbers" className="text-xl font-bold">{a.numbersTitle}</h2>
        <p className="text-sm text-muted">{a.numbersIntro}</p>
        {numbers.error && <p role="alert" className="card">{a.errors.failed}</p>}
        {rows.length === 0 && !numbers.error && <p className="rounded-[5px] bg-sand p-3 font-semibold">{a.noNumbers}</p>}
        <ul className="space-y-4">
          {rows.map((r) => <li key={r.id} className="card"><NumberForm locale={locale} a={a} row={r} /></li>)}
        </ul>
        <div className="card space-y-3">
          <h3 className="font-bold">{a.addNumber}</h3>
          <NumberForm locale={locale} a={a} />
        </div>
      </section>

      <section className="card space-y-3" aria-labelledby="providers">
        <h2 id="providers" className="text-xl font-bold">{a.providersTitle}</h2>
        <p className="text-sm text-muted">{a.providersIntro}</p>
        <form action={saveProviders} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="locale" value={locale} />
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className="text-sm"><span className="block font-semibold">{a.methods[m]}</span>
              <input name={m} defaultValue={providers[m].join(', ')} placeholder="manual_lipa, flutterwave" className="field font-mono" />
            </label>
          ))}
          <div className="sm:col-span-3"><SubmitButton className="btn-outline">{a.providersSave}</SubmitButton></div>
        </form>
      </section>

      <section className="card space-y-3" aria-labelledby="rate">
        <h2 id="rate" className="text-xl font-bold">{a.rateTitle}</h2>
        <p className="text-sm text-muted">{a.rateIntro}</p>
        <p className="font-semibold">{rate?.rate ? fillText(a.rateNow, { rate: rate.rate, source: rate.source ?? '', date: rate.as_of ?? '' }) : a.rateNone}</p>
        <form action={saveRate} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="text-sm"><span className="block font-semibold">{a.rate}</span><input name="rate" required inputMode="decimal" className="field" /></label>
          <label className="text-sm"><span className="block font-semibold">{a.rateSource}</span><input name="source" required minLength={3} maxLength={120} className="field" /></label>
          <label className="text-sm"><span className="block font-semibold">{a.rateDate}</span><input name="as_of" type="date" required max={tanzaniaToday()} className="field" /></label>
          <div className="sm:col-span-3"><SubmitButton className="btn-outline">{a.rateSave}</SubmitButton></div>
        </form>
      </section>
    </div>
  );
}
