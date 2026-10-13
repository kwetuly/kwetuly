import type { Href } from 'expo-router';
import { supabase } from './supabase';

// The web preview of the app has no phone alerts.
export type PushState = 'on' | 'off' | 'denied' | 'unavailable';
export const registerForPush = async (_ask: boolean): Promise<PushState> => 'unavailable';
export const unregisterPush = async () => undefined;
export const signOut = async () => {
  await supabase.auth.signOut();
};
export const appPathFor = (_path: string | undefined): Href => '/';
