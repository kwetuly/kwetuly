import 'server-only';
import type { CurrentUser } from './auth';
import { createClient } from './supabase/server';

export type ConversationRow = {
  id: string;
  traveler_id: string;
  traveler_name: string | null;
  /** Null for a business thread (migration 20261123000000_business_chat.sql). */
  guide_id: string | null;
  /** Set for a business thread; absent while that migration is not on the database. */
  provider_id?: string | null;
  /** True for every business thread, also after the business is deleted (then provider_id is null). */
  was_business?: boolean;
  contact_unlocked: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  traveler_last_read_at: string | null;
  /** The guide's or, in a business thread, the business owner's read time. */
  guide_last_read_at: string | null;
  guides: { display_name: string; slug: string; photo_url: string | null; owner_id: string } | null;
  providers?: { business_name: string; owner_id: string } | null;
};

/** Today's columns: the chat on live works with these before the business chat migration. */
export const LEGACY_CONVERSATION_COLUMNS =
  'id, traveler_id, traveler_name, guide_id, contact_unlocked, last_message_at, last_message_preview, traveler_last_read_at, guide_last_read_at, guides(display_name, slug, photo_url, owner_id)';

export const CONVERSATION_COLUMNS = `${LEGACY_CONVERSATION_COLUMNS}, provider_id, was_business, providers(business_name, owner_id)`;

/**
 * Missing column (42703 / PGRST204) or missing relationship (PGRST200): the business chat migration is
 * not applied, so the query is run again with today's columns. The live chat must keep working.
 */
export function missingChatColumns(error: { code?: string | null } | null | undefined): boolean {
  return !!error?.code && ['42703', 'PGRST204', 'PGRST200'].includes(error.code);
}

// Who is on the other side, and whether there's something unread, from this user's point of view.
export function viewOf(c: ConversationRow, user: CurrentUser, travellerLabel = 'Traveller') {
  const isTraveler = c.traveler_id === user.id;
  const isBusiness = c.was_business ?? !!c.provider_id;
  // A deleted business: the thread stays readable, nobody can send.
  const readOnly = isBusiness && !c.provider_id;
  const otherName = isTraveler ? (c.guides?.display_name ?? c.providers?.business_name ?? 'Guide') : (c.traveler_name ?? travellerLabel);
  const lastRead = isTraveler ? c.traveler_last_read_at : c.guide_last_read_at;
  const unread = !lastRead || new Date(c.last_message_at) > new Date(lastRead);
  return { isTraveler, isBusiness, readOnly, otherName, unread };
}

export async function listConversations() {
  const supabase = await createClient();
  const run = (columns: string) =>
    supabase.from('conversations').select(columns).order('last_message_at', { ascending: false }).limit(100).returns<ConversationRow[]>();
  let { data, error } = await run(CONVERSATION_COLUMNS);
  if (missingChatColumns(error)) ({ data, error } = await run(LEGACY_CONVERSATION_COLUMNS));
  return data ?? [];
}

export async function getConversation(id: string): Promise<ConversationRow | null> {
  const supabase = await createClient();
  const run = (columns: string) => supabase.from('conversations').select(columns).eq('id', id).maybeSingle<ConversationRow>();
  let { data, error } = await run(CONVERSATION_COLUMNS);
  if (missingChatColumns(error)) ({ data, error } = await run(LEGACY_CONVERSATION_COLUMNS));
  return data ?? null;
}
