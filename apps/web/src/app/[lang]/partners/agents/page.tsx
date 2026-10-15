import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRightLeft, BadgeCheck, Handshake, Languages, Sparkles, Zap } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { PhotoHero } from '@/components/photo-hero';
import { applyAsAgency } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/partners/agents', title: t.partners.title, description: t.partners.subtitle });
}

const whyIcons = [BadgeCheck, Languages, Sparkles, Zap];

export default async function AgentsPage({ searchParams }: PageProps<'/[lang]/partners/agents'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const p = t.partners;

  return (
    <>
      <PhotoHero photo="buffaloCar">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-14">
          <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white">
            <Handshake className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold sm:text-5xl">{p.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">{p.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#apply" className="btn">{p.applyTitle}</a>
            <Link href={`/${locale}/guides?partners=1`} className="btn-dark bg-white/15 backdrop-blur hover:bg-white hover:text-charcoal">
              {p.browse}
            </Link>
          </div>
        </div>
      </PhotoHero>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {p.why.map((item, i) => {
          const WhyIcon = whyIcons[i] ?? BadgeCheck;
          return (
            <div key={item.title} className="card">
              <WhyIcon className="size-8 text-leaf-dark" aria-hidden />
              <h2 className="mt-4 font-bold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </div>
          );
        })}
      </section>

      <section className="bg-sand">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_440px]">
          <div>
            <h2 className="text-3xl font-extrabold">{p.howTitle}</h2>
            <ol className="mt-6 space-y-4">
              {p.how.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-leaf font-extrabold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-2 font-semibold">{step}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10 rounded-[5px] bg-night p-6 text-white">
              <ArrowRightLeft className="size-7" aria-hidden />
              <h3 className="mt-3 text-xl font-extrabold">{p.overflowTitle}</h3>
              <p className="mt-2 text-white/80">{p.overflowBody}</p>
              <Link href={`/${locale}/jobs/post?kind=handover`} className="btn mt-5">
                {p.overflowCta}
              </Link>
            </div>
          </div>

          <div id="apply" className="scroll-mt-28">
            <Suspense fallback={<div className="card h-96 animate-pulse" />}>
              <ApplyForm searchParams={searchParams} t={t} locale={locale} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}

async function ApplyForm({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const status = await searchParams;
  const p = t.partners;

  return (
    <div className="card">
      <h2 className="text-2xl font-extrabold">{p.applyTitle}</h2>
      <p className="mt-1 text-sm text-muted">{p.applyBody}</p>
      {status.sent ? (
        <p className="mt-5 rounded-[5px] bg-mint p-4 font-semibold text-forest">✓ {p.sent}</p>
      ) : (
        <form action={applyAsAgency} className="mt-5 space-y-3">
          {status.error && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
          <input type="hidden" name="locale" value={locale} />
          <input name="agency" className="field" placeholder={p.agency} required maxLength={120} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="country" className="field" placeholder={p.country} maxLength={80} />
            <input name="website" className="field" placeholder={p.website} maxLength={200} />
          </div>
          <input name="name" className="field" placeholder={t.profile.name} required maxLength={120} />
          <input name="contact" className="field" placeholder={t.profile.contact} required maxLength={160} />
          <textarea name="markets" className="field min-h-20" placeholder={p.markets} maxLength={400} />
          <input name="volume" className="field" placeholder={p.volume} maxLength={40} />
          <button className="btn w-full">{p.submit}</button>
        </form>
      )}
    </div>
  );
}
