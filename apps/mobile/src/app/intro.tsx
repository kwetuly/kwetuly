import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Glyph, type GlyphName } from '@/components/glyph';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LOCALES, PHOTOS } from '@kwetuly/shared';
import { photoSource } from '@/lib/photos';
import { useI18n } from '@/lib/i18n';
import { markIntroSeen } from '@/lib/intro';
import { brand, radius, space, textSize } from '@/theme';

const SHORT: Record<string, string> = { en: 'EN', sw: 'SW', fr: 'FR', it: 'IT', de: 'DE', pl: 'PL', zh: '中文' };

// First-launch welcome: three photo slides, a language choice, and the way in.
export default function IntroScreen() {
  const { t, locale, setLocale } = useI18n();
  const i = t.intro;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  // Each slide: a big icon (green square, white icon) and a row of small feature icons (gold).
  const slides: { photo: (typeof PHOTOS)[keyof typeof PHOTOS]; title: string; body: string; icon: GlyphName; features: GlyphName[] }[] = [
    {
      photo: PHOTOS.saddleHikers,
      title: i.s1Title,
      body: i.s1Body,
      icon: { ios: 'checkmark.seal.fill', android: 'verified' },
      features: [
        { ios: 'mountain.2.fill', android: 'landscape' },
        { ios: 'pawprint.fill', android: 'pets' },
        { ios: 'sailboat.fill', android: 'sailing' },
        { ios: 'star.fill', android: 'star' },
      ],
    },
    {
      photo: PHOTOS.leopardTree,
      title: i.s2Title,
      body: i.s2Body,
      icon: { ios: 'binoculars.fill', android: 'travel_explore' },
      features: [
        { ios: 'square.and.pencil', android: 'edit_note' },
        { ios: 'tag.fill', android: 'sell' },
        { ios: 'person.3.fill', android: 'groups' },
        { ios: 'hand.thumbsup.fill', android: 'thumb_up' },
      ],
    },
    {
      photo: PHOTOS.dhowSunset,
      title: i.s3Title,
      body: i.s3Body,
      icon: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum' },
      features: [
        { ios: 'camera.fill', android: 'photo_camera' },
        { ios: 'video.fill', android: 'videocam' },
        { ios: 'creditcard.fill', android: 'payments' },
        { ios: 'bell.fill', android: 'notifications_active' },
      ],
    },
  ];
  const last = page === slides.length - 1;

  function finish(next?: 'join' | 'signIn') {
    markIntroSeen();
    router.replace('/');
    if (next) router.push({ pathname: '/sign-in', params: next === 'join' ? { mode: 'join' } : {} });
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.shade }}>
      <StatusBar style="light" />
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {slides.map((slide, index) => (
          <View key={slide.photo.id} style={{ width, height }}>
            <Image source={photoSource(slide.photo)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityLabel={slide.photo.alt} transition={300} />
            {/* The photo fills the screen: a light fade at the top for the language chips, a fade at the bottom for the text. */}
            <LinearGradient
              colors={['rgba(30,30,30,0.55)', 'rgba(30,30,30,0)']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 120 }}
            />
            <LinearGradient
              colors={['rgba(30,30,30,0)', 'rgba(30,30,30,0.55)', 'rgba(30,30,30,0.92)']}
              locations={[0, 0.35, 1]}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingTop: 160,
                paddingHorizontal: space.xl,
                paddingBottom: insets.bottom + 230,
                gap: space.md,
              }}
            >
              {index === 0 && (
                <View style={{ gap: space.xs, marginBottom: space.sm }}>
                  <Text style={{ color: brand.gold, fontWeight: '700', fontSize: textSize.headline }}>{i.welcome}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Text style={{ color: brand.onDark, fontWeight: '900', fontSize: textSize.hero, letterSpacing: -1 }}>Kwetuly</Text>
                    <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: brand.gold, marginTop: 10, marginLeft: 4 }} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: textSize.body }}>{i.tagline}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.button, borderCurve: 'continuous', backgroundColor: brand.leaf, alignItems: 'center', justifyContent: 'center' }}>
                  <Glyph name={slide.icon} size={26} color={brand.onDark} />
                </View>
                <Text style={{ color: brand.gold, fontWeight: '800', fontSize: textSize.subhead, letterSpacing: 2, fontVariant: ['tabular-nums'] }}>
                  {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </Text>
              </View>
              <Text style={{ color: brand.onDark, fontWeight: '800', fontSize: textSize.title1, lineHeight: 33 }}>{slide.title}</Text>
              <View style={{ width: 44, height: 4, borderRadius: radius.bar, backgroundColor: brand.gold }} />
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: textSize.body, lineHeight: 23 }}>{slide.body}</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                {slide.features.map((f) => (
                  <View
                    key={f.android}
                    style={{ width: 44, height: 44, borderRadius: radius.button, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,182,39,0.55)' }}
                  >
                    <Glyph name={f} size={22} color={brand.gold} />
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>
        ))}
      </ScrollView>

      {/* Language choice, always reachable at the top. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ position: 'absolute', top: insets.top + 12, left: 0, right: 0, flexGrow: 0 }}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
        accessibilityLabel={i.language}
      >
        {LOCALES.map((l) => (
          <Pressable
            key={l}
            onPress={() => setLocale(l)}
            accessibilityRole="button"
            accessibilityState={{ selected: l === locale }}
            style={{
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderRadius: radius.button,
              backgroundColor: l === locale ? brand.gold : 'rgba(58,58,58,0.45)',
              borderWidth: 1,
              borderColor: l === locale ? brand.gold : 'rgba(255,255,255,0.35)',
            }}
          >
            <Text style={{ color: l === locale ? brand.ink : brand.onDark, fontWeight: '800', fontSize: textSize.caption }}>{SHORT[l] ?? l}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Dots and the way in. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingBottom: insets.bottom + 20, gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center', marginBottom: space.sm }}>
          {slides.map((slide, index) => (
            <View key={slide.photo.id} style={{ height: 6, width: index === page ? 22 : 6, borderRadius: radius.full, backgroundColor: index === page ? brand.gold : 'rgba(255,255,255,0.4)' }} />
          ))}
        </View>
        {last ? (
          <Pressable onPress={() => finish('join')} accessibilityRole="button" style={{ backgroundColor: brand.leaf, borderRadius: radius.button, borderCurve: 'continuous', paddingVertical: space.lg, alignItems: 'center' }}>
            <Text style={{ color: brand.onDark, fontWeight: '800', fontSize: textSize.body }}>{i.getStarted}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => scroller.current?.scrollTo({ x: (page + 1) * width, animated: true })}
            accessibilityRole="button"
            style={{ backgroundColor: brand.leaf, borderRadius: radius.button, borderCurve: 'continuous', paddingVertical: space.lg, alignItems: 'center' }}
          >
            <Text style={{ color: brand.onDark, fontWeight: '800', fontSize: textSize.body }}>{i.next}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => finish('signIn')} accessibilityRole="button" style={{ borderRadius: radius.button, borderCurve: 'continuous', paddingVertical: space.lg, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' }}>
          <Text style={{ color: brand.onDark, fontWeight: '700', fontSize: textSize.body }}>{i.haveAccount}</Text>
        </Pressable>
        <Pressable onPress={() => finish()} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: space.sm }}>
          <Text style={{ color: brand.gold, fontWeight: '700' }}>{i.explore}</Text>
        </Pressable>
      </View>
    </View>
  );
}
