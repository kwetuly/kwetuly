import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getGuideBySlug } from '@/lib/guides';
import { GuideAvatar, languageName, specialtyName } from '@/components/guide-card';
import { requestGuide } from './actions';

export async function generateMetadata({ params }: PageProps<'/[lang]/guides/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return { title: 'Guide not found' };
  return {
    title: `${guide.display_name} — ${guide.base_region} guide`,
    description: guide.headline ?? undefined,
    robots: guide.visibility === 'link_only' ? { index: false } : undefined,
  };
}

export default async function GuideProfilePage({ params, searchParams }: PageProps<'/[lang]/guides/[slug]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-4xl animate-pulse rounded-brand bg-surface" />}>
      <Profile params={params} searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

async function Profile({
  params,
  searchParams,
  t,
  locale,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();
  const status = await searchParams;

  const facts = [
    guide.years_experience != null && `${guide.years_experience} ${t.guides.years}`,
    guide.summits ? `${guide.summits} ${t.guides.summits}` : null,
    `${t.guides.groupUpTo} ${guide.max_group_size}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex gap-5">
          <GuideAvatar guide={guide} size={112} />
          <div>
            <h1 className="text-3xl font-bold">{guide.display_name}</h1>
            {guide.headline && <p className="mt-1 text-muted">{guide.headline}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge">✓ {t.guides.verified}</span>
              {guide.plan === 'pro' && <span className="badge">{t.guides.pro}</span>}
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm font-medium text-muted">{facts.join(' · ')}</p>

        {guide.bio && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.profile.about}</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{guide.bio}</p>
          </section>
        )}

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <Facts title={t.profile.specialties} items={guide.specialties.map((s) => specialtyName(s, locale))} />
          <Facts title={t.guides.languages} items={guide.languages.map(languageName)} />
          <Facts title={t.profile.regions} items={[guide.base_region, ...guide.regions.filter((r) => r !== guide.base_region)]} />
          <Facts
            title={t.profile.certifications}
            items={[
              ...guide.certifications,
              ...(guide.association ? [`${t.profile.association}: ${guide.association}`] : []),
              ...(guide.has_vehicle ? [t.profile.vehicle] : []),
            ]}
          />
        </section>

        <div className="mt-8 flex gap-4 text-sm">
          {guide.instagram_url && <a className="text-forest underline" href={guide.instagram_url} rel="nofollow noopener" target="_blank">Instagram</a>}
          {guide.facebook_url && <a className="text-forest underline" href={guide.facebook_url} rel="nofollow noopener" target="_blank">Facebook</a>}
          {guide.tiktok_url && <a className="text-forest underline" href={guide.tiktok_url} rel="nofollow noopener" target="_blank">TikTok</a>}
        </div>
      </div>

      <aside id="contact" className="card h-fit">
        <h2 className="text-lg font-semibold">{t.profile.contactTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.profile.contactBody}</p>
        {status.sent ? (
          <p className="mt-4 rounded-brand bg-mint p-4 text-forest">{t.profile.sent}</p>
        ) : (
          <form action={requestGuide} className="mt-4 space-y-3">
            {status.error && <p className="rounded-brand bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={guide.slug} />
            <input type="hidden" name="guide_id" value={guide.id} />
            <input className="field" name="name" placeholder={t.profile.name} required maxLength={120} />
            <input className="field" name="contact" placeholder={t.profile.contact} required maxLength={160} />
            <textarea className="field min-h-28" name="message" placeholder={t.profile.message} required maxLength={2000} />
            <button className="btn w-full">{t.profile.send}</button>
          </form>
        )}
      </aside>
    </div>
  );
}

function Facts({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-full bg-surface px-3 py-1 text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}
