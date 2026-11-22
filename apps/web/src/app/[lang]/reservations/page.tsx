import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { fillText, isNotAppliedError, reserveText, type ReserveText } from '@kwetuly/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MyReservations, type MyReservation } from './my-reservations';

export async function generateMetadata(): Promise<Metadata> {
  return { title: reserveText(await getLocale()).myTitle, robots: { index: false } };
}

// The traveller's reservations (slice 2): status, the business's answer, the other time offered,
// cancel, and "Did your visit happen?". Shown with "opens soon" while the database part is missing.
export default async function ReservationsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const r = reserveText(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline">{t.nav.dashboard}</Link>
      <h1 className="mt-2 text-3xl font-bold">{r.myTitle}</h1>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} r={r} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="mt-6 space-y-4">
      <div className="h-32 animate-pulse rounded-[5px] bg-line" />
      <div className="h-32 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

async function Content({ locale, r, searchParams }: { locale: Locale; r: ReserveText; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await requireUser(locale, `/${locale}/reservations`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_reservations');
  const soon = isNotAppliedError(error);
  if (error && !soon) {
    return (
      <div role="alert" className="card mt-6 space-y-4">
        <p>{r.loadError}</p>
        <Link href={`/${locale}/reservations`} className="btn-outline">{r.retry}</Link>
      </div>
    );
  }
  const rows = soon ? [] : ((data ?? []) as MyReservation[]);
  const sent = typeof params.sent === 'string' ? params.sent.slice(0, 120) : null;
  return (
    <div className="mt-6 space-y-4">
      {sent && (
        <p role="status" className="flex items-start gap-2 rounded-[5px] bg-mint p-4 font-semibold text-forest">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> {fillText(r.sent, { business: sent })}
        </p>
      )}
      {soon && (
        <p role="status" className="flex items-start gap-2 rounded-[5px] bg-sand p-4 font-semibold">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {r.soon}
        </p>
      )}
      {rows.length === 0 ? (
        <div className="card space-y-4">
          <p className="text-muted">{r.myEmpty}</p>
          <Link href={`/${locale}/local/food`} className="btn-outline">{r.findPlaces}</Link>
        </div>
      ) : (
        <MyReservations locale={locale} rows={rows} />
      )}
    </div>
  );
}
