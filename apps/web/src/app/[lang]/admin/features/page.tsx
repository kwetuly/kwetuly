import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FEATURES, FEATURE_PARTS, featureName, isNotAppliedError, tanzaniaToday, type FeatureDef } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminMenu } from '../admin-menu';
import { setFeatureLegal, setFeatureOn, setFeatureTeamOnly } from './actions';
import { FEATURE_ADMIN, featuresText, type FeatureAdminRow, type FeatureLegal, type FeaturesText } from './admin-data';

export const metadata: Metadata = { title: 'Feature switches', robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type LastChange = { feature_id: string; action: string; changed_by_name: string; changed_at: string };
type State = { hasRow: boolean; on: boolean; legal: FeatureLegal; legalCheckedOn: string | null; teamOnly: boolean };
type LogRow = { id: number; feature_id: string; kind: 'switch' | 'meta'; action: string; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; changed_by_name: string; changed_at: string };

// Walter's switch page (slice W1-1, docs/team/design-2026-11-24.md section 2.4). The list comes from
// packages/shared/src/features.ts, the questions and board references from the admin-only module
// (./admin-data, server only); on/off, legal state and team preview from public.admin_feature_rows()
// (admins only; the legal state is not public). Admin texts: English and Kiswahili.
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' });

export default async function FeaturesPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  const t = featuresText(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t.title}</h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Content locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/features`} />
        </div>
      </div>
    </div>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: SearchParams }) {
  await requireAdmin(locale);
  const t = featuresText(locale);
  const params = await searchParams;
  const legalOnly = params.filter === 'legal';
  const errors: Record<string, string> = { not_admin: t.errNotAdmin, locked: t.errLocked, unknown: t.errUnknown, date: t.errDate, failed: t.errFailed };
  const ok = params.ok === 'saved' ? t.saved : '';
  const error = typeof params.e === 'string' && Object.hasOwn(errors, params.e) ? errors[params.e] : '';

  const supabase = await createClient();
  const [rows, last, log] = await Promise.all([
    supabase.rpc('admin_feature_rows'),
    supabase.rpc('admin_feature_last_changes'),
    supabase.rpc('admin_feature_log', { p_limit: 50 }),
  ]);
  if (rows.error || last.error) {
    return (
      <section role="alert" className="card mt-4 space-y-3">
        <p>{isNotAppliedError(rows.error ?? last.error) ? t.notApplied : t.loadFailed}</p>
        <Link href={`/${locale}/admin/features`} className="btn-outline">{t.tryAgain}</Link>
      </section>
    );
  }
  const states: Record<string, State> = {};
  for (const r of (rows.data ?? []) as FeatureAdminRow[]) {
    states[r.feature_id] = { hasRow: r.has_row, on: r.on, legal: r.legal, legalCheckedOn: r.legal_checked_on, teamOnly: r.team_only };
  }
  const lastById = new Map(((last.data ?? []) as LastChange[]).map((r) => [r.feature_id, r]));
  const logRows = (log.data ?? []) as LogRow[];
  const today = tanzaniaToday();
  const visible = FEATURES.filter((f) => !f.hidden && (!legalOnly || states[f.id]?.legal === 'pending' || (!states[f.id] && f.legalPending)));

  return (
    <div className="mt-4 space-y-8">
      <p className="text-sm text-muted">{t.intro}</p>
      {ok && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{ok}</p>}
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
      <nav aria-label={t.legalPendingOnly} className="flex flex-wrap gap-3">
        <Link href={`/${locale}/admin/features`} aria-current={!legalOnly ? 'page' : undefined} className={!legalOnly ? 'btn' : 'btn-outline'}>{t.showAll}</Link>
        <Link href={`/${locale}/admin/features?filter=legal`} aria-current={legalOnly ? 'page' : undefined} className={legalOnly ? 'btn' : 'btn-outline'}>{t.legalPendingOnly}</Link>
      </nav>

      {FEATURE_PARTS.map((part) => {
        const items = visible.filter((f) => f.part === part.id);
        if (items.length === 0) return null;
        return (
          <section key={part.id} aria-labelledby={`part-${part.id}`} className="space-y-3">
            <h2 id={`part-${part.id}`} className="text-xl font-bold">{locale === 'sw' ? part.name.sw : part.name.en}</h2>
            <ul className="space-y-3">
              {items.map((f) => (
                <FeatureRow key={f.id} def={f} state={states[f.id]} last={lastById.get(f.id)} locale={locale} t={t} legalOnly={legalOnly} today={today} />
              ))}
            </ul>
          </section>
        );
      })}

      <details className="card">
        <summary className="cursor-pointer font-semibold">{t.log}</summary>
        {logRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t.noLog}</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {logRows.map((l) => (
              <li key={l.id}>
                {when(l.changed_at)}: {featureName(l.feature_id, locale)} {describe(l, t)}, {l.changed_by_name}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function describe(l: LogRow, t: FeaturesText): string {
  const onText = (v: Record<string, unknown> | null) => (v?.on === true ? t.on : t.off);
  if (l.action === 'created') {
    return l.kind === 'meta' ? `${t.setupChange} (legal: ${String(l.new_value?.legal ?? 'none')})` : `${t.setupChange} (${onText(l.new_value)})`;
  }
  if (l.action === 'deleted') return 'deleted';
  const parts: string[] = [];
  if (l.kind === 'switch' && l.old_value?.on !== l.new_value?.on) parts.push(`${onText(l.old_value)} to ${onText(l.new_value)}`);
  if (l.old_value?.legal !== l.new_value?.legal) parts.push(`legal: ${String(l.old_value?.legal ?? 'none')} to ${String(l.new_value?.legal ?? 'none')}`);
  if (l.old_value?.team_only !== l.new_value?.team_only) parts.push(`${t.teamOnly}: ${l.new_value?.team_only === true ? t.on : t.off}`);
  return parts.length ? parts.join(', ') : 'saved';
}

function Hidden({ id, locale, legalOnly }: { id: string; locale: Locale; legalOnly: boolean }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      {legalOnly && <input type="hidden" name="filter" value="legal" />}
    </>
  );
}

function FeatureRow({ def, state, last, locale, t, legalOnly, today }: {
  def: FeatureDef; state: State | undefined; last: LastChange | undefined; locale: Locale; t: FeaturesText; legalOnly: boolean; today: string;
}) {
  const name = featureName(def.id, locale);
  const on = state?.on === true;
  const legal = state?.legal ?? (def.legalPending ? 'pending' : 'none');
  const admin = FEATURE_ADMIN[def.id];
  return (
    <li id={`feature-${def.id}`} className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{name}</h3>
          <p className="text-sm text-muted">
            <code>{def.id}</code>{admin ? ` · ${t.boardRef} ${admin.boardRef}` : ''}
          </p>
        </div>
        <span className={`rounded-[5px] px-3 py-1 text-sm font-bold ${on ? 'bg-mint text-forest' : 'bg-surface text-charcoal'}`}>
          {def.lockedOff ? t.lockedOff : on ? t.on : t.off}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {legal === 'pending' && <span className="rounded-[5px] bg-surface px-3 py-1 text-xs font-bold text-charcoal">{t.legalPending}</span>}
        {legal === 'cleared' && state?.legalCheckedOn && (
          <span className="badge">{t.legalCheckedOn} {state.legalCheckedOn}</span>
        )}
        {state?.teamOnly && <span className="rounded-[5px] bg-sand px-3 py-1 text-xs font-bold text-charcoal">{t.teamOnly}</span>}
      </div>

      {admin?.legalQuestion && (
        <p className="text-sm"><span className="font-semibold">{t.legalQuestion}:</span> {admin.legalQuestion}</p>
      )}

      {!state?.hasRow ? (
        <p className="text-sm text-muted">{t.missingRow}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          {def.lockedOff ? (
            <p className="text-sm text-muted">{t.lockedOffNote}</p>
          ) : (
            <form action={setFeatureOn}>
              <Hidden id={def.id} locale={locale} legalOnly={legalOnly} />
              <input type="hidden" name="on" value={on ? 'false' : 'true'} />
              <button type="submit" className={on ? 'btn-outline' : 'btn'}>{on ? t.switchOff : t.switchOn}</button>
            </form>
          )}
          {!def.lockedOff && (
            <form action={setFeatureTeamOnly}>
              <Hidden id={def.id} locale={locale} legalOnly={legalOnly} />
              <input type="hidden" name="team_only" value={state.teamOnly ? 'false' : 'true'} />
              <button type="submit" className="btn-outline" aria-describedby={`team-${def.id}`}>{state.teamOnly ? t.teamOnlyOff : t.teamOnlyOn}</button>
              <span id={`team-${def.id}`} className="sr-only">{t.teamOnlyNote}</span>
            </form>
          )}
          {legal === 'cleared' ? (
            <form action={setFeatureLegal}>
              <Hidden id={def.id} locale={locale} legalOnly={legalOnly} />
              <input type="hidden" name="legal" value="pending" />
              <button type="submit" className="btn-outline">{t.markPending}</button>
            </form>
          ) : legal === 'pending' ? (
            <form action={setFeatureLegal} className="flex flex-wrap items-end gap-2">
              <Hidden id={def.id} locale={locale} legalOnly={legalOnly} />
              <input type="hidden" name="legal" value="cleared" />
              <label className="text-sm">
                <span className="block font-semibold">{t.checkedDate}</span>
                <input type="date" name="legal_checked_on" max={today} required className="rounded-[5px] border border-line px-2 py-1.5" />
              </label>
              <button type="submit" className="btn-outline">{t.markCleared}</button>
            </form>
          ) : null}
        </div>
      )}

      <p className="text-sm text-muted">
        {t.lastChange}: {last ? `${when(last.changed_at)}, ${last.changed_by_name}` : t.noChange}
      </p>
    </li>
  );
}
