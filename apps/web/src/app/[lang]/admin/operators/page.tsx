import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BadgeCheck } from 'lucide-react';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin: tour operators', robots: { index: false } };

type Row = { id: string; slug: string; name: string; location: string | null; status: string; verified_at: string | null; licence_checked_at: string | null; trips: { count: number }[] };

export default async function AdminOperatorsPage() {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Tour operators</h1>
        <Link href={`/${locale}/admin/trips`} className="text-sm font-semibold text-forest underline">← Tours</Link>
        <Link href={`/${locale}/admin/operators/new`} className="btn ml-auto px-4 py-2 text-sm">New operator</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Add reputable Tanzanian operators whose tours you list. Write the description yourself. Tick “Verified” only after you have checked their
        licence (e.g. with the Tourism Agency Licensing Authority) and contact details. Licence and TripAdvisor figures need the date you checked them.
      </p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <List locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ locale }: { locale: Locale }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from('tour_operators')
    .select('id, slug, name, location, status, verified_at, licence_checked_at, trips(count)')
    .order('name')
    .returns<Row[]>();
  const rows = data ?? [];
  if (rows.length === 0) return <p className="mt-8 text-muted">No operators yet.</p>;
  return (
    <ul className="mt-6 divide-y divide-line rounded-[5px] border border-line bg-white">
      {rows.map((op) => (
        <li key={op.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Link href={`/${locale}/admin/operators/${op.id}`} className="flex items-center gap-1 font-bold hover:text-leaf-dark">
              {op.name} {op.verified_at && <BadgeCheck className="size-4 text-leaf-dark" aria-label="Verified" />}
            </Link>
            <p className="text-xs text-muted">
              {op.location ?? 'No location'} · {op.trips[0]?.count ?? 0} tours · {op.licence_checked_at ? `licence checked ${op.licence_checked_at}` : 'licence not checked'}
            </p>
          </div>
          <span className={`rounded-[5px] px-2 py-0.5 text-xs font-bold ${op.status === 'published' ? 'bg-mint text-forest' : 'bg-sand text-leaf-dark'}`}>{op.status}</span>
          <Link href={`/${locale}/operators/${op.slug}`} className="text-xs font-semibold underline">View</Link>
        </li>
      ))}
    </ul>
  );
}
