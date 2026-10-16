import 'server-only';
import { randomBytes } from 'node:crypto';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Invite-only soft launch. The database is the one source of truth (migration 20261016001500):
// site_settings 'invite_only' switches the gate on or off, and the codes are stored hashed in
// private.invite_codes, managed on /admin/invites. The database checks the code itself when an
// account is created (email sign-up) and on the welcome step (complete_onboarding), so the website,
// the app and direct API calls all meet the same rule. Existing accounts are never asked.

function publicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** True while sign-up needs an invite code (shows the code field). */
export async function inviteRequired(): Promise<boolean> {
  'use cache';
  cacheTag('settings');
  cacheLife('minutes');
  const { data } = await publicClient().from('site_settings').select('value').eq('key', 'invite_only').maybeSingle<{ value: { enabled?: boolean } }>();
  return data?.value?.enabled === true;
}

/** The code as typed, trimmed and length-limited; the database compares it. */
export function inviteCodeInput(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim().slice(0, 200);
}

/** True when complete_onboarding refused the invite code. */
export function isInviteError(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes('invite_code_invalid'));
}

// No 0/O or 1/I/L, so codes read out over the phone survive. 12 characters ≈ 60 bits.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A new random invite code, e.g. RAF-7KQM-X2PD-9WTE. Shown to the admin once, then stored hashed. */
export function generateInviteCode(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `RAF-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
