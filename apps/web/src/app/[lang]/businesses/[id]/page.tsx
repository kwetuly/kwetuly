import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { BUSINESS_TYPES, ORDER_TYPES } from '@rafrika/shared';
import { pageMeta } from '@/lib/seo';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getBusiness } from '@/lib/businesses';
import { today } from '@/lib/today';
import { BusinessBadge } from '@/components/business-card';
import { askBusiness } from './actions';

export async function generateMetadata({ params }: PageProps<'/[lang]/businesses/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) return {};
  return pageMeta({ path: `/businesses/${id}`, title: business.business_name, description: business.story?.slice(0, 160) ?? business.base_region, image: business.photo_url ?? undefined });
}

export default async function BusinessPage(props: PageProps<'/[lang]/businesses/[id]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse px-4 py-10" />}>
      <Content {...props} t={t} locale={locale} />
    </Suspense>
  );
}

async function Content({ params, searchParams, t, locale }: PageProps<'/[lang]/businesses/[id]'> & { t: Dictionary; locale: Locale }) {
  const { id } = await params;
  const [business, status, now] = await Promise.all([getBusiness(id), searchParams, today()]);
  if (!business) notFound();
  const bt = t.business;
  const isShop = ORDER_TYPES.includes(business.business_type);
  const photos = [business.photo_url, ...business.photos].filter((p): p is string => !!p).slice(0, 7);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <p className="text-sm font-semibold text-leaf-dark">{BUSINESS_TYPES.find((b) => b.id === business.business_type)?.[locale]}</p>
        <h1 className="mt-1 text-3xl font-bold">{business.business_name}</h1>
        <p className="mt-2 flex items-center gap-1 text-muted">
          <MapPin className="size-4" aria-hidden /> {[business.location, business.base_region].filter(Boolean).join(', ')}
        </p>
        {photos.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((src, i) => (
              <Image key={src} src={src} alt="" width={400} height={300} className={`h-40 w-full rounded-[5px] object-cover ${i === 0 ? 'col-span-2 h-64 sm:col-span-3' : ''}`} />
            ))}
          </div>
        )}
        <div className="mt-6">
          <BusinessBadge business={business} t={t} locale={locale} today={now.toISOString().slice(0, 10)} full />
        </div>
        {business.has_referral_agreement && <p className="mt-3 text-sm text-muted">{bt.commissionNote}</p>}
        {business.story && <p className="mt-6 whitespace-pre-line leading-relaxed">{business.story}</p>}
        {business.website && (
          <a href={business.website} target="_blank" rel="nofollow noopener" className="mt-4 inline-flex items-center gap-1 font-semibold text-forest underline">
            {bt.website} <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>

      <aside id="ask" className="card h-fit scroll-mt-28">
        <h2 className="text-lg font-semibold">{(isShop ? bt.orderTitle : bt.askTitle).replace('{name}', business.business_name)}</h2>
        <p className="mt-1 text-sm text-muted">{isShop ? bt.orderBody : bt.askBody}</p>
        {status.sent ? (
          <p className="mt-4 rounded-[5px] bg-mint p-4 text-forest">{bt.sent}</p>
        ) : (
          <form action={askBusiness} className="mt-4 space-y-3">
            {status.error && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="provider_id" value={business.id} />
            <label className="block">
              <span className="label">{t.profile.name}</span>
              <input className="field" name="name" required maxLength={120} autoComplete="name" />
            </label>
            <label className="block">
              <span className="label">{t.profile.contact}</span>
              <input className="field" name="contact" required maxLength={160} />
            </label>
            {isShop && (
              <>
                <fieldset className="space-y-2">
                  {(['deliver', 'collect'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="order_mode" value={mode} defaultChecked={mode === 'deliver'} className="size-4 accent-forest" />
                      {mode === 'deliver' ? bt.orderDeliver : bt.orderCollect}
                    </label>
                  ))}
                </fieldset>
                <label className="block">
                  <span className="label">{bt.orderWhere}</span>
                  <input className="field" name="order_where" maxLength={300} />
                </label>
              </>
            )}
            <label className="block">
              <span className="label">{isShop ? bt.orderWhat : t.profile.message}</span>
              <textarea className="field min-h-28" name="message" required maxLength={2000} />
            </label>
            <button className="btn w-full" data-track="business_send_enquiry">{t.profile.send}</button>
          </form>
        )}
      </aside>
    </div>
  );
}
