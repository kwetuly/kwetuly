import Link from 'next/link';
import { getDictionary, getLocale } from '@/i18n/dictionaries';

// Shown for unknown links and for guides, tours or places that no longer exist.
export default async function NotFound() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <title>{`${t.ux.notFoundMeta} · Rafrika`}</title>
      <h1 className="text-3xl font-bold">{t.ux.notFoundTitle}</h1>
      <p className="mt-3 text-muted">{t.ux.notFoundBody}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={`/${locale}/guides`} className="btn">{t.nav.guides}</Link>
        <Link href={`/${locale}/tours`} className="btn-outline">{t.tours.title}</Link>
      </div>
      <Link href={`/${locale}`} className="mt-6 inline-block text-sm font-semibold text-leaf-dark underline">{t.ux.goHome}</Link>
    </div>
  );
}
