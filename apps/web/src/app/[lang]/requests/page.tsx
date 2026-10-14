import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CalendarDays, Gavel, Plus, Users } from 'lucide-react';
import { formatUsd } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { REQUEST_COLUMNS, type TripOffer, type TripRequest } from '@/lib/requests';
import { createClient } from '@/lib/supabase/server';
import { PhotoHero } from '@/components/photo-hero';
import { specialtyName } from '@/components/guide-card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.requests.title, description: t.requests.subtitle };
}

export default async function RequestsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo="kiliHeather">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14">
          <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white">
            <Gavel className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-4xl font-extrabold sm:text-5xl">{t.requests.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{t.requests.subtitle}</p>
          <Link href={`/${locale}/requests/new`} className="btn mt-8"><Plus className="size-4" aria-hidden /> {t.requests.post}</Link>
        </div>
      </PhotoHero>
      <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-6xl animate-pulse rounded-[5px] bg-surface" />}>
        <Lists t={t} locale={locale} />
      </Suspense>
    </>
  );
}

async function Lists({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link href={`/${locale}/login?next=/${locale}/requests`} className="btn-outline">{t.nav.signIn}</Link>
      </div>
    );
  }
  const canOffer = user.role === 'admin' || user.role === 'provider' || user.guide?.status === 'approved';
  const supabase = await createClient();
  const [{ data: mine }, { data: open }, { data: myOffers }] = await Promise.all([
    supabase.from('trip_requests').select(REQUEST_COLUMNS).eq('traveler_id', user.id).order('created_at', { ascending: false }).returns<TripRequest[]>(),
    canOffer
      ? supabase.from('trip_requests').select(REQUEST_COLUMNS).eq('status', 'open').neq('traveler_id', user.id).order('created_at', { ascending: false }).limit(60).returns<TripRequest[]>()
      : Promise.resolve({ data: [] as TripRequest[] }),
    canOffer
      ? supabase
          .from('trip_offers')
          .select('id, request_id, status, price_total_usd, trip_requests(title)')
          .eq('offered_by', user.id)
          .order('created_at', { ascending: false })
          .returns<(Pick<TripOffer, 'id' | 'request_id' | 'status' | 'price_total_usd'> & { trip_requests: { title: string } | null })[]>()
      : Promise.resolve({ data: [] }),
  ]);
  const r = t.requests;
  const o = t.offers;
  // Lowest live offer on each of my requests (travellers can read offers on their own requests).
  const myIds = (mine ?? []).map((req) => req.id);
  const { data: prices } = myIds.length
    ? await supabase.from('trip_offers').select('request_id, price_total_usd').in('request_id', myIds).in('status', ['sent', 'accepted']).returns<{ request_id: string; price_total_usd: number }[]>()
    : { data: [] as { request_id: string; price_total_usd: number }[] };
  const lowest = new Map<string, number>();
  for (const p of prices ?? []) lowest.set(p.request_id, Math.min(lowest.get(p.request_id) ?? Infinity, p.price_total_usd));

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <section>
        <h2 className="text-2xl font-bold">{r.mine}</h2>
        {(mine ?? []).length === 0 ? (
          <p className="mt-3 text-muted">{r.none}</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {mine!.map((req) => <RequestRow key={req.id} req={req} lowest={lowest.get(req.id)} t={t} locale={locale} />)}
          </ul>
        )}
      </section>

      {canOffer && (
        <section>
          <h2 className="text-2xl font-bold">{o.boardTitle}</h2>
          <p className="mt-1 text-muted">{o.boardBody}</p>
          {(open ?? []).length === 0 ? (
            <p className="mt-3 text-muted">{o.noneOpen}</p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {open!.map((req) => <RequestRow key={req.id} req={req} t={t} locale={locale} showName />)}
            </ul>
          )}
        </section>
      )}

      {canOffer && (
        <section>
          <h2 className="text-2xl font-bold">{o.myOffers}</h2>
          {(myOffers ?? []).length === 0 ? (
            <p className="mt-3 text-muted">{o.noOffers}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-[5px] border border-line bg-white">
              {myOffers!.map((offer) => (
                <li key={offer.id}>
                  <Link href={`/${locale}/requests/${offer.request_id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
                    <span className="font-semibold">{offer.trip_requests?.title}</span>
                    <span className="text-sm text-muted">${offer.price_total_usd.toLocaleString(locale)} · {r.offerStatus[offer.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function RequestRow({ req, lowest, t, locale, showName }: { req: TripRequest; lowest?: number; t: Dictionary; locale: Locale; showName?: boolean }) {
  const r = t.requests;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <li>
      <Link href={`/${locale}/requests/${req.id}`} className="card block h-full p-5 transition hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-bold">{req.title}</p>
          <span className={`shrink-0 rounded-[5px] px-2.5 py-0.5 text-xs font-bold ${req.status === 'open' ? 'bg-mint text-forest' : 'bg-surface text-muted'}`}>
            {r.status[req.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {specialtyName(req.specialty, locale)}{showName ? ` · ${req.traveler_name}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {req.start_date ? date.format(new Date(req.start_date)) : r.datesFlexible}
          </span>
          <span className="flex items-center gap-1.5"><Users className="size-4" aria-hidden /> {req.adults + req.children} {r.people}</span>
          <span className="text-leaf-dark">{r.offersTitle}: {req.offers_count}</span>
          {lowest != null && <span className="tabular-nums">{r.fromPrice.replace('{price}', formatUsd(lowest))}</span>}
        </div>
      </Link>
    </li>
  );
}
