import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Join group chat', robots: { index: false } };

// Opening an invite link joins the chat (after signing in) and goes straight to it.
export default async function JoinChatPage({ params }: PageProps<'/[lang]/chats/join/[code]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Suspense fallback={<div className="card h-40 animate-pulse" />}>
        <Join params={params} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Join({ params, t, locale }: { params: Promise<{ code: string }>; t: Dictionary; locale: Locale }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="card space-y-4 text-center">
        <h1 className="text-2xl font-extrabold">{t.chats.title}</h1>
        <p className="text-muted">{t.chats.inviteBody}</p>
        <div className="flex justify-center gap-2">
          <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/chats/join/${code}`)}`} className="btn-outline">{t.nav.signIn}</Link>
          <Link href={`/${locale}/join?role=traveler`} className="btn">{t.nav.signUp}</Link>
        </div>
      </div>
    );
  }
  if (!user.onboarded) redirect(`/${locale}/welcome`);

  const supabase = await createClient();
  const { data, error } = /^[0-9a-f]{18}$/.test(code) ? await supabase.rpc('join_group_chat', { p_code: code }) : { data: null, error: true };
  if (!error && data) redirect(`/${locale}/chats/${data}`);
  return <p className="card text-red-800">{t.chats.joinError}</p>;
}
