import type { Href } from 'expo-router';
import { ALL_SECTIONS, type MenuItem, type MenuSection } from '@rafrika/shared';

// Turns a website menu link into the matching app screen, so the app offers the same sections as the site.
export function appHref(section: MenuSection, item: MenuItem): Href {
  const href = item.href;
  if (!href) return { pathname: '/soon/[section]/[item]', params: { section: section.slug, item: item.slug } };
  const [path, query = ''] = href.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  switch (path) {
    case '/guides':
      return { pathname: '/guides', params };
    case '/tours':
      return { pathname: '/trips', params: { ...params, view: 'tours' } };
    case '/operators':
      return '/operators';
    case '/places':
      return '/places';
    case '/group-trips':
      return '/trips';
    case '/group-trips/new':
      return '/group-trip/new';
    case '/calls':
      return '/calls';
    case '/jobs/post':
      return { pathname: '/jobs-post', params };
    case '/partners/agents':
      return '/partners';
    case '/requests/new':
      return '/request/new';
    case '/requests':
      return '/requests';
    case '/moments':
      return '/moments';
    case '/join':
      return { pathname: '/sign-in', params: { mode: 'join' } };
    case '/packages':
      return { pathname: '/packages', params };
    case '/travel-info':
      return '/travel-info';
    default:
      // A whole section (e.g. "/transport"): its own screen with all its links.
      if (/^\/[a-z-]+$/.test(path) && ALL_SECTIONS.some((s) => `/${s.slug}` === path)) return { pathname: '/section/[slug]', params: { slug: path.slice(1) } };
      return { pathname: '/soon/[section]/[item]', params: { section: section.slug, item: item.slug } };
  }
}
