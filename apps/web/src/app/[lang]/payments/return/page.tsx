import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CheckCircle2, Clock, SearchCheck, XCircle } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser, requireUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { isOrderId } from '@kwetuly/shared';
import { callPayments } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.payments.returnTitle, robots: { index: false } };
}

// The processor sends the traveller back here (Flutterwave adds status, tx_ref and transaction_id to
// the address). Nothing in the address is trusted: the server asks the processor for the real result.
export default async function PaymentReturnPage({ searchParams }: PageProps<'/[lang]/payments/return'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <Result searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Result({ searchParams, t, locale }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary; locale: Locale }) {
  const params = await searchParams;
  // Our own `order`, or the processor's echo of it (Flutterwave: `tx_ref`, the same id). Only used to look up the payer's own row.
  const pick = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 35) : '');
  const candidate = [pick(params.order), pick(params.tx_ref)].find((v) => isOrderId(v));
  const orderId = candidate ?? null;
  // Signed out (e.g. the phone opened the return link in another browser): come back here after sign-in.
  // Only a well-formed order id is carried over, so the address stays a plain local path.
  const here = `/${locale}/payments/return${orderId ? `?order=${orderId}` : ''}`;
  if (!(await getCurrentUser())) redirect(`/${locale}/login?next=${encodeURIComponent(here)}`);
  await requireUser(locale, here);
  const p = t.payments;

  const supabase = await createClient();
  const [{ data: session }, { data: payment }] = await Promise.all([
    supabase.auth.getSession(),
    orderId
      ? supabase
          .from('payments')
          .select('kind, description, amount_tzs, status, trip_offer_id, group_member_id, trip_offers(request_id), group_trip_members(group_trip_id)')
          .eq('order_id', orderId)
          .maybeSingle<{
            kind: string;
            description: string;
            amount_tzs: number;
            status: string;
            trip_offers: { request_id: string } | null;
            group_trip_members: { group_trip_id: string } | null;
          }>()
      : Promise.resolve({ data: null }),
  ]);
  if (!orderId || !payment) {
    return (
      <div className="card space-y-4 text-center">
        <p>{orderId ? p.notFound : p.error}</p>
        <Link href={`/${locale}/dashboard`} className="btn">{p.myTrips}</Link>
      </div>
    );
  }

  let state = payment.status;
  // Failed orders are asked about too: one Kwetuly gave up on may still have been paid, and the Edge
  // Function then holds it for review.
  if (state === 'pending' || state === 'failed') {
    const result = await callPayments({ action: 'status', order_id: orderId }, session.session?.access_token).catch(() => ({ status: 'pending' }));
    state = result.status ?? 'pending';
  }
  const back = payment.trip_offers
    ? `/${locale}/requests/${payment.trip_offers.request_id}`
    : payment.group_trip_members
      ? `/${locale}/group-trips/${payment.group_trip_members.group_trip_id}`
      : `/${locale}/dashboard`;

  const view =
    state === 'paid'
      ? { icon: <CheckCircle2 className="size-10 text-forest" aria-hidden />, text: p.paid }
      : state === 'review'
        ? { icon: <SearchCheck className="size-10 text-leaf-dark" aria-hidden />, text: p.review, note: p.reviewNote }
        : state === 'failed'
          ? { icon: <XCircle className="size-10 text-red-700" aria-hidden />, text: p.failed }
          : { icon: <Clock className="size-10 text-leaf-dark" aria-hidden />, text: p.pending };

  return (
    <div className="card space-y-4 text-center">
      <div className="flex justify-center">{view.icon}</div>
      <h1 className="text-2xl font-extrabold">{view.text}</h1>
      {'note' in view && <p>{view.note}</p>}
      <p className="text-muted">{payment.description} · TZS {payment.amount_tzs.toLocaleString(locale)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {(state === 'pending' || state === 'review') && <Link href={`/${locale}/payments/return?order=${orderId}`} className="btn-outline">{p.checkAgain}</Link>}
        <Link href={back} className="btn">{p.back}</Link>
      </div>
    </div>
  );
}
