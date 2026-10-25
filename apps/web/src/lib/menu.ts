import { HUB_MENU, type MenuItem, type MenuSection } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';

export function itemHref(locale: Locale, section: MenuSection, item: MenuItem) {
  return `/${locale}${item.href ?? `/${section.slug}/${item.slug}`}`;
}

// Page titles inside the Guide Hub reuse the Hub menu wording.
export function hubLabel(slug: string, locale: Locale) {
  return HUB_MENU.find((item) => item.slug === slug)?.label[locale] ?? slug;
}
