import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import Link from 'next/link';
import { MessagesSquare, Video } from 'lucide-react';
import { startConversation } from '../../messages/actions';
import { CALL_TOPICS } from '@rafrika/shared';
import { getGuideBySlug, type Guide } from '@/lib/guides';
import { getCurrentUser } from '@/lib/auth';
import { topicName } from '@/lib/labels';
import { GuideAvatar, expertiseOf, languageName, specialtyName } from '@/components/guide-card';
import { Icon } from '@/components/icon';
import { requestCall, requestGuide } from './actions';

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
              {guide.female_guide && <span className="badge bg-sand text-sunset-dark">{t.guides.female}</span>}
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

        {guide.expertise.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.profile.expertise}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {expertiseOf(guide).map((e) => (
                <li key={e.id}>
                  <Link href={`/${locale}/guides?expertise=${e.id}`} className="flex items-center gap-3 rounded-2xl bg-mint p-3 text-forest hover:bg-forest hover:text-white">
                    <Icon name={e.icon} className="size-5 shrink-0" />
                    <span className="text-sm font-semibold">{e.label[locale]}</span>
                  </Link>
                </li>
              ))}
            </ul>
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

      <div className="space-y-6">
      <MessageButton guide={guide} t={t} locale={locale} />
      {guide.call_enabled && (
        <CallBooking guide={guide} status={status} t={t} locale={locale} />
      )}
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
    </div>
  );
}

async function MessageButton({ guide, t, locale }: { guide: Guide; t: Dictionary; locale: Locale }) {
  const user = await getCurrentUser();
  // Guides don't message themselves.
  if (user?.guide?.id === guide.id) return null;
  if (!user) {
    return (
      <Link href={`/${locale}/login`} className="btn-dark w-full">
        <MessagesSquare className="size-5" aria-hidden /> {t.messages.signInToMessage}
      </Link>
    );
  }
  return (
    <form action={startConversation}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="guide_id" value={guide.id} />
      <button className="btn-dark w-full">
        <MessagesSquare className="size-5" aria-hidden /> {t.messages.messageGuide}
      </button>
    </form>
  );
}

async function CallBooking({
  guide,
  status,
  t,
  locale,
}: {
  guide: Guide;
  status: Record<string, string | string[] | undefined>;
  t: Dictionary;
  locale: Locale;
}) {
  const user = await getCurrentUser();

  return (
    <section id="call" className="overflow-hidden rounded-3xl bg-night text-white shadow-xl">
      <div className="bg-gradient-to-r from-sunset to-gold px-6 py-4 text-night">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <Video className="size-4" aria-hidden /> {t.dashboard.callsSection}
        </p>
        <p className="mt-1 text-2xl font-extrabold">
          {guide.call_price_usd != null ? `$${guide.call_price_usd}` : t.calls.priceTbc}
          <span className="ml-2 text-sm font-semibold">/ {guide.call_minutes} {t.calls.minutes}</span>
        </p>
      </div>
      <div className="p-6">
        {status.callSent ? (
          <p className="rounded-2xl bg-mint p-4 font-semibold text-forest">{t.calls.sent}</p>
        ) : !user ? (
          <div>
            <p className="text-white/80">{t.calls.signInFirst}</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/${locale}/login`} className="btn-outline border-white text-white hover:bg-white/10">{t.nav.signIn}</Link>
              <Link href={`/${locale}/join?role=traveler`} className="btn">{t.nav.signUp}</Link>
            </div>
          </div>
        ) : (
          <form action={requestCall} className="space-y-3">
            {status.callError && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={guide.slug} />
            <input type="hidden" name="guide_id" value={guide.id} />
            <label className="block">
              <span className="label text-white">{t.calls.topic}</span>
              <select name="topic" required className="field text-charcoal">
                {(guide.call_topics.length ? guide.call_topics : CALL_TOPICS.map((c) => c.id)).map((id) => (
                  <option key={id} value={id}>{topicName(id, locale)}</option>
                ))}
              </select>
            </label>
            <textarea name="preferred_times" className="field min-h-20 text-charcoal" placeholder={t.calls.times} required maxLength={500} />
            <input name="contact" className="field text-charcoal" placeholder={t.calls.contact} maxLength={160} />
            <textarea name="message" className="field min-h-20 text-charcoal" placeholder={t.profile.message} maxLength={2000} />
            <button className="btn w-full">{t.calls.book}</button>
          </form>
        )}
      </div>
    </section>
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
