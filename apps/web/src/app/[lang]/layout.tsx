import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Suspense } from 'react';
import Link from 'next/link';
import '../globals.css';
import { MENU } from '@rafrika/shared';
import { LOCALE_TAGS, locales } from '@/i18n/config';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { AuthLinks, MenuAccount } from '@/components/auth-links';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SiteNav } from '@/components/site-nav';
import { Concierge } from '@/components/concierge';
import { Logo } from '@/components/logo';
import { Icon } from '@/components/icon';
import { Analytics } from '@/components/analytics';
import { INDEXING_ON, SITE_URL } from '@/lib/site';
import { PHOTOS, photoUrl } from '@/lib/photos';
import { itemHref } from '@/lib/menu';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin', 'latin-ext'] });

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: { default: `Rafrika — ${t.home.title}`, template: '%s · Rafrika' },
    description: t.home.subtitle,
    // Tell search engines about every language version of the site.
    alternates: { languages: Object.fromEntries(locales.map((l) => [LOCALE_TAGS[l], `/${l}`])) },
    // Preview shown when a Rafrika link is shared on WhatsApp, Facebook, X and others.
    metadataBase: new URL(SITE_URL),
    openGraph: { siteName: 'Rafrika', type: 'website', images: [{ url: photoUrl(PHOTOS.safariSunset, 1200), width: 1200, height: 800 }] },
    twitter: { card: 'summary_large_image' },
    // Invite-only soft launch: keep every page out of search results until NEXT_PUBLIC_INDEXING=on.
    ...(INDEXING_ON ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <html lang={LOCALE_TAGS[locale]} className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only z-50 rounded-[5px] bg-leaf px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          {t.ux.skipToContent}
        </a>
        <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4">
            <Link href={`/${locale}`} className="shrink-0" aria-label="Rafrika home">
              <Logo className="text-[28px]" />
            </Link>
            <div className="ml-auto flex min-w-0 items-center gap-2 text-sm sm:gap-3">
              <Suspense fallback={null}>
                <AuthLinks />
              </Suspense>
              <Suspense fallback={null}>
                <LanguageSwitcher current={locale} />
              </Suspense>
              <div className="xl:hidden">
                <SiteNav
                  locale={locale}
                  soonLabel={t.nav.soon}
                  account={
                    <Suspense fallback={null}>
                      <MenuAccount />
                    </Suspense>
                  }
                />
              </div>
            </div>
          </nav>
          {/* Desktop: the section menu gets its own row so it never collides with the account buttons. */}
          <div className="hidden border-t border-line/60 xl:block">
            <div className="mx-auto max-w-7xl px-2 py-1">
              <SiteNav locale={locale} soonLabel={t.nav.soon} />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
        <Analytics locale={locale} />
        {/* The AI chat appears automatically once ANTHROPIC_API_KEY is set in .env.local. */}
        {process.env.ANTHROPIC_API_KEY && <Concierge labels={t.concierge} locale={locale} />}

        <footer className="pattern-kanga text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <Logo tone="light" className="text-3xl" />
              <p className="mt-2 text-sm text-white/90">{t.footer.tagline}</p>
            </div>
            {MENU.map((section) => (
              <div key={section.slug}>
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className="flex size-6 items-center justify-center rounded-[5px] bg-leaf">
                    <Icon name={section.icon} className="size-3.5" />
                  </span>
                  {section.label[locale]}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/90">
                  {section.items.map((item) => (
                    <li key={item.slug}>
                      <Link href={itemHref(locale, section, item)} className="hover:text-white hover:underline">
                        {item.label[locale]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/90">
              © 2026 Rafrika. {t.footer.rights} · Photos: Unsplash photographers
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
