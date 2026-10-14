import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { hubLabel } from '@/lib/menu';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireHubAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createReply } from '../../actions';

export const metadata: Metadata = { title: 'Forum thread', robots: { index: false } };

type Thread = {
  id: string;
  title: string;
  body: string;
  region: string | null;
  author_name: string | null;
  created_at: string;
  hub_replies: { id: string; body: string; author_name: string | null; created_at: string }[];
};

export default async function ThreadPage({ params }: PageProps<'/[lang]/hub/forum/[id]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[5px] bg-white" />}>
      <ThreadView params={params} t={t} locale={locale} />
    </Suspense>
  );
}

async function ThreadView({ params, t, locale }: { params: Promise<{ id: string }>; t: Dictionary; locale: Locale }) {
  await requireHubAccess(locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: post } = await supabase
    .from('hub_posts')
    .select('id, title, body, region, author_name, created_at, hub_replies(id, body, author_name, created_at)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'hub_replies', ascending: true })
    .maybeSingle<Thread>();
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={`/${locale}/hub/forum`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-charcoal">
        <ArrowLeft className="size-4" aria-hidden /> {hubLabel('forum', locale)}
      </Link>
      <div className="card mt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-charcoal">{post.author_name}</span>
          {post.region && <span className="badge">{post.region}</span>}
          <span>{new Date(post.created_at).toLocaleString(locale)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">{post.title}</h1>
        <p className="mt-3 whitespace-pre-line leading-relaxed">{post.body}</p>
      </div>

      <section id="replies" className="mt-6 space-y-3">
        <h2 className="font-bold text-muted">
          {post.hub_replies.length} {t.hub.replies}
        </h2>
        {post.hub_replies.map((r) => (
          <div key={r.id} className="rounded-[5px] border border-line bg-white p-4">
            <p className="text-xs text-muted">
              <span className="font-semibold text-charcoal">{r.author_name}</span> · {new Date(r.created_at).toLocaleString(locale)}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>
          </div>
        ))}
        <form action={createReply} className="card space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="post_id" value={post.id} />
          <textarea name="body" className="field min-h-24" required maxLength={3000} placeholder={t.hub.reply} />
          <button className="btn">{t.hub.reply}</button>
        </form>
      </section>
    </article>
  );
}
