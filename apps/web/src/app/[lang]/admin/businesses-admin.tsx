import Link from 'next/link';
import { BADGE_CHECKS, BUSINESS_TYPES, USER_LINK_REL, normaliseWebsite } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { getBadgeFee } from '@/lib/businesses';
import { createClient } from '@/lib/supabase/server';
import { grantBadge, reviewBusiness, setBadgeFee } from './actions';

type AdminBusiness = {
  id: string;
  business_name: string;
  business_type: string;
  base_region: string;
  location: string | null;
  story: string | null;
  website: string | null;
  photo_url: string | null;
  provider_private: { whatsapp_number: string | null; licence_document_path: string | null } | null;
  verification_status: string;
  badge_requested_at: string | null;
  updated_at: string;
};

// Business listings waiting for approval, badge check requests, and the yearly badge fee.
export async function BusinessesAdmin({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const columns = 'id, business_name, business_type, base_region, location, story, website, photo_url, verification_status, badge_requested_at, updated_at, provider_private(whatsapp_number, licence_document_path)';
  const [pending, requests, fee] = await Promise.all([
    supabase.from('providers').select(columns).eq('verification_status', 'pending').order('created_at').returns<AdminBusiness[]>(),
    supabase.from('providers').select(columns).not('badge_requested_at', 'is', null).order('badge_requested_at').returns<AdminBusiness[]>(),
    getBadgeFee(),
  ]);
  // Licence documents are private: give the admin a short-lived link.
  const all = [...(pending.data ?? []), ...(requests.data ?? [])];
  const links = new Map<string, string>();
  await Promise.all(
    all
      .filter((b) => b.provider_private?.licence_document_path)
      .map(async (b) => {
        const { data } = await supabase.storage.from('verification').createSignedUrl(b.provider_private!.licence_document_path!, 600);
        if (data) links.set(b.id, data.signedUrl);
      }),
  );

  const details = (b: AdminBusiness) => {
    const website = b.website ? normaliseWebsite(b.website) : null;
    return (
    <>
      <p className="text-xs font-semibold text-leaf-dark">{BUSINESS_TYPES.find((x) => x.id === b.business_type)?.en}</p>
      <h3 className="text-lg font-bold">{b.business_name}</h3>
      <p className="text-sm text-muted">{[b.location, b.base_region].filter(Boolean).join(', ')} · WhatsApp {b.provider_private?.whatsapp_number ?? 'not given'}</p>
      {b.story && <p className="whitespace-pre-line text-sm">{b.story}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        {website?.ok && <a href={website.url} target="_blank" rel={USER_LINK_REL} className="text-forest underline">Website: {website.host}</a>}
        {website && !website.ok && <span className="break-all text-red-800">Website not valid, not shown to travellers: {b.website}</span>}
        {b.photo_url && <a href={b.photo_url} target="_blank" rel={USER_LINK_REL} className="text-forest underline">Photo</a>}
        {links.get(b.id) ? <a href={links.get(b.id)} target="_blank" rel="noopener" className="text-forest underline">Business licence</a> : <span className="text-muted">No licence uploaded</span>}
      </div>
    </>
    );
  };

  return (
    <section id="businesses" className="mt-12">
      <h2 className="text-2xl font-bold">Businesses ({pending.data?.length ?? 0} to approve, {requests.data?.length ?? 0} badge requests)</h2>

      <form action={setBadgeFee} className="card mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="label">Yearly badge fee in USD (empty = “ask Kwetuly”)</span>
          <input className="field w-40" name="amount_usd" type="number" min={0} step="1" defaultValue={fee ?? ''} />
        </label>
        <button className="btn-outline px-4 py-2 text-sm">Save fee</button>
      </form>

      {(pending.data ?? []).length === 0 && <p className="mt-4 text-muted">No businesses waiting for review.</p>}
      <ul className="mt-4 space-y-4">
        {(pending.data ?? []).map((b) => (
          <li key={b.id} className="card space-y-2">
            {details(b)}
            <form action={reviewBusiness} className="flex gap-3 pt-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="provider_id" value={b.id} />
              <input type="hidden" name="updated_at" value={b.updated_at} />
              <button name="decision" value="approve" className="btn px-4 py-2 text-sm">{t.admin.approve}</button>
              <button name="decision" value="reject" className="btn-outline px-4 py-2 text-sm">{t.admin.reject}</button>
            </form>
          </li>
        ))}
      </ul>

      {(requests.data ?? []).length > 0 && <h3 className="mt-8 text-lg font-bold">Badge check requests</h3>}
      <p className="mt-1 text-sm text-muted">
        Tick only what you actually checked, after the fee is paid. The badge then shows for one year with exactly these checks. Untick everything to close a request without a badge.
      </p>
      <ul className="mt-4 space-y-4">
        {(requests.data ?? []).map((b) => (
          <li key={b.id} className="card space-y-2 bg-sand">
            {details(b)}
            {b.verification_status === 'approved' && (
              <Link href={`/${locale}/businesses/${b.id}`} className="text-sm text-forest underline">Public listing</Link>
            )}
            <form action={grantBadge} className="space-y-3 pt-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="provider_id" value={b.id} />
              <fieldset className="flex flex-wrap gap-3">
                {BADGE_CHECKS.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="checks" value={c.id} className="size-4 accent-forest" /> {c.en}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="label">Internal note (payment reference, who checked)</span>
                <input className="field" name="note" maxLength={500} />
              </label>
              <button className="btn px-4 py-2 text-sm">Save check</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
