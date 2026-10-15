import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PACKAGE_KINDS } from '@rafrika/shared';
import { pageMeta } from '@/lib/seo';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listPackages } from '@/lib/guides';
import { PackageCard } from '@/components/guide-packages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/packages', title: t.packages.catalogTitle, description: t.packages.catalogBody });
}

// Every approved package from verified guides. Cards open in place; "Ask about this package"
// goes to the guide's profile with the package already chosen in the contact form.
export default async function PackagesPage({ searchParams }: PageProps<'/[lang]/packages'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold">{t.packages.catalogTitle}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t.packages.catalogBody}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <List t={t} locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const kind = PACKAGE_KINDS.some((k) => k.id === params.kind) ? (params.kind as string) : undefined;
  const packages = await listPackages(kind);
  const chip = (active: boolean) =>
    `rounded-[5px] border px-3 py-1.5 text-sm ${active ? 'border-forest bg-mint font-semibold text-forest' : 'border-line bg-white hover:border-leaf'}`;

  return (
    <>
      <nav className="mt-8 flex flex-wrap gap-2" aria-label={t.packages.kindField}>
        <Link href={`/${locale}/packages`} className={chip(!kind)}>{t.packages.all}</Link>
        {PACKAGE_KINDS.map((k) => (
          <Link key={k.id} href={`/${locale}/packages?kind=${k.id}`} className={chip(kind === k.id)}>
            {k[locale]}
          </Link>
        ))}
      </nav>
      {packages.length === 0 ? (
        <p className="mt-10 text-lg text-muted">{t.packages.catalogEmpty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {packages.map((p) => (
            <li key={p.id}>
              <PackageCard
                p={p}
                t={t}
                locale={locale}
                askHref={p.guides ? `/${locale}/guides/${p.guides.slug}?package=${p.id}#contact` : undefined}
                guide={p.guides ? { name: p.guides.display_name, href: `/${locale}/guides/${p.guides.slug}#packages` } : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
