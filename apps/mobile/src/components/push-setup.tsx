import { useEffect } from 'react';
import { router } from 'expo-router';
import { useSession } from '@/lib/auth';
import { appPathFor, Notifications, registerForPush } from '@/lib/push';

// Registers this phone for alerts once signed in (only if allowed before), and opens the right screen when an alert is tapped.
export function PushSetup() {
  return Notifications ? <PushListener notifications={Notifications} /> : null;
}

function PushListener({ notifications }: { notifications: NonNullable<typeof Notifications> }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const response = notifications.useLastNotificationResponse();

  useEffect(() => {
    if (userId) registerForPush(false);
  }, [userId]);

  useEffect(() => {
    const path = response?.notification.request.content.data?.path;
    if (typeof path === 'string') router.push(appPathFor(path));
  }, [response]);

  return null;
}
