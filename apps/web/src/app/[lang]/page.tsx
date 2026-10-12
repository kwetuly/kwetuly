import Link from 'next/link';
import { ArrowRight, BadgeCheck, Languages, Star } from 'lucide-react';
import { MENU } from '@rafrika/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { GuideSearch } from '@/components/guide-search';
import { Icon } from '@/components/icon';
import { itemHref } from '@/lib/menu';

const whyIcons = [BadgeCheck, Star, Languages];

export default async function HomePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      {/* Hero */}
      <section className="pattern-kanga relative overflow-hidden text-white">
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-16 sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold backdrop-blur">
            <span className="size-2 animate-pulse rounded-full bg-gold" /> {t.home.eyebrow}
          </p>
          <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            {t.home.title.split(' ').slice(0, -2).join(' ')}{' '}
            <span className="text-glow">{t.home.title.split(' ').slice(-2).join(' ')}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">{t.home.subtitle}</p>
          <div className="mt-10 max-w-3xl rounded-[28px] border border-white/15 bg-white/10 p-2 text-charcoal backdrop-blur-xl">
            <GuideSearch locale={locale} t={t} />
          </div>
        </div>
        {/* Soft wave into the next section */}
        <svg className="absolute -bottom-px left-0 w-full text-white" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0,64 C240,16 480,0 720,24 C960,48 1200,80 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </section>

      {/* Explore every section */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.explore.title}</h2>
        <p className="mt-2 text-lg text-muted">{t.explore.subtitle}</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MENU.map((section, index) => (
            <div
              key={section.slug}
              className={`group relative overflow-hidden rounded-3xl p-6 transition hover:-translate-y-1 ${
                index % 3 === 0
                  ? 'bg-night text-white'
                  : index % 3 === 1
                    ? 'bg-sand'
                    : 'bg-mint'
              }`}
            >
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br from-sunset/30 to-gold/30 blur-2xl transition group-hover:scale-125" />
              <span className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sunset to-gold text-white shadow-lg">
                <Icon name={section.icon} className="size-6" />
              </span>
              <h3 className="relative mt-5 text-2xl font-bold">{section.label[locale]}</h3>
              <p className={`relative mt-1 text-sm ${index % 3 === 0 ? 'text-white/70' : 'text-muted'}`}>
                {section.tagline[locale]}
              </p>
              <ul className="relative mt-5 flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={itemHref(locale, section, item)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        index % 3 === 0
                          ? 'bg-white/10 hover:bg-white/20'
                          : 'bg-white hover:text-sunset'
                      }`}
                    >
                      <Icon name={item.icon} className="size-4" />
                      {item.label[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Why Rafrika */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">{t.home.whyTitle}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {t.home.why.map((item, i) => {
              const WhyIcon = whyIcons[i] ?? BadgeCheck;
              return (
                <div key={item.title} className="card">
                  <WhyIcon className="size-8 text-sunset" aria-hidden />
                  <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-muted">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Guides + AFCON */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-16 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest to-night p-8 text-white sm:p-10">
          <div className="absolute -bottom-16 -right-16 size-64 rounded-full bg-gold/20 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold">{t.home.forGuidesTitle}</h2>
          <p className="relative mt-3 max-w-md text-white/80">{t.home.forGuidesBody}</p>
          <Link href={`/${locale}/join`} className="btn relative mt-8">
            {t.home.forGuidesCta} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <Link
          href={`/${locale}/discover/afcon-2027`}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold via-[#ff9a3d] to-sunset p-8 text-night sm:p-10"
        >
          <div className="absolute right-6 top-6 text-7xl opacity-90 transition group-hover:scale-110 group-hover:rotate-12" aria-hidden>
            ⚽
          </div>
          <p className="text-sm font-bold uppercase tracking-widest">19 June – 17 July 2027</p>
          <h2 className="mt-3 max-w-sm text-3xl font-extrabold">{t.home.afconTitle}</h2>
          <p className="mt-3 max-w-md font-medium text-night/80">{t.home.afconBody}</p>
          <span className="btn-dark mt-8">
            AFCON 2027 <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
          </span>
        </Link>
      </section>
    </>
  );
}
