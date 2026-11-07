import { Stack } from 'expo-router';
import { brand } from '@/theme';
import { useType } from '@/lib/use-type';

export default function TabStackLayout() {
  const { headerFonts } = useType();
  return <Stack screenOptions={{ headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.leafDark, ...headerFonts }} />;
}
