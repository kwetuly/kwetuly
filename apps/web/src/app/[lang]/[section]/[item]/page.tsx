import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Bell, Store } from 'lucide-react';
import { MENU, findMenuItem } from '@rafrika/shared';
import { locales, type Locale } from '@/i18n/config';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import { Icon } from '@/components/icon';
import { itemHref } from '@/lib/menu';
import { registerInterest } from '../actions';

export async function generateStaticParams() {
  return locales.flatMap((lang) =>
    MENU.flatMap((s) => s.items.filter((i) => !i.href).map((i) => ({ lang, section: s.slug, item: i.slug }))),
  );
}

export async function generateMetadata({ params }: PageProps<'/[lang]/[section]/[item]'>): Promise<Metadata> {
  const { lang, section, item } = await params;
  const found = findMenuItem(section, item);
  const locale = lang === 'sw' ? 'sw' : 'en';
  return found ? { title: found.item.label[locale], description: found.item.blurb[locale] } : {};
}

export default function ItemPage(props: PageProps<'/[lang]/[section]/[item]'>) {
  return (
    <Suspense fallback={<div className="pattern-kanga h-72" />}>
      <ItemContent {...props} />
    </Suspense>
  );
}

async function ItemContent({ params, searchParams }: PageProps<'/[lang]/[section]/[item]'>) {
  const { section: sectionSlug, item: itemSlug } = await params;
  const found = findMenuItem(sectionSlug, itemSlug);
  if (!found || found.item.href) notFound();
  const { section, item } = found;
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const siblings = section.items.filter((i) => i.slug !== item.slug);

  return (
    <>
      <section className="pattern-kanga text-white">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-10">
          <Link href={`/${locale}/${section.slug}`} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> {t.explore.back} {section.label[locale]}
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sunset to-gold shadow-lg">
              <Icon name={item.icon} className="size-8" />
            </span>
            <div>
              <span className="badge">{t.nav.soon}</span>
              <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{item.label[locale]}</h1>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-lg text-white/80">{item.blurb[locale]}</p>
        </div>
      </section>

      <section className="mx-auto -mt-16 grid max-w-6xl gap-6 px-4 pb-16 lg:grid-cols-2">
        <Suspense fallback={<div className="card h-80 animate-pulse" />}>
          <InterestForm
            kind="traveler"
            searchParams={searchParams}
            t={t}
            locale={locale}
            section={section.slug}
            item={item.slug}
            title={t.explore.comingTitle}
            body={t.explore.comingBody}
          />
          <InterestForm
            kind="business"
            searchParams={searchParams}
            t={t}
            locale={locale}
            section={section.slug}
            item={item.slug}
            title={t.explore.listTitle}
            body={t.explore.listBody}
          />
        </Suspense>
      </section>

      {siblings.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
            {t.explore.alsoIn} {section.label[locale]}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {siblings.map((s) => (
              <Link
                key={s.slug}
                href={itemHref(locale, section, s)}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 font-semibold transition hover:border-sunset hover:text-sunset"
              >
                <Icon name={s.icon} className="size-4" /> {s.label[locale]}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

async function InterestForm({
  kind,
  searchParams,
  t,
  locale,
  section,
  item,
  title,
  body,
}: {
  kind: 'traveler' | 'business';
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
  section: string;
  item: string;
  title: string;
  body: string;
}) {
  const status = await searchParams;
  const sent = status.sent === kind;
  const failed = status.error === kind;
  const isBusiness = kind === 'business';

  return (
    <div id={kind} className={`card ${isBusiness ? 'bg-sand' : ''}`}>
      <span className={`flex size-11 items-center justify-center rounded-xl ${isBusiness ? 'bg-night text-gold' : 'bg-mint text-forest'}`}>
        {isBusiness ? <Store className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
      </span>
      <h2 className="mt-4 text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-muted">{body}</p>
      {sent ? (
        <p className="mt-6 rounded-2xl bg-mint p-4 font-semibold text-forest">✓ {t.explore.thanks}</p>
      ) : (
        <form action={registerInterest} className="mt-6 space-y-3">
          {failed && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="section" value={section} />
          <input type="hidden" name="item" value={item} />
          <input type="hidden" name="kind" value={kind} />
          <input className="field" name="name" placeholder={t.profile.name} required maxLength={120} />
          {isBusiness && <input className="field" name="business_name" placeholder={t.explore.businessName} maxLength={120} />}
          <input className="field" name="contact" placeholder={t.profile.contact} required maxLength={160} />
          <textarea className="field min-h-24" name="message" placeholder={t.profile.message} maxLength={2000} />
          <button className={isBusiness ? 'btn-dark w-full' : 'btn w-full'}>
            {isBusiness ? t.explore.listCta : t.profile.send}
          </button>
        </form>
      )}
    </div>
  );
}
