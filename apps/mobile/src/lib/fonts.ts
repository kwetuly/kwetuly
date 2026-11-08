import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { fontFiles } from '@/theme';

/** The five Plus Jakarta Sans weights the app uses, keyed by the names in `font` (theme/typography.ts). */
export const FONT_MAP = {
  [fontFiles.regular]: PlusJakartaSans_400Regular,
  [fontFiles.medium]: PlusJakartaSans_500Medium,
  [fontFiles.semibold]: PlusJakartaSans_600SemiBold,
  [fontFiles.bold]: PlusJakartaSans_700Bold,
  [fontFiles.extrabold]: PlusJakartaSans_800ExtraBold,
};
