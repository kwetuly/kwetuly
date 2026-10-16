// Public address of the site, used for the sitemap and links in shared content.
// Set NEXT_PUBLIC_SITE_URL when deploying (e.g. https://rafrika.com).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rafrika.com').replace(/\/$/, '');

// Search engines may index the site only when NEXT_PUBLIC_INDEXING is "on". While Rafrika is
// invite-only it is unset: robots.txt disallows everything, the sitemap is empty and every page
// says noindex. Set NEXT_PUBLIC_INDEXING=on (and rebuild) at public launch.
export const INDEXING_ON = process.env.NEXT_PUBLIC_INDEXING === 'on';

// Where people can write to the Rafrika team (for example when a group trip was not approved).
// Set NEXT_PUBLIC_SUPPORT_EMAIL to the real team address; "contact Rafrika" links stay hidden until then.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;
