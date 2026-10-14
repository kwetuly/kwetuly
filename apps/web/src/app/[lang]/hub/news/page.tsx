import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Newspaper } from 'lucide-react';
import { REGIONS } from '@rafrika/shared';
import { hubLabel } from '@/lib/menu';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireHubAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createPost } from '../actions';

export const metadata: Metadata = { title: 'Field news', robots: { index: false } };

type NewsItem = { id: string; title: string; body: string; region: string | null; source: string | null; created_at: string };

export default async function NewsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[5px] bg-white" />}>
      <News t={t} locale={locale} />
    </Suspense>
  );
}

async function News({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireHubAccess(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from('hub_posts')
    .select('id, title, body, region, source, created_at')
    .eq('kind', 'news')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<NewsItem[]>();
  const news = data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold">
          <Newspaper className="size-7 text-leaf-dark" aria-hidden /> {hubLabel('news', locale)}
        </h1>
        {news.length === 0 && <p className="mt-6 text-muted">{t.hub.noNews}</p>}
        <ul className="mt-6 space-y-4">
          {news.map((n) => (
            <li key={n.id} className="card border-l-4 border-l-gold">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {n.source && <span className="badge">{n.source}</span>}
                {n.region && <span>{n.region}</span>}
                <span>{new Date(n.created_at).toLocaleDateString(locale)}</span>
              </div>
              <h2 className="mt-2 text-lg font-bold">{n.title}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Only admins publish official news (e.g. on behalf of TANAPA or the ministry). */}
      {user.role === 'admin' && (
        <aside className="card h-fit">
          <h2 className="text-lg font-bold">+ Field news</h2>
          <form action={createPost} className="mt-4 space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="kind" value="news" />
            <input name="title" className="field" placeholder={t.hub.postTitle} required maxLength={160} />
            <textarea name="body" className="field min-h-32" required maxLength={6000} />
            <input name="source" className="field" placeholder={t.hub.newsSource} maxLength={120} />
            <select name="region" className="field" defaultValue="">
              <option value="">{t.hub.region}</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button className="btn w-full">{t.hub.post}</button>
          </form>
        </aside>
      )}
    </div>
  );
}
