import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  BUSINESS_LINK_KINDS,
  GUIDE_LINK_KINDS,
  PROFILE_LINK_COLUMNS,
  SWITCHED_GUIDE_LINK_KINDS,
  profileLinkErrorMessage,
  profileLinksText,
  type ProfileLinkColumn,
  type ProfileLinkKind,
  type ProfileLinksText,
} from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { KeepForm } from '@/components/keep-form';
import { SubmitButton } from '@/components/submit-button';
import { InViewNote } from '@/components/in-view-note';
import { LinkField } from './link-field';
import { saveBusinessLinks, saveGuideLinks } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = profileLinksText(await getLocale());
  return { title: t.title, robots: { index: false } };
}

type LinkRow = Partial<Record<ProfileLinkColumn, string | null>>;

// Profile links (slice S5): a guide adds a website, Google Business Profile and YouTube (and the
// Instagram, Facebook and TikTok links that are also in the "story" step); a business owner adds the
// same social links for each business. Guide and owner texts, so English and Kiswahili.
export default async function LinksPage({ searchParams }: PageProps<'/[lang]/dashboard/links'>) {
  const locale = await getLocale();
  const t = profileLinksText(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline">{t.dashboard}</Link>
      <h1 className="mt-2 text-3xl font-bold">{t.title}</h1>
      <p className="mt-2 text-muted">{t.intro}</p>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} t={t} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="mt-6 space-y-4">
      <div className="h-64 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

async function Content({ locale, t, searchParams }: { locale: Locale; t: ProfileLinksText; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(locale, `/${locale}/dashboard/links`);
  const status = await searchParams;
  const supabase = await createClient();
  const columns = 'instagram_url, facebook_url, tiktok_url, google_business_url, youtube_url';
  const [guide, providers, setting] = await Promise.all([
    supabase.from('guides').select(`id, ${columns}, website`).eq('owner_id', user.id).maybeSingle<LinkRow & { id: string }>(),
    supabase.from('providers').select(`id, business_name, ${columns}`).eq('owner_id', user.id).order('created_at').limit(10),
    supabase.from('site_settings').select('value').eq('key', 'feature.profile_links').maybeSingle<{ value: { on?: unknown } | null }>(),
  ]);
  // Until 20261126000200 is applied the new columns do not exist: say so instead of an empty form.
  if (guide.error || providers.error) {
    return (
      <div className="card mt-6 space-y-4" role="alert">
        <p>{t.loadError}</p>
        <Link href={`/${locale}/dashboard/links`} className="btn-outline">{t.retry}</Link>
      </div>
    );
  }
  const businesses = (providers.data ?? []) as (LinkRow & { id: string; business_name: string })[];
  if (!guide.data && businesses.length === 0) {
    return (
      <div className="card mt-6 space-y-4">
        <p>{t.notMember}</p>
        <Link href={`/${locale}/dashboard`} className="btn-outline">{t.dashboard}</Link>
      </div>
    );
  }
  const on = setting.data?.value?.on === true;
  const messages = Object.fromEntries(
    ['pl_website', 'pl_website_blocked', 'pl_google', 'pl_youtube', 'pl_instagram', 'pl_facebook', 'pl_tiktok', 'pl_save', 'pl_off'].map((code) => [
      code,
      profileLinkErrorMessage(code, locale) ?? t.saveError,
    ]),
  );

  return (
    <div className="mt-6 space-y-8">
      {status.saved && <InViewNote className="rounded-[5px] bg-mint p-4 font-semibold text-forest">{t.saved}</InViewNote>}

      {guide.data && (
        <section className="card" aria-labelledby="guide-links">
          <h2 id="guide-links" className="text-xl font-semibold">{t.guideHeading}</h2>
          {!on && <p className="mt-2 rounded-[5px] bg-surface p-3 text-sm text-muted">{t.switchedOff}</p>}
          <KeepForm action={saveGuideLinks} messages={messages} fallback={t.saveError} className="mt-4 space-y-5">
            <input type="hidden" name="locale" value={locale} />
            <Fields kinds={GUIDE_LINK_KINDS} row={guide.data} formId="guide" locale={locale} disabled={(kind) => !on && SWITCHED_GUIDE_LINK_KINDS.includes(kind)} />
            <p className="text-xs text-muted">{t.clearNote}</p>
            <SubmitButton className="btn">{t.save}</SubmitButton>
          </KeepForm>
        </section>
      )}

      {businesses.map((business) => (
        <section key={business.id} className="card" aria-labelledby={`business-links-${business.id}`}>
          <h2 id={`business-links-${business.id}`} className="text-xl font-semibold">{t.businessHeading.replace('{business}', () => business.business_name)}</h2>
          <p className="mt-1 text-sm text-muted">{t.businessWebsiteNote}</p>
          {on ? (
            <KeepForm action={saveBusinessLinks} messages={messages} fallback={t.saveError} className="mt-4 space-y-5">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="provider_id" value={business.id} />
              <Fields kinds={BUSINESS_LINK_KINDS} row={business} formId={`business-${business.id}`} locale={locale} />
              <p className="text-xs text-muted">{t.clearNote}</p>
              <SubmitButton className="btn">{t.save}</SubmitButton>
            </KeepForm>
          ) : (
            <p className="mt-3 rounded-[5px] bg-surface p-3 text-sm text-muted">{t.businessSwitchedOff}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Fields({
  kinds,
  row,
  formId,
  locale,
  disabled,
}: {
  kinds: readonly ProfileLinkKind[];
  row: LinkRow;
  formId: string;
  locale: string;
  disabled?: (kind: ProfileLinkKind) => boolean;
}) {
  return (
    <>
      {kinds.map((kind) => (
        <LinkField key={kind} kind={kind} name={`link_${kind}`} formId={formId} locale={locale} defaultValue={row[PROFILE_LINK_COLUMNS[kind]]} disabled={disabled?.(kind)} />
      ))}
    </>
  );
}
