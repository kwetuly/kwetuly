import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PLACE_KINDS } from '@rafrika/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin: places', robots: { index: false } };

type Row = { id: string; slug: string; name: string; kind: string; status: string; source_checked_at: string | null; trip_stops: { count: number }[] };

export default async function AdminPlacesPage() {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Place guides</h1>
        <Link href={`/${locale}/admin/trips`} className="text-sm font-semibold text-forest underline">← Tours</Link>
        <Link href={`/${locale}/admin/places/new`} className="btn ml-auto px-4 py-2 text-sm">New place</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Short guides to the parks and sites tours visit. Write the summary yourself; take figures only from an official page (TANAPA, NCAA, UNESCO,
        Ramsar…) and add its link and the date you checked it. Link a place to a tour’s map stops in the tour editor.
      </p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <List locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const supabase = await createClient();
  const { data } = await supabase.from('places').select('id, slug, name, kind, status, source_checked_at, trip_stops(count)').order('name').returns<Row[]>();
  return (
    <ul className="mt-6 divide-y divide-line rounded-[5px] border border-line bg-white">
      {(data ?? []).map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Link href={`/${locale}/admin/places/${p.id}`} className="font-bold hover:text-leaf-dark">{p.name}</Link>
            <p className="text-xs text-muted">
              {PLACE_KINDS.find((k) => k.id === p.kind)?.en} · {p.trip_stops[0]?.count ?? 0} stops · {p.source_checked_at ? `source checked ${p.source_checked_at}` : 'no source'}
            </p>
          </div>
          <span className={`rounded-[5px] px-2 py-0.5 text-xs font-bold ${p.status === 'published' ? 'bg-mint text-forest' : 'bg-sand text-leaf-dark'}`}>{p.status}</span>
          <Link href={`/${locale}/places/${p.slug}`} className="text-xs font-semibold underline">View</Link>
        </li>
      ))}
    </ul>
  );
}
