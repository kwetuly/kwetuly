import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { ALL_SECTIONS } from '@rafrika/shared';
import { defaultLocale, hasLocale, locales } from '@/i18n/config';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { Icon } from '@/components/icon';
import { itemHref } from '@/lib/menu';
import { PhotoHero } from '@/components/photo-hero';
import { SECTION_PHOTOS } from '@/lib/photos';

const sections = ALL_SECTIONS;

export async function generateStaticParams() {
  return locales.flatMap((lang) => sections.map((s) => ({ lang, section: s.slug })));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/[section]'>): Promise<Metadata> {
  const { lang, section: slug } = await params;
  const section = sections.find((s) => s.slug === slug);
  const locale = hasLocale(lang) ? lang : defaultLocale;
  return section ? pageMeta({ path: `/${section.slug}`, title: section.label[locale], description: section.tagline[locale] }) : {};
}

export default async function SectionPage(props: PageProps<'/[lang]/[section]'>) {
  // Unknown addresses such as /en/does-not-exist land here: answer them with a real HTTP 404
  // before the Suspense boundary starts streaming a 200.
  const { section: slug } = await props.params;
  if (!sections.some((s) => s.slug === slug)) notFound();
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
          <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white">
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
            className="card group flex items-start gap-4 transition hover:-translate-y-1 hover:border-leaf/40"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[5px] bg-sand text-leaf-dark transition group-hover:bg-leaf group-hover:text-white">
              <Icon name={item.icon} className="size-6" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-lg font-bold">
                {item.label[locale]}
                {item.status !== 'live' && <span className="badge">{t.nav.soon}</span>}
              </span>
              <span className="mt-1 block text-muted">{item.blurb[locale]}</span>
            </span>
            <ArrowRight className="mt-1 size-5 text-muted transition group-hover:translate-x-1 group-hover:text-leaf-dark" aria-hidden />
          </Link>
        ))}
      </section>
    </>
  );
}
