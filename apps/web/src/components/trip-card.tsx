import Link from 'next/link';
import { Clock, MapPin, Sparkles } from 'lucide-react';
import { TRIP_CATEGORIES, TRIP_KINDS } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import { tripSummary, tripTitle, type Trip } from '@/lib/trips';
import { Icon } from './icon';

// Each category gets its own colour so the catalogue reads at a glance without photos.
const gradients: Record<string, string> = {
  safari: 'from-[#c2410c] via-[#f59e0b] to-[#fde68a]',
  mountain: 'from-[#0a1f17] via-[#1e3a5f] to-[#93c5fd]',
  cultural: 'from-[#7c2d12] via-[#dc2626] to-[#fbbf24]',
  beach: 'from-[#0e7490] via-[#22d3ee] to-[#fef3c7]',
  historical: 'from-[#44403c] via-[#a16207] to-[#fde68a]',
  marine: 'from-[#1e3a8a] via-[#0891b2] to-[#a5f3fc]',
  chimpanzee: 'from-[#14532d] via-[#15803d] to-[#bef264]',
  walking: 'from-[#365314] via-[#65a30d] to-[#d9f99d]',
  event: 'from-[#0a1f17] via-[#0e6b4f] to-[#ffb627]',
};

export function TripCover({ trip, className = '' }: { trip: Trip; className?: string }) {
  const category = trip.categories[0] ?? 'safari';
  const icon = TRIP_CATEGORIES.find((c) => c.id === category)?.icon ?? 'compass';
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradients[category] ?? gradients.safari} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] [background-size:18px_18px]" />
      <Icon name={icon} className="absolute -bottom-4 -right-4 size-32 text-white/25" />
    </div>
  );
}

export function TripCard({ trip, locale, labels }: { trip: Trip; locale: Locale; labels: { days: string; day: string; signature: string; draft: string } }) {
  return (
    <Link href={`/${locale}/tours/${trip.slug}`} className="group overflow-hidden rounded-3xl border border-line bg-white shadow-[0_10px_40px_-12px_rgba(10,31,23,0.12)] transition hover:-translate-y-1">
      <div className="relative">
        <TripCover trip={trip} className="h-36" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {trip.is_signature && (
            <span className="inline-flex items-center gap-1 rounded-full bg-night px-3 py-1 text-xs font-bold text-gold">
              <Sparkles className="size-3" aria-hidden /> {labels.signature}
            </span>
          )}
          {trip.status !== 'published' && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-sunset">{labels.draft}</span>}
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-night">
            {TRIP_KINDS.find((k) => k.id === trip.kind)?.[locale]}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold leading-snug group-hover:text-sunset">{tripTitle(trip, locale)}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{tripSummary(trip, locale)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {trip.days} {trip.days === 1 ? labels.day : labels.days}</span>
          {trip.start_from && <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {trip.start_from}</span>}
          {trip.price_from_usd != null && <span className="ml-auto text-base font-extrabold text-forest">${trip.price_from_usd}</span>}
        </div>
      </div>
    </Link>
  );
}
