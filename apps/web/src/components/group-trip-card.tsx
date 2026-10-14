import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, Languages, MapPin, Users } from 'lucide-react';
import { formatUsd } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { spotsLeft, type GroupTrip } from '@/lib/groups';
import { photoUrl, specialtyPhoto } from '@/lib/photos';
import { languageName, specialtyName } from './guide-card';

export function formatDates(trip: GroupTrip, locale: Locale) {
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const start = format.format(new Date(trip.start_date));
  return trip.start_date === trip.end_date ? start : `${start} – ${format.format(new Date(trip.end_date))}`;
}

// Bar showing how full the group is.
export function SpotsBar({ trip, t }: { trip: GroupTrip; t: Dictionary }) {
  const left = spotsLeft(trip);
  const percent = Math.min(100, Math.round((trip.seats_taken / trip.max_people) * 100));
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-leaf" style={{ width: `${percent}%` }} />
      </div>
      <p className={`mt-1.5 text-xs font-bold ${left === 0 ? 'text-muted' : 'text-leaf-dark'}`}>
        {left === 0 ? t.groups.full : `${left} ${t.groups.spotsLeft}`} · {trip.seats_taken}/{trip.max_people}
      </p>
    </div>
  );
}

export function GroupTripCard({ trip, locale, t }: { trip: GroupTrip; locale: Locale; t: Dictionary }) {
  const photo = specialtyPhoto(trip.specialty);
  const organizer = trip.guides?.display_name ?? trip.company_name;
  return (
    <Link
      href={`/${locale}/group-trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-[5px] border border-line bg-white transition hover:-translate-y-1"
    >
      <div className="relative h-44">
        <Image src={photoUrl(photo, 900)} alt={photo.alt} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
        <span className="absolute left-4 top-4 rounded-[5px] bg-white/90 px-3 py-1 text-xs font-bold text-night">
          {specialtyName(trip.specialty, locale)}
        </span>
        <span className="absolute bottom-4 right-4 rounded-[5px] bg-night px-3 py-1.5 text-sm font-extrabold text-gold">
          <span className="tabular-nums">{formatUsd(trip.price_per_person_usd)}</span> <span className="text-xs font-semibold text-white/70">{t.groups.perPerson}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug group-hover:text-leaf">{trip.title}</h3>
        {organizer && <p className="mt-1 text-sm text-muted">{t.groups.organisedBy} {organizer}</p>}
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-center gap-1.5"><CalendarDays className="size-4 text-forest" aria-hidden /> {formatDates(trip, locale)}</p>
          <p className="flex items-center gap-1.5"><MapPin className="size-4 text-forest" aria-hidden /> {trip.region}</p>
          {trip.languages.length > 0 && (
            <p className="flex items-center gap-1.5"><Languages className="size-4 text-forest" aria-hidden /> {trip.languages.map(languageName).join(', ')}</p>
          )}
          <p className="flex items-center gap-1.5"><Users className="size-4 text-forest" aria-hidden /> {t.groups.minPeople} {trip.min_people} {t.groups.people}</p>
        </div>
        <div className="mt-auto pt-4">
          <SpotsBar trip={trip} t={t} />
        </div>
      </div>
    </Link>
  );
}
