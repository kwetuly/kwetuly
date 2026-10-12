import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import Link from 'next/link';
import '../globals.css';
import { locales } from '@/i18n/config';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { AuthLinks } from '@/components/auth-links';
import { LanguageSwitcher } from '@/components/language-switcher';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: { default: 'Rafrika — Tanzanian guides', template: '%s · Rafrika' },
  description:
    'Find verified Tanzanian guides for Kilimanjaro, safari, culture, Zanzibar and day trips. Book directly with the guide.',
};

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href={`/${locale}`} className="text-xl font-extrabold tracking-tight text-forest">
              Rafrika
            </Link>
            <Link href={`/${locale}/guides`} className="text-sm font-medium hover:text-forest">
              {t.nav.guides}
            </Link>
            <div className="ml-auto flex items-center gap-4 text-sm">
              <Suspense fallback={null}>
                <AuthLinks />
              </Suspense>
              <Suspense fallback={null}>
                <LanguageSwitcher current={locale} />
              </Suspense>
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
            <p>
              <span className="font-bold text-forest">Rafrika</span> — {t.footer.tagline}
            </p>
            <p>© 2026 Rafrika. {t.footer.rights}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
