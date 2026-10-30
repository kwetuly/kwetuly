import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export const SOCIAL_PROVIDERS = ['google', 'facebook', 'apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

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

/**
 * Signs in with Google / Facebook / Apple in a secure in-app browser and returns to the app
 * (kwetuly://auth-callback, or the Expo Go address while developing). Returns true when signed in.
 */
export async function signInWithProvider(provider: SocialProvider): Promise<boolean> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return false;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) return false;
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  return !exchangeError;
}
