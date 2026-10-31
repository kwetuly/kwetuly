import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Backpack, BadgeCheck, Briefcase, FileCheck, MessagesSquare, Route, Store, UserRound, UsersRound, Wallet, type LucideIcon } from 'lucide-react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { paymentsEnabled } from '@/lib/payments';
import { adminDateTime, hoursSince, waitedFor } from '@/lib/admin-format';
import { TARGET_HOURS, loadQueue, type QueueItem, type ReviewKind } from '@/lib/admin-queue';
import { AdminMenu } from './admin-menu';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

// Admin home: what is waiting, and for how long. One main action: "Review waiting items".
export default async function AdminHome() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Admin</h1>
          <Suspense fallback={<HomeSkeleton />}>
            <HomeContent locale={locale} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin`} />
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading counts">
      <div className="mt-1 h-5 w-48 animate-pulse rounded-[5px] bg-line" />
      <div className="mt-5 h-12 animate-pulse rounded-[5px] bg-line" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[5px] bg-line" />
        ))}
      </div>
    </div>
  );
}

type Tile = {
  key: string;
  name: string;
  icon: LucideIcon;
  href: string;
  /** null = could not load */
  count: number | null;
  line?: string | null;
  /** extra line in gold, e.g. "1 needs a call" */
  flag?: string | null;
  samples?: number;
  late?: boolean;
};

function oldest(dates: string[]) {
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
}

async function HomeContent({ locale }: { locale: Locale }) {
  await requireAdmin(locale);
  const supabase = await createClient();
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const head = { count: 'exact' as const, head: true };

  const [queue, docGuides, badges, reports, paymentsReview, paymentsToPay, tripsFlagged, enquiries, requests, signups, reviews, hidden, depositsOn] = await Promise.all([
    loadQueue(supabase),
    supabase
      .from('guides')
      .select('identity_checked_at, licence_checked_at, first_aid_checked_at, guide_private(id_document_path, license_document_path, first_aid_document_path)')
      .eq('verification_status', 'approved')
      .eq('is_sample', false)
      .returns<{ identity_checked_at: string | null; licence_checked_at: string | null; first_aid_checked_at: string | null; guide_private: { id_document_path: string | null; license_document_path: string | null; first_aid_document_path: string | null } | null }[]>(),
    supabase.from('providers').select('badge_requested_at').not('badge_requested_at', 'is', null).eq('is_sample', false).returns<{ badge_requested_at: string }[]>(),
    supabase.from('message_reports').select('created_at').eq('resolved', false).returns<{ created_at: string }[]>(),
    supabase.from('payments').select('id', head).eq('status', 'review'),
    supabase.from('payments').select('id', head).eq('status', 'paid').eq('payout_done', false),
    supabase.from('trips').select('id', head).eq('needs_review', true),
    supabase.from('leads').select('id', head).is('guide_id', null).gte('created_at', week),
    supabase.from('trip_requests').select('id', head).eq('status', 'open').eq('offers_count', 0),
    supabase.from('interest_signups').select('id', head).gte('created_at', week),
    supabase.from('guide_reviews').select('id', head).gte('created_at', week),
    supabase.from('guide_reviews').select('id', head).eq('hidden', true),
    paymentsEnabled(),
  ]);

  const items = queue.items;
  const real = (kind: ReviewKind) => items.filter((i) => i.kind === kind && !i.sample);
  const samples = (kind: ReviewKind) => items.filter((i) => i.kind === kind && i.sample).length;
  const late = (list: { since: string }[], hours: number) => list.filter((i) => hoursSince(i.since, now) > hours).length;

  const queueTile = (kind: ReviewKind, name: string, icon: LucideIcon, extra?: (list: QueueItem[]) => { line?: string | null; flag?: string | null }): Tile => {
    const list = real(kind);
    const failed = queue.failed.includes(kind);
    const first = oldest(list.map((i) => i.since));
    const more = extra?.(list) ?? {};
    return {
      key: kind,
      name,
      icon,
      href: `/${locale}/admin/review?kind=${kind}`,
      count: failed ? null : list.length,
      line: more.line ?? (first ? `oldest ${waitedFor(first, now)}` : null),
      flag: more.flag,
      samples: samples(kind),
      late: late(list, TARGET_HOURS[kind]) > 0,
    };
  };

  const ready = (list: QueueItem[]) => list.filter((i) => i.readiness.state === 'ready').length;
  const docsToCheck = docGuides.error
    ? null
    : (docGuides.data ?? []).filter(
        (g) =>
          (g.guide_private?.id_document_path && !g.identity_checked_at) ||
          (g.guide_private?.license_document_path && !g.licence_checked_at) ||
          (g.guide_private?.first_aid_document_path && !g.first_aid_checked_at),
      ).length;
  const badgeDates = (badges.data ?? []).map((b) => b.badge_requested_at);
  const reportDates = (reports.data ?? []).map((r) => r.created_at);
  const toPay = (paymentsReview.count ?? 0) + (paymentsToPay.count ?? 0);
  const showPayments = depositsOn || toPay > 0;

  const tiles: Tile[] = [
    queueTile('guide', 'Guides', UserRound, (list) => {
      const first = oldest(list.map((i) => i.since));
      return { line: first ? `oldest ${waitedFor(first, now)}` : null, flag: list.length ? `${ready(list)} ready to approve` : null };
    }),
    queueTile('business', 'Businesses', Store),
    queueTile('package', 'Packages', Backpack, (list) => {
      const first = oldest(list.map((i) => i.since));
      return { line: first ? `oldest ${waitedFor(first, now)}` : null, flag: list.length ? `${ready(list)} ready` : null };
    }),
    queueTile('group', 'Group trips', UsersRound, (list) => {
      const calls = list.filter((i) => i.kind === 'group' && i.row.organizer_kind === 'traveller' && !i.row.organiser?.phone_verified_at).length;
      const first = oldest(list.map((i) => i.since));
      return { line: first ? `oldest ${waitedFor(first, now)}` : null, flag: calls ? `${calls} ${calls === 1 ? 'needs' : 'need'} a phone call` : null };
    }),
    queueTile('job', 'Jobs', Briefcase),
    { key: 'documents', name: 'Documents to re-check', icon: FileCheck, href: `/${locale}/admin/all`, count: docsToCheck, line: 'Approved guides, new document' },
    {
      key: 'badges',
      name: 'Badge requests',
      icon: BadgeCheck,
      href: `/${locale}/admin/all#businesses`,
      count: badges.error ? null : badgeDates.length,
      line: oldest(badgeDates) ? `oldest ${waitedFor(oldest(badgeDates)!, now)}` : null,
      late: badgeDates.some((d) => hoursSince(d, now) > TARGET_HOURS.badges),
    },
    ...(showPayments
      ? [
          {
            key: 'payments',
            name: 'Payments',
            icon: Wallet,
            href: `/${locale}/admin/all#payments`,
            count: paymentsReview.error || paymentsToPay.error ? null : toPay,
            line: `${paymentsReview.count ?? 0} to check with Selcom, ${paymentsToPay.count ?? 0} to pay out`,
          } satisfies Tile,
        ]
      : []),
    {
      key: 'reports',
      name: 'Message reports',
      icon: MessagesSquare,
      href: `/${locale}/admin/messages`,
      count: reports.error ? null : reportDates.length,
      line: oldest(reportDates) ? `oldest ${waitedFor(oldest(reportDates)!, now)}` : null,
      late: reportDates.some((d) => hoursSince(d, now) > TARGET_HOURS.reports),
    },
    { key: 'trips', name: 'Trips to re-check', icon: Route, href: `/${locale}/admin/trips?show=review`, count: tripsFlagged.error ? null : (tripsFlagged.count ?? 0), line: 'Flagged for a facts check' },
  ];

  const reviewCount = items.filter((i) => !i.sample).length;
  // "Waiting for you": the review queues, documents, badge requests, message reports and payments.
  const waiting =
    reviewCount + (docsToCheck ?? 0) + badgeDates.length + reportDates.length + (showPayments ? toPay : 0);
  const pastTarget =
    (['guide', 'business', 'package', 'group', 'job'] as ReviewKind[]).reduce((n, k) => n + late(real(k), TARGET_HOURS[k]), 0) +
    badgeDates.filter((d) => hoursSince(d, now) > TARGET_HOURS.badges).length +
    reportDates.filter((d) => hoursSince(d, now) > TARGET_HOURS.reports).length;
  const someFailed = tiles.some((t) => t.count === null);

  return (
    <>
      <p className="mt-1 text-sm text-muted">{adminDateTime(now)} (Dar es Salaam)</p>

      {someFailed && (
        <p role="alert" className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">
          Some counts could not load. Reload the page to try again.
        </p>
      )}

      {reviewCount > 0 ? (
        <Link href={`/${locale}/admin/review`} className="btn mt-5 min-h-12 w-full sm:w-auto">
          Review waiting items ({reviewCount})
        </Link>
      ) : (
        <>
          <p className="mt-5 rounded-[5px] bg-mint p-4 font-semibold text-forest">All caught up. New items will show here.</p>
          <Link href={`/${locale}/admin/review?sample=all`} className="btn-outline mt-3 min-h-12 w-full sm:w-auto">
            Nothing waiting. Look at all items
          </Link>
        </>
      )}

      <h2 className="mt-8 text-lg font-bold">Waiting for you: {waiting}</h2>
      <p className="text-sm text-muted">
        {pastTarget > 0 ? (
          <>
            <span className="mr-1.5 inline-block size-2.5 rounded-full bg-gold align-middle" aria-hidden />
            Past target time: {pastTarget}
          </>
        ) : (
          'Nothing is past its target time.'
        )}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <TileCard tile={tile} />
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-bold">In the last 7 days</h2>
      <ul className="mt-2 flex flex-wrap gap-x-5 text-sm">
        <SmallCount href={`/${locale}/admin/all#inbox`} label="Enquiries with no guide" count={enquiries.error ? null : enquiries.count} />
        <SmallCount href={`/${locale}/admin/all#inbox`} label="Sign-ups" count={signups.error ? null : signups.count} />
        <SmallCount href={`/${locale}/admin/all#reviews`} label="New reviews" count={reviews.error ? null : reviews.count} />
        <SmallCount href={`/${locale}/admin/all#reviews`} label="Hidden reviews (all time)" count={hidden.error ? null : hidden.count} />
        <SmallCount href={`/${locale}/admin/all#requests`} label="Open trip requests with no offer" count={requests.error ? null : requests.count} />
      </ul>
    </>
  );
}

function SmallCount({ href, label, count }: { href: string; label: string; count: number | null }) {
  return (
    <li>
      <Link href={href} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        {label}: <strong className="ml-1">{count === null ? 'could not load' : count}</strong>
      </Link>
    </li>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  const failed = tile.count === null;
  const zero = tile.count === 0;
  const spoken = failed
    ? `${tile.name}, could not load`
    : `${tile.name}, ${tile.count} waiting${tile.line && !zero ? `, ${tile.line}` : ''}${tile.late ? ', waiting long' : ''}`;
  return (
    <Link href={tile.href} aria-label={spoken} className="flex h-full min-h-24 flex-col rounded-[5px] border border-line bg-white p-3 hover:border-leaf sm:p-4">
      <span className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white" aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </span>
        <span className="min-w-0 font-semibold leading-tight">{tile.name}</span>
      </span>
      {failed ? (
        <span className="mt-2 text-sm text-muted">Could not load</span>
      ) : (
        <>
          <span className={`mt-2 text-[28px] font-bold leading-none ${zero ? 'text-muted' : ''}`}>{tile.count}</span>
          <span className="mt-1 text-sm text-muted">
            {zero ? (
              'Nothing waiting'
            ) : (
              <>
                {tile.late && <span className="mr-1.5 inline-block size-2.5 rounded-full bg-gold align-middle" aria-hidden />}
                {tile.line}
                {tile.late && ', waiting long'}
              </>
            )}
          </span>
          {tile.flag && !zero && <span className="mt-0.5 text-sm font-semibold text-charcoal">{tile.flag}</span>}
          {!!tile.samples && <span className="mt-0.5 text-xs text-muted">samples: {tile.samples}</span>}
        </>
      )}
    </Link>
  );
}
