import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { TOUR_COLUMNS, TOUR_TYPES, TRIP_CIRCUITS, tourReadiness, verifiedPrice, type Tour } from '@kwetuly/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { today } from '@/lib/today';
import { quickUpdateTour } from './actions';

export const metadata: Metadata = { title: 'Admin: tours', robots: { index: false } };

type AdminTour = Tour & { trip_stops: { count: number }[]; trip_guides: { count: number }[] };
type Search = Promise<Record<string, string | string[] | undefined>>;

// Prices and operator pages older than this are flagged as outdated.
const STALE_DAYS = 180;

export default async function AdminToursPage({ searchParams }: PageProps<'/[lang]/admin/trips'>) {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Tours</h1>
        <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">← Guides & jobs</Link>
        <Link href={`/${locale}/admin/places`} className="btn-outline ml-auto px-4 py-2 text-sm">Place guides →</Link>
        <Link href={`/${locale}/admin/operators`} className="btn-outline px-4 py-2 text-sm">Tour operators →</Link>
        <Link href={`/${locale}/admin/trips/new`} className="btn px-4 py-2 text-sm">New tour</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Signature Trips are Kwetuly’s own itineraries. Operator Tours link to a tour operator and their own page, with original summaries only.
        Prices show only with the date you verified them; without one, travellers see “Price subject to confirmation”.
        A tour can only be published once its itinerary, map stops, highlights, inclusions and best months are filled in.
      </p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <TourList locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TourList({ locale, searchParams }: { locale: Locale; searchParams: Search }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const params = await searchParams;
  const show = typeof params.show === 'string' ? params.show : 'all';

  const supabase = await createClient();
  const [{ data }, now] = await Promise.all([
    supabase
      .from('trips')
      .select(`${TOUR_COLUMNS}, trip_stops(count), trip_guides(count)`)
      .order('status')
      .order('sort_order')
      .returns<AdminTour[]>(),
    today(),
  ]);
  const all = data ?? [];
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 86_400_000);

  const info = all.map((tour) => {
    const counts = { stops: tour.trip_stops[0]?.count ?? 0, guides: tour.trip_guides[0]?.count ?? 0 };
    const missing = tourReadiness(tour, counts).filter((x) => x.required && !x.ok);
    const priceExpired = tour.price_from != null && verifiedPrice(tour, now) == null;
    const stale =
      priceExpired ||
      (tour.price_verified_at != null && new Date(tour.price_verified_at) < staleBefore) ||
      (tour.source_checked_at != null && new Date(tour.source_checked_at) < staleBefore);
    return { tour, counts, missing, priceExpired, outdated: stale || tour.needs_review };
  });

  const filters: Record<string, (x: (typeof info)[number]) => boolean> = {
    all: () => true,
    published: (x) => x.tour.status === 'published',
    draft: (x) => x.tour.status === 'draft',
    archived: (x) => x.tour.status === 'archived',
    signature: (x) => x.tour.tour_type === 'signature',
    ready: (x) => x.tour.status === 'draft' && x.missing.length === 0,
    review: (x) => x.outdated,
  };
  const labels: Record<string, string> = {
    all: 'All',
    published: 'Published',
    draft: 'Drafts',
    archived: 'Archived',
    signature: 'Signature Trips',
    ready: 'Ready to publish',
    review: 'Needs review / outdated',
  };
  const rows = info.filter(filters[show] ?? filters.all);

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {Object.keys(filters).map((key) => (
          <Link
            key={key}
            href={`/${locale}/admin/trips${key === 'all' ? '' : `?show=${key}`}`}
            className={`rounded-[5px] px-3 py-1.5 text-sm font-semibold ${show === key ? 'bg-night text-white' : 'border border-line bg-white hover:border-leaf'}`}
          >
            {labels[key]} ({info.filter(filters[key]).length})
          </Link>
        ))}
      </div>
      {params.deleted && <p className="mt-4 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">Tour deleted.</p>}

      <div className="mt-6 overflow-x-auto rounded-[5px] border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs text-muted">
            <tr>
              <th className="p-3">Tour</th>
              <th className="p-3">Status</th>
              <th className="p-3">Price</th>
              <th className="p-3">Map / guides</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ tour, counts, missing, priceExpired, outdated }) => (
              <tr key={tour.id} id={tour.id} className="align-top">
                <td className="p-3">
                  <Link href={`/${locale}/admin/trips/${tour.id}`} className="font-bold hover:text-leaf-dark">{tour.title_en}</Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {TOUR_TYPES.find((x) => x.id === tour.tour_type)?.en} · {TRIP_CIRCUITS.find((c) => c.id === tour.circuit)?.en} · {tour.days} days
                    {tour.tour_operators && ` · ${tour.tour_operators.name}`}
                  </p>
                  {missing.length > 0 && <p className="mt-1 text-xs text-muted">Missing: {missing.map((m) => m.label).join(', ')}</p>}
                </td>
                <td className="p-3">
                  <span className={`rounded-[5px] px-2 py-0.5 text-xs font-bold ${tour.status === 'published' ? 'bg-mint text-forest' : tour.status === 'draft' ? 'bg-sand text-leaf-dark' : 'bg-surface text-muted'}`}>
                    {tour.status}
                  </span>
                  {outdated && <span className="mt-1 block text-xs font-bold text-red-700">{tour.needs_review ? 'Flagged for review' : 'Outdated'}</span>}
                </td>
                <td className="p-3 text-xs">
                  {tour.price_from == null ? (
                    <span className="text-muted">Subject to confirmation</span>
                  ) : (
                    <>
                      <span className="font-semibold">{tour.price_currency} {Number(tour.price_from).toLocaleString('en-US')}</span>
                      <span className={`block ${priceExpired ? 'font-bold text-red-700' : 'text-muted'}`}>
                        {priceExpired ? 'Expired' : `Checked ${tour.price_verified_at}`}
                      </span>
                    </>
                  )}
                </td>
                <td className="p-3 text-xs text-muted">{counts.stops} stops · {counts.guides} guides</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/${locale}/admin/trips/${tour.id}`} className="rounded-[5px] bg-leaf px-2.5 py-1 text-xs font-bold text-white">Edit</Link>
                    <Link href={`/${locale}/tours/${tour.slug}`} className="rounded-[5px] border border-line px-2.5 py-1 text-xs font-semibold">View</Link>
                    <QuickAction id={tour.id} locale={locale} action={tour.needs_review ? 'unflag' : 'flag'} label={tour.needs_review ? 'Reviewed' : 'Flag'} />
                    {tour.status === 'published' && <QuickAction id={tour.id} locale={locale} action="draft" label="Unpublish" />}
                    {tour.status !== 'archived' && <QuickAction id={tour.id} locale={locale} action="archive" label="Archive" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function QuickAction({ id, locale, action, label }: { id: string; locale: Locale; action: string; label: string }) {
  return (
    <form action={quickUpdateTour}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button className="rounded-[5px] border border-line px-2.5 py-1 text-xs font-semibold hover:border-leaf">{label}</button>
    </form>
  );
}
