import type { Href } from 'expo-router';
import { useProfile, useSession } from './auth';

/**
 * Accounts that have not finished the welcome step (e.g. no invite code yet while Kwetuly is
 * invite-only) cannot create anything: the database refuses it. Screens with a form send them to
 * the welcome step instead, which brings them back to `next` afterwards.
 */
export function useNeedsSetup(): boolean {
  const { session } = useSession();
  const profile = useProfile();
  return !!session && !!profile.data && !profile.data.onboarded_at;
}

/** The welcome step, then back to `next` (an app path such as "/request/new"). */
export function welcomeHref(next?: string, role?: 'traveler' | 'guide' | 'provider'): Href {
  const params: Record<string, string> = {};
  if (next) params.next = next;
  if (role) params.role = role;
  return { pathname: '/welcome', params };
}

/** Where the welcome step may send people afterwards: only plain paths inside the app. */
export function safeNext(value: unknown): Href | null {
  const next = typeof value === 'string' ? value : '';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://') || next.includes('\\')) return null;
  if (/^\/(welcome|sign-in|intro)(\/|\?|$)/.test(next)) return null;
  return next as Href;
}

/** An app path with its search params, for `next` (empty values are left out). */
export function pathWithParams(path: string, params: Record<string, string | undefined>): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}
