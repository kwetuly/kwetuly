import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Info } from 'lucide-react';
import {
  addDaysIso,
  isNotAppliedError,
  isReservableType,
  monthStart,
  recentMonths,
  reservationInboxText,
  tanzaniaToday,
  type ReservationInboxText,
} from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Inbox, Statement, type OwnerReservation, type StatementRow } from './inbox';

export async function generateMetadata(): Promise<Metadata> {
  return { title: reservationInboxText(await getLocale()).title, robots: { index: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The business owner's reservations (slice 2): requests to answer, guests to mark as came or did not
// come, and the monthly statement ("for information, no charge" while billing is off). From 30 days
// ago to 60 days ahead (the database allows up to 93 days per call).
export default async function BusinessReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  const x = reservationInboxText(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/${locale}/dashboard#business`} className="text-sm font-semibold text-forest underline">{x.backToBusiness}</Link>
      <h1 className="mt-2 text-3xl font-bold">{x.title}</h1>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} x={x} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="mt-6 space-y-4">
      <div className="h-32 animate-pulse rounded-[5px] bg-line" />
      <div className="h-48 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

async function Content({ locale, x, searchParams }: { locale: Locale; x: ReservationInboxText; searchParams: SearchParams }) {
  const params = await searchParams;
  const user = await requireUser(locale, `/${locale}/dashboard/business/reservations`);
  const supabase = await createClient();
  const own = await supabase.from('providers').select('id, business_name, business_type').eq('owner_id', user.id).order('created_at').returns<{ id: string; business_name: string; business_type: string }[]>();
  const reservable = (own.data ?? []).filter((b) => isReservableType(b.business_type));
  if (own.error || reservable.length === 0) {
    return (
      <div role={own.error ? 'alert' : undefined} className="card mt-6 space-y-4">
        <p>{own.error ? x.loadError : x.noBusiness}</p>
        <Link href={`/${locale}/dashboard#business`} className="btn-outline">{x.backToBusiness}</Link>
      </div>
    );
  }
  const business = reservable.find((b) => b.id === params.id) ?? reservable[0];
  const today = tanzaniaToday();
  const month = monthStart(typeof params.month === 'string' ? params.month : null, today);
  const [list, statement, billing] = await Promise.all([
    supabase.rpc('business_reservations', { p_provider: business.id, p_from: addDaysIso(today, -30), p_to: addDaysIso(today, 60) }),
    supabase.rpc('business_reservation_statement', { p_provider: business.id, p_month: month }),
    supabase.rpc('reservation_billing_on'),
  ]);
  const soon = isNotAppliedError(list.error) || isNotAppliedError(statement.error);
  if (!soon && (list.error || statement.error)) {
    return (
      <div role="alert" className="card mt-6 space-y-4">
        <p>{x.loadError}</p>
        <Link href={`/${locale}/dashboard/business/reservations?id=${business.id}`} className="btn-outline">{x.retry}</Link>
      </div>
    );
  }
  const rows = soon ? [] : ((list.data ?? []) as OwnerReservation[]);
  const statementRows = soon ? [] : ((statement.data ?? []) as StatementRow[]);

  return (
    <div className="mt-2 space-y-6">
      <p className="text-muted">{x.intro}</p>
      {reservable.length > 1 && (
        <nav aria-label={x.title} className="flex flex-wrap gap-2">
          {reservable.map((b) => (
            <Link
              key={b.id}
              href={`/${locale}/dashboard/business/reservations?id=${b.id}`}
              aria-current={b.id === business.id ? 'page' : undefined}
              className={`rounded-[5px] border px-4 py-2 text-sm font-semibold ${b.id === business.id ? 'border-forest bg-mint text-forest' : 'border-line bg-white'}`}
            >
              {b.business_name}
            </Link>
          ))}
        </nav>
      )}
      {soon && (
        <p role="status" className="flex items-start gap-2 rounded-[5px] bg-sand p-4 font-semibold">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {x.soon}
        </p>
      )}
      <Link href={`/${locale}/dashboard/business/reservations-setup?id=${business.id}`} className="inline-block text-sm font-semibold text-forest underline">{x.setupLink}</Link>
      <Inbox key={business.id} locale={locale} rows={rows} soon={soon} />
      <Statement
        locale={locale}
        providerId={business.id}
        month={month.slice(0, 7)}
        months={recentMonths(today, 12)}
        rows={statementRows}
        billingOn={!soon && (billing.data === true || statementRows.some((s) => s.billing_on))}
        soon={soon}
      />
    </div>
  );
}
