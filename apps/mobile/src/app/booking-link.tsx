import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { guideProgressText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { useBookingLinkOn } from '@/components/booking-link';
import { Button, Card, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { getMyGuide } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { shareLink } from '@/lib/share';
import { SITE_URL } from '@/lib/supabase';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, media, radius, space } from '@/theme';

// Copies with expo-clipboard. Loaded only when pressed, so an older development build without the
// clipboard module still opens this screen; then the share sheet (which has its own "Copy") is used.
async function copyText(text: string): Promise<boolean> {
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

// The guide's booking link: the /g/[slug] short link to their page, with copy, share and its QR code
// (an SVG made by the website, kept in the image cache so it still shows offline).
export default function BookingLinkScreen() {
  const { locale } = useI18n();
  const g = guideProgressText(locale);
  const { type, font } = useType();
  const { session, ready } = useSession();
  const userId = session?.user.id;
  const mine = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const on = useBookingLinkOn();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [qrFailed, setQrFailed] = useState<false | 'closed' | 'error'>(false);
  const needsSetup = useNeedsSetup();

  if (needsSetup) return <Redirect href={welcomeHref('/booking-link')} />;
  // Signed out (or the session ended): sign in instead of waiting forever.
  if (ready && !userId) return <Redirect href="/sign-in" />;
  const title = <Stack.Title>{g.linkTitle}</Stack.Title>;
  if (!userId || mine.isLoading || on.isLoading) return <>{title}<ScreenState screen loading loadingCount={1} /></>;
  if (mine.error || on.error) {
    return (
      <>
        {title}
        <ScreenState screen error retryLabel={g.retry} onRetry={() => { void mine.refetch(); void on.refetch(); }} />
      </>
    );
  }

  const guide = mine.data?.guide;
  const notice = (text: string, action?: { label: string; onPress: () => void }) => (
    <Card>
      <Muted>{text}</Muted>
      {action && <Button title={action.label} onPress={action.onPress} />}
    </Card>
  );

  let body;
  if (!on.data) body = notice(g.linkOff);
  else if (!guide) body = notice(g.linkNoProfile, { label: g.steps[0], onPress: () => router.replace({ pathname: '/profile-edit', params: { step: '0' } }) });
  else {
    const path = `/g/${guide.slug}`;
    const url = `${SITE_URL}${path}`;
    const approved = guide.verification_status === 'approved';
    body = (
      <>
        <Card>
          <SectionTitle>{g.linkTitle}</SectionTitle>
          {/* The link itself, easy to read aloud; long-press selects it. */}
          <Text selectable style={{ ...type.body, ...font.bold, color: brand.forest, backgroundColor: brand.mint, padding: space.md, borderRadius: radius.button, borderCurve: 'continuous' }}>
            {url}
          </Text>
          {approved ? (
            <>
              <FormMessage message={message} />
              <Button title={g.share} icon={GLYPHS.share} onPress={() => shareLink(path, g.shareMessage)} />
              <Button
                title={g.copy}
                icon={GLYPHS.copy}
                variant="outline"
                onPress={async () => {
                  if (await copyText(url)) setMessage({ tone: 'ok', text: g.copied });
                  else await shareLink(path, g.shareMessage);
                }}
              />
            </>
          ) : (
            <View style={{ backgroundColor: brand.sand, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' }}>
              <Text style={{ ...type.callout, color: colors.label }}>{g.linkPending}</Text>
            </View>
          )}
        </Card>
        {approved && (
          <Card>
            <SectionTitle>{g.qrTitle}</SectionTitle>
            {qrFailed ? (
              <Muted>{qrFailed === 'closed' ? g.qrSoon : g.linkError}</Muted>
            ) : (
              <Image
                source={{ uri: `${SITE_URL}${path}/qr.svg` }}
                cachePolicy="disk"
                contentFit="contain"
                accessibilityLabel={g.qrAlt}
                accessible
                onError={async () => {
                  // The image is only asked for when the switch is on and the guide is approved, so a
                  // 404 here means the site is still closed (the QR is for the team only until launch).
                  // Anything else (offline, server error) is a real error.
                  try {
                    const response = await fetch(`${SITE_URL}${path}/qr.svg`);
                    setQrFailed(response.status === 404 ? 'closed' : 'error');
                  } catch {
                    setQrFailed('error');
                  }
                }}
                style={{ width: media.detailPhoto, height: media.detailPhoto, alignSelf: 'center', backgroundColor: colors.card }}
              />
            )}
            <Muted>{g.qrHint}</Muted>
          </Card>
        )}
      </>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.huge }}>
      {title}
      <Muted>{g.linkIntro}</Muted>
      {body}
    </ScrollView>
  );
}
