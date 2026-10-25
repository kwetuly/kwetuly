import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { PLACE_COLUMNS, PLACE_KINDS, type Place } from '@kwetuly/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { savePlace } from '../actions';

export const metadata: Metadata = { title: 'Admin: edit place', robots: { index: false } };

export default async function EditPlacePage({ params, searchParams }: PageProps<'/[lang]/admin/places/[id]'>) {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/${locale}/admin/places`} className="text-sm font-semibold text-forest underline">← All places</Link>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <Editor locale={locale} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Editor({ locale, params, searchParams }: { locale: Locale; params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const [{ id }, status] = await Promise.all([params, searchParams]);
  const isNew = id === 'new';
  const supabase = await createClient();
  const { data } = isNew ? { data: null } : await supabase.from('places').select(PLACE_COLUMNS).eq('id', id).maybeSingle();
  if (!isNew && !data) notFound();
  const p = (data ?? {}) as Partial<Place>;
  const lines = (list?: string[]) => (list ?? []).join('\n');

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{isNew ? 'New place' : p.name}</h1>
        {!isNew && <Link href={`/${locale}/places/${p.slug}`} className="btn-outline ml-auto px-4 py-2 text-sm">Preview →</Link>}
      </div>
      {status.saved && <p className="mt-4 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">Saved.</p>}
      {typeof status.error === 'string' && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{status.error}</p>}

      <form action={savePlace} className="mt-6 space-y-5 rounded-[5px] border border-line bg-white p-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={isNew ? '' : p.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input name="name" required maxLength={120} defaultValue={p.name ?? ''} className="field py-2" /></Field>
          <Field label="Web address (slug)"><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={p.slug ?? ''} className="field py-2" /></Field>
          <Field label="Kind">
            <select name="kind" defaultValue={p.kind ?? 'national_park'} className="field py-2">
              {PLACE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.en}</option>)}
            </select>
          </Field>
          <Field label="Region (e.g. Northern circuit, Zanzibar)"><input name="region" maxLength={80} defaultValue={p.region ?? ''} className="field py-2" /></Field>
          <Field label="Status">
            <select name="status" defaultValue={p.status ?? 'published'} className="field py-2">
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Managed by (e.g. TANAPA)"><input name="managed_by" maxLength={120} defaultValue={p.managed_by ?? ''} className="field py-2" /></Field>
          <Field label="Latitude"><input name="lat" type="number" step="0.0001" defaultValue={p.lat ?? ''} className="field py-2" /></Field>
          <Field label="Longitude"><input name="lng" type="number" step="0.0001" defaultValue={p.lng ?? ''} className="field py-2" /></Field>
        </div>
        <Field label="Summary (your own words)"><textarea name="summary" required maxLength={1200} defaultValue={p.summary ?? ''} className="field min-h-28" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Known for (one per line)"><textarea name="known_for" defaultValue={lines(p.known_for)} className="field min-h-32" /></Field>
          <Field label="Wildlife (one per line)"><textarea name="wildlife" defaultValue={lines(p.wildlife)} className="field min-h-32" /></Field>
          <Field label="Things to do (one per line)"><textarea name="activities" defaultValue={lines(p.activities)} className="field min-h-32" /></Field>
        </div>
        <fieldset className="space-y-3 rounded-[5px] border border-line p-4">
          <legend className="px-1 font-bold">Figures and source</legend>
          <p className="text-xs text-muted">Figures are only saved with an official source link and the date you checked it.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Area (km²)"><input name="area_km2" type="number" step="0.01" defaultValue={p.area_km2 ?? ''} className="field py-2" /></Field>
            <Field label="Established (year)"><input name="established" type="number" defaultValue={p.established ?? ''} className="field py-2" /></Field>
            <Field label="UNESCO World Heritage since (year)"><input name="unesco_year" type="number" defaultValue={p.unesco_year ?? ''} className="field py-2" /></Field>
            <Field label="Highest point (e.g. Kibo, 5,895 m)"><input name="highest_point" maxLength={120} defaultValue={p.highest_point ?? ''} className="field py-2" /></Field>
            <Field label="Source name"><input name="source_name" maxLength={120} defaultValue={p.source_name ?? ''} className="field py-2" /></Field>
            <Field label="Source link (https)"><input name="source_url" type="url" defaultValue={p.source_url ?? ''} className="field py-2" /></Field>
            <Field label="Checked on"><input name="source_checked_at" type="date" defaultValue={p.source_checked_at ?? ''} className="field py-2" /></Field>
          </div>
        </fieldset>
        <button className="btn">Save place</button>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
