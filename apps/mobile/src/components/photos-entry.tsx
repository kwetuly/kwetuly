import { router, type Href } from 'expo-router';
import { uploadsText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** "Photos for your page" (slice S4) on the guide's profile overview. Always shown, so guides can still
 * find their photos: while feature.cover_gallery is off the photos screen shows uploadsText.switchedOff,
 * and the database refuses new cover and gallery photos (start_media_upload, 'media:switched_off'). */
export function PhotosEntry() {
  const { locale } = useI18n();
  const u = uploadsText(locale);
  return (
    <ListGroup>
      <ListRow icon={GLYPHS.photos} title={u.title} subtitle={u.menuHint} onPress={() => router.push('/photos' as Href)} />
    </ListGroup>
  );
}
