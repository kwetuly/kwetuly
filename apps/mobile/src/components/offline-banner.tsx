import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { addNetworkStateListener, useNetworkState } from 'expo-network';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { brand, space, textSize } from '@/theme';
import { useType } from '@/lib/use-type';

/** A thin notice at the top while the phone is offline; screens keep showing what was loaded. */
export function OfflineBanner() {
  const { font } = useType();
  const { t } = useI18n();
  // Lets React Query pause and retry requests when the phone loses and regains its connection.
  // Set up after mount, so it never runs during the web build's server rendering.
  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      const subscription = addNetworkStateListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
      return () => subscription.remove();
    });
  }, []);
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;

  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: insets.top + space.xs, paddingBottom: space.xs, paddingHorizontal: space.lg, backgroundColor: brand.shade }}
    >
      <Text style={{ color: brand.onDark, fontSize: textSize.footnote, ...font.bold, textAlign: 'center' }}>{t.ux.offline}</Text>
    </View>
  );
}
