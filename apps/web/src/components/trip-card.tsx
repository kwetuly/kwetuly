import Image from 'next/image';
import Link from 'next/link';
import { photoUrl, tripPhoto } from '@/lib/photos';
import { BadgeCheck, Clock, MapPin, Sparkles } from 'lucide-react';
import { TOUR_TYPES, TRIP_CATEGORIES, formatPrice, verifiedPrice } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { tripSummary, tripTitle, type Trip } from '@/lib/trips';
import { Icon } from './icon';

// Each category gets its own colour so the catalogue reads at a glance without photos.
const gradients: Record<string, string> = {
  safari: 'from-[#c2410c] via-[#f59e0b] to-[#fde68a]',
  mountain: 'from-[#7f7f7f] via-[#1e3a5f] to-[#93c5fd]',
  cultural: 'from-[#7c2d12] via-[#dc2626] to-[#fbbf24]',
  beach: 'from-[#0e7490] via-[#22d3ee] to-[#fef3c7]',
  historical: 'from-[#44403c] via-[#a16207] to-[#fde68a]',
  marine: 'from-[#1e3a8a] via-[#0891b2] to-[#a5f3fc]',
  chimpanzee: 'from-[#14532d] via-[#15803d] to-[#bef264]',
  walking: 'from-[#365314] via-[#65a30d] to-[#d9f99d]',
  event: 'from-[#7f7f7f] via-[#187a16] to-[#ffb627]',
};

/** The tour's own cover photo when an admin set one, otherwise a photo matching its first category. */
export function tourCoverUrl(trip: Pick<Trip, 'cover_url' | 'slug' | 'categories'>, width = 1200) {
  return trip.cover_url ?? photoUrl(tripPhoto(trip.slug, trip.categories), width);
}

// Photo cover with the category gradient underneath (shown while the photo loads).
export function TripCover({ trip, className = '', sizes = '(min-width: 1024px) 33vw, 100vw', priority = false }: { trip: Trip; className?: string; sizes?: string; priority?: boolean }) {
  const category = trip.categories[0] ?? 'safari';
  const icon = TRIP_CATEGORIES.find((c) => c.id === category)?.icon ?? 'compass';
  const photo = tripPhoto(trip.slug, trip.categories);
  const position = className.includes('absolute') ? '' : 'relative';
  return (
    <div className={`${position} overflow-hidden bg-gradient-to-br ${gradients[category] ?? gradients.safari} ${className}`}>
      <Icon name={icon} className="absolute -bottom-4 -right-4 size-32 text-white/25" />
      <Image src={tourCoverUrl(trip)} alt={trip.cover_url ? tripTitle(trip, 'en') : photo.alt} fill sizes={sizes} priority={priority} className="object-cover transition duration-700 group-hover:scale-105" />
    </div>
  );
}

/** "Signature Trip" in gold, or "Operator Tour" in white. */
export function TourTypeBadge({ trip, locale }: { trip: Pick<Trip, 'tour_type'>; locale: Locale }) {
  const label = TOUR_TYPES.find((x) => x.id === trip.tour_type)?.[locale];
  return trip.tour_type === 'signature' ? (
    <span className="inline-flex items-center gap-1 rounded-[5px] bg-gold px-3 py-1 text-xs font-bold text-charcoal">
      <Sparkles className="size-3" aria-hidden /> {label}
    </span>
  ) : (
    <span className="rounded-[5px] bg-white/90 px-3 py-1 text-xs font-bold text-charcoal">{label}</span>
  );
}

export function durationText(trip: Pick<Trip, 'days' | 'nights'>, tt: Dictionary['tours']) {
  const days = `${trip.days} ${trip.days === 1 ? tt.day : tt.days}`;
  return trip.nights ? `${days} / ${trip.nights} ${trip.nights === 1 ? tt.night : tt.nights}` : days;
}

export function TripCard({ trip, locale, t, today }: { trip: Trip; locale: Locale; t: Dictionary; today: Date }) {
  const tt = t.tours;
  const price = verifiedPrice(trip, today);
  const operator = trip.tour_operators;
  return (
    <Link href={`/${locale}/tours/${trip.slug}`} className="group flex flex-col overflow-hidden rounded-[5px] border border-line bg-white transition hover:-translate-y-1">
      <div className="relative">
        <TripCover trip={trip} className="h-52" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <TourTypeBadge trip={trip} locale={locale} />
          {trip.status !== 'published' && <span className="rounded-[5px] bg-white px-3 py-1 text-xs font-bold text-leaf-dark">{tt.draft}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug group-hover:text-leaf-dark">{tripTitle(trip, locale)}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{tripSummary(trip, locale)}</p>
        {operator && (
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-muted">
            {operator.name}
            {operator.verified_at && <BadgeCheck className="size-3.5 text-leaf-dark" aria-label={tt.verified} />}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {durationText(trip, tt)}</span>
          {trip.start_from && <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {trip.start_from}</span>}
          <span className="ml-auto text-right">
            {price ? (
              <span className="text-base font-extrabold tabular-nums text-forest">{tt.priceFrom} {formatPrice(price.amount, price.currency)}</span>
            ) : (
              <span className="text-muted">{tt.priceTbc}</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
