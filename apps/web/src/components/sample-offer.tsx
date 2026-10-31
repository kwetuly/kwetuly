import Image from 'next/image';
import { USER_LINK_REL, catalogueText, sampleMediaPaths, type PhotoCredit, type SampleListing } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';
import { getPhotoCredits, getSampleListings } from '@/lib/businesses';

// Read-only "What they offer" list on a SAMPLE business page (security finding F1: real owners'
// items are not shown until the catalogue review rules exist; the query filters on is_sample too).
export async function SampleOffer({ providerId, sampleLabel, locale }: { providerId: string; sampleLabel: string; locale: Locale }) {
  const c = catalogueText(locale);
  let items: SampleListing[];
  try {
    items = await getSampleListings(providerId);
  } catch {
    return (
      <section className="mt-8" aria-labelledby="offer-title">
        <h2 id="offer-title" className="text-xl font-bold">{c.whatTheyOffer}</h2>
        <p role="alert" className="mt-2 rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{c.loadError}</p>
      </section>
    );
  }
  // Empty: nothing to show, so the section is left out.
  if (items.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="offer-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="offer-title" className="text-xl font-bold">{c.whatTheyOffer}</h2>
        <span className="rounded-[5px] bg-sand px-2 py-0.5 text-xs font-semibold text-charcoal">{sampleLabel}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{c.sampleItemsNote}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const photo = item.photos[0];
          return (
            <li key={item.id} className="flex gap-3 rounded-[5px] border border-line bg-white p-3">
              {photo && <Image src={photo} alt={item.title} width={96} height={96} sizes="96px" className="size-20 shrink-0 rounded-[5px] object-cover sm:size-24" />}
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">{item.title}</h3>
                {item.description && <p className="mt-1 text-sm">{item.description}</p>}
                {item.price_note && <p className="mt-1 text-xs text-muted">{item.price_note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <PhotoCredits urls={items.flatMap((i) => i.photos)} locale={locale} />
    </section>
  );
}

// "Photo credits": the credit line and source of each stock photo on a sample page. Shows nothing
// for photos that are not in the sample-media bucket, or while the credits table is missing.
export async function PhotoCredits({ urls, locale }: { urls: (string | null | undefined)[]; locale: Locale }) {
  const paths = sampleMediaPaths(urls);
  if (paths.length === 0) return null;
  let credits: PhotoCredit[] = [];
  try {
    credits = await getPhotoCredits(paths);
  } catch {
    return null;
  }
  if (credits.length === 0) return null;
  const c = catalogueText(locale);
  const ordered = paths.map((p) => credits.find((x) => x.path === p)).filter((x): x is PhotoCredit => !!x);
  return (
    <details className="mt-4 text-xs text-muted">
      <summary className="cursor-pointer rounded-[5px] font-semibold text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
        {c.photoCredits} ({ordered.length})
      </summary>
      <p className="mt-2">{c.photoCreditsNote}</p>
      <ul className="mt-2 space-y-1">
        {ordered.map((x) => (
          <li key={x.path} className="break-words">
            {x.credit}.{' '}
            <a href={x.source_url} target="_blank" rel={USER_LINK_REL} className="underline">
              {c.source}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
