import Link from 'next/link';
import { Globe } from 'lucide-react';
import { profileLinksText } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';

// The "Profile links" line on the dashboard (slice S5), for guides and business owners. Always shown:
// the links page itself says when website, Google and YouTube links are switched off.
export function ProfileLinksEntry({ locale, business = false }: { locale: Locale; business?: boolean }) {
  const t = profileLinksText(locale);
  return (
    <Link href={`/${locale}/dashboard/links`} className="card mt-6 flex items-center gap-3 hover:border-leaf">
      <Globe className="size-5 shrink-0 text-leaf-dark" aria-hidden />
      <span className="min-w-0">
        <span className="block font-bold">{t.entry}</span>
        <span className="block text-sm text-muted">{business ? t.businessEntryNote : t.entryNote}</span>
      </span>
    </Link>
  );
}
