import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AlertTriangle, BadgeCheck, CircleDashed, Clock, CreditCard, XCircle } from 'lucide-react';
import { fillText, formatTzsAmount, lipaMemberText, tanzaniaToday, verificationSummary, verificationText, type MemberCheck, type VerificationText } from '@kwetuly/shared';
import { PayNow } from '@/components/pay-now';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MemberVerification, type OwnDocument, type OwnIdentifiers } from './member-verification';
import { formatDay } from './format';

export async function generateMetadata(): Promise<Metadata> {
  const v = verificationText(await getLocale());
  return { title: v.title, robots: { index: false } };
}

// Member verification (paid verification, plan 3): guides and business owners send documents for
// Kwetuly to check, save identity numbers and, later, pay to switch verification on. Travellers never
// see this page's tools. Uploads and withdrawals work now; numbers and payments say "opens soon" until
// their switches are on.
export default async function VerificationPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const v = verificationText(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline">{t.nav.dashboard}</Link>
      <h1 className="mt-2 text-3xl font-bold">{v.title}</h1>
      <Suspense fallback={<Loading />}>
        <Content locale={locale} v={v} dashboard={t.nav.dashboard} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="mt-6 space-y-4">
      <div className="h-28 animate-pulse rounded-[5px] bg-line" />
      <div className="h-40 animate-pulse rounded-[5px] bg-line" />
      <div className="h-40 animate-pulse rounded-[5px] bg-line" />
    </div>
  );
}

async function Content({ locale, v, dashboard }: { locale: Locale; v: VerificationText; dashboard: string }) {
  const user = await requireUser(locale, `/${locale}/dashboard/verification`);
  const supabase = await createClient();
  const { data: providers } = await supabase.from('providers').select('id, business_name').eq('owner_id', user.id).order('created_at');
  const guide = user.role === 'guide' || Boolean(user.guide);
  const business = user.role === 'provider' || (providers ?? []).length > 0;
  if (!guide && !business && user.role !== 'admin') {
    return (
      <div className="card mt-6 space-y-4">
        <p>{v.forMembersOnly}</p>
        <Link href={`/${locale}/dashboard`} className="btn-outline">{dashboard}</Link>
      </div>
    );
  }

  const [documents, checks, ids, tins] = await Promise.all([
    supabase
      .from('person_documents')
      .select('id, kind, title, provider_id, path, review_state, review_reason, stated_valid_until, uploaded_at, reviewed_at')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(100),
    supabase.from('person_document_checks').select('id, kind, title, provider_id, checked_at, valid_until, ended_at').eq('user_id', user.id).is('ended_at', null),
    supabase.rpc('my_identifiers'),
    // Not applied yet (supabase/migrations/20261122000100_my_business_identifiers.sql): no row means "nothing saved".
    supabase.rpc('my_business_identifiers'),
  ]);
  if (documents.error || checks.error) {
    return (
      <div className="card mt-6 space-y-4" role="alert">
        <p>{v.loadError}</p>
        <Link href={`/${locale}/dashboard/verification`} className="btn-outline">{v.retry}</Link>
      </div>
    );
  }
  const docs = (documents.data ?? []) as OwnDocument[];
  const current = (checks.data ?? []) as MemberCheck[];
  const today = tanzaniaToday();
  const summary = verificationSummary(docs, current, today);
  const identifiers = ((ids.data ?? []) as OwnIdentifiers[])[0] ?? null;
  const businessTins = Object.fromEntries(((tins.error ? [] : (tins.data ?? [])) as { provider_id: string; tin_last3: string }[]).map((r) => [r.provider_id, r.tin_last3]));

  return (
    <div className="mt-2 space-y-6">
      {/* Only guides and owners read the intro; travellers get forMembersOnly above (QA issue 1). */}
      <p className="text-muted">{v.intro}</p>
      <StatusCard summary={summary} v={v} locale={locale} />
      <MemberVerification
        userId={user.id}
        locale={locale}
        today={today}
        guide={guide || user.role === 'admin'}
        business={business}
        providers={(providers ?? []).map((p) => ({ id: p.id as string, name: p.business_name as string }))}
        documents={docs}
        checks={current}
        identifiers={identifiers}
        businessTins={businessTins}
      />
      <MemberPay locale={locale} guide={guide || user.role === 'admin'} hasCheck={current.length > 0} providers={(providers ?? []).map((p) => ({ id: p.id as string, name: p.business_name as string }))} />
    </div>
  );
}

function StatusCard({ summary, v, locale }: { summary: ReturnType<typeof verificationSummary>; v: VerificationText; locale: Locale }) {
  const s = v.status[summary.state];
  const date = formatDay(summary.activeUntil, locale);
  const look = {
    none: { Icon: CircleDashed, tone: 'bg-white border border-line' },
    waiting: { Icon: Clock, tone: 'bg-sand' },
    checked: { Icon: BadgeCheck, tone: 'bg-mint text-forest' },
    rejected: { Icon: XCircle, tone: 'bg-red-50 text-red-900' },
    expiring: { Icon: AlertTriangle, tone: 'bg-sand' },
    expired: { Icon: AlertTriangle, tone: 'bg-red-50 text-red-900' },
  }[summary.state];
  let body = s.body;
  if (summary.state === 'waiting') body = fillText(s.body, { count: summary.waiting });
  if (summary.state === 'checked') body = summary.activeUntil ? fillText(s.body, { date }) : v.checkedNoDate;
  if (summary.state === 'expiring' || summary.state === 'expired') body = fillText(s.body, { date });
  if (summary.state === 'rejected' && summary.rejected) {
    body = fillText(s.body, { kind: summary.rejected.title ?? v.kinds[summary.rejected.kind], reason: summary.rejected.review_reason ? v.reasons[summary.rejected.review_reason] : v.reasons.other });
  }
  return (
    <section aria-labelledby="status-title" className={`rounded-[5px] p-5 ${look.tone}`}>
      <h2 id="status-title" className="flex items-center gap-2 text-xl font-bold">
        <look.Icon className="size-6 shrink-0" aria-hidden /> {s.title}
      </h2>
      <p className="mt-2">{body}</p>
      {summary.lastChecked && summary.state !== 'none' && <p className="mt-1 text-sm opacity-80">{fillText(v.lastChecked, { date: formatDay(summary.lastChecked, locale) })}</p>}
      {summary.waiting > 0 && summary.state !== 'waiting' && <p className="mt-1 text-sm opacity-80">{fillText(v.status.waiting.body, { count: summary.waiting })}</p>}
    </section>
  );
}

type PriceRow = { service_code: string; account_type: string; business_type: string | null; period: string; amount_tzs: number | null; active_from: string | null; active_to: string | null };
type Sub = { service_code: string; provider_id: string | null; paid_until: string };

// Paid verification and the badge by Lipa number (manual payments, 2026-11-26). Prices come from
// /admin/prices (public active rows); the server works the amount out again when the order starts.
// Documents first, then pay: without a current check the guide sees "send your documents first".
async function MemberPay({ locale, guide, hasCheck, providers }: { locale: Locale; guide: boolean; hasCheck: boolean; providers: { id: string; name: string }[] }) {
  const m = lipaMemberText(locale);
  const supabase = await createClient();
  const today = tanzaniaToday();
  const [prices, subs] = await Promise.all([
    supabase.from('price_list').select('service_code, account_type, business_type, period, amount_tzs, active_from, active_to')
      .in('service_code', ['verification', 'business_badge']).eq('status', 'active'),
    supabase.rpc('my_subscriptions'),
  ]);
  const live = ((prices.data ?? []) as PriceRow[]).filter((p) => p.amount_tzs && p.active_from && p.active_from <= today && (!p.active_to || p.active_to > today));
  const price = (code: string, period: string, type: string) => live.find((p) => p.service_code === code && p.period === period && p.account_type === type)?.amount_tzs ?? null;
  const paid = (subs.error ? [] : (subs.data ?? [])) as Sub[];
  const back = `/${locale}/dashboard/verification`;
  const verificationUntil = paid.find((s) => s.service_code === 'verification')?.paid_until;
  const month = price('verification', 'month', 'guide');
  const year = price('verification', 'year', 'guide');
  const badge = price('business_badge', 'year', 'business');
  return (
    <>
      {guide && (
        <section aria-labelledby="pay-title" className="card space-y-3">
          <h2 id="pay-title" className="flex items-center gap-2 text-lg font-bold">
            <CreditCard className="size-5 text-leaf-dark" aria-hidden /> {m.payTitle}
          </h2>
          <p className="text-sm text-muted">{m.payBody}</p>
          {verificationUntil && <p className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{fillText(m.paidUntil, { date: formatDay(verificationUntil, locale) })}</p>}
          {!hasCheck ? (
            <p className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{m.checksFirst}</p>
          ) : !month && !year ? (
            <p className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{m.priceNotSet}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {month && <PayNow purpose="verification" period="month" amountTzs={month} locale={locale} back={back} buttonLabel={fillText(m.payMonth, { amount: formatTzsAmount(month) })} />}
              {year && <PayNow purpose="verification" period="year" amountTzs={year} locale={locale} back={back} buttonLabel={fillText(m.payYear, { amount: formatTzsAmount(year) })} buttonClassName="btn-outline w-full" />}
            </div>
          )}
        </section>
      )}
      {providers.map((p) => {
        const until = paid.find((s) => s.service_code === 'business_badge' && s.provider_id === p.id)?.paid_until;
        return (
          <section key={p.id} aria-labelledby={`badge-${p.id}`} className="card space-y-3">
            <h2 id={`badge-${p.id}`} className="text-lg font-bold">{m.badgeTitle}: {p.name}</h2>
            <p className="text-sm text-muted">{m.badgeBody}</p>
            {until && <p className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{fillText(m.badgePaidUntil, { date: formatDay(until, locale) })}</p>}
            {badge ? (
              <PayNow purpose="business_badge" subject={p.id} amountTzs={badge} locale={locale} back={back} buttonLabel={fillText(m.badgePay, { amount: formatTzsAmount(badge) })} />
            ) : (
              <p className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{m.priceNotSet}</p>
            )}
          </section>
        );
      })}
      <Link href={`/${locale}/payments/orders`} className="btn-outline">{m.myPayments}</Link>
    </>
  );
}
