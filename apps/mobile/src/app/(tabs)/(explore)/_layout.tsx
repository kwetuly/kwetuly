import { Stack } from 'expo-router';
import { brand, headerFonts } from '@/theme';

export default function TabStackLayout() {
  return <Stack screenOptions={{ headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.leafDark, ...headerFonts }} />;
}
