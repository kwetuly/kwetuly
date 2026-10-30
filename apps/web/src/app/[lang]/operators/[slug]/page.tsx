import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ArrowLeft, BadgeCheck, ExternalLink, Globe, Mail, MapPin, Phone, ShieldCheck, Star } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getOperatorForViewer, listTours } from '@/lib/trips';
import { today } from '@/lib/today';
import { safeExternalUrl } from '@kwetuly/shared';
import { OperatorLogo } from '@/components/operator-logo';
import { TripCard } from '@/components/trip-card';

export async function generateMetadata({ params }: PageProps<'/[lang]/operators/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const operator = await getOperatorForViewer(slug);
  if (!operator) notFound();
  return pageMeta({
    path: `/operators/${operator.slug}`,
    title: operator.name,
    description: operator.description,
    image: operator.logo_url,
    noindex: operator.status !== 'published',
  });
}

export default async function OperatorPage({ params }: PageProps<'/[lang]/operators/[slug]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-80 max-w-6xl animate-pulse rounded-[5px] bg-surface" />}>
      <Operator params={params} t={t} locale={locale} />
    </Suspense>
  );
}

const hostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

async function Operator({ params, t, locale }: { params: Promise<{ slug: string }>; t: Dictionary; locale: Locale }) {
  const { slug } = await params;
  const op = await getOperatorForViewer(slug);
  if (!op) notFound();
  const [tours, now] = await Promise.all([listTours(), today()]);
  const theirs = tours.filter((tour) => tour.operator_id === op.id);
  const tt = t.tours;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const link = 'inline-flex items-center gap-1.5 font-semibold text-leaf-dark underline';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href={`/${locale}/operators`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-charcoal">
        <ArrowLeft className="size-4 text-leaf-dark" aria-hidden /> {tt.operatorsTitle}
      </Link>
      <div className="mt-6 flex flex-wrap items-start gap-5">
        <OperatorLogo name={op.name} logo={op.logo_url} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{op.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {op.verified_at ? (
              <span className="inline-flex items-center gap-1 rounded-[5px] bg-mint px-3 py-1 text-xs font-bold text-forest">
                <BadgeCheck className="size-3.5" aria-hidden /> {tt.verified} · {date.format(new Date(op.verified_at))}
              </span>
            ) : (
              <span className="rounded-[5px] bg-surface px-3 py-1 text-xs font-semibold text-muted">{tt.notVerified}</span>
            )}
            {op.status !== 'published' && <span className="rounded-[5px] bg-sand px-3 py-1 text-xs font-bold text-leaf-dark">{tt.draft}</span>}
          </div>
          {op.description && <p className="mt-4 max-w-3xl whitespace-pre-line text-muted">{op.description}</p>}
        </div>
      </div>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {op.location && <Fact icon={MapPin} label={tt.location}>{op.location}</Fact>}
        {safeExternalUrl(op.website) && (
          <Fact icon={Globe} label={tt.website}>
            <a href={safeExternalUrl(op.website)!} target="_blank" rel="noopener noreferrer nofollow" className={link}>{hostname(op.website!)} <ExternalLink className="size-3.5" aria-hidden /></a>
          </Fact>
        )}
        {(op.contact_email || op.contact_phone) && (
          <Fact icon={op.contact_email ? Mail : Phone} label={tt.contact}>
            {op.contact_email && <a href={`mailto:${op.contact_email}`} className={`${link} flex`}>{op.contact_email}</a>}
            {op.contact_phone && <a href={`tel:${op.contact_phone.replace(/\s/g, '')}`} className={`${link} flex`}>{op.contact_phone}</a>}
          </Fact>
        )}
        {op.licence_number && op.licence_checked_at && (
          <Fact icon={ShieldCheck} label={tt.licence}>
            {op.licence_authority ? `${op.licence_authority}: ` : ''}{op.licence_number}
            <span className="block text-xs font-normal text-muted">{tt.lastChecked}: {date.format(new Date(op.licence_checked_at))}</span>
          </Fact>
        )}
        {op.tripadvisor_url && (
          <Fact icon={Star} label={tt.tripadvisor}>
            {op.tripadvisor_rating != null && op.tripadvisor_checked_at && (
              <span className="block">
                {Number(op.tripadvisor_rating).toFixed(1)} / 5
                {op.tripadvisor_reviews != null && ` · ${op.tripadvisor_reviews.toLocaleString(locale)} ${tt.reviews}`}
              </span>
            )}
            {safeExternalUrl(op.tripadvisor_url) && (
              <a href={safeExternalUrl(op.tripadvisor_url)!} target="_blank" rel="noopener noreferrer nofollow" className={link}>{tt.tripadvisor} <ExternalLink className="size-3.5" aria-hidden /></a>
            )}
            {op.tripadvisor_checked_at && <span className="block text-xs font-normal text-muted">{tt.lastChecked}: {date.format(new Date(op.tripadvisor_checked_at))}</span>}
          </Fact>
        )}
      </dl>

      <h2 className="mt-12 text-2xl font-extrabold">{tt.operatorTours}</h2>
      {theirs.length === 0 ? (
        <p className="mt-3 text-muted">{tt.empty}</p>
      ) : (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {theirs.map((tour) => <TripCard key={tour.id} trip={tour} locale={locale} t={t} today={now} />)}
        </div>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[5px] border border-line bg-white p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 text-sm">
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className="font-semibold">{children}</dd>
      </div>
    </div>
  );
}
