import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { callPayments } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };

// Selcom sends the traveller back here. We ask Selcom for the real result rather than trusting the URL.
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
  await requireUser(locale);
  const order = (await searchParams).order;
  const orderId = typeof order === 'string' && /^RAF\d{10,20}$/.test(order) ? order : null;
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
    return <p className="card">{p.error}</p>;
  }

  let state = payment.status;
  if (state === 'pending') {
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
      : state === 'failed'
        ? { icon: <XCircle className="size-10 text-red-700" aria-hidden />, text: p.failed }
        : { icon: <Clock className="size-10 text-sunset" aria-hidden />, text: p.pending };

  return (
    <div className="card space-y-4 text-center">
      <div className="flex justify-center">{view.icon}</div>
      <h1 className="text-2xl font-extrabold">{view.text}</h1>
      <p className="text-muted">{payment.description} · TZS {payment.amount_tzs.toLocaleString(locale)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {state === 'pending' && <Link href={`/${locale}/payments/return?order=${orderId}`} className="btn-outline">{p.checkAgain}</Link>}
        <Link href={back} className="btn">{p.back}</Link>
      </div>
    </div>
  );
}
