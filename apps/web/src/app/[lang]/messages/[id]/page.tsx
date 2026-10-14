import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Flag, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CONVERSATION_COLUMNS, viewOf, type ConversationRow } from '@/lib/messages';
import { LiveRefresh } from '@/components/live-refresh';
import { reportMessage } from '../actions';
import { MessageComposer } from '@/components/message-composer';

export const metadata: Metadata = { title: 'Conversation', robots: { index: false } };

type Message = { id: string; sender_id: string; body: string; masked: boolean; created_at: string };

export default async function ConversationPage({ params, searchParams }: PageProps<'/[lang]/messages/[id]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <Thread params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Thread({
  params,
  searchParams,
  t,
  locale,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  t: Dictionary;
  locale: Locale;
}) {
  const user = await requireUser(locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const status = await searchParams;

  const supabase = await createClient();
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase.from('conversations').select(CONVERSATION_COLUMNS).eq('id', id).maybeSingle<ConversationRow>(),
    supabase.from('messages').select('id, sender_id, body, masked, created_at').eq('conversation_id', id).order('created_at').limit(500).returns<Message[]>(),
  ]);
  if (!conversation) notFound();

  const { isTraveler, otherName } = viewOf(conversation, user);
  // Mark as read for this side of the conversation.
  await supabase
    .from('conversations')
    .update(isTraveler ? { traveler_last_read_at: new Date().toISOString() } : { guide_last_read_at: new Date().toISOString() })
    .eq('id', id);

  const m = t.messages;

  return (
    <>
      <LiveRefresh conversationId={id} />
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/messages`} className="flex size-10 items-center justify-center rounded-[5px] border border-line hover:border-leaf" aria-label={m.back}>
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold">{otherName}</h1>
          {isTraveler && conversation.guides && (
            <Link href={`/${locale}/guides/${conversation.guides.slug}`} className="text-xs font-semibold text-forest underline">
              {t.dashboard.viewProfile}
            </Link>
          )}
        </div>
      </div>

      <p className={`mt-4 flex gap-2 rounded-[5px] p-3 text-xs ${conversation.contact_unlocked ? 'bg-mint text-forest' : 'bg-sand text-leaf-dark'}`}>
        {conversation.contact_unlocked ? <ShieldCheck className="size-4 shrink-0" aria-hidden /> : <LockKeyhole className="size-4 shrink-0" aria-hidden />}
        {conversation.contact_unlocked ? m.unlockedNote : m.hiddenNote}
      </p>
      {status.reported && <p className="mt-3 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">{m.reported}</p>}

      <ol className="mt-4 flex-1 space-y-3 rounded-[5px] bg-surface p-4" aria-live="polite">
        {(messages ?? []).map((msg) => {
          const mine = msg.sender_id === user.id;
          return (
            <li key={msg.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-[5px] px-4 py-2.5 text-sm shadow-sm ${mine ? ' bg-night text-white' : ' bg-white'}`}>
                {msg.body}
              </p>
              <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                {mine ? m.you : otherName} · {new Date(msg.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                {!mine && (
                  <form action={reportMessage} className="inline">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="conversation_id" value={id} />
                    <input type="hidden" name="message_id" value={msg.id} />
                    <button className="inline-flex items-center gap-0.5 opacity-60 hover:text-leaf hover:opacity-100" title={m.report}>
                      <Flag className="size-3" aria-hidden /> {m.report}
                    </button>
                  </form>
                )}
              </span>
            </li>
          );
        })}
        <li id="end" />
      </ol>

      <MessageComposer conversationId={id} locale={locale} labels={{ placeholder: m.placeholder, send: m.send, notSent: t.alerts.notSent }} />
    </>
  );
}
