import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { formatTzsAmount, lipaPayText, type MyPaymentOrder } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: lipaPayText(await getLocale()).myPayments, robots: { index: false } };
}

// The payer's own payments to Kwetuly, newest first.
export default async function MyPaymentsPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{lipaPayText(locale).myPayments}</h1>
      <Suspense fallback={<div aria-busy="true" className="card mt-6 h-40 animate-pulse" />}>
        <List locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ locale }: { locale: Locale }) {
  await requireUser(locale, `/${locale}/payments/orders`);
  const t = lipaPayText(locale);
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_payment_orders', { p_reference: null });
  const rows = (data ?? []) as MyPaymentOrder[];
  if (rows.length === 0) return <p className="mt-6 text-muted">{t.none}</p>;
  return (
    <ul className="mt-6 space-y-3">
      {rows.map((o) => (
        <li key={o.reference}>
          <Link href={`/${locale}/payments/orders/${o.reference}`} className="card flex flex-wrap items-center justify-between gap-3 hover:bg-surface">
            <span>
              <span className="block font-bold">{t.purposes[o.purpose]}</span>
              <span className="block font-mono text-sm text-muted">{o.reference}</span>
            </span>
            <span className="text-right">
              <span className="block font-bold tabular-nums">{formatTzsAmount(o.amount_tzs)}</span>
              <span className="block text-sm">{t.status[o.status]}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
