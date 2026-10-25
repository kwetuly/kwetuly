import Link from 'next/link';
import { BUSINESS_TYPES, REGIONS, formatUsd } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import type { CurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getBadgeFee } from '@/lib/businesses';
import { today } from '@/lib/today';
import { DirectUpload } from '@/components/direct-upload';
import { requestBadge, saveBusiness } from './business-actions';
import { BusinessSales } from './business-sales';
import { SubmitButton } from '@/components/submit-button';

type OwnBusiness = {
  id: string;
  business_name: string;
  business_type: string;
  base_region: string;
  location: string | null;
  story: string | null;
  website: string | null;
  photo_url: string | null;
  photos: string[];
  provider_private: { whatsapp_number: string | null; licence_document_path: string | null } | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  badge_requested_at: string | null;
  badge_checks: string[];
  badge_valid_until: string | null;
};

type Enquiry = { id: string; traveler_name: string | null; traveler_contact: string | null; message: string | null; created_at: string };

// The owner's listing (free once approved), the paid badge, and enquiries from travellers.
export async function BusinessListing({ t, locale, user, status }: { t: Dictionary; locale: Locale; user: CurrentUser; status: Record<string, string | string[] | undefined> }) {
  const bt = t.business;
  const supabase = await createClient();
  const { data: business } = await supabase
    .from('providers')
    .select('id, business_name, business_type, base_region, location, story, website, photo_url, photos, verification_status, badge_requested_at, badge_checks, badge_valid_until, provider_private(whatsapp_number, licence_document_path)')
    .eq('owner_id', user.id)
    .maybeSingle<OwnBusiness>();
  const [fee, now, enquiries] = await Promise.all([
    getBadgeFee(),
    today(),
    business
      ? supabase.from('leads').select('id, traveler_name, traveler_contact, message, created_at').eq('provider_id', business.id).order('created_at', { ascending: false }).limit(30).returns<Enquiry[]>()
      : Promise.resolve({ data: [] as Enquiry[] }),
  ]);
  const day = now.toISOString().slice(0, 10);
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const badgeValid = !!business?.badge_valid_until && business.badge_valid_until >= day && business.badge_checks.length > 0;
  const uploadLabels = { uploading: t.chats.uploading, uploaded: t.chats.uploaded, error: t.chats.uploadError };
  const statusText = business?.verification_status === 'approved' ? bt.statusApproved : business?.verification_status === 'rejected' ? bt.statusRejected : bt.statusPending;

  return (
    <section id="business" className="scroll-mt-24">
      <h1 className="text-3xl font-bold">{bt.dashboardTitle}</h1>
      {business && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[5px] bg-mint p-4 text-forest">
          <span>{statusText}</span>
          {business.verification_status === 'approved' && (
            <Link href={`/${locale}/businesses/${business.id}`} className="font-semibold underline">{bt.viewListing}</Link>
          )}
        </div>
      )}
      {status.saved && <p className="mt-4 rounded-[5px] bg-mint p-4 font-semibold text-forest">{bt.saved}</p>}
      {status.error && <p className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">{t.auth.error}</p>}

      <form action={saveBusiness} className="card mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="label">{bt.nameField}</span>
          <input className="field" name="business_name" required maxLength={120} defaultValue={business?.business_name ?? ''} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">{bt.typeField}</span>
            <select className="field" name="business_type" required defaultValue={business?.business_type ?? 'hotel'}>
              {BUSINESS_TYPES.map((b) => <option key={b.id} value={b.id}>{b[locale]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">{bt.regionField}</span>
            <select className="field" name="base_region" required defaultValue={business?.base_region ?? ''}>
              <option value="" disabled>—</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">{bt.locationField}</span>
            <input className="field" name="location" maxLength={160} defaultValue={business?.location ?? ''} />
          </label>
          <label className="block">
            <span className="label">{bt.whatsappField}</span>
            <input className="field" name="whatsapp_number" type="tel" required maxLength={30} defaultValue={business?.provider_private?.whatsapp_number ?? user.phone ?? ''} />
          </label>
        </div>
        <label className="block">
          <span className="label">{bt.storyField}</span>
          <textarea className="field min-h-32" name="story" maxLength={4000} defaultValue={business?.story ?? ''} />
        </label>
        <label className="block">
          <span className="label">{bt.websiteField}</span>
          <input className="field" name="website" type="url" maxLength={200} placeholder="https://" defaultValue={business?.website ?? ''} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">{bt.photoField}</span>
            <DirectUpload name="photo_path" bucket="avatars" userId={user.id} prefix="business" accept="image/jpeg,image/png,image/webp" labels={uploadLabels} />
          </div>
          <div>
            <span className="label">{bt.morePhotosField} ({business?.photos.length ?? 0}/6)</span>
            <DirectUpload name="extra_photo_path" bucket="avatars" userId={user.id} prefix="business-extra" accept="image/jpeg,image/png,image/webp" labels={uploadLabels} />
          </div>
        </div>
        <div>
          <span className="label">
            {bt.licenceField} {business?.provider_private?.licence_document_path ? '✓' : ''}
          </span>
          <DirectUpload name="licence_path" bucket="verification" userId={user.id} prefix="business-licence" accept="image/jpeg,image/png,image/webp,application/pdf" labels={uploadLabels} />
        </div>
        <SubmitButton className="btn">{bt.save}</SubmitButton>
      </form>

      {business && (
        <section id="badge" className="card mt-6 space-y-3 bg-sand">
          <h2 className="text-lg font-bold">{bt.badgeTitle}</h2>
          <p className="text-sm">{bt.badgeBody}</p>
          <p className="text-sm font-semibold">{fee != null ? bt.badgeFee.replace('{price}', formatUsd(fee)) : bt.badgeFeeAsk}</p>
          {badgeValid ? (
            <p className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{bt.badgeActive.replace('{date}', date.format(new Date(business.badge_valid_until!)))}</p>
          ) : (
            <>
              {business.badge_valid_until && <p className="text-sm text-red-800">{bt.badgeExpired.replace('{date}', date.format(new Date(business.badge_valid_until)))}</p>}
              {business.badge_requested_at ? (
                <p className="rounded-[5px] bg-white p-3 text-sm font-semibold">{bt.badgeRequested}</p>
              ) : (
                <form action={requestBadge}>
                  <input type="hidden" name="locale" value={locale} />
                  <SubmitButton className="btn">{bt.badgeRequest}</SubmitButton>
                </form>
              )}
            </>
          )}
        </section>
      )}

      {business && <BusinessSales providerId={business.id} t={t} locale={locale} status={status} />}

      {business && (
        <section className="card mt-6">
          <h2 className="text-lg font-bold">{bt.enquiriesTitle}</h2>
          {(enquiries.data ?? []).length === 0 ? (
            <p className="mt-2 text-muted">{bt.noEnquiries}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {(enquiries.data ?? []).map((e) => (
                <li key={e.id} className="py-3 text-sm">
                  <p className="font-semibold">
                    {e.traveler_name} · <span className="font-normal text-muted">{e.traveler_contact}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line">{e.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
