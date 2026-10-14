import { useState } from 'react';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';
import { PushSetup } from '@/components/push-setup';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { brand, colors } from '@/theme';

// Always the website's light look, whatever the phone's dark-mode setting.
const rafrikaTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: brand.leafDark, background: colors.background, card: colors.card, text: colors.label, border: colors.separator },
};

// The window behind every screen: the website's light page colour, never the phone's dark default.
SystemUI.setBackgroundColorAsync(colors.background);

function RootStack() {
  const { t } = useI18n();
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
            <PushSetup />
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
