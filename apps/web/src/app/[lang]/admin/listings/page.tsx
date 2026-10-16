import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BUSINESS_TYPES, REGIONS } from '@rafrika/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { deleteAllSamples, deleteListing, saveListing } from './actions';

export const metadata: Metadata = { title: 'Listings', robots: { index: false } };

type Listing = {
  id: string;
  business_name: string;
  business_type: string;
  base_region: string;
  location: string | null;
  story: string | null;
  website: string | null;
  source_url: string | null;
  photo_url: string | null;
  is_sample: boolean;
  verification_status: string;
  owner_id: string;
};

// Admin only: every business listing (hotels, apartments, car hire, shops...). Add, edit, hide or delete.
export default async function ListingsPage({ searchParams }: PageProps<'/[lang]/admin/listings'>) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
      <h1 className="mt-2 text-3xl font-bold">Business listings</h1>
      <p className="mt-1 text-muted">
        Sample listings were added from public information to test the site. They show a “Sample listing” note and enquiries come to you. Call a business before you untick “Sample”.
      </p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Content locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ListingForm({ locale, item }: { locale: Locale; item?: Listing }) {
  return (
    <form action={saveListing} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="block">
        <span className="label">Name</span>
        <input name="business_name" className="field" required maxLength={120} defaultValue={item?.business_name} />
      </label>
      <label className="block">
        <span className="label">Type</span>
        <select name="business_type" className="field" defaultValue={item?.business_type ?? 'hotel'}>
          {BUSINESS_TYPES.map((b) => <option key={b.id} value={b.id}>{b.en}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Region</span>
        <select name="base_region" className="field" defaultValue={item?.base_region ?? 'Arusha'}>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Area or street</span>
        <input name="location" className="field" maxLength={160} defaultValue={item?.location ?? ''} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Description</span>
        <textarea name="story" className="field min-h-24" maxLength={4000} defaultValue={item?.story ?? ''} />
      </label>
      <label className="block">
        <span className="label">Website (https://…)</span>
        <input name="website" type="url" className="field" maxLength={400} defaultValue={item?.website ?? ''} />
      </label>
      <label className="block">
        <span className="label">Where the information came from (https://…)</span>
        <input name="source_url" type="url" className="field" maxLength={400} defaultValue={item?.source_url ?? ''} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Photo link (https://…, only photos you may use)</span>
        <input name="photo_url" type="url" className="field" maxLength={400} defaultValue={item?.photo_url ?? ''} />
      </label>
      <div className="flex flex-wrap gap-5 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={item ? item.verification_status === 'approved' : true} className="size-4 accent-forest" /> Show on the site
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_sample" defaultChecked={item?.is_sample ?? true} className="size-4 accent-forest" /> Sample (not contacted yet)
        </label>
      </div>
      <button className="btn w-fit px-5 py-2 text-sm sm:col-span-2">{item ? 'Save changes' : 'Add listing'}</button>
    </form>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') return <p className="mt-6">Admins only.</p>;
  const params = await searchParams;
  const type = typeof params.type === 'string' ? params.type : '';
  const supabase = await createClient();
  let query = supabase
    .from('providers')
    .select('id, business_name, business_type, base_region, location, story, website, source_url, photo_url, is_sample, verification_status, owner_id')
    .order('base_region')
    .order('business_name');
  if (type) query = query.eq('business_type', type);
  const { data } = await query.returns<Listing[]>();
  const rows = data ?? [];
  const samples = rows.filter((r) => r.is_sample).length;

  return (
    <>
      {params.saved && <p className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Saved.</p>}
      {params.deleted && <p className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Deleted.</p>}
      {params.error === 'confirm' && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-red-800">Nothing was deleted. Type DELETE exactly to confirm.</p>}
      {params.error && params.error !== 'confirm' && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-red-800">Could not save. Check the name, type and region (links must start with https://).</p>}
      {(params.samples_deleted || params.samples_failed) && <SampleReport params={params} />}

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href={`/${locale}/admin/listings`} className={!type ? 'btn px-3 py-1.5 text-sm' : 'btn-outline px-3 py-1.5 text-sm'}>All</Link>
        {BUSINESS_TYPES.map((b) => (
          <Link key={b.id} href={`/${locale}/admin/listings?type=${b.id}`} className={type === b.id ? 'btn px-3 py-1.5 text-sm' : 'btn-outline px-3 py-1.5 text-sm'}>
            {b.en}
          </Link>
        ))}
      </nav>

      <details className="card mt-6">
        <summary className="cursor-pointer font-bold">Add a listing</summary>
        <div className="mt-4">
          <ListingForm locale={locale} />
        </div>
      </details>

      <h2 className="mt-8 text-xl font-bold">
        {rows.length} listings{samples > 0 && `, ${samples} samples`}
      </h2>
      <ul className="mt-4 space-y-3">
        {rows.map((b) => (
          <li key={b.id} id={`b-${b.id}`}>
            <details className="card scroll-mt-28">
              <summary className="cursor-pointer">
                <span className="font-semibold">{b.business_name}</span>{' '}
                <span className="text-sm text-muted">
                  · {BUSINESS_TYPES.find((x) => x.id === b.business_type)?.en} · {b.base_region}
                  {b.is_sample && ' · sample'}
                  {b.verification_status !== 'approved' && ` · ${b.verification_status}`}
                  {b.owner_id !== user.id && ' · owner account'}
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                {b.verification_status === 'approved' && (
                  <Link href={`/${locale}/businesses/${b.id}`} className="text-sm text-forest underline">Public page</Link>
                )}
                <ListingForm locale={locale} item={b} />
                <form action={deleteListing}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={b.id} />
                  <button className="text-sm font-semibold text-red-800 underline">Delete this listing</button>
                </form>
              </div>
            </details>
          </li>
        ))}
      </ul>

      {samples > 0 && (
        <form action={deleteAllSamples} className="card mt-10 flex flex-wrap items-end gap-3 border-red-200">
          <input type="hidden" name="locale" value={locale} />
          <label className="block">
            <span className="label">Before launch: type DELETE to remove every sample listing, sample guide, package and group trip</span>
            <input name="confirm" className="field w-48" />
          </label>
          <button className="btn-outline border-red-800 px-4 py-2 text-sm text-red-800">Delete all samples</button>
        </form>
      )}
    </>
  );
}

// Result of "Delete all samples": rows removed per table, and where it stopped if a step failed.
function SampleReport({ params }: { params: Record<string, string | string[] | undefined> }) {
  const n = (key: string) => {
    const value = Number(params[`n_${key}`]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  };
  const failed = typeof params.samples_failed === 'string' ? params.samples_failed.slice(0, 40) : '';
  const counts = `Sample listings: ${n('providers')}. Sample group trips: ${n('group_trips')}. Sample guides: ${n('guides')}. Their packages: ${n('packages')}.`;
  return failed ? (
    <p role="alert" className="mt-4 rounded-[5px] bg-red-50 p-3 text-red-800">
      Stopped: removing {failed} failed, so the remaining samples were left in place. Already removed: {counts} Check the server log and try again.
    </p>
  ) : (
    <p role="status" className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Samples removed. {counts}</p>
  );
}
