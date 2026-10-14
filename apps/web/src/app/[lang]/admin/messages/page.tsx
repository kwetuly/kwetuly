import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveReport, unlockConversation } from './actions';

export const metadata: Metadata = { title: 'Admin: messages', robots: { index: false } };

type Report = {
  id: string;
  reason: string | null;
  created_at: string;
  messages: { id: string; body: string; conversation_id: string; message_moderation: { original_body: string } | null } | null;
};

type Masked = {
  message_id: string;
  original_body: string;
  created_at: string;
  messages: { conversation_id: string; conversations: { contact_unlocked: boolean; traveler_name: string | null; guides: { display_name: string } | null } | null } | null;
};

export default async function AdminMessagesPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold">Message safety</h1>
        <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">← Admin</Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Reported messages, and messages where contact details were hidden. Unlock a conversation only once a booking is confirmed.
      </p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Moderation locale={locale} />
      </Suspense>
    </div>
  );
}

async function Moderation({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const supabase = await createClient();

  const [{ data: reports }, { data: masked }] = await Promise.all([
    supabase
      .from('message_reports')
      .select('id, reason, created_at, messages(id, body, conversation_id, message_moderation(original_body))')
      .eq('resolved', false)
      .order('created_at')
      .returns<Report[]>(),
    supabase
      .from('message_moderation')
      .select('message_id, original_body, created_at, messages(conversation_id, conversations(contact_unlocked, traveler_name, guides(display_name)))')
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<Masked[]>(),
  ]);

  return (
    <>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Open reports ({reports?.length ?? 0})</h2>
        <div className="mt-4 space-y-3">
          {(reports ?? []).map((r) => (
            <div key={r.id} className="card flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1 text-sm">
                <p className="whitespace-pre-wrap">{r.messages?.message_moderation?.original_body ?? r.messages?.body}</p>
                {r.reason && <p className="mt-1 text-muted">Reason: {r.reason}</p>}
              </div>
              <form action={resolveReport}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="report_id" value={r.id} />
                <button className="btn-outline px-4 py-2 text-sm">Mark resolved</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Hidden contact details (latest 50)</h2>
        <div className="mt-4 space-y-3">
          {(masked ?? []).map((m) => {
            const c = m.messages?.conversations;
            return (
              <div key={m.message_id} className="card flex flex-wrap items-start gap-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted">
                    {c?.traveler_name} ↔ {c?.guides?.display_name} · {new Date(m.created_at).toLocaleString(locale)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.original_body}</p>
                </div>
                {c && !c.contact_unlocked && m.messages && (
                  <form action={unlockConversation}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="conversation_id" value={m.messages.conversation_id} />
                    <button className="btn-outline px-4 py-2 text-sm">Unlock contact sharing</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
