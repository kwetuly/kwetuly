import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { shortName, signMedia, type ChatMessage } from '@/lib/chats';
import { setFeatured } from '../actions';

export const metadata: Metadata = { title: 'Admin: shared media', robots: { index: false } };

// Photos, videos and tips travellers agreed to share. Feature the best ones on /moments.
// Items with an objection from someone in the chat cannot go public (the database enforces this too).
export default async function AdminMediaPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold">Shared by travellers</h1>
        <Link href={`/${locale}/moments`} className="btn-outline ml-auto px-4 py-2 text-sm">View public gallery →</Link>
      </div>
      <p className="mt-2 text-muted">
        Only items whose sender ticked “Rafrika may use this publicly”. If anyone in the chat objects, or the sender stops
        sharing, the item disappears from the site automatically.
      </p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-3xl bg-surface" />}>
        <Library locale={locale} />
      </Suspense>
    </div>
  );
}

async function Library({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from('group_chat_messages')
    .select('id, sender_id, sender_name, body, media_path, media_type, share_public, featured, created_at, group_chats(name)')
    .eq('share_public', true)
    .order('created_at', { ascending: false })
    .limit(120)
    .returns<(ChatMessage & { group_chats: { name: string } | null })[]>();
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [items, { data: objections }] = await Promise.all([
    signMedia(rows),
    ids.length
      ? supabase.from('group_chat_objections').select('message_id').in('message_id', ids).returns<{ message_id: string }[]>()
      : Promise.resolve({ data: [] as { message_id: string }[] }),
  ]);
  const blocked = new Set((objections ?? []).map((o) => o.message_id));

  if (items.length === 0) return <p className="mt-8 text-muted">Nothing shared yet.</p>;
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => (
        <figure key={m.id} className={`overflow-hidden rounded-3xl border bg-white ${m.featured ? 'border-forest' : 'border-line'} ${blocked.has(m.id) ? 'opacity-60' : ''}`}>
          {m.media_url && m.media_type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element -- signed link to a private file
            <img src={m.media_url} alt="" className="h-56 w-full object-cover" loading="lazy" />
          )}
          {m.media_url && m.media_type === 'video' && <video src={m.media_url} controls preload="metadata" className="h-56 w-full bg-black" />}
          <figcaption className="space-y-2 p-4 text-sm">
            {m.body && <p className="whitespace-pre-line">{m.body}</p>}
            <p className="text-xs text-muted">
              {shortName(m.sender_name)} · {m.group_chats?.name} · {new Date(m.created_at).toLocaleDateString('en-GB')}
            </p>
            {blocked.has(m.id) ? (
              <p className="font-semibold text-red-700">Someone in the chat objected. It can’t be used publicly.</p>
            ) : (
              <form action={setFeatured}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="message_id" value={m.id} />
                <input type="hidden" name="featured" value={m.featured ? 'false' : 'true'} />
                <button className={m.featured ? 'btn-outline w-full px-4 py-2 text-sm' : 'btn w-full px-4 py-2 text-sm'}>
                  {m.featured ? 'Remove from site' : 'Feature on the site'}
                </button>
              </form>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
