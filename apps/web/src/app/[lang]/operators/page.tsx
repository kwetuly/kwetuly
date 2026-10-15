import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { Suspense } from 'react';
import { BadgeCheck, Building2, MapPin } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listOperators, listTours } from '@/lib/trips';
import { OperatorLogo } from '@/components/operator-logo';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/operators', title: t.tours.operatorsTitle, description: t.tours.operatorsSubtitle });
}

export default async function OperatorsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white">
        <Building2 className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-4xl font-extrabold">{t.tours.operatorsTitle}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t.tours.operatorsSubtitle}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <List t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [operators, tours] = await Promise.all([listOperators(), listTours()]);
  if (operators.length === 0) return <p className="mt-10 text-lg text-muted">{t.tours.noOperators}</p>;
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {operators.map((op) => {
        const count = tours.filter((tour) => tour.operator_id === op.id).length;
        return (
          <li key={op.id}>
            <Link href={`/${locale}/operators/${op.slug}`} className="group flex h-full gap-4 rounded-[5px] border border-line bg-white p-5 hover:border-leaf">
              <OperatorLogo name={op.name} logo={op.logo_url} size={56} />
              <div className="min-w-0">
                <h2 className="flex items-center gap-1 font-bold group-hover:text-leaf-dark">
                  {op.name}
                  {op.verified_at && <BadgeCheck className="size-4 shrink-0 text-leaf-dark" aria-label={t.tours.verified} />}
                </h2>
                {op.location && <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden /> {op.location}</p>}
                <p className="mt-2 text-xs font-semibold text-muted">{count} {count === 1 ? t.tours.tourOne : t.tours.tourMany}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
