import Link from 'next/link';
import { Images } from 'lucide-react';
import { uploadsText } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';

// The "Photos for your page" line on the guide dashboard (slice S4). Always shown: the photos page
// itself says when cover photos and galleries are switched off.
export function PhotosEntry({ locale }: { locale: Locale }) {
  const u = uploadsText(locale);
  return (
    <Link href={`/${locale}/dashboard/photos`} className="card mt-6 flex items-center gap-3 hover:border-leaf">
      <Images className="size-5 shrink-0 text-leaf-dark" aria-hidden />
      <span className="min-w-0">
        <span className="block font-bold">{u.title}</span>
        <span className="block text-sm text-muted">{u.menuHint}</span>
      </span>
    </Link>
  );
}
