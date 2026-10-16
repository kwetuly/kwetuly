import type { MetadataRoute } from 'next';
import { ALL_SECTIONS } from '@rafrika/shared';
import { locales } from '@/i18n/config';
import { listGuides } from '@/lib/guides';
import { listOperators, listPlaces, listTours } from '@/lib/trips';
import { listGroupTrips } from '@/lib/groups';
import { INDEXING_ON, SITE_URL } from '@/lib/site';

// Every public page in every language: home, sections, menu pages, published trips and public guides.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Empty while Rafrika is invite-only (NEXT_PUBLIC_INDEXING not "on").
  if (!INDEXING_ON) return [];
  const [guides, trips, groups, operators, places] = await Promise.all([listGuides({}), listTours(), listGroupTrips(), listOperators(), listPlaces()]);

  const paths = new Set<string>(['', '/guides', '/tours', '/calls', '/partners/agents', '/group-trips', '/operators', '/places', '/moments', '/join']);
  for (const section of ALL_SECTIONS) {
    paths.add(`/${section.slug}`);
    for (const item of section.items) {
      // Filtered lists (e.g. /guides?expertise=vip) are covered by their base page.
      if (!item.href) paths.add(`/${section.slug}/${item.slug}`);
    }
  }
  for (const trip of trips) paths.add(`/tours/${trip.slug}`);
  for (const place of places) paths.add(`/places/${place.slug}`);
  for (const operator of operators) paths.add(`/operators/${operator.slug}`);
  for (const group of groups) paths.add(`/group-trips/${group.id}`);
  for (const guide of guides) paths.add(`/guides/${guide.slug}`);

  return [...paths].flatMap((path) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`])) },
    })),
  );
}
