import Image from 'next/image';
import Link from 'next/link';
import { photoUrl, tripPhoto } from '@/lib/photos';
import { Clock, MapPin, Sparkles } from 'lucide-react';
import { TRIP_CATEGORIES, TRIP_KINDS, formatUsd } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
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

// Photo cover with the category gradient underneath (shown while the photo loads).
export function TripCover({ trip, className = '', sizes = '(min-width: 1024px) 33vw, 100vw', priority = false }: { trip: Trip; className?: string; sizes?: string; priority?: boolean }) {
  const category = trip.categories[0] ?? 'safari';
  const icon = TRIP_CATEGORIES.find((c) => c.id === category)?.icon ?? 'compass';
  const photo = tripPhoto(trip.slug, trip.categories);
  const position = className.includes('absolute') ? '' : 'relative';
  return (
    <div className={`${position} overflow-hidden bg-gradient-to-br ${gradients[category] ?? gradients.safari} ${className}`}>
      <Icon name={icon} className="absolute -bottom-4 -right-4 size-32 text-white/25" />
      <Image src={photoUrl(photo, 1200)} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover transition duration-700 group-hover:scale-105" />
    </div>
  );
}

export function TripCard({ trip, locale, labels }: { trip: Trip; locale: Locale; labels: { days: string; day: string; signature: string; draft: string } }) {
  return (
    <Link href={`/${locale}/tours/${trip.slug}`} className="group overflow-hidden rounded-[5px] border border-line bg-white transition hover:-translate-y-1">
      <div className="relative">
        <TripCover trip={trip} className="h-52" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {trip.is_signature && (
            <span className="inline-flex items-center gap-1 rounded-[5px] bg-night px-3 py-1 text-xs font-bold text-gold">
              <Sparkles className="size-3" aria-hidden /> {labels.signature}
            </span>
          )}
          {trip.status !== 'published' && <span className="rounded-[5px] bg-white px-3 py-1 text-xs font-bold text-leaf-dark">{labels.draft}</span>}
          <span className="rounded-[5px] bg-white/90 px-3 py-1 text-xs font-bold text-charcoal">
            {TRIP_KINDS.find((k) => k.id === trip.kind)?.[locale]}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold leading-snug group-hover:text-leaf-dark">{tripTitle(trip, locale)}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{tripSummary(trip, locale)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {trip.days} {trip.days === 1 ? labels.day : labels.days}</span>
          {trip.start_from && <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {trip.start_from}</span>}
          {trip.price_from_usd != null && <span className="ml-auto text-base font-extrabold tabular-nums text-forest">{formatUsd(trip.price_from_usd)}</span>}
        </div>
      </div>
    </Link>
  );
}
