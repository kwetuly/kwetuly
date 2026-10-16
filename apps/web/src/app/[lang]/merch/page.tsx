import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ShoppingBag } from 'lucide-react';
import { MERCH_ENABLED } from '@rafrika/shared';
import { pageMeta } from '@/lib/seo';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getMerchShopId, listProducts, type Product } from '@/lib/merch';
import { orderMerch } from './actions';
import { PrefillContact } from '@/components/prefill-contact';
import { SubmitButton } from '@/components/submit-button';

export async function generateMetadata(): Promise<Metadata> {
  if (!MERCH_ENABLED) return {};
  const t = await getDictionary();
  return pageMeta({ path: '/merch', title: t.extras.merchTitle, description: t.extras.merchSubtitle });
}

const tzs = (n: number) => `TSh ${n.toLocaleString('en-US')}`;

// Rafrika t-shirts, caps and more. Products and prices are managed in /admin/shop.
export default async function MerchPage(props: PageProps<'/[lang]/merch'>) {
  // Hidden during the invite-only soft launch (MERCH_ENABLED in packages/shared/src/menu.ts).
  if (!MERCH_ENABLED) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const x = t.extras;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="flex items-center gap-2 text-4xl font-extrabold">
        <ShoppingBag className="size-8 text-leaf-dark" aria-hidden /> {x.merchTitle}
      </h1>
      <p className="mt-3 text-lg text-muted">{x.merchSubtitle}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Content {...props} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams, t, locale }: PageProps<'/[lang]/merch'> & { t: Dictionary; locale: Locale }) {
  const [products, shopId, status] = await Promise.all([listProducts(), getMerchShopId(), searchParams]);
  const x = t.extras;
  const bt = t.business;
  if (products.length === 0 || !shopId) return <p className="mt-8 text-muted">{x.merchNone}</p>;
  const sizes = [...new Set(products.flatMap((p) => p.sizes))];

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="grid gap-5 sm:grid-cols-2">
        {products.map((p: Product) => (
          <li key={p.id} className="card flex flex-col gap-2">
            {p.photo_url && (
              <div className="relative -mx-5 -mt-5 mb-2 h-56 overflow-hidden rounded-t-[5px] bg-surface">
                <Image src={p.photo_url} alt={p.name} fill unoptimized sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />
              </div>
            )}
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="font-semibold text-leaf-dark">{p.price_tzs != null ? tzs(p.price_tzs) : x.priceOnRequest}</p>
            {p.description && <p className="text-sm text-muted">{p.description}</p>}
            {p.sizes.length > 0 && <p className="text-sm">{x.merchSize}: {p.sizes.join(', ')}</p>}
          </li>
        ))}
      </ul>

      <aside id="order" className="card h-fit scroll-mt-28">
        <h2 className="text-lg font-semibold">{x.merchOrder}</h2>
        <p className="mt-1 text-sm text-muted">{bt.orderBody}</p>
        {status.sent ? (
          <p className="mt-4 rounded-[5px] bg-mint p-4 text-forest">{bt.sent}</p>
        ) : (
          <form action={orderMerch} className="mt-4 space-y-3">
            {status.error && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
            <input type="hidden" name="locale" value={locale} />
            <label className="block">
              <span className="label">{x.merchOrder}</span>
              <select name="product" className="field" required>
                {products.map((p) => <option key={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {sizes.length > 0 && (
                <label className="block">
                  <span className="label">{x.merchSize}</span>
                  <select name="size" className="field" defaultValue="">
                    <option value="">—</option>
                    {sizes.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="label">{x.merchQty}</span>
                <input name="qty" type="number" min={1} max={50} defaultValue={1} className="field" />
              </label>
            </div>
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
              <input name="order_where" className="field" maxLength={300} />
            </label>
            <label className="block">
              <span className="label">{t.profile.name}</span>
              <input name="name" className="field" required maxLength={120} autoComplete="name" />
              <PrefillContact />
            </label>
            <label className="block">
              <span className="label">{t.profile.contact}</span>
              <input name="contact" className="field" required maxLength={160} />
            </label>
            <label className="block">
              <span className="label">{x.merchNote}</span>
              <textarea name="message" className="field min-h-20" maxLength={1000} />
            </label>
            <SubmitButton className="btn w-full" data-track="merch_order">{t.profile.send}</SubmitButton>
          </form>
        )}
      </aside>
    </div>
  );
}
