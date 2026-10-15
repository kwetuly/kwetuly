import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Clock } from 'lucide-react';
import { formatUsd } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireHubAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { topicName, type CallStatus } from '@/lib/labels';
import { respondToCall } from './actions';

export const metadata: Metadata = { title: 'Guide Hub', robots: { index: false } };

type IncomingCall = {
  id: string;
  topic: string;
  preferred_times: string | null;
  message: string | null;
  traveler_contact: string | null;
  status: CallStatus;
  scheduled_at: string | null;
  price_usd: number | null;
  created_at: string;
};

type Deposit = { id: string; description: string; amount_tzs: number; amount_usd: number; paid_at: string | null; payout_done: boolean };

type Lead = { id: string; traveler_name: string | null; traveler_contact: string | null; message: string | null; created_at: string; guide_packages: { title: string } | null };

export default async function HubHome() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <h1 className="text-3xl font-extrabold">{t.hub.title}</h1>
      <p className="mt-1 text-muted">{t.hub.subtitle}</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-white" />}>
        <Inbox t={t} locale={locale} />
      </Suspense>
    </>
  );
}

async function Inbox({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireHubAccess(locale);
  const supabase = await createClient();
  const guideId = user.guide?.id ?? '00000000-0000-0000-0000-000000000000';

  const [{ data: calls }, { data: leads }, { data: deposits }, { count: openCount }] = await Promise.all([
    supabase
      .from('call_requests')
      .select('id, topic, preferred_times, message, traveler_contact, status, scheduled_at, price_usd, created_at')
      .eq('guide_id', guideId)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<IncomingCall[]>(),
    supabase
      .from('leads')
      .select('id, traveler_name, traveler_contact, message, created_at, guide_packages(title)')
      .eq('guide_id', guideId)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<Lead[]>(),
    supabase
      .from('payments')
      .select('id, description, amount_tzs, amount_usd, paid_at, payout_done')
      .eq('payee_user_id', user.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(50)
      .returns<Deposit[]>(),
    supabase.from('trip_requests').select('id', { count: 'exact', head: true }).eq('status', 'open').neq('traveler_id', user.id),
  ]);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <Link href={`/${locale}/requests`} className="card flex items-center justify-between gap-4 p-5 hover:border-leaf lg:col-span-2">
        <span className="font-bold">{t.hub.openRequests}</span>
        <span className="text-2xl font-extrabold tabular-nums text-leaf-dark">{openCount ?? 0}</span>
      </Link>

      {/* Deposits as statement rows: date, trip, amount, where the money is. */}
      <section id="deposits" className="card lg:col-span-2">
        <h2 className="text-lg font-bold">{t.hub.depositsTitle}</h2>
        {(deposits ?? []).length === 0 && <p className="mt-3 text-sm text-muted">{t.hub.noDeposits}</p>}
        <ul className="mt-3 divide-y divide-line text-sm">
          {(deposits ?? []).map((d) => (
            <li key={d.id} className="grid grid-cols-[4rem_1fr_auto] items-baseline gap-3 py-3">
              <span className="tabular-nums text-muted">{d.paid_at ? day.format(new Date(d.paid_at)) : ''}</span>
              <span className="min-w-0 truncate font-semibold">{d.description}</span>
              <span className="text-right">
                <span className="block font-bold tabular-nums">TSh {d.amount_tzs.toLocaleString('en-US')}</span>
                <span className="block text-xs text-muted tabular-nums">{formatUsd(Number(d.amount_usd))} · {d.payout_done ? t.hub.depositPaidOut : t.hub.depositHeld}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="calls" className="card">
        <h2 className="text-lg font-bold">{t.hub.calls}</h2>
        {(calls ?? []).length === 0 && <p className="mt-3 text-sm text-muted">{t.hub.noRequests}</p>}
        <ul className="mt-4 space-y-4">
          {(calls ?? []).map((c) => (
            <li key={c.id} className="rounded-[5px] border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm tabular-nums text-muted">{day.format(new Date(c.created_at))}</span>
                <span className="font-semibold">{topicName(c.topic, locale)}</span>
                {c.price_usd != null && <span className="text-sm tabular-nums text-muted">{formatUsd(c.price_usd)}</span>}
                <span className="badge ml-auto">{t.hub.status[c.status]}</span>
              </div>
              {c.preferred_times && <p className="mt-2 flex items-start gap-1.5 text-sm"><Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> {c.preferred_times}</p>}
              {c.message && <p className="mt-1 text-sm text-muted">{c.message}</p>}
              {c.traveler_contact && <p className="mt-1 text-sm">{c.traveler_contact}</p>}
              {c.status === 'requested' && (
                <form action={respondToCall} className="mt-3 grid gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="call_id" value={c.id} />
                  <label className="text-xs font-semibold">
                    {t.hub.scheduledAt}
                    <input type="datetime-local" name="scheduled_at" className="field mt-1" />
                  </label>
                  <input name="meeting_link" className="field" placeholder={t.hub.meetingLink} />
                  <div className="flex gap-2">
                    <button name="decision" value="accept" className="btn px-4 py-2 text-sm">{t.hub.accept}</button>
                    <button name="decision" value="decline" className="btn-outline px-4 py-2 text-sm">{t.hub.decline}</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold">{t.hub.requests}</h2>
        {(leads ?? []).length === 0 && <p className="mt-3 text-sm text-muted">{t.hub.noRequests}</p>}
        <ul className="mt-4 divide-y divide-line">
          {(leads ?? []).map((l) => (
            <li key={l.id} className="py-3 text-sm">
              <p className="font-semibold"><span className="mr-2 font-normal tabular-nums text-muted">{day.format(new Date(l.created_at))}</span>{l.traveler_name} · <span className="font-normal text-muted">{l.traveler_contact}</span></p>
              {l.guide_packages && <p className="mt-1 text-sm font-semibold text-forest">{t.packages.about.replace('{title}', l.guide_packages.title)}</p>}
              <p className="mt-1">{l.message}</p>
            </li>
          ))}
        </ul>
        <Link href={`/${locale}/dashboard`} className="mt-4 inline-block text-sm font-semibold text-forest underline">
          {t.nav.dashboard}
        </Link>
      </section>
    </div>
  );
}
