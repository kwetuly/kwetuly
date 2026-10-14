import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Bell, BellOff, Globe, ShieldOff, Sparkles, UserPlus } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signMedia, type ChatMessage, type GroupChat } from '@/lib/chats';
import { ChatComposer } from '@/components/chat-composer';
import { LiveChatRefresh } from '@/components/live-chat-refresh';
import { ShareButtons } from '@/components/share-buttons';
import { ShareMedia } from '@/components/share-media';
import { deleteChatMessage, leaveChat, setMuted, setObjection, setShareConsent } from '../actions';

export const metadata: Metadata = { title: 'Group chat', robots: { index: false } };

export default async function ChatPage({ params }: PageProps<'/[lang]/chats/[id]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <Chat params={params} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Chat({ params, t, locale }: { params: Promise<{ id: string }>; t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: chat }, { data: members }, { data: rows }] = await Promise.all([
    supabase.from('group_chats').select('id, name, created_by, group_trip_id, invite_code, last_message_at').eq('id', id).maybeSingle<GroupChat>(),
    supabase.from('group_chat_members').select('user_id, display_name, role, muted').eq('chat_id', id).order('joined_at').returns<{ user_id: string; display_name: string; role: string; muted: boolean }[]>(),
    supabase
      .from('group_chat_messages')
      .select('id, sender_id, sender_name, body, media_path, media_type, share_public, featured, created_at')
      .eq('chat_id', id)
      .order('created_at')
      .limit(300)
      .returns<ChatMessage[]>(),
  ]);
  if (!chat || !members?.some((m) => m.user_id === user.id)) notFound();

  await supabase.from('group_chat_members').update({ last_read_at: new Date().toISOString() }).eq('chat_id', id).eq('user_id', user.id);

  const sharedIds = (rows ?? []).filter((r) => r.share_public).map((r) => r.id);
  const [messages, { data: objections }] = await Promise.all([
    signMedia(rows ?? []),
    sharedIds.length
      ? supabase.from('group_chat_objections').select('message_id, user_id').in('message_id', sharedIds).returns<{ message_id: string; user_id: string }[]>()
      : Promise.resolve({ data: [] as { message_id: string; user_id: string }[] }),
  ]);
  const objected = new Map<string, Set<string>>();
  for (const o of objections ?? []) {
    if (!objected.has(o.message_id)) objected.set(o.message_id, new Set());
    objected.get(o.message_id)!.add(o.user_id);
  }
  const c = t.chats;
  const muted = members.find((m) => m.user_id === user.id)?.muted ?? false;
  const time = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <LiveChatRefresh chatId={id} />
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/chats`} className="flex size-10 items-center justify-center rounded-[5px] border border-line hover:border-leaf" aria-label={c.title}>
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{chat.name}</h1>
          <p className="truncate text-xs text-muted">
            {c.members}: {members.length} · {members.map((m) => m.display_name.split(' ')[0]).join(', ')}
          </p>
        </div>
      </div>

      <form action={setMuted} className="mt-2 flex justify-end">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="chat_id" value={id} />
        <input type="hidden" name="muted" value={muted ? 'false' : 'true'} />
        <button className="inline-flex items-center gap-1.5 rounded-[5px] border border-line px-3 py-1.5 text-xs font-semibold hover:border-leaf" title={muted ? t.alerts.muted : undefined}>
          {muted ? <BellOff className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />} {muted ? t.alerts.unmute : t.alerts.mute}
        </button>
      </form>

      <details className="card mt-2 p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
          <UserPlus className="size-5 text-leaf" aria-hidden /> {c.invite}
        </summary>
        <p className="mt-2 text-sm text-muted">{c.inviteBody}</p>
        <div className="mt-3">
          <ShareButtons path={`/${locale}/chats/join/${chat.invite_code}`} title={chat.name} text={`${c.invite}: ${chat.name}`} labels={t.share} />
        </div>
        <form action={leaveChat} className="mt-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="chat_id" value={id} />
          <button className="text-xs font-semibold text-muted underline hover:text-red-700">{c.leave}</button>
        </form>
      </details>

      <ol className="mt-4 flex-1 space-y-4 rounded-[5px] bg-surface p-4" aria-live="polite">
        {messages.map((msg) => {
          const mine = msg.sender_id === user.id;
          const objectors = objected.get(msg.id);
          const iObject = objectors?.has(user.id) ?? false;
          const blocked = (objectors?.size ?? 0) > 0;
          const isPublic = msg.share_public && msg.featured && !blocked;
          return (
            <li key={msg.id} id={`m-${msg.id}`} className={`flex scroll-mt-24 flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && <span className="mb-1 text-xs font-semibold text-muted">{msg.sender_name}</span>}
              <div className={`max-w-[85%] overflow-hidden rounded-[5px] shadow-sm ${mine ? ' bg-night text-white' : ' bg-white'}`}>
                {msg.media_url && msg.media_type === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to a private file
                  <img src={msg.media_url} alt="" className="max-h-96 w-full object-cover" loading="lazy" />
                )}
                {msg.media_url && msg.media_type === 'video' && (
                  <video src={msg.media_url} controls playsInline preload="metadata" className="max-h-96 w-full bg-black" />
                )}
                {msg.body && <p className="whitespace-pre-wrap px-4 py-2.5 text-sm">{msg.body}</p>}
              </div>

              <div className={`mt-1 flex max-w-[85%] flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted ${mine ? 'justify-end' : ''}`}>
                <span>{time.format(new Date(msg.created_at))}</span>
                {isPublic && (
                  <span className="inline-flex items-center gap-1 font-semibold text-forest"><Sparkles className="size-3" aria-hidden /> {c.featured}</span>
                )}
                {msg.media_url && msg.media_path && (
                  <ShareMedia url={msg.media_url} name={msg.media_path.split('/').pop() ?? 'rafrika'} labels={{ share: c.shareToApps, download: c.download }} />
                )}
              </div>

              {/* Sender decides whether Rafrika may use it publicly. */}
              {mine && (
                <form action={setShareConsent} className="mt-1">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="chat_id" value={id} />
                  <input type="hidden" name="message_id" value={msg.id} />
                  <input type="hidden" name="share_public" value={msg.share_public ? 'false' : 'true'} />
                  <button className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs font-semibold ${msg.share_public ? 'bg-mint text-forest' : 'hover:bg-white'}`}>
                    <Globe className="size-3.5" aria-hidden /> {msg.share_public ? `${c.sharedPublicly} · ${c.stopSharing}` : c.shareConsent}
                  </button>
                </form>
              )}
              {mine && (
                <form action={deleteChatMessage} className="mt-1">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="chat_id" value={id} />
                  <input type="hidden" name="message_id" value={msg.id} />
                  <button className="rounded-[5px] px-2 py-1 text-[11px] font-semibold text-muted hover:bg-white hover:text-red-700">{c.delete}</button>
                </form>
              )}
              {mine && blocked && <p className="mt-1 max-w-[85%] text-right text-[11px] text-leaf-dark">{c.objectionNote}</p>}

              {/* Anyone else in the chat can block public use of something they appear in. */}
              {!mine && msg.share_public && (
                <form action={setObjection} className="mt-1">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="chat_id" value={id} />
                  <input type="hidden" name="message_id" value={msg.id} />
                  <input type="hidden" name="object" value={iObject ? 'false' : 'true'} />
                  <button className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs font-semibold ${iObject ? 'bg-sand text-leaf-dark' : 'hover:bg-white'}`}>
                    <ShieldOff className="size-3.5" aria-hidden /> {iObject ? `${c.objected} · ${c.withdrawObjection}` : c.objectCta}
                  </button>
                </form>
              )}
            </li>
          );
        })}
        <li id="end" />
      </ol>

      <ChatComposer
        chatId={id}
        locale={locale}
        labels={{
          placeholder: c.placeholder,
          send: c.send,
          attach: c.attach,
          uploading: c.uploading,
          uploadError: c.uploadError,
          tooBig: c.tooBig,
          shareConsent: c.shareConsent,
          consentNote: c.consentNote,
          notSent: t.alerts.notSent,
        }}
      />
    </>
  );
}
