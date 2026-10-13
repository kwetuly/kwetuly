// Public address of the site, used for the sitemap and links in shared content.
// Set NEXT_PUBLIC_SITE_URL when deploying (e.g. https://rafrika.com).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rafrika.com').replace(/\/$/, '');
