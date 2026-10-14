import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Camera } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { PhotoHero } from '@/components/photo-hero';
import { ShareButtons } from '@/components/share-buttons';
import { listMoments, shortName } from '@/lib/chats';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.moments.title, description: t.moments.subtitle };
}

// Public gallery: only items the traveller agreed to share, that Rafrika featured, and that
// nobody in the chat objected to (enforced by the database, not just this page).
export default async function MomentsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo="elephantsBalloon">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14">
          <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf">
            <Camera className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-4xl font-extrabold sm:text-5xl">{t.moments.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{t.moments.subtitle}</p>
        </div>
      </PhotoHero>
      <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-6xl animate-pulse rounded-[5px] bg-surface" />}>
        <Gallery t={t} locale={locale} />
      </Suspense>
    </>
  );
}

async function Gallery({ t, locale }: { t: Dictionary; locale: Locale }) {
  const moments = await listMoments();
  if (moments.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-lg text-muted">{t.moments.none}</p>
        <Link href={`/${locale}/guides`} className="btn mt-5">{t.moments.cta}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {moments.map((m) => (
          <figure key={m.id} className="mb-5 break-inside-avoid overflow-hidden rounded-[5px] border border-line bg-white shadow-sm">
            {m.media_url && m.media_type === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element -- signed link to a consented, featured file
              <img src={m.media_url} alt={m.body ?? t.moments.title} className="w-full object-cover" loading="lazy" />
            )}
            {m.media_url && m.media_type === 'video' && <video src={m.media_url} controls playsInline preload="metadata" className="w-full bg-black" />}
            <figcaption className="space-y-2 p-4">
              {m.body && <p className="whitespace-pre-line">{m.body}</p>}
              <p className="text-xs text-muted">{t.moments.sharedBy} {shortName(m.sender_name)}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-8">
        <ShareButtons path={`/${locale}/moments`} title={t.moments.title} text={t.moments.subtitle} labels={t.share} />
      </div>
    </div>
  );
}
