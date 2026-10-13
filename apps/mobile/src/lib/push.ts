import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { supabase } from './supabase';

// Show alerts as banners while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type PushState = 'on' | 'off' | 'denied' | 'unavailable';

let registeredToken: string | null = null;

// Push needs a real phone and an EAS project id (set by `eas init`). Expo Go on Android cannot receive
// remote push since SDK 53, so this reports "unavailable" there instead of failing.
export async function registerForPush(ask: boolean): Promise<PushState> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!Device.isDevice || !projectId) return 'unavailable';
  try {
    if (process.env.EXPO_OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Rafrika', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return status === 'denied' ? 'denied' : 'off';

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: process.env.EXPO_OS === 'ios' ? 'ios' : 'android' });
    if (error) return 'off';
    registeredToken = token;
    return 'on';
  } catch {
    return 'unavailable';
  }
}

/** Stop alerts on this phone (call before signing out). */
export async function unregisterPush() {
  if (!registeredToken) return;
  await supabase.from('push_tokens').delete().eq('token', registeredToken);
  registeredToken = null;
}

export async function signOut() {
  await unregisterPush().catch(() => undefined);
  await supabase.auth.signOut();
}

// Alerts carry the website path (e.g. /chats/<id>); open the matching app screen.
export function appPathFor(path: string | undefined): Href {
  const clean = (path ?? '/').split(/[?#]/)[0];
  const [, first, second] = clean.split('/');
  switch (first) {
    case 'chats':
      return second ? `/chat/${second}` : '/chats';
    case 'messages':
      return second ? `/conversation/${second}` : '/chats';
    case 'requests':
      return second ? { pathname: '/request/[id]', params: { id: second } } : '/requests';
    case 'group-trips':
      return second && second !== 'mine' ? `/group-trip/${second}` : '/my-group-trips';
    case 'hub':
      return '/hub' as Href;
    case 'guides':
      return second ? `/guide/${second}` : '/guides';
    case 'dashboard':
      return '/account';
    default:
      return '/';
  }
}
