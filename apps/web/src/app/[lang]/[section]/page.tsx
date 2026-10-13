import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { MENU } from '@rafrika/shared';
import { defaultLocale, hasLocale, locales } from '@/i18n/config';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { Icon } from '@/components/icon';
import { itemHref } from '@/lib/menu';
import { PhotoHero } from '@/components/photo-hero';
import { SECTION_PHOTOS } from '@/lib/photos';

const sections = MENU;

export async function generateStaticParams() {
  return locales.flatMap((lang) => sections.map((s) => ({ lang, section: s.slug })));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/[section]'>): Promise<Metadata> {
  const { lang, section: slug } = await params;
  const section = sections.find((s) => s.slug === slug);
  const locale = hasLocale(lang) ? lang : defaultLocale;
  return section ? { title: section.label[locale], description: section.tagline[locale] } : {};
}

export default function SectionPage(props: PageProps<'/[lang]/[section]'>) {
  return (
    <Suspense fallback={<div className="pattern-kanga h-72" />}>
      <SectionContent {...props} />
    </Suspense>
  );
}

async function SectionContent({ params }: PageProps<'/[lang]/[section]'>) {
  const { section: slug } = await params;
  const section = sections.find((s) => s.slug === slug);
  if (!section) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <PhotoHero photo={SECTION_PHOTOS[section.slug] ?? 'safariSunset'}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sunset to-gold shadow-lg">
            <Icon name={section.icon} className="size-7" />
          </span>
          <h1 className="mt-5 text-4xl font-extrabold sm:text-5xl">{section.label[locale]}</h1>
          <p className="mt-3 max-w-xl text-lg text-white/80">{section.tagline[locale]}</p>
        </div>
      </PhotoHero>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 sm:grid-cols-2">
        {section.items.map((item) => (
          <Link
            key={item.slug}
            href={itemHref(locale, section, item)}
            className="card group flex items-start gap-4 transition hover:-translate-y-1 hover:border-sunset/40"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sand text-sunset transition group-hover:bg-gradient-to-br group-hover:from-sunset group-hover:to-gold group-hover:text-white">
              <Icon name={item.icon} className="size-6" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-lg font-bold">
                {item.label[locale]}
                {item.status !== 'live' && <span className="badge">{t.nav.soon}</span>}
              </span>
              <span className="mt-1 block text-muted">{item.blurb[locale]}</span>
            </span>
            <ArrowRight className="mt-1 size-5 text-muted transition group-hover:translate-x-1 group-hover:text-sunset" aria-hidden />
          </Link>
        ))}
      </section>
    </>
  );
}
