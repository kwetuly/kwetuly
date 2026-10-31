// "What they offer" on business pages (public.listings) and credit lines for sample photos
// (public.sample_media_credits, bucket 'sample-media').
//
// Security finding F1: owners can still publish listings without review, so only items of SAMPLE
// businesses are shown until the catalogue review rules exist. Every query must join
// providers!inner(is_sample) and filter providers.is_sample = true (see SAMPLE_LISTING_FILTER).

export type SampleListing = {
  id: string;
  title: string;
  description: string | null;
  photos: string[];
  price_note: string | null;
};

/** Columns for the read-only item list; the inner join lets the query filter on the parent's is_sample. */
export const SAMPLE_LISTING_COLUMNS = 'id, title, description, photos, price_note, providers!inner(is_sample)';

export type PhotoCredit = { path: string; credit: string; source_url: string; licence: string };

export const SAMPLE_MEDIA_BUCKET = 'sample-media';

const SAMPLE_MEDIA_MARKER = `/storage/v1/object/public/${SAMPLE_MEDIA_BUCKET}/`;

/** The object path ("sample/business/x/cover.webp") of a sample-media public URL, or null for any other photo. */
export function sampleMediaPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const at = url.indexOf(SAMPLE_MEDIA_MARKER);
  if (at < 0) return null;
  const path = url.slice(at + SAMPLE_MEDIA_MARKER.length).split(/[?#]/)[0];
  return /^sample\/[a-z0-9/._-]+\.(webp|jpg|png)$/.test(path) ? path : null;
}

/** Unique sample-media paths among some photo URLs (other photos are ignored). */
export function sampleMediaPaths(urls: (string | null | undefined)[]): string[] {
  return [...new Set(urls.map(sampleMediaPath).filter((p): p is string => !!p))];
}
