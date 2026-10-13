import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import type { GroupTrip } from '@/lib/groups';
import { createClient } from '@/lib/supabase/server';
import { formatDates } from '@/components/group-trip-card';

export const metadata: Metadata = { title: 'My group trips', robots: { index: false } };

export default async function MyGroupTripsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">{t.groups.mine}</h1>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-3xl bg-surface" />}>
        <Lists t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

type Row = Pick<GroupTrip, 'id' | 'title' | 'start_date' | 'end_date' | 'seats_taken' | 'max_people' | 'status' | 'cancelled'>;

async function Lists({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  const g = t.groups;
  const supabase = await createClient();
  const [organised, joined] = await Promise.all([
    supabase
      .from('group_trips')
      .select('id, title, start_date, end_date, seats_taken, max_people, status, cancelled')
      .eq('organizer_id', user.id)
      .order('start_date', { ascending: false })
      .returns<Row[]>(),
    supabase
      .from('group_trip_members')
      .select('status, group_trips(id, title, start_date, end_date, seats_taken, max_people, status, cancelled)')
      .eq('traveler_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .returns<{ status: string; group_trips: Row | null }[]>(),
  ]);
  const requestLabel: Record<string, string> = { requested: g.stateRequested, accepted: g.stateAccepted, declined: g.stateDeclined };
  const tripState = (trip: Row) => (trip.cancelled ? g.cancelledTrip : trip.status === 'pending' ? g.statusPending : trip.status === 'rejected' ? g.statusRejected : null);

  const item = (trip: Row, note?: string | null) => (
    <li key={trip.id}>
      <Link href={`/${locale}/group-trips/${trip.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-5 hover:border-sunset">
        <span>
          <span className="block font-bold">{trip.title}</span>
          <span className="text-sm text-muted">{formatDates(trip as GroupTrip, locale)} · {trip.seats_taken}/{trip.max_people}</span>
        </span>
        {note && <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-sunset-dark">{note}</span>}
      </Link>
    </li>
  );

  return (
    <div className="mt-6 space-y-10">
      {(organised.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-xl font-bold">{g.organising}</h2>
          <ul className="mt-3 space-y-3">{organised.data!.map((trip) => item(trip, tripState(trip)))}</ul>
        </section>
      )}
      <section>
        <h2 className="text-xl font-bold">{g.joined}</h2>
        {(joined.data?.length ?? 0) === 0 ? (
          <p className="mt-3 text-muted">
            <Link href={`/${locale}/group-trips`} className="font-semibold text-forest underline">{g.title}</Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {joined.data!.filter((j) => j.group_trips).map((j) => item(j.group_trips!, tripState(j.group_trips!) ?? requestLabel[j.status]))}
          </ul>
        )}
      </section>
      {/* Only verified guides and business accounts can organise. */}
      {(user.guide?.status === 'approved' || user.role === 'provider' || user.role === 'admin') && (
        <Link href={`/${locale}/group-trips/new`} className="btn">{g.start}</Link>
      )}
    </div>
  );
}
