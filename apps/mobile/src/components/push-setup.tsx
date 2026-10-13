import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSession } from '@/lib/auth';
import { appPathFor, registerForPush } from '@/lib/push';

// Registers this phone for alerts once signed in (only if allowed before), and opens the right screen when an alert is tapped.
export function PushSetup() {
  const { session } = useSession();
  const userId = session?.user.id;
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (userId) registerForPush(false);
  }, [userId]);

  useEffect(() => {
    const path = response?.notification.request.content.data?.path;
    if (typeof path === 'string') router.push(appPathFor(path));
  }, [response]);

  return null;
}
