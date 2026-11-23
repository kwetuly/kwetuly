import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  fillText,
  hoursByWeekday,
  isNotAppliedError,
  isReservableType,
  reservationLimits,
  reserveText,
  tanzaniaToday,
  type ReservationRate,
} from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { getBusiness } from '@/lib/businesses';
import { createClient } from '@/lib/supabase/server';
import { ReserveForm, type ReserveData } from './reserve-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: reserveText(await getLocale()).reserve, robots: { index: false } };
}

// The Reserve form of a restaurant, spa or salon (slice 2). Signed-in travellers only (the database
// needs an account). While the reservation migrations are not on the database the form is still shown,
// with "opens soon" and Send switched off.
export default async function ReservePage(props: { params: Promise<{ lang: string; id: string }> }) {
  // Checked before the Suspense boundary so other businesses and samples return HTTP 404 (QA 14).
  const { id } = await props.params;
  const business = await getBusiness(id);
  if (!business || business.is_sample || !isReservableType(business.business_type)) notFound();
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<Loading />}>
        <Content params={props.params} locale={locale} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-10 w-2/3 animate-pulse rounded-[5px] bg-line" />
      <div className="h-96 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

const rateOf = (row: Record<string, unknown> | undefined): ReservationRate | null =>
  row && typeof row.kind === 'string'
    ? { kind: row.kind as ReservationRate['kind'], amount_tzs: (row.amount_tzs as number | null) ?? null, percent: row.percent == null ? null : Number(row.percent), max_guests_counted: (row.max_guests_counted as number | null) ?? null }
    : null;

async function Content({ params, locale }: { params: Promise<{ id: string }>; locale: Locale }) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business || business.is_sample || !isReservableType(business.business_type)) notFound();
  await requireUser(locale, `/${locale}/businesses/${id}/reserve`);
  const r = reserveText(locale);
  const supabase = await createClient();
  const today = tanzaniaToday();

  const [rules, services, hours, closed, rate] = await Promise.all([
    supabase.from('providers').select('takes_reservations, reservation_min_notice_min, reservation_max_days').eq('id', id).maybeSingle<{ takes_reservations: boolean; reservation_min_notice_min: number; reservation_max_days: number }>(),
    supabase.from('business_services').select('id, name, duration_min, price_tzs, max_people').eq('provider_id', id).eq('active', true).order('sort').limit(reservationLimits.servicesPerBusiness),
    supabase.from('business_hours').select('weekday, opens, closes').eq('provider_id', id),
    supabase.from('business_closed_dates').select('day').eq('provider_id', id).gte('day', today).limit(120),
    supabase.rpc('reservation_rate', { p_provider: id }),
  ]);
  const results = [rules, services, hours, closed, rate];
  const soon = results.some((x) => isNotAppliedError(x.error));
  if (!soon && results.some((x) => x.error)) {
    return (
      <div role="alert" className="card space-y-4">
        <p>{r.loadError}</p>
        <Link href={`/${locale}/businesses/${id}/reserve`} className="btn-outline">{r.retry}</Link>
      </div>
    );
  }
  const serviceRows = soon ? [] : ((services.data ?? []) as ReserveData['services']);
  const care = business.business_type !== 'restaurant';
  const unpriced = care ? serviceRows.find((s) => s.price_tzs == null) : undefined;
  const unpricedRate = unpriced && !soon ? await supabase.rpc('reservation_rate', { p_provider: id, p_service: unpriced.id }) : null;
  const generalRate = soon ? null : rateOf(((rate.data ?? []) as Record<string, unknown>[])[0]);
  const open = !soon && Boolean(rules.data?.takes_reservations) && ((hours.data ?? []) as unknown[]).length > 0;
  // An open business always has a rate (the database checks it). A missing rate, or a failed second
  // call, is a load error, never a form without the disclosure (security review L-A).
  if (unpricedRate?.error || (open && !generalRate)) {
    return (
      <div role="alert" className="card space-y-4">
        <p>{r.loadError}</p>
        <Link href={`/${locale}/businesses/${id}/reserve`} className="btn-outline">{r.retry}</Link>
      </div>
    );
  }
  const hourRows = soon ? [] : ((hours.data ?? []) as { weekday: number; opens: string; closes: string }[]);

  const data: ReserveData = {
    soon,
    open,
    providerId: id,
    businessName: business.business_name,
    care,
    today,
    minNoticeMin: rules.data?.reservation_min_notice_min ?? reservationLimits.minNoticeDefault,
    maxDays: rules.data?.reservation_max_days ?? reservationLimits.maxDaysDefault,
    hours: hoursByWeekday(hourRows),
    closedDays: soon ? [] : ((closed.data ?? []) as { day: string }[]).map((c) => c.day),
    services: serviceRows,
    rate: generalRate,
    unpricedRate: unpricedRate ? rateOf(((unpricedRate.data ?? []) as Record<string, unknown>[])[0]) : null,
  };

  return (
    <>
      <Link href={`/${locale}/businesses/${id}`} className="text-sm font-semibold text-forest underline">{business.business_name}</Link>
      <h1 className="mt-2 text-3xl font-bold">{fillText(r.title, { business: business.business_name })}</h1>
      <ReserveForm locale={locale} data={data} />
    </>
  );
}
