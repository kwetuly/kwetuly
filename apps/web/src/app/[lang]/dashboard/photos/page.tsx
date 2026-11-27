import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { MEDIA_COLUMNS, guideProgressText, uploadsText, type MediaItem, type UploadsText } from '@kwetuly/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { featureOn } from '@/lib/features';
import { signupReturn, signupReturnHref } from '@/lib/guide-steps';
import { createClient } from '@/lib/supabase/server';
import { MediaField } from '@/components/upload/media-field';

export async function generateMetadata(): Promise<Metadata> {
  return { title: uploadsText(await getLocale()).title, robots: { index: false } };
}

// Guide photo manager (slice S4): the cover photo and up to 12 photos for the guide's own page. They
// are shown at once and checked by Kwetuly afterwards. The public page shows them from slice S6.
export default async function PhotosPage({ searchParams }: PageProps<'/[lang]/dashboard/photos'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const u = uploadsText(locale);
  const plain = <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline">{t.nav.dashboard}</Link>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={plain}>
        <SignupBackLink locale={locale} searchParams={searchParams} fallback={plain} />
      </Suspense>
      <h1 className="mt-2 text-3xl font-bold">{u.title}</h1>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} u={u} dashboard={t.nav.dashboard} />
      </Suspense>
    </div>
  );
}

// Reached from the "Your page" sign-up step (?next=story): the way back goes to that step.
async function SignupBackLink({ locale, searchParams, fallback }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>>; fallback: ReactNode }) {
  const next = signupReturn((await searchParams).next);
  if (!next) return fallback;
  return <Link href={signupReturnHref(locale, next)} className="text-sm font-semibold text-forest underline">{guideProgressText(locale).backToSignup}</Link>;
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
  const [media, on] = await Promise.all([
    supabase
      .from('media')
      .select(MEDIA_COLUMNS)
      .eq('subject_kind', 'guide')
      .eq('subject_id', user.guide.id)
      .in('field', ['cover', 'gallery'])
      .not('state', 'in', '(removed,uploading)')
      .order('sort'),
    // feature.cover_gallery, read like the database (missing row = off): start_media_upload() refuses
    // cover and gallery photos while it is off (QA M1).
    featureOn('cover_gallery'),
  ]);
  if (!on) {
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
