import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MessagesSquare } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { listConversations, viewOf } from '@/lib/messages';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };

export default async function MessagesPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold">
        <MessagesSquare className="size-7 text-sunset" aria-hidden /> {t.messages.title}
      </h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-3xl bg-surface" />}>
        <Inbox t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Inbox({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireUser(locale);
  const conversations = await listConversations();

  if (conversations.length === 0) {
    return (
      <div className="card mt-6">
        <p>{t.messages.none}</p>
        {!user.guide && (
          <>
            <p className="mt-1 text-sm text-muted">{t.messages.noneTraveler}</p>
            <Link href={`/${locale}/guides`} className="btn mt-4">{t.nav.guides}</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
      {conversations.map((c) => {
        const { otherName, unread } = viewOf(c, user);
        return (
          <li key={c.id}>
            <Link href={`/${locale}/messages/${c.id}`} className="flex items-center gap-4 p-4 transition hover:bg-sand">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-lg font-bold text-forest">
                {otherName.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`truncate ${unread ? 'font-extrabold' : 'font-semibold'}`}>{otherName}</span>
                  {unread && c.last_message_preview && <span className="badge">{t.messages.newBadge}</span>}
                </span>
                <span className="block truncate text-sm text-muted">{c.last_message_preview ?? '…'}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{new Date(c.last_message_at).toLocaleDateString(locale)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
