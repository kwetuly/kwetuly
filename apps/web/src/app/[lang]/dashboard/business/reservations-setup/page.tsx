import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  isNotAppliedError,
  isReservableType,
  knownBlockers,
  reservationLimits,
  reservationText,
  tanzaniaToday,
  type ReservationRate,
  type ReservationText,
} from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ReservationSetup, type SetupData } from './setup';

export async function generateMetadata(): Promise<Metadata> {
  return { title: reservationText(await getLocale()).title, robots: { index: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type OwnBusiness = { id: string; business_name: string; business_type: string };

// Reservations setup for restaurant, spa and salon owners (slice 1 of
// docs/team/design-reservations-and-trip-record-2026-11-22.md). While migration 20261122200000 is not on
// the database, every part is still shown, with "opens soon" and the save buttons switched off.
export default async function ReservationsSetupPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  const r = reservationText(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/${locale}/dashboard#business`} className="text-sm font-semibold text-forest underline">{r.backToBusiness}</Link>
      <h1 className="mt-2 text-3xl font-bold">{r.title}</h1>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} r={r} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="mt-6 space-y-4">
      <div className="h-32 animate-pulse rounded-[5px] bg-line" />
      <div className="h-48 animate-pulse rounded-[5px] bg-line" />
      <div className="h-48 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

function Note({ children, locale, r }: { children: string; locale: Locale; r: ReservationText }) {
  return (
    <div className="card mt-6 space-y-4">
      <p>{children}</p>
      <Link href={`/${locale}/dashboard#business`} className="btn-outline">{r.backToBusiness}</Link>
    </div>
  );
}

const rateOf = (row: Record<string, unknown> | undefined): ReservationRate | null =>
  row && typeof row.kind === 'string'
    ? { kind: row.kind as ReservationRate['kind'], amount_tzs: (row.amount_tzs as number | null) ?? null, percent: row.percent == null ? null : Number(row.percent), max_guests_counted: (row.max_guests_counted as number | null) ?? null }
    : null;

async function Content({ locale, r, searchParams }: { locale: Locale; r: ReservationText; searchParams: SearchParams }) {
  const params = await searchParams;
  const user = await requireUser(locale, `/${locale}/dashboard/business/reservations-setup`);
  const supabase = await createClient();
  const own = await supabase.from('providers').select('id, business_name, business_type').eq('owner_id', user.id).order('created_at').returns<OwnBusiness[]>();
  if (own.error) {
    return (
      <div role="alert" className="card mt-6 space-y-4">
        <p>{r.loadError}</p>
        <Link href={`/${locale}/dashboard/business/reservations-setup`} className="btn-outline">{r.retry}</Link>
      </div>
    );
  }
  const businesses = own.data ?? [];
  if (businesses.length === 0) return <Note locale={locale} r={r}>{r.noBusiness}</Note>;
  const reservable = businesses.filter((b) => isReservableType(b.business_type));
  if (reservable.length === 0) return <Note locale={locale} r={r}>{r.notReservable}</Note>;
  const wanted = typeof params.id === 'string' ? params.id : '';
  const business = reservable.find((b) => b.id === wanted) ?? reservable[0];
  const today = tanzaniaToday();

  const [status, rules, hours, closed, services, rate] = await Promise.all([
    supabase.rpc('reservation_setup_status', { p_provider: business.id }),
    supabase.from('providers').select('reservation_min_notice_min, reservation_max_days').eq('id', business.id).maybeSingle<{ reservation_min_notice_min: number; reservation_max_days: number }>(),
    supabase.from('business_hours').select('weekday, opens, closes').eq('provider_id', business.id),
    // Notes are not readable from the table (security review); the owner reads them through this function.
    supabase.rpc('business_closed_dates_with_notes', { p_provider: business.id }),
    supabase.from('business_services').select('id, name, duration_min, price_tzs, max_people, group_discount_min_people, group_discount_percent, active, sort').eq('provider_id', business.id).order('sort').order('created_at').limit(reservationLimits.servicesPerBusiness),
    supabase.rpc('reservation_rate', { p_provider: business.id }),
  ]);
  const results = [status, rules, hours, closed, services, rate];
  const soon = results.some((x) => isNotAppliedError(x.error));
  if (!soon && results.some((x) => x.error)) {
    return (
      <div role="alert" className="card mt-6 space-y-4">
        <p>{r.loadError}</p>
        <Link href={`/${locale}/dashboard/business/reservations-setup?id=${business.id}`} className="btn-outline">{r.retry}</Link>
      </div>
    );
  }

  const s = soon ? undefined : ((status.data ?? []) as Record<string, unknown>[])[0];
  const serviceRows = soon ? [] : ((services.data ?? []) as SetupData['services']);
  // Spa and salon services without a listed price use the per-person rate: show it too.
  const unpriced = business.business_type !== 'restaurant' ? serviceRows.find((x) => x.active && x.price_tzs == null) : undefined;
  const unpricedRate = unpriced && !soon ? await supabase.rpc('reservation_rate', { p_provider: business.id, p_service: unpriced.id }) : null;

  const data: SetupData = {
    soon,
    today,
    providerId: business.id,
    businessName: business.business_name,
    businessType: business.business_type as SetupData['businessType'],
    status: {
      takesReservations: Boolean(s?.takes_reservations),
      openNow: Boolean(s?.open_now),
      blockers: knownBlockers((s?.blockers as string[] | undefined) ?? []),
      termsVersion: (s?.terms_version as string | null) ?? null,
      termsCurrentVersion: (s?.terms_current_version as string | null) ?? null,
      termsAcceptedAt: (s?.terms_accepted_at as string | null) ?? null,
    },
    rules: {
      minNotice: rules.data?.reservation_min_notice_min ?? reservationLimits.minNoticeDefault,
      maxDays: rules.data?.reservation_max_days ?? reservationLimits.maxDaysDefault,
    },
    hours: soon ? [] : ((hours.data ?? []) as SetupData['hours']),
    closed: soon ? [] : ((closed.data ?? []) as SetupData['closed']).filter((c) => c.day >= today),
    services: serviceRows,
    rate: soon ? null : rateOf(((rate.data ?? []) as Record<string, unknown>[])[0]),
    unpricedRate: unpricedRate && !unpricedRate.error ? rateOf(((unpricedRate.data ?? []) as Record<string, unknown>[])[0]) : null,
  };

  return (
    <>
      {reservable.length > 1 && (
        <nav aria-label={r.pickBusiness} className="mt-4 flex flex-wrap gap-2">
          {reservable.map((b) => (
            <Link
              key={b.id}
              href={`/${locale}/dashboard/business/reservations-setup?id=${b.id}`}
              aria-current={b.id === business.id ? 'page' : undefined}
              className={`rounded-[5px] border px-4 py-2 text-sm font-semibold ${b.id === business.id ? 'border-forest bg-mint text-forest' : 'border-line bg-white'}`}
            >
              {b.business_name}
            </Link>
          ))}
        </nav>
      )}
      {/* Keyed by business, so the forms start again from the saved values when the owner switches. */}
      <ReservationSetup key={business.id} locale={locale} data={data} />
    </>
  );
}
