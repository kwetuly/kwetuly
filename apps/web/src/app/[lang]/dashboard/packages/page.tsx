import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PACKAGE_COLUMNS, PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage, type PackageStatus } from '@kwetuly/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DirectUpload } from '@/components/direct-upload';
import { deletePackage, savePackage } from './actions';
import { SubmitButton } from '@/components/submit-button';

export const metadata: Metadata = { title: 'My packages', robots: { index: false } };

const STATUS_STYLE: Record<PackageStatus, string> = {
  draft: 'bg-surface text-muted',
  pending: 'bg-sand text-charcoal',
  approved: 'bg-mint text-forest',
  rejected: 'bg-red-50 text-red-800',
};

// The guide's own packages: a list with their review status, and one form to add or edit.
export default async function PackagesPage({ searchParams }: PageProps<'/[lang]/dashboard/packages'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <Packages t={t} locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Packages({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(locale);
  const params = await searchParams;
  const pt = t.packages;
  const supabase = await createClient();
  const { data: guide } = await supabase.from('guides').select('id').eq('owner_id', user.id).maybeSingle<{ id: string }>();
  // Packages are for guides only; everyone else goes back to their own dashboard.
  if (!guide) redirect(`/${locale}/dashboard`);
  const { data } = await supabase.from('guide_packages').select(PACKAGE_COLUMNS).eq('guide_id', guide.id).order('sort_order').order('created_at');
  const packages = (data ?? []) as GuidePackage[];
  const editing = typeof params.edit === 'string' ? packages.find((p) => p.id === params.edit) : undefined;
  const showForm = !!editing || params.new === '1' || packages.length === 0;

  return (
    <>
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline">{t.dashboard.title}</Link>
      <h1 className="mt-2 text-3xl font-bold">{pt.manageTitle}</h1>
      <p className="mt-2 text-muted">{pt.manageIntro}</p>
      {params.saved && <p className="mt-4 rounded-[5px] bg-mint p-4 font-semibold text-forest">{pt.saved}</p>}
      {params.error && <p className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">{t.auth.error}</p>}

      {packages.length > 0 && (
        <ul className="card mt-6 divide-y divide-line">
          {packages.map((p) => (
            <li key={p.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{p.title}</span>
                <span className={`rounded-[5px] px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>{pt.status[p.status]}</span>
              </div>
              <p className="text-sm text-muted">
                {[PACKAGE_KINDS.find((k) => k.id === p.kind)?.[locale], packageDuration(p, pt), packagePrice(p, pt)].filter(Boolean).join(' · ')}
              </p>
              {p.review_note && p.status === 'rejected' && (
                <p className="text-sm">
                  <span className="font-semibold">{pt.reviewNote}: </span>
                  {p.review_note}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Link href={`/${locale}/dashboard/packages?edit=${p.id}`} className="btn-outline px-4 py-2 text-sm">{t.dashboard.edit}</Link>
                <form action={deletePackage}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={p.id} />
                  <button className="px-2 py-2 text-sm font-semibold text-red-800 underline">{pt.remove}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <PackageForm p={editing} t={t} locale={locale} userId={user.id} />
      ) : (
        <Link href={`/${locale}/dashboard/packages?new=1`} className="btn mt-6">{pt.add}</Link>
      )}
    </>
  );
}

function PackageForm({ p, t, locale, userId }: { p?: GuidePackage; t: Dictionary; locale: Locale; userId: string }) {
  const pt = t.packages;
  return (
    <form action={savePackage} className="card mt-6 space-y-4">
      <h2 className="text-lg font-bold">{p ? pt.editPackage : pt.add}</h2>
      {p?.status === 'approved' && <p className="text-sm text-muted">{pt.changeNote}</p>}
      <input type="hidden" name="locale" value={locale} />
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="block">
        <span className="label">{pt.kindField}</span>
        <select className="field" name="kind" required defaultValue={p?.kind ?? 'cultural'}>
          {PACKAGE_KINDS.map((k) => <option key={k.id} value={k.id}>{k[locale]}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">{pt.titleField}</span>
        <input className="field" name="title" required minLength={3} maxLength={120} defaultValue={p?.title ?? ''} />
      </label>
      <label className="block">
        <span className="label">{pt.summaryField}</span>
        <textarea className="field min-h-20" name="summary" required minLength={10} maxLength={500} defaultValue={p?.summary ?? ''} />
      </label>
      <label className="block">
        <span className="label">{pt.detailsField}</span>
        <textarea className="field min-h-32" name="details" maxLength={4000} defaultValue={p?.details ?? ''} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{pt.hoursField}</span>
          <input className="field" name="duration_hours" type="number" inputMode="numeric" min={1} max={24} defaultValue={p?.duration_hours ?? ''} />
        </label>
        <label className="block">
          <span className="label">{pt.daysField}</span>
          <input className="field" name="duration_days" type="number" inputMode="numeric" min={1} max={30} defaultValue={p?.duration_days ?? ''} />
        </label>
        <label className="block">
          <span className="label">{pt.priceField}</span>
          <input className="field" name="price_usd" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={p?.price_usd ?? ''} />
        </label>
        <label className="block">
          <span className="label">{pt.pricePerField}</span>
          <select className="field" name="price_per" defaultValue={p?.price_per ?? 'person'}>
            <option value="person">{pt.person}</option>
            <option value="group">{pt.group}</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{pt.maxGroupField}</span>
          <input className="field" name="max_group" type="number" inputMode="numeric" min={1} max={60} defaultValue={p?.max_group ?? ''} />
        </label>
        <label className="block">
          <span className="label">{pt.meetingField}</span>
          <input className="field" name="meeting_point" maxLength={200} defaultValue={p?.meeting_point ?? ''} />
        </label>
      </div>
      <label className="block">
        <span className="label">{pt.includesField}</span>
        <textarea className="field min-h-24" name="includes" maxLength={1500} defaultValue={p?.includes.join('\n') ?? ''} />
      </label>
      <div>
        <span className="label">{pt.photoField}</span>
        <DirectUpload
          name="photo_path"
          bucket="avatars"
          userId={userId}
          prefix="package"
          accept="image/jpeg,image/png,image/webp"
          labels={{ uploading: t.chats.uploading, uploaded: t.chats.uploaded, error: t.chats.uploadError }}
        />
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton className="btn">{pt.submit}</SubmitButton>
        <button className="btn-outline" name="draft" value="1">{pt.saveDraft}</button>
      </div>
    </form>
  );
}
