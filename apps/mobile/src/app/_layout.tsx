import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PushSetup } from '@/components/push-setup';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { brand } from '@/theme/colors';

function RootStack() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.sunset }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t.auth.signInTitle }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootStack />
            <PushSetup />
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
