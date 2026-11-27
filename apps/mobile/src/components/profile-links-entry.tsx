import { router, type Href } from 'expo-router';
import { profileLinksText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** "Profile links" (slice S5) on the guide's profile overview and the business screen. Always shown:
 * the links screen itself says when website, Google and YouTube links are switched off. */
export function ProfileLinksEntry({ business = false }: { business?: boolean }) {
  const { locale } = useI18n();
  const t = profileLinksText(locale);
  return (
    <ListGroup>
      <ListRow icon={GLYPHS.globe} title={t.entry} subtitle={business ? t.businessEntryNote : t.entryNote} onPress={() => router.push('/profile-links' as Href)} />
    </ListGroup>
  );
}
