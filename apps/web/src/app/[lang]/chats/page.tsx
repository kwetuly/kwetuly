import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { UsersRound } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { listMyChats } from '@/lib/chats';
import { createChat, joinChat } from './actions';

export const metadata: Metadata = { title: 'Group chats', robots: { index: false } };

export default async function ChatsPage({ searchParams }: PageProps<'/[lang]/chats'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold">
        <UsersRound className="size-7 text-leaf" aria-hidden /> {t.chats.title}
      </h1>
      <p className="mt-2 text-muted">{t.chats.subtitle}</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-3xl bg-surface" />}>
        <Chats searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Chats({ searchParams, t, locale }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary; locale: Locale }) {
  await requireUser(locale);
  const [chats, params] = await Promise.all([listMyChats(), searchParams]);
  const c = t.chats;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <form action={createChat} className="card space-y-3">
          <h2 className="font-bold">{c.newChat}</h2>
          {params.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
          <input type="hidden" name="locale" value={locale} />
          <label className="block">
            <span className="label">{c.chatName}</span>
            <input name="name" className="field" required maxLength={80} placeholder={c.chatNamePlaceholder} />
          </label>
          <button className="btn w-full">{c.create}</button>
        </form>
        <form action={joinChat} className="card space-y-3">
          <h2 className="font-bold">{c.joinWithCode}</h2>
          {params.joinError && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{c.joinError}</p>}
          <input type="hidden" name="locale" value={locale} />
          <input name="code" className="field" required maxLength={300} placeholder={c.codePlaceholder} aria-label={c.codePlaceholder} />
          <button className="btn-outline w-full">{c.join}</button>
        </form>
      </div>

      {chats.length === 0 ? (
        <p className="mt-8 text-muted">{c.none}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link href={`/${locale}/chats/${chat.id}`} className="flex items-center gap-4 p-4 transition hover:bg-sand">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-leaf font-bold text-white">
                  <UsersRound className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${chat.unread ? 'font-extrabold' : 'font-semibold'}`}>{chat.name}</span>
                  {chat.group_trip_id && <span className="text-xs text-muted">{c.tripChat}</span>}
                </span>
                {chat.unread && <span className="badge">{t.messages.newBadge}</span>}
                <span className="shrink-0 text-xs text-muted">{new Date(chat.last_message_at).toLocaleDateString(locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
