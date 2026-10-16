import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

// Invite-only soft launch. SIGNUP_INVITE_CODES is a server-only, comma-separated list of codes.
// When it is set, new accounts (email sign-up and the welcome step after Google / Facebook / Apple)
// need one of the codes. When it is unset or empty, sign-up works for everyone, as before.
// Existing accounts signing in are never asked.

function inviteCodes(): string[] {
  return (process.env.SIGNUP_INVITE_CODES ?? '')
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
}

const digest = (value: string) => createHash('sha256').update(value).digest();

export function inviteRequired(): boolean {
  return inviteCodes().length > 0;
}

/** Case-insensitive; compares fixed-length hashes in constant time and checks every code. */
export function inviteCodeAccepted(input: FormDataEntryValue | null): boolean {
  const codes = inviteCodes();
  if (codes.length === 0) return true;
  const given = digest(String(input ?? '').trim().toLowerCase().slice(0, 200));
  let match = false;
  for (const code of codes) {
    if (timingSafeEqual(given, digest(code))) match = true;
  }
  return match;
}
