import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { isFeatureOn, uploadsText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { MediaField } from '@/components/media-field';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { EmptyState, FormScreen, Muted, ScreenState } from '@/components/ui';
import { getMyGuide } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useFeatures } from '@/lib/features';
import { useI18n } from '@/lib/i18n';
import { loadMedia } from '@/lib/media';

// Guide photo manager (slice S4), the same as /dashboard/photos on the website: the cover photo and up
// to 12 photos for the guide's own page. Shown at once, checked by Kwetuly afterwards; the public page
// shows them from slice S6.
export default function PhotosScreen() {
  const { locale } = useI18n();
  const u = uploadsText(locale);
  const { session } = useSession();
  const userId = session?.user.id;
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const guideId = guide.data?.guide?.id;
  const photos = useQuery({ queryKey: ['my-media', guideId], queryFn: () => loadMedia('guide', guideId!, ['cover', 'gallery']), enabled: !!guideId });
  // feature.cover_gallery (missing row = off, like the database, which refuses new cover and gallery
  // photos while it is off).
  const features = useFeatures();

  if (!session) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: u.title }} />
        <SignInPrompt />
      </FormScreen>
    );
  }
  if (guide.data && !guideId) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: u.title }} />
        <EmptyState glyph={GLYPHS.photos} text={u.forGuidesOnly} />
      </FormScreen>
    );
  }
  if (features.data && !isFeatureOn(features.data, 'cover_gallery')) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: u.title }} />
        <EmptyState glyph={GLYPHS.photos} text={u.switchedOff} />
      </FormScreen>
    );
  }
  if (!photos.data || !features.data) {
    const error = guide.error ?? photos.error ?? features.error;
    return (
      <>
        <Stack.Screen options={{ title: u.title }} />
        <ScreenState
          screen
          loading={!error}
          error={error}
          onRetry={() => (guide.error ? guide.refetch() : photos.error ? photos.refetch() : features.refetch())}
          retryLabel={u.retryLoad}
        />
      </>
    );
  }
  return (
    <FormScreen>
      <Stack.Screen options={{ title: u.title }} />
      <Muted>{u.intro}</Muted>
      <MediaField field="cover" subjectKind="guide" subjectId={guideId!} initial={photos.data.filter((p) => p.field === 'cover')} />
      <MediaField field="gallery" subjectKind="guide" subjectId={guideId!} initial={photos.data.filter((p) => p.field === 'gallery')} />
      <Muted>{u.checkedAfter}</Muted>
    </FormScreen>
  );
}
