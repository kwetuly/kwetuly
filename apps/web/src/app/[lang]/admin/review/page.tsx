import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Check, CircleAlert, Search } from 'lucide-react';
import { BADGE_CHECKS, PACKAGE_KINDS, USER_LINK_REL, normaliseWebsite, packageDuration, packagePrice } from '@kwetuly/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { languageName, specialtyName } from '@/components/guide-card';
import { jobRoleName } from '@/lib/labels';
import { SavedNote } from '@/components/saved-note';
import { SubmitButton } from '@/components/submit-button';
import { dateRange, waitedFor } from '@/lib/admin-format';
import {
  BATCH_MAX,
  KIND_NAME,
  REVIEW_KINDS,
  SKIP_REASON,
  TARGET_HOURS,
  decodeSkip,
  encodePick,
  loadQueue,
  summaryLine,
  type QueueItem,
  type ReviewKind,
} from '@/lib/admin-queue';
import { confirmPhone, reviewBusiness, reviewGroupTrip, reviewGuide, reviewJob, reviewPackage } from '../actions';
import { FocusResult, ReviewBar, type ReadyItem } from './review-bar';

export const metadata: Metadata = { title: 'Review', robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewPage({ searchParams }: PageProps<'/[lang]/admin/review'>) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href={`/${locale}/admin`} className="font-semibold text-forest underline">Admin</Link> / Review
      </nav>
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading waiting items">
      <div className="mt-2 h-8 w-56 animate-pulse rounded-[5px] bg-line" />
      <div className="mt-4 h-12 animate-pulse rounded-[5px] bg-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 space-y-3 rounded-[5px] border border-line bg-white p-4">
          <div className="h-4 w-32 animate-pulse rounded-[5px] bg-line" />
          <div className="h-6 w-48 animate-pulse rounded-[5px] bg-line" />
          <div className="h-20 animate-pulse rounded-[5px] bg-surface" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-11 animate-pulse rounded-[5px] bg-line" />
            <div className="h-11 animate-pulse rounded-[5px] bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

type Filters = { kind: ReviewKind | 'all'; ready: 'all' | 'ready' | 'notready'; sample: 'real' | 'sample' | 'all'; sort: 'oldest' | 'newest'; q: string; page: number };

function readFilters(p: Record<string, string | string[] | undefined>): Filters {
  const kind = one(p.kind);
  const ready = one(p.ready);
  const sample = one(p.sample);
  const page = Number.parseInt(one(p.page), 10);
  return {
    kind: (REVIEW_KINDS as string[]).includes(kind) ? (kind as ReviewKind) : 'all',
    ready: ready === 'ready' || ready === 'notready' ? ready : 'all',
    sample: sample === 'sample' || sample === 'all' ? sample : 'real',
    sort: one(p.sort) === 'newest' ? 'newest' : 'oldest',
    q: one(p.q).trim().slice(0, 80),
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The review URL for these filters (defaults left out, so links stay short). */
function reviewHref(locale: string, f: Filters, change: Partial<Filters> = {}) {
  const next = { ...f, page: 1, ...change };
  const q = new URLSearchParams();
  if (next.kind !== 'all') q.set('kind', next.kind);
  if (next.ready !== 'all') q.set('ready', next.ready);
  if (next.sample !== 'real') q.set('sample', next.sample);
  if (next.sort !== 'oldest') q.set('sort', next.sort);
  if (next.q) q.set('q', next.q);
  if (next.page > 1) q.set('page', String(next.page));
  const s = q.toString();
  return `/${locale}/admin/review${s ? `?${s}` : ''}`;
}

async function ReviewContent({ locale, searchParams }: { locale: Locale; searchParams: Search }) {
  await requireAdmin(locale);
  const [params, t] = await Promise.all([searchParams, getDictionary()]);
  const f = readFilters(params);
  const supabase = await createClient();
  const queue = await loadQueue(supabase);
  const now = new Date();

  const matchesBase = (i: QueueItem) =>
    (f.sample === 'all' || (f.sample === 'sample' ? i.sample : !i.sample)) &&
    (f.ready === 'all' || (f.ready === 'ready' ? i.readiness.state === 'ready' : i.readiness.state !== 'ready')) &&
    (!f.q || i.name.toLowerCase().includes(f.q.toLowerCase()));
  const base = queue.items.filter(matchesBase);
  const filtered = base
    .filter((i) => f.kind === 'all' || i.kind === f.kind)
    .sort((a, b) => (f.sort === 'oldest' ? a.since.localeCompare(b.since) : b.since.localeCompare(a.since)));
  const pages = Math.max(1, Math.ceil(filtered.length / BATCH_MAX));
  const page = Math.min(f.page, pages);
  const shown = filtered.slice((page - 1) * BATCH_MAX, page * BATCH_MAX);
  const readyShown = shown.filter((i) => i.readiness.state === 'ready');
  const readyLater = filtered.slice(page * BATCH_MAX).filter((i) => i.readiness.state === 'ready').length;
  const back = reviewHref(locale, f, { page });
  const filtered_ = f.kind !== 'all' || f.ready !== 'all' || f.sample !== 'real' || !!f.q;

  // Short-lived links to private documents, only for the cards on this page.
  const docLinks = new Map<string, string>();
  await Promise.all(
    shown.flatMap((i) => {
      const paths =
        i.kind === 'guide'
          ? [i.row.guide_private?.id_document_path, i.row.guide_private?.license_document_path, i.row.guide_private?.first_aid_document_path]
          : i.kind === 'business'
            ? [i.row.provider_private?.licence_document_path]
            : [];
      return paths.filter((p): p is string => !!p).map(async (path) => {
        const { data } = await supabase.storage.from('verification').createSignedUrl(path, 600);
        if (data) docLinks.set(path, data.signedUrl);
      });
    }),
  );

  // Result of the last batch or single action.
  const skips = one(params.skip).split(',').map(decodeSkip).filter((s) => s !== null);
  const changedIds = new Set(skips.filter((s) => s.code === 'changed').map((s) => s.id));
  const nameOf = (id: string) => queue.items.find((i) => i.id === id)?.name;
  const realCount = queue.items.filter((i) => !i.sample).length;
  const readyTotal = base.filter((i) => i.readiness.state === 'ready').length;

  const readyItems: ReadyItem[] = readyShown.map((i) => ({ pick: encodePick(i), name: i.name, group: KIND_NAME[i.kind].many }));

  return (
    <div className={readyItems.length ? 'pb-44' : ''}>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Waiting items ({realCount})</h1>
      <p className="text-sm text-muted">
        {readyTotal} ready to approve · {base.length - readyTotal} to approve one by one or need something
      </p>

      <Result params={params} skips={skips} nameOf={nameOf} />
      {queue.failed.length > 0 && (
        <p role="alert" className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800">
          Could not load {queue.failed.map((k) => KIND_NAME[k].many.toLowerCase()).join(', ')}. Reload the page to try again.
        </p>
      )}

      <FilterBar locale={locale} f={f} counts={REVIEW_KINDS.map((k) => [k, base.filter((i) => i.kind === k).length] as const)} total={base.length} active={filtered_} />

      {shown.length === 0 ? (
        <EmptyState locale={locale} f={f} filtered={filtered_} />
      ) : (
        <ul className="mt-5 space-y-4">
          {shown.map((item) => (
            <li key={`${item.kind}:${item.id}`} id={`item-${item.id}`} className="scroll-mt-24">
              <ReviewCard item={item} locale={locale} back={back} t={t} docLinks={docLinks} now={now} changed={changedIds.has(item.id)} />
            </li>
          ))}
        </ul>
      )}

      {readyLater > 0 && <p className="mt-4 text-sm text-muted">{readyLater} more ready on the next page.</p>}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 grid grid-cols-2 gap-3">
          {page > 1 ? (
            <Link href={reviewHref(locale, f, { page: page - 1 })} className="btn-outline min-h-11">Previous</Link>
          ) : <span />}
          {page < pages && <Link href={reviewHref(locale, f, { page: page + 1 })} className="btn-outline min-h-11">Next</Link>}
        </nav>
      )}

      <ReviewBar locale={locale} back={back} items={readyItems} max={BATCH_MAX} />
    </div>
  );
}

function Result({
  params,
  skips,
  nameOf,
}: {
  params: Record<string, string | string[] | undefined>;
  skips: NonNullable<ReturnType<typeof decodeSkip>>[];
  nameOf: (id: string) => string | undefined;
}) {
  const error = one(params.error);
  const done = one(params.done);
  const ok = one(params.ok);
  const errors: Record<string, string> = {
    batch: 'Could not approve. Nothing was changed. Please try again.',
    changed: 'Nothing was changed: this item changed or was already decided after the page was loaded. Look at it again below.',
    save: 'Could not save. Nothing was changed. Please try again.',
    checks: 'Not approved: the ID and the licence must both be ticked and saved first. Open the documents, tick what you looked at, then approve.',
    phone: 'Not approved: the traveller organiser’s phone number is not confirmed yet.',
    phone_changed: 'Not confirmed: the organiser’s phone number changed after this page was loaded (or none was shown). Check the new number, call it, then press "Phone confirmed" again.',
    phone_confirm: 'Could not save the phone confirmation. Please try again.',
  };
  if (error) {
    return (
      <>
        <p id="result" tabIndex={-1} role="alert" className="mt-4 rounded-[5px] bg-red-50 p-4 text-red-800 outline-none">
          {Object.hasOwn(errors, error) ? errors[error] : errors.save}
        </p>
        <FocusResult id="result" />
      </>
    );
  }
  if (ok !== '') {
    const approved = Number.parseInt(ok, 10) || 0;
    if (skips.length === 0) {
      return (
        <div id="result" tabIndex={-1} className="outline-none">
          <SavedNote className="mt-4 flex items-center gap-2 rounded-[5px] bg-mint p-4 font-semibold text-forest">
            <Check size={18} aria-hidden /> {approved} approved.
          </SavedNote>
          <FocusResult id="result" />
        </div>
      );
    }
    return (
      <div id="result" tabIndex={-1} role="status" className="mt-4 rounded-[5px] border-l-4 border-gold bg-sand p-4 outline-none">
        <p className="font-semibold">
          {approved === 0 ? 'None approved.' : `${approved} approved, ${skips.length} not approved.`}
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {skips.map((s) => {
            const name = nameOf(s.id);
            return (
              <li key={`${s.kind}:${s.id}`}>
                <strong>{name ?? `A ${KIND_NAME[s.kind].one.toLowerCase()}`}</strong>: {SKIP_REASON[s.code]}.{' '}
                {name && <a href={`#item-${s.id}`} className="font-semibold text-forest underline">Show this item</a>}
              </li>
            );
          })}
        </ul>
        {skips.some((s) => !nameOf(s.id)) && <p className="mt-1 text-sm">Items no longer waiting are not in the list any more.</p>}
        <FocusResult id="result" />
      </div>
    );
  }
  const saved: Record<string, string> = { approved: 'Approved.', rejected: 'Rejected.', checks: 'Checks saved.', phone: 'Phone confirmed.' };
  if (saved[done]) {
    return (
      <div id="result" tabIndex={-1} className="outline-none">
        <SavedNote className="mt-4 flex items-center gap-2 rounded-[5px] bg-mint p-4 font-semibold text-forest">
          <Check size={18} aria-hidden /> {saved[done]}
        </SavedNote>
        <FocusResult id="result" />
      </div>
    );
  }
  return null;
}

function FilterBar({ locale, f, counts, total, active }: { locale: Locale; f: Filters; counts: (readonly [ReviewKind, number])[]; total: number; active: boolean }) {
  const chip = (selected: boolean) =>
    `inline-flex min-h-10 items-center rounded-[5px] px-3 text-sm font-semibold ${selected ? 'bg-leaf-dark text-white' : 'border border-line bg-white text-charcoal hover:border-leaf'}`;
  return (
    <div className="mt-5 space-y-3">
      {/* A plain GET form: the filters live in the address bar, so reload and tile links keep them. */}
      <form method="get" action={`/${locale}/admin/review`} className="space-y-3">
        {f.kind !== 'all' && <input type="hidden" name="kind" value={f.kind} />}
        <label className="relative block">
          <span className="sr-only">Search by name</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" name="q" defaultValue={f.q} placeholder="Search by name" className="field min-h-12 pl-10" maxLength={80} />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="sr-only">Ready or not</span>
            <select name="ready" defaultValue={f.ready} className="field py-2.5">
              <option value="all">Ready and not ready</option>
              <option value="ready">Ready only</option>
              <option value="notready">Not ready only</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Real or sample</span>
            <select name="sample" defaultValue={f.sample} className="field py-2.5">
              <option value="real">Real only</option>
              <option value="sample">Sample only</option>
              <option value="all">Real and sample</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Order</span>
            <select name="sort" defaultValue={f.sort} className="field py-2.5">
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn-outline min-h-11 px-5 py-2">Show</button>
          {active && (
            <Link href={`/${locale}/admin/review`} className="inline-flex min-h-11 items-center font-semibold text-forest underline">
              Clear filters
            </Link>
          )}
        </div>
      </form>
      <nav aria-label="Kinds" className="flex flex-wrap gap-2">
        <Link href={reviewHref(locale, f, { kind: 'all' })} aria-current={f.kind === 'all' ? 'page' : undefined} className={chip(f.kind === 'all')}>
          All {total}
        </Link>
        {counts.map(([kind, n]) => (
          <Link key={kind} href={reviewHref(locale, f, { kind })} aria-current={f.kind === kind ? 'page' : undefined} className={chip(f.kind === kind)}>
            {KIND_NAME[kind].many} {n}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function EmptyState({ locale, f, filtered }: { locale: Locale; f: Filters; filtered: boolean }) {
  if (f.q) {
    return (
      <div className="mt-5 rounded-[5px] border border-line bg-white p-5">
        <p>No waiting item called “{f.q}”. Check the spelling or clear the search.</p>
        <Link href={`/${locale}/admin/review`} className="btn mt-3 min-h-11">Clear filters</Link>
      </div>
    );
  }
  if (filtered) {
    return (
      <div className="mt-5 rounded-[5px] border border-line bg-white p-5">
        <p>Nothing matches these filters.</p>
        <Link href={`/${locale}/admin/review`} className="btn mt-3 min-h-11">Clear filters</Link>
      </div>
    );
  }
  return (
    <div className="mt-5 rounded-[5px] bg-mint p-5 text-forest">
      <p className="font-semibold">Nothing is waiting. New guides, businesses, packages, group trips and jobs show here.</p>
      <Link href={`/${locale}/admin`} className="btn-outline mt-3 min-h-11">Back to admin</Link>
    </div>
  );
}

// --- One card --------------------------------------------------------------------------------

const ID_FIELD: Record<ReviewKind, string> = { guide: 'guide_id', package: 'package_id', business: 'provider_id', group: 'group_trip_id', job: 'job_id' };
const ACTION = { guide: reviewGuide, package: reviewPackage, business: reviewBusiness, group: reviewGroupTrip, job: reviewJob } as const;

function ReviewCard({
  item,
  locale,
  back,
  t,
  docLinks,
  now,
  changed,
}: {
  item: QueueItem;
  locale: Locale;
  back: string;
  t: Dictionary;
  docLinks: Map<string, string>;
  now: Date;
  changed: boolean;
}) {
  const { readiness } = item;
  const late = (now.getTime() - new Date(item.since).getTime()) / 3_600_000 > TARGET_HOURS[item.kind];
  const formId = `decide-${item.id}`;
  const missingId = `missing-${item.id}`;
  const href =
    item.kind === 'guide'
      ? `/${locale}/guides/${item.row.slug}`
      : item.kind === 'package'
        ? item.row.guides ? `/${locale}/guides/${item.row.guides.slug}` : null
        : item.kind === 'group'
          ? `/${locale}/group-trips/${item.id}`
          : item.kind === 'business'
            ? `/${locale}/businesses/${item.id}`
            : null;

  return (
    <article className="flex rounded-[5px] border border-line bg-white has-[[data-pick]:checked]:border-2 has-[[data-pick]:checked]:border-leaf">
      {readiness.state === 'ready' ? (
        <label className="flex w-11 shrink-0 cursor-pointer justify-center pt-4">
          <input type="checkbox" data-pick={encodePick(item)} aria-label={`Select ${item.name}`} className="size-6 accent-leaf" />
        </label>
      ) : (
        <span className="w-11 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-3 py-4 pr-4">
        <p className="text-sm font-semibold text-muted">
          {KIND_NAME[item.kind].one} · {waitedFor(item.since, now) === 'today' ? 'waiting since today' : `${waitedFor(item.since, now)} waiting`}
          {late && (
            <>
              {' · '}
              <span className="mr-1 inline-block size-2.5 rounded-full bg-gold align-middle" aria-hidden />
              waiting long
            </>
          )}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-lg font-bold underline">
              {item.name}
            </a>
          ) : (
            <h2 className="min-w-0 break-words text-lg font-bold">{item.name}</h2>
          )}
          {item.sample && <span className="rounded-[5px] border border-gold bg-sand px-2 py-0.5 text-xs font-semibold text-charcoal">Sample</span>}
          {changed && <span className="rounded-[5px] bg-sand px-2 py-0.5 text-xs font-semibold text-charcoal">Changed since you opened this</span>}
        </div>
        <p className="text-sm text-muted">{summaryLine(item, (s) => specialtyName(s, locale))}</p>

        <ReadinessBox item={item} missingId={missingId} />

        {item.kind === 'group' && item.row.organizer_kind === 'traveller' && !item.row.organiser?.phone_verified_at && (
          <form action={confirmPhone}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="back" value={`${back}#item-${item.id}`} />
            <input type="hidden" name="user_id" value={item.row.organizer_id} />
            <input type="hidden" name="phone" value={item.row.organiser?.phone ?? ''} />
            <p className="mb-2 text-sm">
              Phone: <strong>{item.row.organiser?.phone ?? 'none given'}</strong>
            </p>
            <SubmitButton className="btn-outline min-h-11 w-full" disabled={!item.row.organiser?.phone}>Phone confirmed</SubmitButton>
          </form>
        )}

        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-forest underline">Open details</summary>
          <div className="mt-2 space-y-2 border-t border-line pt-3 text-sm">
            <Details item={item} locale={locale} back={back} t={t} docLinks={docLinks} formId={formId} />
          </div>
        </details>

        <form id={formId} action={ACTION[item.kind]} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name={ID_FIELD[item.kind]} value={item.id} />
          <input type="hidden" name="updated_at" value={item.updatedAt} />
          <SubmitButton
            name="decision"
            value="approve"
            className="btn min-h-11 px-3 py-2"
            disabled={readiness.state === 'blocked'}
            aria-describedby={readiness.state === 'blocked' ? missingId : undefined}
          >
            {t.admin.approve}
          </SubmitButton>
          <SubmitButton name="decision" value="reject" className="btn-outline min-h-11 px-3 py-2">
            {t.admin.reject}
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

function ReadinessBox({ item, missingId }: { item: QueueItem; missingId: string }) {
  const { readiness } = item;
  const passed = readiness.passed.length > 0 && (
    <ul className="mt-1 space-y-0.5">
      {readiness.passed.map((p) => (
        <li key={p} className="flex items-start gap-1.5">
          <Check size={16} className="mt-0.5 shrink-0 text-forest" aria-hidden /> {p}
        </li>
      ))}
    </ul>
  );
  if (readiness.state === 'ready') {
    return (
      <div className="rounded-[5px] bg-mint p-3 text-sm text-forest">
        <p className="font-semibold">Ready</p>
        {passed}
      </div>
    );
  }
  return (
    <div id={missingId} className="rounded-[5px] border-l-4 border-gold bg-sand p-3 text-sm text-charcoal">
      <p className="font-semibold">{readiness.state === 'blocked' ? 'Missing before you can approve' : 'Approve one by one'}</p>
      <ul className="mt-1 space-y-0.5">
        {readiness.missing.map((m) => (
          <li key={m} className="flex items-start gap-1.5">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {m}
          </li>
        ))}
      </ul>
      {passed}
    </div>
  );
}

const GUIDE_DOCS = [
  { path: 'id_document_path', check: 'identity_checked_at', field: 'identity', label: 'ID document' },
  { path: 'license_document_path', check: 'licence_checked_at', field: 'licence', label: 'Guide licence' },
  { path: 'first_aid_document_path', check: 'first_aid_checked_at', field: 'first_aid', label: 'First-aid certificate' },
] as const;

function Details({
  item,
  locale,
  back,
  t,
  docLinks,
  formId,
}: {
  item: QueueItem;
  locale: Locale;
  back: string;
  t: Dictionary;
  docLinks: Map<string, string>;
  formId: string;
}) {
  switch (item.kind) {
    case 'guide': {
      const g = item.row;
      const p = g.guide_private;
      return (
        <>
          {g.headline && <p className="text-muted">{g.headline}</p>}
          <p>Languages: {g.languages.map(languageName).join(', ') || 'none given'}</p>
          <p>Registration: <strong>{p?.registration_number ?? 'not given'}</strong> · KINAPA/TANAPA: {p?.kinapa_tanapa_id ?? 'not given'}</p>
          <p>Phone: {p?.phone ?? 'not given'} · WhatsApp: {p?.whatsapp_number ?? 'not given'}{g.association ? ` · ${g.association}` : ''}</p>
          {/* Tick only what you actually looked at: each tick shows publicly as "… checked". Ticks are saved one guide at a time. */}
          <form action={reviewGuide} className="mt-3 space-y-2 rounded-[5px] border border-line p-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="back" value={`${back}#item-${g.id}`} />
            <input type="hidden" name="guide_id" value={g.id} />
            <input type="hidden" name="updated_at" value={g.updated_at} />
            <input type="hidden" name="with_checks" value="1" />
            <p className="font-semibold">Documents (tick only what you looked at)</p>
            {GUIDE_DOCS.map((doc) => {
              const path = p?.[doc.path];
              const link = path ? docLinks.get(path) : undefined;
              return (
                <label key={doc.field} className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name={doc.field} defaultChecked={!!g[doc.check]} disabled={!link} className="size-5 accent-leaf" />
                  {/* A box that cannot be ticked keeps any earlier check as it is. */}
                  {!link && <input type="hidden" name={doc.field} value="keep" />}
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline">
                      {doc.label} checked
                    </a>
                  ) : (
                    <span className="text-muted">{doc.label}: {path ? 'could not open the file' : 'not uploaded'}</span>
                  )}
                </label>
              );
            })}
            <label className="block">
              <span className="text-sm text-muted">First aid valid until</span>
              <input type="date" name="first_aid_valid_until" defaultValue={g.first_aid_valid_until ?? ''} className="field py-2" />
            </label>
            <SubmitButton name="decision" value="checks" className="btn-outline min-h-11 w-full">Save checks</SubmitButton>
          </form>
        </>
      );
    }
    case 'package': {
      const p = item.row;
      const pt = t.packages;
      return (
        <>
          <p className="font-semibold text-forest">{PACKAGE_KINDS.find((k) => k.id === p.kind)?.en}</p>
          <p>{p.summary}</p>
          {p.details && <p className="whitespace-pre-line text-muted">{p.details}</p>}
          <p className="font-semibold">
            {[packagePrice(p, pt), packageDuration(p, pt), p.max_group ? pt.upTo.replace('{n}', String(p.max_group)) : null].filter(Boolean).join(' · ')}
          </p>
          {p.includes.length > 0 && <p className="text-muted">{pt.included}: {p.includes.join(', ')}</p>}
          {p.meeting_point && <p className="text-muted">{pt.meetingPoint}: {p.meeting_point}</p>}
          {p.photo_url && <a href={p.photo_url} target="_blank" rel={USER_LINK_REL} className="text-forest underline">Photo</a>}
          <label className="block pt-1">
            <span className="label">Note to the guide (if you reject)</span>
            <input className="field" name="note" maxLength={500} form={formId} />
          </label>
        </>
      );
    }
    case 'business': {
      const b = item.row;
      const website = b.website ? normaliseWebsite(b.website) : null;
      const licence = b.provider_private?.licence_document_path ? docLinks.get(b.provider_private.licence_document_path) : undefined;
      return (
        <>
          <p className="text-muted">WhatsApp {b.provider_private?.whatsapp_number ?? 'not given'}</p>
          {b.story && <p className="whitespace-pre-line">{b.story}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {website?.ok && <a href={website.url} target="_blank" rel={USER_LINK_REL} className="text-forest underline">Website: {website.host}</a>}
            {website && !website.ok && <span className="break-all text-red-800">Website not valid, not shown to travellers: {b.website}</span>}
            {b.photo_url && <a href={b.photo_url} target="_blank" rel={USER_LINK_REL} className="text-forest underline">Photo</a>}
            {licence ? <a href={licence} target="_blank" rel="noopener noreferrer" className="text-forest underline">Business licence</a> : <span className="text-muted">No licence uploaded</span>}
          </div>
          <p className="text-muted">Badge checks offered: {BADGE_CHECKS.map((c) => c.en).join(', ')}. Badges are handled on the old page.</p>
        </>
      );
    }
    case 'group': {
      const g = item.row;
      return (
        <>
          <p>{g.region} · {dateRange(g.start_date, g.end_date)}</p>
          {g.organizer_kind === 'traveller' && <p>Traveller: {g.organiser?.full_name ?? 'no name given'}</p>}
          {g.already_going > 0 && <p>Completing a group: {g.already_going} already going</p>}
          {g.group_trip_private && <p>Contact given: {g.group_trip_private.contact}</p>}
          <p>${g.price_per_person_usd} per person · {g.min_people} to {g.max_people} people</p>
          <p className="whitespace-pre-line text-muted">{g.description}</p>
          {g.includes && <p className="text-muted">Includes: {g.includes}</p>}
        </>
      );
    }
    case 'job': {
      const j = item.row;
      return (
        <>
          <p className="font-semibold">{j.kind === 'handover' ? 'Client handover' : jobRoleName(j.role_needed, locale)}</p>
          <p>Pay: {j.pay ?? 'not given'}</p>
          {j.description && <p className="whitespace-pre-line text-muted">{j.description}</p>}
          <p>How to apply: {j.how_to_apply}</p>
        </>
      );
    }
  }
}
