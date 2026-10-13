import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type GroupChat = {
  id: string;
  name: string;
  created_by: string;
  group_trip_id: string | null;
  invite_code: string;
  last_message_at: string;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  share_public: boolean;
  featured: boolean;
  created_at: string;
  /** Signed link to the photo or video, valid for an hour. */
  media_url?: string | null;
};

export const CHAT_MEDIA_BUCKET = 'chat-media';
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

// Signed links let members (and, for featured items, everyone) see private files for a while.
export async function signMedia<T extends { media_path: string | null }>(
  rows: T[],
  client?: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createSupabaseClient>,
  expiresInSeconds = 60 * 60,
): Promise<(T & { media_url: string | null })[]> {
  const paths = rows.map((r) => r.media_path).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return rows.map((r) => ({ ...r, media_url: null }));
  const supabase = client ?? (await createClient());
  const { data } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrls(paths, expiresInSeconds);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, media_url: r.media_path ? byPath.get(r.media_path) ?? null : null }));
}

export async function listMyChats(): Promise<(GroupChat & { unread: boolean })[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('group_chat_members')
    .select('last_read_at, group_chats(id, name, created_by, group_trip_id, invite_code, last_message_at)')
    .eq('user_id', user.id)
    .returns<{ last_read_at: string; group_chats: GroupChat | null }[]>();
  return (data ?? [])
    .filter((row) => row.group_chats)
    .map((row) => ({ ...row.group_chats!, unread: row.group_chats!.last_message_at > row.last_read_at }))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

export type Moment = Pick<ChatMessage, 'id' | 'sender_name' | 'body' | 'media_path' | 'media_type' | 'created_at'> & { media_url: string | null };

// Items travellers agreed to share and Rafrika featured, newest first, for the public gallery.
export async function listMoments(): Promise<Moment[]> {
  'use cache';
  cacheTag('moments');
  // Public links last 15 minutes and the page refreshes every 5, so a withdrawn photo stops
  // working within minutes even for someone who copied its link.
  cacheLife({ stale: 60, revalidate: 300, expire: 600 });

  const publicClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await publicClient
    .from('group_chat_messages')
    .select('id, sender_name, body, media_path, media_type, created_at')
    .eq('share_public', true)
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as Omit<Moment, 'media_url'>[];
  return signMedia(rows, publicClient, 15 * 60);
}

// Public display name: first name and initial only.
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}` : 'Traveller';
}
