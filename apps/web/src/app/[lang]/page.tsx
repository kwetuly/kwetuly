import Link from 'next/link';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { GuideSearch } from '@/components/guide-search';

export default async function HomePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <section className="bg-forest text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-mint">{t.home.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">{t.home.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-mint">{t.home.subtitle}</p>
          <div className="mt-8 max-w-3xl text-charcoal">
            <GuideSearch locale={locale} t={t} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">{t.home.whyTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {t.home.why.map((item) => (
            <div key={item.title} className="card">
              <h3 className="font-semibold text-forest">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2">
        <div className="card bg-mint">
          <h2 className="text-xl font-bold text-forest">{t.home.forGuidesTitle}</h2>
          <p className="mt-2">{t.home.forGuidesBody}</p>
          <Link href={`/${locale}/join`} className="btn mt-5">
            {t.home.forGuidesCta}
          </Link>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold">{t.home.afconTitle}</h2>
          <p className="mt-2 text-muted">{t.home.afconBody}</p>
        </div>
      </section>
    </>
  );
}
