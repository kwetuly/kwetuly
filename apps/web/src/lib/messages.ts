import 'server-only';
import type { CurrentUser } from './auth';
import { createClient } from './supabase/server';

export type ConversationRow = {
  id: string;
  traveler_id: string;
  traveler_name: string | null;
  guide_id: string;
  contact_unlocked: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  traveler_last_read_at: string | null;
  guide_last_read_at: string | null;
  guides: { display_name: string; slug: string; photo_url: string | null; owner_id: string } | null;
};

export const CONVERSATION_COLUMNS =
  'id, traveler_id, traveler_name, guide_id, contact_unlocked, last_message_at, last_message_preview, traveler_last_read_at, guide_last_read_at, guides(display_name, slug, photo_url, owner_id)';

// Who is on the other side, and whether there's something unread, from this user's point of view.
export function viewOf(c: ConversationRow, user: CurrentUser) {
  const isTraveler = c.traveler_id === user.id;
  const otherName = isTraveler ? (c.guides?.display_name ?? 'Guide') : (c.traveler_name ?? 'Traveller');
  const lastRead = isTraveler ? c.traveler_last_read_at : c.guide_last_read_at;
  const unread = !lastRead || new Date(c.last_message_at) > new Date(lastRead);
  return { isTraveler, otherName, unread };
}

export async function listConversations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .order('last_message_at', { ascending: false })
    .limit(100)
    .returns<ConversationRow[]>();
  return data ?? [];
}
