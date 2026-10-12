'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';

const labels: Record<Locale, string> = { en: 'EN', sw: 'SW' };

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const other: Locale = current === 'en' ? 'sw' : 'en';
  const href = pathname.replace(/^\/(en|sw)(?=\/|$)/, `/${other}`);

  return (
    <Link
      href={href}
      className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-forest"
      aria-label={other === 'sw' ? 'Badilisha lugha kuwa Kiswahili' : 'Switch language to English'}
    >
      {labels[other]}
    </Link>
  );
}
