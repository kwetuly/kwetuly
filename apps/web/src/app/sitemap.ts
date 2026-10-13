import type { MetadataRoute } from 'next';
import { MENU } from '@rafrika/shared';
import { locales } from '@/i18n/config';
import { listGuides } from '@/lib/guides';
import { listTrips } from '@/lib/trips';
import { SITE_URL } from '@/lib/site';

// Every public page in every language: home, sections, menu pages, published trips and public guides.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [guides, trips] = await Promise.all([listGuides({}), listTrips({})]);

  const paths = new Set<string>(['', '/guides', '/tours', '/calls', '/partners/agents', '/join']);
  for (const section of MENU) {
    paths.add(`/${section.slug}`);
    for (const item of section.items) {
      // Filtered lists (e.g. /guides?expertise=vip) are covered by their base page.
      if (!item.href) paths.add(`/${section.slug}/${item.slug}`);
    }
  }
  for (const trip of trips) paths.add(`/tours/${trip.slug}`);
  for (const guide of guides) paths.add(`/guides/${guide.slug}`);

  return [...paths].flatMap((path) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`])) },
    })),
  );
}
