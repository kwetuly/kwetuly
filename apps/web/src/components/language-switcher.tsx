'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Check, Globe } from 'lucide-react';
import { LOCALE_NAMES, localePrefix, locales, type Locale } from '@/i18n/config';

// Globe button that opens the list of site languages, each written in its own language.
export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);

  // Close when clicking anywhere else on the page.
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-[15px] border border-line px-3 py-1.5 text-xs font-bold uppercase hover:border-forest [&::-webkit-details-marker]:hidden"
        aria-label="Language"
      >
        <Globe className="size-4" aria-hidden /> {current}
      </summary>
      <ul className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[0_24px_60px_-12px_rgba(10,31,23,0.25)]">
        {locales.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname.replace(localePrefix, `/${locale}`)}
              hrefLang={locale}
              lang={locale}
              onClick={() => ref.current && (ref.current.open = false)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold hover:bg-sand ${locale === current ? 'text-forest' : 'text-charcoal'}`}
            >
              {LOCALE_NAMES[locale]}
              {locale === current && <Check className="size-4" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
