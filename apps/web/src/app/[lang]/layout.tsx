import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Suspense } from 'react';
import Link from 'next/link';
import '../globals.css';
import { MENU } from '@rafrika/shared';
import { locales } from '@/i18n/config';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { AuthLinks } from '@/components/auth-links';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SiteNav } from '@/components/site-nav';
import { Concierge } from '@/components/concierge';
import { itemHref } from '@/lib/menu';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] });

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: { default: 'Rafrika — Tanzanian guides, stays & transport', template: '%s · Rafrika' },
  description:
    'Find verified Tanzanian guides for Kilimanjaro, safari, culture, Zanzibar and day trips, plus stays, transport, gear and local life.',
};

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <html lang={locale} className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href={`/${locale}`} className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sunset to-gold text-base text-white shadow-md">
                R
              </span>
              <span className="text-night">Rafrika</span>
            </Link>
            <div className="ml-2 hidden lg:block">
              <SiteNav locale={locale} soonLabel={t.nav.soon} />
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Suspense fallback={null}>
                <AuthLinks />
              </Suspense>
              <Suspense fallback={null}>
                <LanguageSwitcher current={locale} />
              </Suspense>
              <div className="lg:hidden">
                <SiteNav locale={locale} soonLabel={t.nav.soon} />
              </div>
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>
        {/* The AI chat appears automatically once ANTHROPIC_API_KEY is set in .env.local. */}
        {process.env.ANTHROPIC_API_KEY && <Concierge labels={t.concierge} />}

        <footer className="pattern-kanga text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-7">
            <div className="lg:col-span-1">
              <p className="text-2xl font-extrabold">Rafrika</p>
              <p className="mt-2 text-sm text-white/70">{t.footer.tagline}</p>
            </div>
            {MENU.map((section) => (
              <div key={section.slug}>
                <p className="text-sm font-bold text-gold">{section.label[locale]}</p>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  {section.items.map((item) => (
                    <li key={item.slug}>
                      <Link href={itemHref(locale, section, item)} className="hover:text-white">
                        {item.label[locale]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/60">© 2026 Rafrika. {t.footer.rights}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
