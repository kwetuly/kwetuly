import Image from 'next/image';
import Link from 'next/link';
import { MENU } from '@rafrika/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { GuideSearch } from '@/components/guide-search';
import { Icon } from '@/components/icon';
import { itemHref } from '@/lib/menu';
import { PHOTOS, SECTION_PHOTOS, photoUrl } from '@/lib/photos';

// Home cards stay even: long sections show their first links and a "See all" link.
const HOME_CARD_LINKS = 5;

export default async function HomePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const hero = PHOTOS.kiliCampMawenzi;

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-night text-white">
        <Image src={photoUrl(hero, 2000)} alt={hero.alt} fill priority sizes="100vw" className="-z-10 object-cover" />
        {/* Shade only the side the text sits on, so the landscape stays visible. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night/90 via-night/55 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night/60 via-transparent to-transparent" />
        <div className="mx-auto flex min-h-[min(78svh,760px)] max-w-7xl flex-col justify-end px-4 pb-14 pt-24 sm:pb-20">
          <p lang="sw" className="text-lg font-semibold text-gold">{t.home.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
            {t.home.title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">{t.home.subtitle}</p>
          <div className="mt-8 max-w-3xl text-charcoal">
            <GuideSearch locale={locale} t={t} />
          </div>
        </div>
      </section>

      {/* Explore every section, each with its own photo */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.explore.title}</h2>
        <p className="mt-2 text-lg text-muted">{t.explore.subtitle}</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MENU.map((section, index) => {
            const photo = PHOTOS[SECTION_PHOTOS[section.slug] ?? 'safariSunset'];
            return (
              <div
                key={section.slug}
                className={`group relative isolate flex min-h-[340px] flex-col justify-end overflow-hidden rounded-3xl p-6 text-white ${index === 0 ? 'sm:col-span-2 lg:row-span-2 lg:min-h-[700px]' : ''}`}
              >
                <Image
                  src={photoUrl(photo, index === 0 ? 1400 : 900)}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="-z-10 object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/60 to-night/10" />
                <span className="flex size-12 items-center justify-center rounded-2xl bg-sunset">
                  <Icon name={section.icon} className="size-6" />
                </span>
                <h3 className={`mt-4 font-extrabold ${index === 0 ? 'text-4xl' : 'text-2xl'}`}>{section.label[locale]}</h3>
                <p className="mt-1 text-sm text-white/80">{section.tagline[locale]}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {section.items.slice(0, HOME_CARD_LINKS).map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={itemHref(locale, section, item)}
                        className="inline-flex items-center gap-1.5 rounded-[15px] bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white hover:text-night"
                      >
                        <Icon name={item.icon} className="size-4" />
                        {item.label[locale]}
                      </Link>
                    </li>
                  ))}
                  {section.items.length > HOME_CARD_LINKS && (
                    <li>
                      <Link
                        href={`/${locale}/${section.slug}`}
                        className="inline-flex items-center gap-1 rounded-[15px] bg-gold px-3 py-1.5 text-sm font-bold text-night"
                      >
                        {t.explore.more} ({section.items.length})
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Rafrika */}
      {/* Plain text, no icon cards: a short list reads faster. */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 lg:grid-cols-[1fr_2fr]">
          <h2 className="text-3xl font-extrabold tracking-tight">{t.home.whyTitle}</h2>
          <ul className="divide-y divide-line">
            {t.home.why.map((item) => (
              <li key={item.title} className="py-5 first:pt-0 last:pb-0">
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-1 max-w-prose text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Guides + AFCON */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-16 lg:grid-cols-2">
        <div className="relative isolate overflow-hidden rounded-3xl p-8 text-white sm:p-10">
          <Image src={photoUrl(PHOTOS.kiboSaddleHikers, 1200)} alt={PHOTOS.kiboSaddleHikers.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-forest/95 via-night/85 to-night/40" />
          <h2 className="text-3xl font-extrabold">{t.home.forGuidesTitle}</h2>
          <p className="mt-3 max-w-md text-white/85">{t.home.forGuidesBody}</p>
          <Link href={`/${locale}/join?role=guide`} className="btn mt-8">
            {t.home.forGuidesCta}
          </Link>
        </div>
        <Link
          href={`/${locale}/discover/afcon-2027`}
          className="group relative overflow-hidden rounded-3xl bg-gold p-8 text-night sm:p-10"
        >
          <p className="font-bold">{t.home.afconDates}</p>
          <h2 className="mt-3 max-w-sm text-3xl font-extrabold">{t.home.afconTitle}</h2>
          <p className="mt-3 max-w-md font-medium text-night/80">{t.home.afconBody}</p>
          <span className="btn-dark mt-8">
            AFCON 2027
          </span>
        </Link>
      </section>
    </>
  );
}
