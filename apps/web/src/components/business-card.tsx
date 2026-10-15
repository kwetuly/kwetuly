import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, MapPin } from 'lucide-react';
import { BADGE_CHECKS, BUSINESS_TYPES, hasValidBadge, type Business } from '@rafrika/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

/**
 * The paid "Checked by Rafrika" badge. It always says what was checked and when, and that it is
 * a paid check, never a recommendation.
 */
export function BusinessBadge({ business, t, locale, today, full }: { business: Business; t: Dictionary; locale: Locale; today: string; full?: boolean }) {
  const bt = t.business;
  if (!hasValidBadge(business, today)) {
    return full ? (
      <p className="rounded-[5px] bg-surface p-3 text-sm text-muted">
        <span className="font-semibold">{bt.listed}.</span> {bt.listedExplain}
      </p>
    ) : (
      <span className="rounded-[5px] bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{bt.listed}</span>
    );
  }
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (!full) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[5px] bg-mint px-2 py-0.5 text-xs font-semibold text-forest">
        <BadgeCheck className="size-3.5" aria-hidden /> {bt.checked}
      </span>
    );
  }
  return (
    <section className="rounded-[5px] border border-leaf bg-mint p-4 text-forest">
      <p className="flex items-center gap-2 font-bold">
        <BadgeCheck className="size-5" aria-hidden /> {bt.checked}
      </p>
      <p className="mt-1 text-sm">
        {bt.checkedOn.replace('{date}', date.format(new Date(business.badge_checked_at ?? business.badge_valid_until!))).replace('{until}', date.format(new Date(business.badge_valid_until!)))}
      </p>
      <p className="mt-3 text-sm font-semibold">{bt.checkedWhat}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {BADGE_CHECKS.filter((c) => business.badge_checks.includes(c.id)).map((c) => (
          <li key={c.id}>✓ {c[locale]}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-charcoal">{bt.badgeExplain}</p>
    </section>
  );
}

export function BusinessCard({ business, t, locale, today }: { business: Business; t: Dictionary; locale: Locale; today: string }) {
  return (
    <Link href={`/${locale}/businesses/${business.id}`} className="card flex gap-4 hover:border-leaf">
      {business.photo_url && (
        <Image src={business.photo_url} alt="" width={96} height={96} className="size-20 shrink-0 rounded-[5px] object-cover" />
      )}
      <span className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-leaf-dark">{BUSINESS_TYPES.find((b) => b.id === business.business_type)?.[locale]}</span>
        <span className="block font-bold">{business.business_name}</span>
        <span className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-4 shrink-0" aria-hidden /> {[business.location, business.base_region].filter(Boolean).join(', ')}
        </span>
        <span className="mt-2 block">
          <BusinessBadge business={business} t={t} locale={locale} today={today} />
        </span>
      </span>
    </Link>
  );
}
