import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { TRIP_CIRCUITS, TRIP_KINDS } from '@rafrika/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateTrip } from './actions';

export const metadata: Metadata = { title: 'Admin: trips', robots: { index: false } };

type AdminTrip = {
  id: string;
  slug: string;
  title_en: string;
  circuit: string;
  kind: string;
  days: number;
  status: string;
  operated_by: string;
  price_from_usd: number | null;
  is_signature: boolean;
  trip_partners: { company_name: string; tala_licence: string | null; contact: string | null; commission_note: string | null } | null;
};

export default async function AdminTripsPage() {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold">Trips</h1>
        <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">← Guides & jobs</Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Review each trip, set a price (or leave it empty for “price on request”), record the licensed partner that runs it, then publish.
        Switch “Operated by” to Rafrika once the company holds its own licence.
      </p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-surface" />}>
        <TripList locale={locale} />
      </Suspense>
    </div>
  );
}

async function TripList({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);

  const supabase = await createClient();
  const { data } = await supabase
    .from('trips')
    .select('id, slug, title_en, circuit, kind, days, status, operated_by, price_from_usd, is_signature, trip_partners(company_name, tala_licence, contact, commission_note)')
    .order('sort_order')
    .returns<AdminTrip[]>();
  const trips = data ?? [];
  const counts = { published: trips.filter((x) => x.status === 'published').length, draft: trips.filter((x) => x.status === 'draft').length };

  return (
    <>
      <p className="mt-4 text-sm font-semibold">Published: {counts.published} · Drafts: {counts.draft}</p>
      <div className="mt-6 space-y-4">
        {trips.map((trip) => (
          <form key={trip.id} id={trip.id} action={updateTrip} className="card grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="trip_id" value={trip.id} />
            <div>
              <Link href={`/${locale}/tours/${trip.slug}`} className="font-bold hover:text-sunset">{trip.title_en}</Link>
              <p className="mt-1 text-xs text-muted">
                {TRIP_CIRCUITS.find((c) => c.id === trip.circuit)?.en} · {TRIP_KINDS.find((k) => k.id === trip.kind)?.en} · {trip.days} days
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <select name="status" defaultValue={trip.status} className="field w-auto py-2">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <label className="flex items-center gap-1.5 font-semibold">
                  <input type="checkbox" name="is_signature" defaultChecked={trip.is_signature} className="size-4 accent-sunset" /> Signature
                </label>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <select name="operated_by" defaultValue={trip.operated_by} className="field py-2">
                <option value="partner">Operated by licensed partner</option>
                <option value="rafrika">Operated by Rafrika</option>
                <option value="guide">Led by a Rafrika guide</option>
              </select>
              <input name="price_from_usd" type="number" min={0} step="1" defaultValue={trip.price_from_usd ?? ''} placeholder="Price from (USD)" className="field py-2" />
            </div>
            <div className="space-y-2 text-sm">
              <input name="company_name" defaultValue={trip.trip_partners?.company_name ?? ''} placeholder="Partner company" className="field py-2" />
              <input name="tala_licence" defaultValue={trip.trip_partners?.tala_licence ?? ''} placeholder="Partner TALA licence no." className="field py-2" />
              <input name="contact" defaultValue={trip.trip_partners?.contact ?? ''} placeholder="Partner contact" className="field py-2" />
              <input name="commission_note" defaultValue={trip.trip_partners?.commission_note ?? ''} placeholder="Commission / referral terms" className="field py-2" />
            </div>
            <div className="lg:col-span-3">
              <button className="btn px-5 py-2 text-sm">Save</button>
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
