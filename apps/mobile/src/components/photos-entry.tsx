import { router, type Href } from 'expo-router';
import { uploadsText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** "Photos for your page" (slice S4) on the guide's profile overview. Always shown: the photos screen
 * itself says when cover photos and galleries are switched off. */
export function PhotosEntry() {
  const { locale } = useI18n();
  const u = uploadsText(locale);
  return (
    <ListGroup>
      <ListRow icon={GLYPHS.photos} title={u.title} subtitle={u.menuHint} onPress={() => router.push('/photos' as Href)} />
    </ListGroup>
  );
}
