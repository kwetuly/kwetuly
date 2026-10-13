import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Suspense } from 'react';
import Link from 'next/link';
import '../globals.css';
import { MENU } from '@rafrika/shared';
import { LOCALE_TAGS, locales } from '@/i18n/config';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { AuthLinks } from '@/components/auth-links';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SiteNav } from '@/components/site-nav';
import { Concierge } from '@/components/concierge';
import { Logo } from '@/components/logo';
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
  };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <html lang={LOCALE_TAGS[locale]} className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href={`/${locale}`} className="shrink-0" aria-label="Rafrika home">
              <Logo className="text-[28px]" />
            </Link>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Suspense fallback={null}>
                <AuthLinks />
              </Suspense>
              <Suspense fallback={null}>
                <LanguageSwitcher current={locale} />
              </Suspense>
              <div className="xl:hidden">
                <SiteNav locale={locale} soonLabel={t.nav.soon} />
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

        <main className="flex-1">{children}</main>
        {/* The AI chat appears automatically once ANTHROPIC_API_KEY is set in .env.local. */}
        {process.env.ANTHROPIC_API_KEY && <Concierge labels={t.concierge} locale={locale} />}

        <footer className="pattern-kanga text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            <div>
              <Logo tone="light" className="text-3xl" />
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
            <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/60">
              © 2026 Rafrika. {t.footer.rights} · Photos: Unsplash photographers
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
