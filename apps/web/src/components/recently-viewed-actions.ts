'use server';

import { getGuideBySlug } from '@/lib/guides';
import { getTripForViewer } from '@/lib/trips';

// Of the links saved in "Pick up where you left off", returns the ones that still open for this
// visitor. Guides that were removed or hidden and tours that no longer exist are dropped.
export async function liveRecentLinks(hrefs: unknown): Promise<string[]> {
  if (!Array.isArray(hrefs)) return [];
  const list = hrefs.filter((h): h is string => typeof h === 'string').slice(0, 12);
  const checks = await Promise.all(
    list.map(async (href) => {
      const match = /^\/[a-z]{2}\/(guides|tours)\/([^/?#]{1,120})$/.exec(href);
      if (!match) return false;
      try {
        const slug = decodeURIComponent(match[2]);
        return match[1] === 'guides' ? !!(await getGuideBySlug(slug)) : !!(await getTripForViewer(slug));
      } catch {
        // Could not check just now (bad link or no connection): keep it rather than lose it.
        return true;
      }
    }),
  );
  return list.filter((_, i) => checks[i]);
}
