import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { REGIONS } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { NEWS_COLUMNS, type TravelNews } from '@/lib/news';
import { createClient } from '@/lib/supabase/server';
import { deleteFieldNews, deleteTravelNews, saveTravelNews } from './actions';

export const metadata: Metadata = { title: 'News', robots: { index: false } };

// Admin only: news for travellers (public /news page) and Field news for guides (Guide Hub).
export default async function AdminNewsPage({ searchParams }: PageProps<'/[lang]/admin/news'>) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
      <h1 className="mt-2 text-3xl font-bold">News</h1>
      <p className="mt-1 text-muted">Travellers only see travel news. Guides only see Field news in the Guide Hub.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Content locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function NewsForm({ locale, item }: { locale: Locale; item?: TravelNews }) {
  return (
    <form action={saveTravelNews} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="block sm:col-span-2">
        <span className="label">Title</span>
        <input name="title" className="field" required minLength={5} maxLength={160} defaultValue={item?.title} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Text</span>
        <textarea name="body" className="field min-h-32" required minLength={20} maxLength={8000} defaultValue={item?.body} />
      </label>
      <label className="block">
        <span className="label">Region (optional)</span>
        <select name="region" className="field" defaultValue={item?.region ?? ''}>
          <option value="">All of Tanzania</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Date</span>
        <input name="published_on" type="date" className="field" defaultValue={item?.published_on ?? new Date().toISOString().slice(0, 10)} />
      </label>
      <label className="block">
        <span className="label">Source name</span>
        <input name="source_name" className="field" maxLength={120} defaultValue={item?.source_name ?? ''} />
      </label>
      <label className="block">
        <span className="label">Source link (https://…)</span>
        <input name="source_url" type="url" className="field" maxLength={400} defaultValue={item?.source_url ?? ''} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={item?.published ?? true} className="size-4 accent-forest" /> Show on the site
      </label>
      <button className="btn w-fit px-5 py-2 text-sm sm:col-span-2">{item ? 'Save changes' : 'Publish news'}</button>
    </form>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') return <p className="mt-6">Admins only.</p>;
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: travel }, { data: field }] = await Promise.all([
    supabase.from('travel_news').select(NEWS_COLUMNS).order('published_on', { ascending: false }).returns<TravelNews[]>(),
    supabase.from('hub_posts').select('id, title, source, region, created_at').eq('kind', 'news').order('created_at', { ascending: false }).limit(50),
  ]);

  return (
    <>
      {params.saved && <p className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Saved.</p>}
      {params.deleted && <p className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Deleted.</p>}
      {params.error && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-red-800">Could not save. A title of 5+ characters and text of 20+ characters are needed.</p>}

      <section className="mt-8">
        <h2 className="text-2xl font-bold">News for travellers ({travel?.length ?? 0})</h2>
        <p className="mt-1 text-sm text-muted">
          Shown on <Link href={`/${locale}/news`} className="underline">the travel news page</Link>.
        </p>
        <div className="card mt-4">
          <h3 className="mb-3 font-bold">Add news</h3>
          <NewsForm locale={locale} />
        </div>
        <div className="mt-4 space-y-3">
          {(travel ?? []).map((n) => (
            <details key={n.id} className="card">
              <summary className="cursor-pointer font-semibold">
                {n.title} <span className="font-normal text-muted">· {n.published_on}{n.published ? '' : ' · hidden'}</span>
              </summary>
              <div className="mt-4 space-y-3">
                <NewsForm locale={locale} item={n} />
                <form action={deleteTravelNews}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={n.id} />
                  <button className="text-sm font-semibold text-red-800 underline">Delete this news</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section id="guides" className="mt-12">
        <h2 className="text-2xl font-bold">Field news for guides ({field?.length ?? 0})</h2>
        <p className="mt-1 text-sm text-muted">
          Write it on <Link href={`/${locale}/hub/news`} className="underline">the Guide Hub news page</Link>. Only guides and admins see it.
        </p>
        <ul className="mt-4 space-y-2">
          {(field ?? []).map((n) => (
            <li key={n.id} className="card flex flex-wrap items-center gap-3 py-3">
              <span className="font-semibold">{n.title}</span>
              <span className="text-sm text-muted">{[n.region, n.source, n.created_at.slice(0, 10)].filter(Boolean).join(' · ')}</span>
              <form action={deleteFieldNews} className="ml-auto">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={n.id} />
                <button className="text-sm font-semibold text-red-800 underline">Delete</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
