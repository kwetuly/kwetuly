import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { PRODUCT_COLUMNS, type Product } from '@/lib/merch';
import { createClient } from '@/lib/supabase/server';
import { createMerchShop, deleteProduct, saveProduct } from './actions';

export const metadata: Metadata = { title: 'Kwetuly Shop', robots: { index: false } };

// Admin only: Kwetuly merchandise. Orders arrive in the admin inbox as enquiries to "Kwetuly Shop".
export default async function AdminShopPage({ searchParams }: PageProps<'/[lang]/admin/shop'>) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
      <h1 className="mt-2 text-3xl font-bold">Kwetuly merchandise</h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Content locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ProductForm({ locale, item }: { locale: Locale; item?: Product }) {
  return (
    <form action={saveProduct} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="block">
        <span className="label">Product name</span>
        <input name="name" className="field" required maxLength={120} defaultValue={item?.name} />
      </label>
      <label className="block">
        <span className="label">Price in TSh (empty = price on request)</span>
        <input name="price_tzs" type="number" min={0} className="field" defaultValue={item?.price_tzs ?? ''} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Description</span>
        <textarea name="description" className="field min-h-20" maxLength={2000} defaultValue={item?.description ?? ''} />
      </label>
      <label className="block">
        <span className="label">Sizes, separated by commas (e.g. S, M, L, XL)</span>
        <input name="sizes" className="field" maxLength={200} defaultValue={item?.sizes.join(', ') ?? ''} />
      </label>
      <label className="block">
        <span className="label">Order on the page (lower first)</span>
        <input name="sort_order" type="number" className="field" defaultValue={item?.sort_order ?? 0} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Photo link (https://…)</span>
        <input name="photo_url" type="url" className="field" maxLength={400} defaultValue={item?.photo_url ?? ''} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="size-4 accent-forest" /> On sale
      </label>
      <button className="btn w-fit px-5 py-2 text-sm sm:col-span-2">{item ? 'Save changes' : 'Add product'}</button>
    </form>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') return <p className="mt-6">Admins only.</p>;
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: products }, { data: shop }] = await Promise.all([
    supabase.from('shop_products').select(PRODUCT_COLUMNS).order('sort_order').order('name').returns<Product[]>(),
    supabase.from('providers').select('id').eq('business_type', 'merch').limit(1).maybeSingle(),
  ]);

  return (
    <>
      {params.saved && <p className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Saved.</p>}
      {params.deleted && <p className="mt-4 rounded-[5px] bg-mint p-3 font-semibold text-forest">Deleted.</p>}
      {params.error && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-red-800">Could not save.</p>}
      <p className="mt-2 text-muted">
        Shown on <Link href={`/${locale}/merch`} className="underline">the merchandise page</Link>. Travellers order to their hotel or collect. You confirm the price and payment (mobile money or cash) by phone.
      </p>
      {!shop && (
        <form action={createMerchShop} className="card mt-4 flex flex-wrap items-center gap-3 bg-sand">
          <input type="hidden" name="locale" value={locale} />
          <p className="flex-1">Orders need a “Kwetuly Shop” listing to arrive in your inbox.</p>
          <button className="btn px-4 py-2 text-sm">Create Kwetuly Shop</button>
        </form>
      )}
      <div className="card mt-6">
        <h2 className="mb-3 font-bold">Add a product</h2>
        <ProductForm locale={locale} />
      </div>
      <ul className="mt-6 space-y-3">
        {(products ?? []).map((p) => (
          <li key={p.id}>
            <details className="card">
              <summary className="cursor-pointer font-semibold">
                {p.name} <span className="font-normal text-muted">· {p.price_tzs != null ? `TSh ${p.price_tzs.toLocaleString('en-US')}` : 'price on request'}{p.active ? '' : ' · hidden'}</span>
              </summary>
              <div className="mt-4 space-y-3">
                <ProductForm locale={locale} item={p} />
                <form action={deleteProduct}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-sm font-semibold text-red-800 underline">Delete this product</button>
                </form>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
