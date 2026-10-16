import type { Metadata } from 'next';
import { ExternalLink, Newspaper } from 'lucide-react';
import { pageMeta } from '@/lib/seo';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { listTravelNews } from '@/lib/news';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/news', title: t.extras.newsTitle, description: t.extras.newsSubtitle });
}

// News for travellers. Rafrika writes it in /admin/news; guides' Field news stays in the Hub.
export default async function NewsPage() {
  const [t, locale, news] = await Promise.all([getDictionary(), getLocale(), listTravelNews()]);
  const x = t.extras;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="flex items-center gap-2 text-4xl font-extrabold">
        <Newspaper className="size-8 text-leaf-dark" aria-hidden /> {x.newsTitle}
      </h1>
      <p className="mt-3 text-lg text-muted">{x.newsSubtitle}</p>
      {news.length === 0 && <p className="mt-8 text-muted">{x.newsNone}</p>}
      <div className="mt-8 space-y-5">
        {news.map((n) => (
          <article key={n.id} id={n.id} className="card scroll-mt-28">
            <p className="text-sm font-semibold text-leaf-dark">
              {date.format(new Date(n.published_on))}
              {n.region && ` · ${n.region}`}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{n.title}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed">{n.body}</p>
            {n.source_url && (
              <a href={n.source_url} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest underline">
                {x.newsSource}: {n.source_name ?? new URL(n.source_url).hostname} <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
