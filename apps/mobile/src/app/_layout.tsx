import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps, type Theme } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';
import { OfflineBanner } from '@/components/offline-banner';
import { PushSetup } from '@/components/push-setup';
import { EVENTS, UX_TEXT } from '@rafrika/shared';
import { Button } from '@/components/ui';
import { track, useScreenTracking } from '@/lib/analytics';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider, initialLocale, useI18n } from '@/lib/i18n';
import { brand, colors, space, textSize } from '@/theme';

// Always the website's light look, whatever the phone's dark-mode setting.
const rafrikaTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: brand.leafDark, background: colors.background, card: colors.card, text: colors.label, border: colors.separator },
};

// The window behind every screen: the website's light page colour, never the phone's dark default.
SystemUI.setBackgroundColorAsync(colors.background);

// Shown when a screen crashes, like the website's error page. It sits outside the providers,
// so it reads the language directly.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const text = UX_TEXT[initialLocale()];
  useEffect(() => track(EVENTS.errorShown, { where: 'app' }), []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.background }}>
      <Text accessibilityRole="header" style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{text.errorTitle}</Text>
      <Text style={{ fontSize: textSize.callout, color: colors.secondaryLabel }}>{text.errorBody}</Text>
      <Button title={text.tryAgain} onPress={retry} />
    </View>
  );
}

function RootStack() {
  const { t } = useI18n();
  useScreenTracking();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.leafDark }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t.auth.signInTitle }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider value={rafrikaTheme}>
            <RootStack />
            <OfflineBanner />
            <PushSetup />
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
