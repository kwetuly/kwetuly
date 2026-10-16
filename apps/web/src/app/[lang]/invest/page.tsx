import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { INVEST_TEXT as TEXT } from '@rafrika/shared';
import { pageMeta } from '@/lib/seo';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { registerInterest } from '../[section]/actions';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const x = locale === 'sw' ? TEXT.sw : TEXT.en;
  return pageMeta({ path: '/invest', title: t.extras.investTitle, description: x.intro });
}

export default async function InvestPage({ searchParams }: PageProps<'/[lang]/invest'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const x = locale === 'sw' ? TEXT.sw : TEXT.en;
  const link = 'inline-flex items-center gap-2 rounded-[5px] border-2 border-forest px-4 py-2.5 font-semibold text-forest hover:bg-mint';
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="flex items-center gap-2 text-4xl font-extrabold">
        <TrendingUp className="size-8 text-leaf-dark" aria-hidden /> {t.extras.investTitle}
      </h1>
      <p className="mt-3 text-lg text-muted">{x.intro}</p>

      <section className="card mt-8 space-y-3">
        <h2 className="text-2xl font-bold">{x.whoTitle}</h2>
        <p>{x.who}</p>
        <div className="flex flex-wrap gap-3">
          <a href="https://www.tiseza.go.tz" target="_blank" rel="noopener" className={link}>
            {x.official} <ExternalLink className="size-4" aria-hidden />
          </a>
          <a href="https://www.tiseza.go.tz/contacts" target="_blank" rel="noopener" className={link}>
            {x.contact} <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="text-2xl font-bold">{x.helpTitle}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {x.help.map((h) => <li key={h}>{h}</li>)}
        </ul>
      </section>

      <section className="card mt-6">
        <h2 className="text-2xl font-bold">{x.stepsTitle}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {x.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </section>

      <section className="card mt-6 space-y-3 bg-sand">
        <h2 className="text-2xl font-bold">{x.rafrikaTitle}</h2>
        <p>{x.rafrika}</p>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-[5px] bg-surface" />}>
          <InterestForm searchParams={searchParams} t={t} locale={locale} placeholder={x.rafrika} cta={x.rafrikaCta} />
        </Suspense>
      </section>

      <p className="mt-6 text-sm text-muted">{x.checked}</p>
    </div>
  );
}

/** Reads the ?sent / ?error status, so it renders inside a Suspense boundary. */
async function InterestForm({
  searchParams,
  t,
  locale,
  placeholder,
  cta,
}: {
  searchParams: PageProps<'/[lang]/invest'>['searchParams'];
  t: Dictionary;
  locale: Locale;
  placeholder: string;
  cta: string;
}) {
  const status = await searchParams;
  return status.sent ? (
    <p className="rounded-[5px] bg-mint p-4 font-semibold text-forest">{t.explore.thanks}</p>
  ) : (
    <form id="business" action={registerInterest} className="space-y-3">
      {status.error && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="section" value="discover" />
      <input type="hidden" name="item" value="invest" />
      <input type="hidden" name="kind" value="business" />
      <input type="hidden" name="back" value={`/${locale}/invest`} />
      <input name="name" className="field" required maxLength={120} placeholder={t.profile.name} autoComplete="name" />
      <input name="contact" className="field" required maxLength={160} placeholder={t.profile.contact} />
      <textarea name="message" className="field min-h-24" maxLength={2000} placeholder={placeholder} />
      <button className="btn">{cta}</button>
    </form>
  );
}
