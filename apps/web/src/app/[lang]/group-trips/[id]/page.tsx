import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, CalendarDays, Languages, MapPin, Users } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { getGroupTripForViewer, spotsLeft, type GroupMember, type GroupTrip } from '@/lib/groups';
import { photoUrl, specialtyPhoto } from '@/lib/photos';
import { createClient } from '@/lib/supabase/server';
import { languageName, specialtyName } from '@/components/guide-card';
import { RatingSummary } from '@/components/stars';
import { SpotsBar, formatDates } from '@/components/group-trip-card';
import { ShareButtons } from '@/components/share-buttons';
import { PayDeposit } from '@/components/pay-deposit';
import { approxTzs, formatUsd } from '@rafrika/shared';
import { paymentsConfig } from '@/lib/payments';
import { depositState } from '@/lib/requests';
import { cancelGroupTrip, cancelMyRequest, requestToJoin, respondToRequest } from '../actions';

type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: PageProps<'/[lang]/group-trips/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const trip = await getGroupTripForViewer(id);
  if (!trip) notFound();
  return {
    title: trip.title,
    description: trip.description.slice(0, 160),
    robots: trip.status === 'approved' ? undefined : { index: false },
    openGraph: { images: [photoUrl(specialtyPhoto(trip.specialty), 1200)] },
  };
}

export default async function GroupTripPage({ params, searchParams }: PageProps<'/[lang]/group-trips/[id]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="pattern-kanga h-80" />}>
      <TripView params={params} searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

async function TripView({ params, searchParams, t, locale }: { params: Promise<{ id: string }>; searchParams: Promise<Search>; t: Dictionary; locale: Locale }) {
  const { id } = await params;
  const [trip, user, status] = await Promise.all([getGroupTripForViewer(id), getCurrentUser(), searchParams]);
  if (!trip) notFound();
  const g = t.groups;
  const photo = specialtyPhoto(trip.specialty);
  const isOrganizer = user?.id === trip.organizer_id;
  const { rate } = await paymentsConfig();
  // The trip chat is only visible to its members (organiser and accepted travellers).
  const tripChat = user
    ? (await (await createClient()).from('group_chats').select('id').eq('group_trip_id', trip.id).maybeSingle()).data
    : null;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-night text-white">
        <Image src={photoUrl(photo, 2000)} alt={photo.alt} fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/70 to-night/20" />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10">
          <Link href={`/${locale}/group-trips`} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> {g.title}
          </Link>
          <p className="mt-16 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{specialtyName(trip.specialty, locale)}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold sm:text-5xl">{trip.title}</h1>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /> {formatDates(trip, locale)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden /> {trip.region}</span>
            <span className="flex items-center gap-1.5"><Users className="size-4" aria-hidden /> {trip.seats_taken}/{trip.max_people}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {status.created && <p className="rounded-2xl bg-mint p-4 font-semibold text-forest">✓ {g.sent}</p>}
          {trip.cancelled && <p className="rounded-2xl bg-red-50 p-4 font-semibold text-red-800">{g.cancelledTrip}</p>}
          {!trip.cancelled && trip.status === 'pending' && <p className="rounded-2xl bg-sand p-4 font-semibold text-sunset-dark">{g.statusPending}</p>}
          {trip.status === 'rejected' && <p className="rounded-2xl bg-red-50 p-4 font-semibold text-red-800">{g.statusRejected}</p>}

          <p className="whitespace-pre-line text-lg leading-relaxed">{trip.description}</p>

          <dl className="grid gap-5 sm:grid-cols-2">
            {trip.meeting_point && <Fact label={g.meeting} value={trip.meeting_point} />}
            <Fact label={g.minPeople} value={`${trip.min_people} ${g.people}`} />
            {trip.languages.length > 0 && (
              <Fact label={t.guides.languages} value={trip.languages.map(languageName).join(', ')} icon={<Languages className="size-4 text-forest" aria-hidden />} />
            )}
            {trip.includes && <Fact label={g.includes} value={trip.includes} />}
          </dl>

          <Organizer trip={trip} t={t} locale={locale} />

          {trip.status === 'approved' && !trip.cancelled && (
            <ShareButtons path={`/${locale}/group-trips/${trip.id}`} title={trip.title} text={`${t.share.shareGroup}: ${trip.title}`} labels={t.share} />
          )}

          {isOrganizer && <Requests trip={trip} status={status} t={t} locale={locale} />}
        </div>

        <aside id="join" className="h-fit scroll-mt-28 lg:sticky lg:top-28">
          <div className="overflow-hidden rounded-3xl bg-night text-white shadow-xl">
            <div className="bg-sunset px-6 py-5 text-night">
              <p className="text-3xl font-extrabold tabular-nums">{formatUsd(trip.price_per_person_usd)}</p>
              {approxTzs(trip.price_per_person_usd, rate) && <p className="text-xs font-semibold tabular-nums">{approxTzs(trip.price_per_person_usd, rate)}</p>}
              <p className="text-sm font-bold">{g.perPerson}</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-2xl bg-white p-3 text-charcoal"><SpotsBar trip={trip} t={t} /></div>
              {isOrganizer ? (
                <OrganizerTools trip={trip} t={t} locale={locale} />
              ) : (
                <JoinBox trip={trip} user={user} status={status} t={t} locale={locale} />
              )}
              {tripChat && (
                <Link href={`/${locale}/chats/${tripChat.id}`} className="btn w-full">{t.chats.openChat}</Link>
              )}
              <p className="text-xs text-white/70">{g.payNote}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-bold text-muted">{label}</dt>
      <dd className="mt-1 flex items-start gap-1.5 whitespace-pre-line">{icon}{value}</dd>
    </div>
  );
}

function Organizer({ trip, t, locale }: { trip: GroupTrip; t: Dictionary; locale: Locale }) {
  return (
    <section className="card">
      <p className="text-sm font-bold text-muted">{t.groups.organisedBy}</p>
      {trip.guides ? (
        <Link href={`/${locale}/guides/${trip.guides.slug}`} className="mt-2 block hover:text-sunset">
          <span className="text-xl font-bold">{trip.guides.display_name}</span>
          <span className="mt-1 block">
            <RatingSummary avg={trip.guides.rating_avg} count={trip.guides.rating_count} labels={t.reviews} />
          </span>
        </Link>
      ) : (
        <p className="mt-2 text-xl font-bold">{trip.company_name}</p>
      )}
    </section>
  );
}

async function JoinBox({ trip, user, status, t, locale }: { trip: GroupTrip; user: CurrentUser | null; status: Search; t: Dictionary; locale: Locale }) {
  const g = t.groups;
  const open = trip.status === 'approved' && !trip.cancelled && trip.start_date >= new Date().toISOString().slice(0, 10);

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-white/80">{g.signInToJoin}</p>
        <div className="flex gap-2">
          <Link href={`/${locale}/login`} className="btn-outline border-white text-white hover:bg-white/10">{t.nav.signIn}</Link>
          <Link href={`/${locale}/join`} className="btn">{t.nav.signUp}</Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from('group_trip_members')
    .select('id, status, seats')
    .eq('group_trip_id', trip.id)
    .eq('traveler_id', user.id)
    .maybeSingle<{ id: string; status: GroupMember['status']; seats: number }>();

  if (mine?.status === 'accepted') {
    const [{ data: contact }, paid] = await Promise.all([
      supabase.from('group_trip_private').select('contact').eq('group_trip_id', trip.id).maybeSingle(),
      depositState('group_member_id', mine.id),
    ]);
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-mint p-4 text-forest">
          <p className="font-semibold">✓ {g.accepted}</p>
          {contact && <p className="mt-2 text-lg font-extrabold">{contact.contact}</p>}
        </div>
        <PayDeposit
          kind="group"
          id={mine.id}
          totalUsd={trip.price_per_person_usd * mine.seats}
          percent={trip.deposit_percent}
          paid={paid.paid}
          paidOut={paid.paidOut}
          back={`/${locale}/group-trips/${trip.id}`}
          error={typeof status.payError === 'string' ? status.payError : undefined}
          t={t}
          locale={locale}
          dark
        />
      </div>
    );
  }
  if (mine?.status === 'requested') {
    return (
      <form action={cancelMyRequest} className="space-y-3">
        <p className="rounded-2xl bg-white/10 p-4 font-semibold">✓ {g.requested}</p>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="group_trip_id" value={trip.id} />
        <button className="text-sm font-semibold text-gold underline">{g.cancel}</button>
      </form>
    );
  }
  if (!open || spotsLeft(trip) === 0) return <p className="font-semibold text-white/80">{trip.cancelled ? g.cancelledTrip : g.closed}</p>;

  return (
    <form action={requestToJoin} className="space-y-3 text-charcoal">
      <h2 className="text-lg font-bold text-white">{mine?.status === 'cancelled' ? g.askAgain : g.joinTitle}</h2>
      {mine?.status === 'declined' && <p className="text-sm text-white/80">{g.declined}</p>}
      {!mine && <p className="text-sm text-white/80">{g.joinBody}</p>}
      {status.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="group_trip_id" value={trip.id} />
      <input name="name" className="field" placeholder={t.profile.name} required maxLength={120} defaultValue={user.fullName ?? ''} />
      <input name="contact" className="field" placeholder={t.profile.contact} required maxLength={160} defaultValue={user.email ?? ''} />
      <label className="block">
        <span className="label text-white">{g.seats}</span>
        <input name="seats" type="number" min={1} max={Math.max(spotsLeft(trip), 1)} defaultValue={1} className="field" />
      </label>
      <textarea name="message" className="field min-h-20" placeholder={g.message} maxLength={1000} />
      <button className="btn w-full">{g.joinCta}</button>
    </form>
  );
}

function OrganizerTools({ trip, t, locale }: { trip: GroupTrip; t: Dictionary; locale: Locale }) {
  if (trip.cancelled) return <p className="font-semibold">{t.groups.cancelledTrip}</p>;
  return (
    <form action={cancelGroupTrip} className="space-y-3">
      <a href="#requests" className="btn w-full">{t.groups.requestsTitle}</a>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="group_trip_id" value={trip.id} />
      <button className="w-full text-sm font-semibold text-white/70 underline hover:text-white">{t.groups.cancelTrip}</button>
    </form>
  );
}

async function Requests({ trip, status, t, locale }: { trip: GroupTrip; status: Search; t: Dictionary; locale: Locale }) {
  const g = t.groups;
  const supabase = await createClient();
  const { data } = await supabase
    .from('group_trip_members')
    .select('id, traveler_id, traveler_name, traveler_contact, seats, message, status, created_at')
    .eq('group_trip_id', trip.id)
    .order('created_at', { ascending: true })
    .returns<GroupMember[]>();
  const requests = (data ?? []).filter((r) => r.status !== 'cancelled');
  const label: Record<GroupMember['status'], string> = {
    requested: t.hub.status.requested,
    accepted: t.hub.status.accepted,
    declined: t.hub.status.declined,
    cancelled: t.hub.status.cancelled,
  };

  return (
    <section id="requests" className="scroll-mt-28">
      <h2 className="text-2xl font-bold">{g.requestsTitle}</h2>
      {status.full && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{g.full}</p>}
      {requests.length === 0 && <p className="mt-3 text-muted">{g.noRequests}</p>}
      <ul className="mt-4 space-y-3">
        {requests.map((r) => (
          <li key={r.id} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="font-bold">
                {r.traveler_name} · {r.seats} {g.people}
                <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{label[r.status]}</span>
              </p>
              <p className="text-sm">{r.traveler_contact}</p>
              {r.message && <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.message}</p>}
            </div>
            {r.status === 'requested' && (
              <form action={respondToRequest} className="flex items-start gap-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="group_trip_id" value={trip.id} />
                <input type="hidden" name="member_id" value={r.id} />
                <button name="decision" value="accept" className="btn px-4 py-2 text-sm">{t.hub.accept}</button>
                <button name="decision" value="decline" className="btn-outline px-4 py-2 text-sm">{t.hub.decline}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
