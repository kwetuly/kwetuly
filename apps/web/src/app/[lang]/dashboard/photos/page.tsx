import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MEDIA_COLUMNS, uploadsText, type MediaItem, type UploadsText } from '@kwetuly/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MediaField } from '@/components/upload/media-field';

export async function generateMetadata(): Promise<Metadata> {
  return { title: uploadsText(await getLocale()).title, robots: { index: false } };
}

// Guide photo manager (slice S4): the cover photo and up to 12 photos for the guide's own page. They
// are shown at once and checked by Kwetuly afterwards. The public page shows them from slice S6.
export default async function PhotosPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const u = uploadsText(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline">{t.nav.dashboard}</Link>
      <h1 className="mt-2 text-3xl font-bold">{u.title}</h1>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} u={u} dashboard={t.nav.dashboard} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="mt-6 space-y-6">
      <div className="h-16 animate-pulse rounded-[5px] bg-line" />
      <div className="aspect-[3/1] animate-pulse rounded-[5px] bg-line" />
      <div className="h-64 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

async function Content({ locale, u, dashboard }: { locale: Locale; u: UploadsText; dashboard: string }) {
  const user = await requireUser(locale, `/${locale}/dashboard/photos`);
  if (!user.guide) {
    return (
      <div className="card mt-6 space-y-4">
        <p>{u.forGuidesOnly}</p>
        <Link href={`/${locale}/dashboard`} className="btn-outline">{dashboard}</Link>
      </div>
    );
  }
  const supabase = await createClient();
  const [media, setting] = await Promise.all([
    supabase
      .from('media')
      .select(MEDIA_COLUMNS)
      .eq('subject_kind', 'guide')
      .eq('subject_id', user.guide.id)
      .in('field', ['cover', 'gallery'])
      .not('state', 'in', '(removed,uploading)')
      .order('sort'),
    // Until S1's feature helper lands: only an explicit "off" hides this page.
    supabase.from('site_settings').select('value').eq('key', 'feature.cover_gallery').maybeSingle<{ value: { on?: boolean } }>(),
  ]);
  if (setting.data?.value?.on === false) {
    return <p className="card mt-6">{u.switchedOff}</p>;
  }
  if (media.error) {
    return (
      <div className="card mt-6 space-y-4" role="alert">
        <p>{u.loadError}</p>
        <Link href={`/${locale}/dashboard/photos`} className="btn-outline">{u.retryLoad}</Link>
      </div>
    );
  }
  const rows = (media.data ?? []) as MediaItem[];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return (
    <div className="mt-2 space-y-6">
      <p className="text-muted">{u.intro}</p>
      <MediaField field="cover" subjectKind="guide" subjectId={user.guide.id} initial={rows.filter((r) => r.field === 'cover')} locale={locale} supabaseUrl={supabaseUrl} />
      <MediaField field="gallery" subjectKind="guide" subjectId={user.guide.id} initial={rows.filter((r) => r.field === 'gallery')} locale={locale} supabaseUrl={supabaseUrl} />
      <p className="text-sm text-muted">{u.checkedAfter}</p>
    </div>
  );
}
