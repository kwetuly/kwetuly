import type { MetadataRoute } from 'next';
import { INDEXING_ON, SITE_URL } from '@/lib/site';

// Private areas (accounts, messages, admin, Guide Hub) are kept out of search results.
// While Kwetuly is invite-only (NEXT_PUBLIC_INDEXING not "on") the whole site is.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXING_ON) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/*/dashboard', '/*/messages', '/*/admin', '/*/hub', '/*/chats', '/*/welcome', '/auth/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
