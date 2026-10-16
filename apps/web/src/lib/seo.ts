// Page metadata helpers (server only).
import type { Metadata } from 'next';
import { LOCALE_TAGS, locales, type Locale } from '@/i18n/config';
import { getLocale } from '@/i18n/dictionaries';
import { PHOTOS, photoUrl } from '@/lib/photos';
import { INDEXING_ON } from '@/lib/site';

type PageMeta = { path: string; title: string; description?: string | null; image?: string | null; noindex?: boolean; type?: 'website' | 'article' | 'profile' };

/** Links to the same page in every language, with this language's address as the canonical one. */
export function alternatesFor(locale: Locale, path: string): Metadata['alternates'] {
  return {
    canonical: `/${locale}${path}`,
    languages: { ...Object.fromEntries(locales.map((l) => [LOCALE_TAGS[l], `/${l}${path}`])), 'x-default': `/en${path}` },
  };
}

/** Title, description, canonical link and the preview used when the page is shared. */
export async function pageMeta({ path, title, description, image, noindex, type = 'website' }: PageMeta): Promise<Metadata> {
  const locale = await getLocale();
  const desc = description?.slice(0, 200) ?? undefined;
  return {
    title,
    description: desc,
    alternates: alternatesFor(locale, path),
    openGraph: {
      title,
      description: desc,
      url: `/${locale}${path}`,
      type,
      siteName: 'Rafrika',
      locale: locale === 'zh' ? 'zh_CN' : locale,
      images: [{ url: image ?? photoUrl(PHOTOS.safariSunset, 1200), width: 1200, height: 800 }],
    },
    twitter: { card: 'summary_large_image', title, description: desc },
    // Only set robots when needed: an undefined value would override the layout's invite-only noindex.
    ...(!INDEXING_ON ? { robots: { index: false, follow: false } } : noindex ? { robots: { index: false } } : {}),
  };
}
