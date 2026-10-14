import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MessagesSquare, TriangleAlert } from 'lucide-react';
import { REGIONS } from '@rafrika/shared';
import { hubLabel } from '@/lib/menu';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireHubAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createPost } from '../actions';

export const metadata: Metadata = { title: 'Guide forum', robots: { index: false } };

type Post = {
  id: string;
  title: string;
  body: string;
  region: string | null;
  author_name: string | null;
  created_at: string;
  hub_replies: { count: number }[];
};

export default async function ForumPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white" />}>
        <Threads t={t} locale={locale} />
      </Suspense>
      <aside className="card h-fit">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MessagesSquare className="size-5 text-leaf" aria-hidden /> {t.hub.newPost}
        </h2>
        <p className="mt-2 flex gap-2 rounded-2xl bg-sand p-3 text-xs font-semibold text-leaf-dark">
          <TriangleAlert className="size-4 shrink-0" aria-hidden /> {t.hub.sightingWarning}
        </p>
        <form action={createPost} className="mt-4 space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value="forum" />
          <input name="title" className="field" placeholder={t.hub.postTitle} required maxLength={160} />
          <textarea name="body" className="field min-h-32" placeholder={t.hub.postBody} required maxLength={6000} />
          <select name="region" className="field" defaultValue="">
            <option value="">{t.hub.region}</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button className="btn w-full">{t.hub.post}</button>
        </form>
      </aside>
    </div>
  );
}

async function Threads({ t, locale }: { t: Dictionary; locale: Locale }) {
  await requireHubAccess(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from('hub_posts')
    .select('id, title, body, region, author_name, created_at, hub_replies(count)')
    .eq('kind', 'forum')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<Post[]>();
  const posts = data ?? [];

  return (
    <section>
      <h1 className="text-3xl font-extrabold">{hubLabel('forum', locale)}</h1>
      {posts.length === 0 ? (
        <p className="mt-6 text-muted">{t.hub.noPosts}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/${locale}/hub/forum/${p.id}`} className="card block transition hover:border-leaf/50">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-semibold text-charcoal">{p.author_name}</span>
                  {p.region && <span className="badge">{p.region}</span>}
                  <span>{new Date(p.created_at).toLocaleDateString(locale)}</span>
                  <span className="ml-auto">{p.hub_replies[0]?.count ?? 0} {t.hub.replies}</span>
                </div>
                <h2 className="mt-2 text-lg font-bold">{p.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{p.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
