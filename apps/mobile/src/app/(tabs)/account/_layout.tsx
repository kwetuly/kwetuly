import { Stack } from 'expo-router';
import { brand } from '@/theme/colors';

export default function TabStackLayout() {
  return <Stack screenOptions={{ headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: brand.sunset }} />;
}
