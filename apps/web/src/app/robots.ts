import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Private areas (accounts, messages, admin, Guide Hub) are kept out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/*/dashboard', '/*/messages', '/*/admin', '/*/hub', '/auth/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
