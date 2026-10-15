import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { OPERATOR_COLUMNS, type TourOperator } from '@/lib/trips';
import { DirectUpload } from '@/components/direct-upload';
import { deleteOperator, saveOperator } from '../actions';

export const metadata: Metadata = { title: 'Admin: edit operator', robots: { index: false } };

export default async function EditOperatorPage({ params, searchParams }: PageProps<'/[lang]/admin/operators/[id]'>) {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/${locale}/admin/operators`} className="text-sm font-semibold text-forest underline">← All operators</Link>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <Editor locale={locale} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Editor({ locale, params, searchParams }: { locale: Locale; params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const [{ id }, status] = await Promise.all([params, searchParams]);
  const isNew = id === 'new';
  const supabase = await createClient();
  const { data } = isNew ? { data: null } : await supabase.from('tour_operators').select(OPERATOR_COLUMNS).eq('id', id).maybeSingle();
  if (!isNew && !data) notFound();
  const op = (data ?? {}) as Partial<TourOperator>;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{isNew ? 'New operator' : op.name}</h1>
        {!isNew && <Link href={`/${locale}/operators/${op.slug}`} className="btn-outline ml-auto px-4 py-2 text-sm">Preview →</Link>}
      </div>
      {status.saved && <p className="mt-4 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">Saved.</p>}
      {typeof status.error === 'string' && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{status.error}</p>}

      <form action={saveOperator} className="mt-6 space-y-5 rounded-[5px] border border-line bg-white p-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={isNew ? '' : op.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input name="name" required maxLength={120} defaultValue={op.name ?? ''} className="field py-2" /></Field>
          <Field label="Web address (slug)"><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={op.slug ?? ''} className="field py-2" /></Field>
          <Field label="Status">
            <select name="status" defaultValue={op.status ?? 'draft'} className="field py-2">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Location (town, region)"><input name="location" maxLength={120} defaultValue={op.location ?? ''} className="field py-2" /></Field>
        </div>
        <Field label="Description (your own words, never copied from their site)">
          <textarea name="description" maxLength={2000} defaultValue={op.description ?? ''} className="field min-h-28" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Website"><input name="website" type="url" defaultValue={op.website ?? ''} className="field py-2" /></Field>
          <Field label="Contact email"><input name="contact_email" type="email" defaultValue={op.contact_email ?? ''} className="field py-2" /></Field>
          <Field label="Contact phone"><input name="contact_phone" maxLength={40} defaultValue={op.contact_phone ?? ''} className="field py-2" /></Field>
          <Field label="Logo URL (with their permission)"><input name="logo_url" type="url" defaultValue={op.logo_url ?? ''} className="field py-2" /></Field>
          <Field label="…or upload a logo">
            <DirectUpload name="logo_upload" bucket="avatars" userId={user.id} prefix="operator-logo" accept="image/jpeg,image/png,image/webp" labels={{ uploading: 'Uploading…', uploaded: 'Uploaded. Save to use it.', error: 'Upload failed' }} />
          </Field>
        </div>

        <fieldset className="space-y-3 rounded-[5px] border border-line p-4">
          <legend className="px-1 font-bold">Licence</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Licence number"><input name="licence_number" maxLength={80} defaultValue={op.licence_number ?? ''} className="field py-2" /></Field>
            <Field label="Issued by"><input name="licence_authority" maxLength={120} defaultValue={op.licence_authority ?? ''} placeholder="e.g. TALA" className="field py-2" /></Field>
            <Field label="Checked on"><input name="licence_checked_at" type="date" defaultValue={op.licence_checked_at ?? ''} className="field py-2" /></Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-[5px] border border-line p-4">
          <legend className="px-1 font-bold">TripAdvisor</legend>
          <p className="text-xs text-muted">Copy the rating and review count exactly as shown on TripAdvisor on the day you check.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="TripAdvisor page"><input name="tripadvisor_url" type="url" defaultValue={op.tripadvisor_url ?? ''} className="field py-2" /></Field>
            <Field label="Checked on"><input name="tripadvisor_checked_at" type="date" defaultValue={op.tripadvisor_checked_at ?? ''} className="field py-2" /></Field>
            <Field label="Rating (0–5)"><input name="tripadvisor_rating" type="number" min={0} max={5} step="0.1" defaultValue={op.tripadvisor_rating ?? ''} className="field py-2" /></Field>
            <Field label="Number of reviews"><input name="tripadvisor_reviews" type="number" min={0} defaultValue={op.tripadvisor_reviews ?? ''} className="field py-2" /></Field>
          </div>
        </fieldset>

        <label className="flex items-start gap-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">
          <input type="checkbox" name="verified" defaultChecked={!!op.verified_at} className="mt-0.5 size-4 accent-leaf" />
          Verified: I have checked this operator’s licence and contact details. Shows the Verified badge.
          {op.verified_at && <span className="font-normal"> (since {op.verified_at.slice(0, 10)})</span>}
        </label>

        <button className="btn">Save operator</button>
      </form>

      {!isNew && (
        <form action={deleteOperator} className="mt-10 rounded-[5px] border border-red-200 bg-red-50 p-4 text-sm">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={op.id} />
          <input type="hidden" name="slug" value={op.slug} />
          <p className="font-bold text-red-800">Delete this operator</p>
          <p className="mt-1 text-red-800">Their tours stay but lose the operator link. Type <code>{op.slug}</code> to confirm.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input name="confirm" className="field max-w-xs py-2" aria-label="Type the web address to confirm" />
            <button className="rounded-[5px] bg-red-700 px-4 py-2 font-bold text-white">Delete</button>
          </div>
        </form>
      )}
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
