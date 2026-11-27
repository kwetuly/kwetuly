import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import {
  LIPA_NETWORKS,
  LIPA_NETWORK_NAMES,
  centsText,
  fillText,
  formatTzsAmount,
  isPaymentReference,
  lipaPayText,
  maskPhone,
  tzsToUsdCents,
  type LipaNetwork,
  type LipaNumber,
  type LipaPayText,
  type MyPaymentOrder,
} from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { manualRate } from '@/lib/lipa';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/components/submit-button';
import { cancelOrder, submitClaim } from '../../lipa-actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: lipaPayText(await getLocale()).title, robots: { index: false } };
}

type Search = Record<string, string | string[] | undefined>;

// One Lipa payment: amount (from the server), Kwetuly's Lipa numbers, the payment code, how to pay on
// each network, and the "I have paid" form. The status only changes when an admin confirms.
export default async function LipaOrderPage({ params, searchParams }: { params: Promise<{ lang: string; ref: string }>; searchParams: Promise<Search> }) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/${locale}/payments/orders`} className="text-sm font-semibold text-forest underline">{lipaPayText(locale).myPayments}</Link>
      <Suspense fallback={<div aria-busy="true" className="card mt-4 h-72 animate-pulse" />}>
        <Order params={params} searchParams={searchParams} locale={locale} />
      </Suspense>
    </div>
  );
}

const networkName = (n: LipaNetwork, t: LipaPayText) => (n === 'bank' ? t.bank : LIPA_NETWORK_NAMES[n]);

async function Order({ params, searchParams, locale }: { params: Promise<{ ref: string }>; searchParams: Promise<Search>; locale: Locale }) {
  const { ref } = await params;
  const t = lipaPayText(locale);
  const reference = ref.toUpperCase();
  if (!isPaymentReference(reference)) notFound();
  await requireUser(locale, `/${locale}/payments/orders/${reference}`);
  const sp = await searchParams;
  const supabase = await createClient();
  const [orders, numbers, rate] = await Promise.all([
    supabase.rpc('my_payment_orders', { p_reference: reference }),
    supabase.rpc('payment_numbers_for_payers'),
    manualRate(),
  ]);
  const order = ((orders.data ?? []) as MyPaymentOrder[])[0];
  if (!order) notFound();
  const list = (numbers.error ? [] : (numbers.data ?? [])) as LipaNumber[];
  const amount = formatTzsAmount(order.amount_tzs);
  const e = typeof sp.e === 'string' && Object.hasOwn(t.errors, sp.e) ? t.errors[sp.e] : '';
  const ok = sp.ok === 'submitted' ? t.submittedOk : sp.ok === 'cancelled' ? t.cancelled : '';
  const open = order.status === 'awaiting_payment' || order.status === 'wrong_amount';
  const received = order.received_tzs ? formatTzsAmount(order.received_tzs) : '';
  const deposit = order.purpose === 'offer_deposit' || order.purpose === 'group_deposit';
  const usdCents = order.amount_usd == null && rate ? tzsToUsdCents(order.amount_tzs, rate.rate) : null;

  const Icon = order.status === 'confirmed' ? CheckCircle2 : order.status === 'cancelled' ? XCircle : Clock;
  const tone = order.status === 'confirmed' ? 'bg-mint text-forest' : order.status === 'cancelled' ? 'bg-surface' : 'bg-sand';

  return (
    <div className="mt-2 space-y-6">
      <h1 className="text-3xl font-bold">{t.purposes[order.purpose]}</h1>
      {ok && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{ok}</p>}
      {e && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{e}</p>}

      <section aria-labelledby="status" className={`rounded-[5px] p-5 ${tone}`}>
        <h2 id="status" className="flex items-center gap-2 text-xl font-bold"><Icon className="size-6 shrink-0" aria-hidden /> {t.status[order.status]}</h2>
        <p className="mt-2">{fillText(t.statusBody[order.status], { amount, received })}</p>
        {order.claim_status === 'rejected' && order.claim_reason && order.status !== 'confirmed' && (
          <div className="mt-3 rounded-[5px] bg-white p-3">
            <p className="font-semibold">{t.rejectedTitle}</p>
            <p className="text-sm">{t.rejected[order.claim_reason]}{order.claim_note ? ` ${order.claim_note}` : ''}</p>
            {open && <p className="mt-1 text-sm">{t.tryAgain}</p>}
          </div>
        )}
        {order.claim_network && order.claim_transaction_id && (
          <p className="mt-2 text-sm opacity-80">
            {fillText(t.sentWith, { network: networkName(order.claim_network, t), code: order.claim_transaction_id, phone: order.claim_phone ?? maskPhone(null) })}
          </p>
        )}
      </section>

      <section className="card space-y-2" aria-labelledby="amount">
        <h2 id="amount" className="text-sm font-semibold text-muted">{t.amount}</h2>
        <p className="text-3xl font-extrabold tabular-nums">{amount}</p>
        {order.amount_usd != null && rate && (
          <p className="text-sm text-muted">{fillText(t.usdNote, { usd: String(order.amount_usd), rate: rate.rate, date: rate.asOf })}</p>
        )}
        {usdCents && rate && <p className="text-sm text-muted">{fillText(t.usdNote, { usd: centsText(usdCents), rate: rate.rate, date: rate.asOf })}</p>}
        {deposit && <p className="text-sm">{t.depositHeld}</p>}
        <div className="pt-2">
          <p className="text-sm font-semibold text-muted">{t.reference}</p>
          <p className="font-mono text-2xl font-bold tracking-wider">{order.reference}</p>
          <p className="text-sm text-muted">{t.referenceHint}</p>
        </div>
      </section>

      {open && (
        <>
          <section aria-labelledby="numbers" className="space-y-3">
            <h2 id="numbers" className="text-xl font-bold">{t.numbersTitle}</h2>
            {list.length === 0 ? (
              <p className="rounded-[5px] bg-sand p-3">{t.noNumbers}</p>
            ) : (
              <ul className="space-y-3">
                {list.map((n) => {
                  const steps = n.network === 'bank' ? t.stepsBank : t.stepsMobile;
                  const values = { network: networkName(n.network, t), number: n.lipa_number, name: n.business_name, amount, code: order.reference, bank: n.bank_name ?? t.bank };
                  return (
                    <li key={n.id} className="card">
                      <details>
                        <summary className="cursor-pointer list-none">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-bold">{networkName(n.network, t)}{n.bank_name ? ` (${n.bank_name})` : ''}</span>
                            <span className="font-mono text-xl font-bold">{n.lipa_number}</span>
                          </span>
                          <span className="block text-sm text-muted">{fillText(t.nameShown, { name: n.business_name })}</span>
                          {n.menu_hint && <span className="block text-sm text-muted">{fillText(t.menu, { hint: n.menu_hint })}</span>}
                          <span className="mt-2 inline-block text-sm font-semibold text-forest underline">{t.stepsTitle}</span>
                        </summary>
                        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                          {steps.map((s, i) => <li key={i}>{fillText(s, values)}</li>)}
                        </ol>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="paid" aria-labelledby="paid-title" className="card scroll-mt-28 space-y-4">
            <h2 id="paid-title" className="text-xl font-bold">{t.formTitle}</h2>
            <form action={submitClaim} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="reference" value={order.reference} />
              <label className="block">
                <span className="mb-1 block font-semibold">{t.network}</span>
                <select name="network" required className="field" defaultValue={list[0]?.network ?? 'mpesa'}>
                  {LIPA_NETWORKS.map((n) => <option key={n} value={n}>{networkName(n, t)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">{t.transactionId}</span>
                <input name="transaction_id" required minLength={6} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="field font-mono" aria-describedby="tx-hint" />
                <span id="tx-hint" className="mt-1 block text-sm text-muted">{t.transactionHint}</span>
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">{t.phone}</span>
                <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} className="field" aria-describedby="phone-hint" />
                <span id="phone-hint" className="mt-1 block text-sm text-muted">{t.phoneHint}</span>
              </label>
              <SubmitButton className="btn w-full">{t.submit}</SubmitButton>
            </form>
            {order.status === 'awaiting_payment' && order.claims_count === 0 && (
              <form action={cancelOrder}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="reference" value={order.reference} />
                <SubmitButton className="btn-outline w-full">{t.cancel}</SubmitButton>
              </form>
            )}
          </section>
        </>
      )}
      <p className="text-sm text-muted">{t.refundNotes.manual}</p>
    </div>
  );
}
