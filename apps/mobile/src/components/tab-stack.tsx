import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { brand, webTabBarClearance } from '@/theme';
import { useType } from '@/lib/use-type';

// The stack inside each of the five tabs. On the web build the tab bar floats at the top of the
// page, so the header gets extra room above the title; iOS and Android look exactly as before.
const webHeader = Platform.OS === 'web' ? { headerStatusBarHeight: webTabBarClearance } : null;

export default function TabStackLayout() {
  const { headerFonts } = useType();
  return <Stack screenOptions={{ headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.leafDark, ...headerFonts, ...webHeader }} />;
}
