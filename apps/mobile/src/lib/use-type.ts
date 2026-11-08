import { themeText } from '@/theme';
import { useI18n } from './i18n';

/** Fonts and text styles for the current language: `const { type, font } = useType();`. Chinese gets the system font. */
export function useType() {
  const { locale } = useI18n();
  return themeText(locale);
}
