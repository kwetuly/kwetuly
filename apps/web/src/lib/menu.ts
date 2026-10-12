import type { MenuItem, MenuSection } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';

export function itemHref(locale: Locale, section: MenuSection, item: MenuItem) {
  return `/${locale}${item.href ?? `/${section.slug}/${item.slug}`}`;
}
