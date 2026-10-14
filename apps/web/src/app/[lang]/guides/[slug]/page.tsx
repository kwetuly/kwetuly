import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import Link from 'next/link';
import { MessagesSquare, Video } from 'lucide-react';
import { startConversation } from '../../messages/actions';
import { CALL_TOPICS, formatUsd } from '@rafrika/shared';
import { getGuideBySlug, listGuides, listReviews, type Guide } from '@/lib/guides';
import { getCurrentUser } from '@/lib/auth';
import { topicName } from '@/lib/labels';
import { GuideAvatar, GuideBadges, GuideCard, expertiseOf, languageName, specialtyName } from '@/components/guide-card';
import { TrackView } from '@/components/recently-viewed';
import { Icon } from '@/components/icon';
import { RatingSummary, Stars } from '@/components/stars';
import { createClient } from '@/lib/supabase/server';
import { ShareButtons } from '@/components/share-buttons';
import { requestCall, requestGuide, submitReview } from './actions';

export async function generateMetadata({ params }: PageProps<'/[lang]/guides/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();
  return {
    title: `${guide.display_name} — ${guide.base_region} guide`,
    description: guide.headline ?? undefined,
    openGraph: guide.photo_url ? { images: [guide.photo_url] } : undefined,
    robots: guide.visibility === 'link_only' ? { index: false } : undefined,
  };
}

export default async function GuideProfilePage({ params, searchParams }: PageProps<'/[lang]/guides/[slug]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-4xl animate-pulse rounded-[5px] bg-surface" />}>
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
  ].filter((fact): fact is string => !!fact);

  return (
    <>
    <TrackView item={{ href: `/${locale}/guides/${guide.slug}`, title: guide.display_name, subtitle: guide.headline ?? guide.base_region, image: guide.photo_url }} />
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex gap-5">
          <GuideAvatar guide={guide} size={112} />
          <div>
            <h1 className="text-3xl font-bold">{guide.display_name}</h1>
            {guide.headline && <p className="mt-1 text-muted">{guide.headline}</p>}
            <a href="#reviews" className="mt-2 inline-block">
              <RatingSummary avg={guide.rating_avg} count={guide.rating_count} labels={t.reviews} />
            </a>
            <div className="mt-3">
              <GuideBadges guide={guide} t={t} />
            </div>
          </div>
        </div>

        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-muted">
          {facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>

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

        {guide.bio && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.profile.about}</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{guide.bio}</p>
          </section>
        )}

        {guide.open_to_partners && (
          <Link
            href={`/${locale}/partners/agents`}
            className="mt-6 flex items-center gap-3 rounded-[5px] bg-night p-4 text-sm text-white hover:bg-forest"
          >
            <Icon name="handshake" className="size-6 shrink-0 text-gold" />
            <span>
              <strong className="block">{t.guides.partners}</strong>
              {t.partners.applyTitle} →
            </span>
          </Link>
        )}

        {guide.expertise.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.profile.expertise}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {expertiseOf(guide).map((e) => (
                <li key={e.id}>
                  <Link href={`/${locale}/guides?expertise=${e.id}`} className="flex items-center gap-3 rounded-[5px] border border-line bg-white p-3 hover:border-leaf">
                    <Icon name={e.icon} className="size-5 shrink-0 text-leaf" />
                    <span className="text-sm font-semibold">{e.label[locale]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 flex gap-4 text-sm">
          {guide.instagram_url && <a className="text-forest underline" href={guide.instagram_url} rel="nofollow noopener" target="_blank">Instagram</a>}
          {guide.facebook_url && <a className="text-forest underline" href={guide.facebook_url} rel="nofollow noopener" target="_blank">Facebook</a>}
          {guide.tiktok_url && <a className="text-forest underline" href={guide.tiktok_url} rel="nofollow noopener" target="_blank">TikTok</a>}
        </div>

        <div className="mt-6">
          <ShareButtons path={`/${locale}/guides/${guide.slug}`} title={guide.display_name} text={`${t.share.shareGuide}: ${guide.display_name}`} labels={t.share} />
        </div>

        <Reviews guide={guide} status={status} t={t} locale={locale} />
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
          <p className="mt-4 rounded-[5px] bg-mint p-4 text-forest">{t.profile.sent}</p>
        ) : (
          <form action={requestGuide} className="mt-4 space-y-3">
            {status.error && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
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
    <Suspense fallback={null}>
      <SimilarGuides guide={guide} t={t} locale={locale} />
    </Suspense>
    </>
  );
}

// Other verified guides who do the same kind of trip, so the profile never ends in a dead end.
async function SimilarGuides({ guide, t, locale }: { guide: Guide; t: Dictionary; locale: Locale }) {
  const specialty = guide.specialties[0];
  const others = (await listGuides(specialty ? { specialty } : {})).filter((g) => g.id !== guide.id).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16">
      <h2 className="text-2xl font-extrabold tracking-tight">{t.explore.similarGuides}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {others.map((g) => (
          <GuideCard key={g.id} guide={g} locale={locale} t={t} />
        ))}
      </div>
    </section>
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
    <section id="call" className="overflow-hidden rounded-[5px] bg-night text-white shadow-xl">
      <div className="bg-leaf px-6 py-4 text-white">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Video className="size-4" aria-hidden /> {t.dashboard.callsSection}
        </p>
        <p className="mt-1 text-2xl font-extrabold">
          {guide.call_price_usd != null ? formatUsd(guide.call_price_usd) : t.calls.priceTbc}
          <span className="ml-2 text-sm font-semibold">/ {guide.call_minutes} {t.calls.minutes}</span>
        </p>
      </div>
      <div className="p-6">
        {status.callSent ? (
          <p className="rounded-[5px] bg-mint p-4 font-semibold text-forest">{t.calls.sent}</p>
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
            {status.callError && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
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
            <p className="text-xs text-white/70">{t.calls.payNote}</p>
          </form>
        )}
      </div>
    </section>
  );
}

async function Reviews({
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
  const r = t.reviews;
  const reviews = await listReviews(guide.id);
  const dateFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });

  return (
    <section id="reviews" className="mt-10 scroll-mt-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{r.title}</h2>
        <RatingSummary avg={guide.rating_avg} count={guide.rating_count} labels={r} />
      </div>

      {reviews.length === 0 ? (
        <p className="mt-3 text-muted">{r.none}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((review) => (
            <li key={review.id} id={`review-${review.id}`} className="card scroll-mt-28 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={review.rating} label={`${review.rating} / 5 ${r.stars}`} />
                <span className="text-xs text-muted">{dateFormat.format(new Date(review.created_at))}</span>
              </div>
              <p className="mt-2 whitespace-pre-line">{review.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">— {review.author_name}</p>
                <ShareButtons compact path={`/${locale}/guides/${guide.slug}#review-${review.id}`} title={guide.display_name} text={`${t.share.shareReview}: ${"★".repeat(review.rating)} ${guide.display_name}`} labels={t.share} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReviewForm guide={guide} status={status} t={t} locale={locale} />
    </section>
  );
}

// Shown to signed-in travellers who had a confirmed call or booking with this guide.
async function ReviewForm({
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
  const r = t.reviews;
  const user = await getCurrentUser();
  if (user?.guide?.id === guide.id) return null;
  if (!user) {
    return (
      <Link href={`/${locale}/login`} className="btn-outline mt-5">
        {r.signIn}
      </Link>
    );
  }

  const supabase = await createClient();
  const [calls, conversations, own] = await Promise.all([
    supabase.from('call_requests').select('id', { count: 'exact', head: true })
      .eq('guide_id', guide.id).eq('traveler_id', user.id).in('status', ['accepted', 'completed']),
    supabase.from('conversations').select('id', { count: 'exact', head: true })
      .eq('guide_id', guide.id).eq('traveler_id', user.id).eq('contact_unlocked', true),
    supabase.from('guide_reviews').select('rating, body').eq('guide_id', guide.id).eq('author_id', user.id).maybeSingle(),
  ]);
  const eligible = (calls.count ?? 0) > 0 || (conversations.count ?? 0) > 0;

  if (status.reviewSent) return <p className="mt-5 rounded-[5px] bg-mint p-4 font-semibold text-forest">✓ {r.thanks}</p>;
  if (!eligible) return <p className="mt-5 rounded-[5px] bg-surface p-4 text-sm text-muted">{r.onlyAfter}</p>;

  return (
    <form action={submitReview} className="card mt-5 space-y-3">
      <h3 className="text-lg font-bold">{own.data ? r.edit : r.write}</h3>
      {status.reviewError && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={guide.slug} />
      <input type="hidden" name="guide_id" value={guide.id} />
      <fieldset>
        <legend className="label">{r.rating}</legend>
        {/* Star picker without JavaScript: radios shown as stars, highest first so CSS can fill to the left. */}
        <div className="flex flex-row-reverse justify-end gap-1">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="cursor-pointer rounded-[5px] text-3xl leading-none text-line transition hover:text-gold has-[:checked]:text-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest [label:has(:checked)~&]:text-gold [label:hover~&]:text-gold">
              <input type="radio" name="rating" value={n} required defaultChecked={own.data?.rating === n} className="sr-only" />
              <span aria-label={`${n} / 5 ${r.stars}`}>★</span>
            </label>
          ))}
        </div>
      </fieldset>
      <textarea name="body" className="field min-h-28" placeholder={r.body} required minLength={10} maxLength={2000} defaultValue={own.data?.body ?? ''} />
      <button className="btn">{r.submit}</button>
    </form>
  );
}

function Facts({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-[5px] bg-surface px-3 py-1 text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}
