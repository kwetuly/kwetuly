import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Clock, Video } from 'lucide-react';
import { CALL_TOPICS, formatUsd } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listCallGuides } from '@/lib/guides';
import { GuideAvatar } from '@/components/guide-card';
import { topicName } from '@/lib/labels';
import { PhotoHero } from '@/components/photo-hero';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.calls.title, description: t.calls.subtitle };
}

export default async function CallsPage({ searchParams }: PageProps<'/[lang]/calls'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <PhotoHero photo={'kiliCamp'}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white">
            <Video className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold sm:text-5xl">{t.calls.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{t.calls.subtitle}</p>
          <ol className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {t.calls.how.map((step, i) => (
              <li key={step} className="rounded-[5px] border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
                <span className="text-2xl font-extrabold text-gold">{i + 1}</span>
                <p className="mt-1">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl text-sm text-white/75">{t.calls.payNote}</p>
        </div>
      </PhotoHero>
      <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-6xl animate-pulse rounded-[5px] bg-surface" />}>
        <CallGuides searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </>
  );
}

async function CallGuides({
  searchParams,
  t,
  locale,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const params = await searchParams;
  const topic = CALL_TOPICS.some((c) => c.id === params.topic) ? (params.topic as string) : undefined;
  const guides = await listCallGuides(topic);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/calls`}
          className={`rounded-[5px] px-4 py-2 text-sm font-semibold ${!topic ? 'bg-night text-white' : 'border border-line bg-white'}`}
        >
          {t.calls.allTopics}
        </Link>
        {CALL_TOPICS.map((c) => (
          <Link
            key={c.id}
            href={`/${locale}/calls?topic=${c.id}`}
            className={`rounded-[5px] px-4 py-2 text-sm font-semibold ${topic === c.id ? 'bg-night text-white' : 'border border-line bg-white hover:border-leaf'}`}
          >
            {c[locale]}
          </Link>
        ))}
      </div>

      {guides.length === 0 ? (
        <p className="mt-10 text-muted">{t.calls.none}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <div key={g.id} className="card flex flex-col">
              <div className="flex items-center gap-4">
                <GuideAvatar guide={g} size={64} />
                <div>
                  <h2 className="font-bold">{g.display_name}</h2>
                  <p className="text-sm text-muted">{g.base_region}</p>
                </div>
              </div>
              {g.headline && <p className="mt-3 text-sm">{g.headline}</p>}
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {g.call_topics.map((c) => (
                  <li key={c} className="rounded-[5px] bg-sand px-2.5 py-1 text-xs font-semibold">{topicName(c, locale)}</li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="flex items-center gap-1 text-sm text-muted">
                  <Clock className="size-4" aria-hidden /> {g.call_minutes} {t.calls.minutes}
                </span>
                <span className="text-lg font-extrabold text-forest">
                  {g.call_price_usd != null ? formatUsd(g.call_price_usd) : t.calls.priceTbc}
                </span>
              </div>
              <Link href={`/${locale}/guides/${g.slug}#call`} className="btn mt-4 w-full">
                {t.calls.book}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
