import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { UserIdentity } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const SOCIAL_PROVIDERS = ['google', 'facebook', 'apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export const PROVIDER_NAMES: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook', apple: 'Apple' };

/** What happened after the in-app browser closed. */
export type ProviderResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'no_email' | 'linking_off' | 'taken' | 'only_one' | 'error' };

/** Which providers are switched on in Supabase, so the app only shows buttons that work. */
export async function enabledProviders(): Promise<SocialProvider[]> {
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    });
    if (!res.ok) return [];
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    const enabled = SOCIAL_PROVIDERS.filter((p) => settings.external?.[p]);
    // App Store rule: an iPhone app that offers Google or Facebook must also offer Apple.
    if (process.env.EXPO_OS === 'ios' && !enabled.includes('apple')) return [];
    return enabled;
  } catch {
    return [];
  }
}

// Supabase Auth's message when a provider returns no email and "Allow users without an email" is off
// (it has no error code for this case).
const NO_EMAIL = /user email from external provider/i;

/** Reads `code` or Supabase's error fields from the address the provider sent people back to (query or fragment). */
function readCallback(url: string): { code: string | null; error: string | null; errorCode: string | null; description: string } {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  const fragment = new URLSearchParams(hash);
  const get = (key: string) => params.get(key) ?? fragment.get(key);
  return { code: get('code'), error: get('error'), errorCode: get('error_code'), description: get('error_description') ?? '' };
}

function failure(errorCode: string | null | undefined, description = ''): ProviderResult {
  if (errorCode === 'manual_linking_disabled') return { ok: false, reason: 'linking_off' };
  if (errorCode === 'identity_already_exists') return { ok: false, reason: 'taken' };
  if (errorCode === 'single_identity_not_deletable') return { ok: false, reason: 'only_one' };
  if (NO_EMAIL.test(description)) return { ok: false, reason: 'no_email' };
  return { ok: false, reason: 'error' };
}

// Opens the provider in a secure in-app browser and finishes the sign-in or link when it comes back
// (kwetuly://auth-callback, or the Expo Go address while developing).
async function finishInBrowser(url: string, redirectTo: string): Promise<ProviderResult> {
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== 'success') return { ok: false, reason: 'cancelled' };
  const back = readCallback(result.url);
  if (back.error) return failure(back.errorCode, back.description);
  if (!back.code) return { ok: false, reason: 'error' };
  const { error } = await supabase.auth.exchangeCodeForSession(back.code);
  return error ? failure(error.code, error.message) : { ok: true };
}

/** Signs in with Google / Facebook / Apple. */
export async function signInWithProvider(provider: SocialProvider): Promise<ProviderResult> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return failure(error?.code, error?.message);
  return finishInBrowser(data.url, redirectTo);
}

/** Adds Google or Facebook to the signed-in account (Supabase manual linking). */
export async function linkProvider(provider: SocialProvider): Promise<ProviderResult> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return failure(error?.code, error?.message);
  return finishInBrowser(data.url, redirectTo);
}

/** Removes a sign-in, only while another way in remains (Supabase refuses the last one too). */
export async function unlinkProvider(identity: UserIdentity, total: number): Promise<ProviderResult> {
  if (total < 2) return { ok: false, reason: 'only_one' };
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) return failure(error.code, error.message);
  // The session still lists the removed sign-in until it is refreshed.
  await supabase.auth.refreshSession();
  return { ok: true };
}
