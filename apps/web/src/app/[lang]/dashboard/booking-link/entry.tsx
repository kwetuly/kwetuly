import Link from 'next/link';
import { Link2 } from 'lucide-react';
import { guideProgressText } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';
import { bookingLinkOn } from './feature';

// The "My booking link" line on the guide dashboard. Hidden while feature.booking_link is off.
export async function BookingLinkEntry({ locale }: { locale: Locale }) {
  if (!(await bookingLinkOn())) return null;
  const g = guideProgressText(locale);
  return (
    <Link href={`/${locale}/dashboard/booking-link`} className="card mt-6 flex items-center gap-3 hover:border-leaf">
      <Link2 className="size-5 shrink-0 text-leaf-dark" aria-hidden />
      <span className="min-w-0">
        <span className="block font-bold">{g.linkTitle}</span>
        <span className="block text-sm text-muted">{g.linkMenuHint}</span>
      </span>
    </Link>
  );
}
