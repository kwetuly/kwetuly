import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps, type Theme } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { OfflineBanner } from '@/components/offline-banner';
import { PushSetup } from '@/components/push-setup';
import { EVENTS, UX_TEXT } from '@kwetuly/shared';
import { Button } from '@/components/ui';
import { track, useScreenTracking } from '@/lib/analytics';
import { AuthProvider } from '@/lib/auth';
import { FONT_MAP } from '@/lib/fonts';
import { I18nProvider, initialLocale, useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, space, themeText, type FontFace } from '@/theme';

// Chinese has no fontFamily (it uses the phone's font), so fall back to the navigation default family.
function navFont(face: FontFace, fallback: Theme['fonts']['regular']): Theme['fonts']['regular'] {
  return { fontFamily: face.fontFamily ?? fallback.fontFamily, fontWeight: face.fontWeight ?? 'normal' };
}

const themes = new Map<string, Theme>();

/** Always the website's light look, whatever the phone's dark-mode setting; headers and back buttons in the language's font. */
function kwetulyTheme(locale: string): Theme {
  const cached = themes.get(locale);
  if (cached) return cached;
  const { font } = themeText(locale);
  const theme: Theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, primary: brand.leafDark, background: colors.background, card: colors.card, text: colors.label, border: colors.separator },
    fonts: {
      regular: navFont(font.regular, DefaultTheme.fonts.regular),
      medium: navFont(font.medium, DefaultTheme.fonts.medium),
      bold: navFont(font.bold, DefaultTheme.fonts.bold),
      heavy: navFont(font.extrabold, DefaultTheme.fonts.heavy),
    },
  };
  themes.set(locale, theme);
  return theme;
}

function KwetulyThemeProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  return <ThemeProvider value={kwetulyTheme(locale)}>{children}</ThemeProvider>;
}

// Keep the splash screen up until the font has loaded, so text never jumps from one font to another.
SplashScreen.preventAutoHideAsync();

// The window behind every screen: the website's light page colour, never the phone's dark default.
SystemUI.setBackgroundColorAsync(colors.background);

// Shown when a screen crashes, like the website's error page. It sits outside the providers,
// so it reads the language directly.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const locale = initialLocale();
  const text = UX_TEXT[locale];
  const { type } = themeText(locale);
  useEffect(() => track(EVENTS.errorShown, { where: 'app' }), []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.background }}>
      <Text accessibilityRole="header" style={type.title2}>{text.errorTitle}</Text>
      <Text style={[type.callout, { color: colors.secondaryLabel }]}>{text.errorBody}</Text>
      <Button title={text.tryAgain} onPress={retry} />
    </View>
  );
}

function RootStack() {
  const { t } = useI18n();
  const { headerFonts } = useType();
  useScreenTracking();
  return (
    // `title: ''`: while a detail screen loads (or is not found) the header stays empty instead of showing the file name.
    <Stack screenOptions={{ title: '', headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.leafDark, ...headerFonts }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t.auth.signInTitle }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  const fontsReady = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);
  if (!fontsReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <KwetulyThemeProvider>
            <RootStack />
            <OfflineBanner />
            <PushSetup />
          </KwetulyThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
