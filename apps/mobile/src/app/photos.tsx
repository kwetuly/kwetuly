import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { uploadsText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { MediaField } from '@/components/media-field';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { EmptyState, FormScreen, Muted, ScreenState } from '@/components/ui';
import { getMyGuide } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
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
  if (!photos.data) {
    return (
      <>
        <Stack.Screen options={{ title: u.title }} />
        <ScreenState screen loading={guide.isLoading || photos.isLoading || (!guide.error && !photos.error)} error={guide.error ?? photos.error} onRetry={() => (guide.error ? guide.refetch() : photos.refetch())} retryLabel={u.retryLoad} />
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
