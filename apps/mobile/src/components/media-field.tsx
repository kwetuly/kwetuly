import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  UPLOAD_CONCURRENCY,
  UPLOAD_SPECS,
  cropRect,
  fillText,
  makeMain,
  mediaPublicUrl,
  moveItem,
  remainingSlots,
  uploadsText,
  type CropRect,
  type MediaErrorCode,
  type MediaField as Field,
  type MediaItem,
  type MediaSubjectKind,
  type UploadQueueState,
} from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { Badge, Button, Card, FormMessage, Muted, Toggle } from '@/components/ui';
import { cleanPhotoForUpload, type CleanUpload } from '@/lib/clean-photo';
import { useI18n } from '@/lib/i18n';
import { MediaError, finishUpload, putFile, removeMedia, reorderMedia, resumeUpload, startUpload } from '@/lib/media';
import { useType } from '@/lib/use-type';
import { brand, colors, control, layout, media, radius, space } from '@/theme';

// One photo field in the app (slice S4), the same rules as the website's MediaField: avatar (picker's
// square crop), cover (the app's own wide crop step), gallery (up to 12) or product (up to 10). Each
// photo is saved again as WebP (JPEG where the phone cannot) without location data, uploaded with its
// own progress bar, two at a time, with "Try again". Order with "Move earlier", "Move later" and
// "Make main photo" (words, no arrows).

type Asset = { uri: string; width: number; height: number; fileName?: string | null };
type QueueItem = {
  key: string;
  asset: Asset;
  crop: CropRect | null;
  status: UploadQueueState;
  progress: number;
  error: MediaErrorCode | null;
  photo?: CleanUpload;
  mediaId?: string;
  stored: { main: boolean; thumb: boolean };
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
let counter = 0;

function confirmRemove(title: string, body: string, cancel: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(body)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: cancel, style: 'cancel' },
    { text: title, style: 'destructive', onPress: onYes },
  ]);
}

export function MediaField({ field, subjectKind, subjectId, initial, onChanged }: { field: Field; subjectKind: MediaSubjectKind; subjectId: string; initial: MediaItem[]; onChanged?: () => void }) {
  const { locale } = useI18n();
  const { type, font } = useType();
  const t = uploadsText(locale);
  const spec = UPLOAD_SPECS[field];
  const single = spec.maxCount === 1;
  const [items, setItems] = useState<MediaItem[]>(() => [...initial].sort((a, b) => a.sort - b.sort));
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropping, setCropping] = useState<Asset | null>(null);
  const running = useRef(new Set<string>());

  const patch = useCallback((key: string, change: Partial<QueueItem>) => setQueue((list) => list.map((q) => (q.key === key ? { ...q, ...change } : q))), []);

  const run = useCallback(
    async (item: QueueItem) => {
      let { photo, mediaId } = item;
      const stored = { ...item.stored };
      try {
        if (!photo) {
          patch(item.key, { status: 'preparing', progress: 0, error: null });
          try {
            photo = await cleanPhotoForUpload(item.asset, spec, item.crop);
          } catch {
            throw new MediaError('decode');
          }
          patch(item.key, { photo });
        }
        patch(item.key, { status: 'uploading', error: null });
        let target;
        try {
          target = mediaId ? await resumeUpload(mediaId) : await startUpload({ field, subjectKind, subjectId, mimeType: photo.mimeType });
        } catch (error) {
          if (mediaId && error instanceof MediaError && error.code === 'file_missing') patch(item.key, { mediaId: undefined, stored: { main: false, thumb: false } });
          throw error;
        }
        mediaId = target.id;
        patch(item.key, { mediaId });
        const total = photo.main.bytes + photo.thumb.bytes;
        if (!stored.main) {
          await putFile(target.url, photo.main.uri, photo.mimeType, (share) => patch(item.key, { progress: Math.min(99, Math.round(((share * photo!.main.bytes) / total) * 100)) }));
          stored.main = true;
          patch(item.key, { stored: { ...stored } });
        }
        if (!stored.thumb) {
          await putFile(target.thumbUrl, photo.thumb.uri, photo.mimeType, (share) => patch(item.key, { progress: Math.min(99, Math.round(((photo!.main.bytes + share * photo!.thumb.bytes) / total) * 100)) }));
          stored.thumb = true;
          patch(item.key, { stored: { ...stored } });
        }
        patch(item.key, { status: 'finishing', progress: 100 });
        const done = await finishUpload(mediaId, photo);
        setItems((list) => [...list.filter((i) => i.id !== done.item.id && !done.replaced.includes(i.path)), done.item].sort((a, b) => a.sort - b.sort));
        setQueue((list) => list.filter((q) => q.key !== item.key));
        setMessage({ tone: 'ok', text: t.uploaded });
        onChanged?.();
      } catch (error) {
        patch(item.key, { status: 'failed', error: error instanceof MediaError ? error.code : 'generic' });
      } finally {
        running.current.delete(item.key);
        setQueue((list) => [...list]);
      }
    },
    [field, subjectKind, subjectId, spec, patch, t.uploaded, onChanged],
  );

  useEffect(() => {
    for (const item of queue) {
      if (running.current.size >= UPLOAD_CONCURRENCY) break;
      if (item.status !== 'waiting' || running.current.has(item.key)) continue;
      running.current.add(item.key);
      void run(item);
    }
  }, [queue, run]);

  const left = single ? 1 : remainingSlots(field, items.length + queue.length);

  function enqueue(assets: Asset[], crop: CropRect | null = null) {
    setQueue((list) => [...list, ...assets.map((asset) => ({ key: `m${++counter}`, asset, crop, status: 'waiting' as const, progress: 0, error: null, stored: { main: false, thumb: false } }))]);
  }

  async function pick() {
    setMessage(null);
    if (spec.needsConsent && !consent) return setMessage({ tone: 'error', text: t.consentNeeded });
    if (left <= 0) return setMessage({ tone: 'error', text: fillText(t.full, { max: spec.maxCount }) });
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: !single,
      selectionLimit: single ? 1 : left,
      // The picker's own crop is square only, so it is used for the avatar; the cover has its own step.
      allowsEditing: field === 'avatar',
      aspect: field === 'avatar' ? [1, 1] : undefined,
    });
    if (result.canceled) return;
    const assets = result.assets.slice(0, single ? 1 : left).map((a) => ({ uri: a.uri, width: a.width, height: a.height, fileName: a.fileName }));
    if (field === 'cover' && assets[0]) return setCropping(assets[0]);
    enqueue(assets);
  }

  async function saveOrder(next: MediaItem[]) {
    const before = items;
    setItems(next);
    setSaving(true);
    try {
      await reorderMedia(subjectKind, subjectId, field, next.map((i) => i.id));
      setItems(next.map((i, index) => ({ ...i, sort: index, is_main: index === 0 })));
      setMessage({ tone: 'ok', text: t.orderSaved });
    } catch (error) {
      setItems(before);
      setMessage({ tone: 'error', text: t.errors[error instanceof MediaError ? error.code : 'generic'] });
    }
    setSaving(false);
  }

  function remove(item: MediaItem) {
    confirmRemove(t.remove, t.removeConfirm, t.cancel, async () => {
      try {
        await removeMedia(item.id);
        setItems((list) => list.filter((i) => i.id !== item.id).map((i, index) => ({ ...i, is_main: index === 0 })));
        setMessage({ tone: 'ok', text: t.removed });
        onChanged?.();
      } catch (error) {
        setMessage({ tone: 'error', text: t.errors[error instanceof MediaError ? error.code : 'generic'] });
      }
    });
  }

  function dismiss(item: QueueItem) {
    if (item.mediaId) void removeMedia(item.mediaId).catch(() => undefined);
    setQueue((list) => list.filter((q) => q.key !== item.key));
  }

  const aspect = spec.cropAspect && spec.cropFixed ? (field === 'cover' ? 2 : spec.cropAspect) : 4 / 3;
  const fieldText = t.fields[field];

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Text accessibilityRole="header" style={{ ...type.cardTitle, flex: 1 }}>{fieldText.title}</Text>
        {!single ? <Text style={type.caption}>{fillText(t.count, { n: items.length, max: spec.maxCount })}</Text> : null}
      </View>
      <Muted>{fillText(fieldText.hint, { max: spec.maxCount })}</Muted>

      {items.length === 0 && queue.length === 0 ? <Muted>{t.empty}</Muted> : null}

      {items.map((item, index) => (
        <View key={item.id} style={{ gap: space.sm }}>
          {/* Cover shown as 2:1 on phones (the centre of the 3:1 photo). The box keeps its shape before the photo loads. */}
          <View style={{ aspectRatio: aspect, borderRadius: radius.media, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: item.placeholder ?? colors.fill }}>
            {spec.bucket === 'media' ? (
              <Image
                source={{ uri: mediaPublicUrl(SUPABASE_URL, single ? item.path : (item.thumb_path ?? item.path)) }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
                accessibilityLabel={field === 'cover' ? t.coverAlt : field === 'avatar' ? t.avatarAlt : fillText(t.photoAlt, { n: index + 1 })}
              />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap, alignItems: 'center' }}>
            {!single && item.is_main ? <Badge label={t.mainPhoto} tone="gold" /> : null}
            <Text style={type.caption}>{item.state === 'checked' ? t.stateChecked : item.state === 'pending' ? t.statePending : t.stateLive}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {!single && index > 0 ? <Button title={t.moveEarlier} variant="text" size="md" disabled={saving} onPress={() => saveOrder(moveItem(items, index, index - 1))} /> : null}
            {!single && index < items.length - 1 ? <Button title={t.moveLater} variant="text" size="md" disabled={saving} onPress={() => saveOrder(moveItem(items, index, index + 1))} /> : null}
            {!single && index > 0 ? <Button title={t.makeMain} variant="text" size="md" disabled={saving} onPress={() => saveOrder(makeMain(items, item.id))} /> : null}
            <Button title={t.remove} variant="text" size="md" onPress={() => remove(item)} accessibilityLabel={`${t.remove}: ${field === 'cover' ? t.coverAlt : fillText(t.photoAlt, { n: index + 1 })}`} />
          </View>
        </View>
      ))}

      {queue.map((item) => (
        <View key={item.key} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
          <Image source={{ uri: item.asset.uri }} style={{ width: media.thumb, height: media.thumb, borderRadius: radius.media, backgroundColor: colors.fill }} contentFit="cover" />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text accessibilityLiveRegion="polite" style={{ ...type.callout, color: item.status === 'failed' ? brand.danger : colors.label }}>
              {item.status === 'failed' ? `${t.queue.failed}. ${item.error ? t.errors[item.error] : ''}` : fillText(t.queue[item.status], { percent: item.progress })}
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={fillText(t.progressLabel, { name: item.asset.fileName ?? t.fields[field].title })}
              accessibilityValue={{ min: 0, max: 100, now: item.progress }}
              style={{ height: control.bar, borderRadius: radius.bar, backgroundColor: colors.fill, overflow: 'hidden' }}
            >
              <View style={{ width: `${item.progress}%`, height: '100%', backgroundColor: item.status === 'failed' ? brand.danger : brand.leaf }} />
            </View>
            {item.status === 'failed' ? (
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <Button title={t.retry} variant="text" size="md" onPress={() => patch(item.key, { status: 'waiting', error: null })} />
                <Button title={t.cancel} variant="text" size="md" onPress={() => dismiss(item)} />
              </View>
            ) : null}
          </View>
        </View>
      ))}

      {spec.needsConsent ? (
        <View style={{ gap: space.xxs }}>
          <Toggle label={t.consent} value={consent} onChange={setConsent} />
          <Text style={type.caption}>{t.consentHint}</Text>
        </View>
      ) : null}
      {left > 0 ? (
        <Button title={single ? (items.length ? t.replace : t.chooseOne) : t.choose} icon={GLYPHS.attach} onPress={pick} />
      ) : (
        <Text style={{ ...type.callout, ...font.semibold, color: brand.ink, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button, overflow: 'hidden' }}>{fillText(t.full, { max: spec.maxCount })}</Text>
      )}
      <FormMessage message={message} />

      {cropping && spec.cropAspect ? (
        <CropStep
          asset={cropping}
          aspect={spec.cropAspect}
          onCancel={() => setCropping(null)}
          onConfirm={(crop) => {
            enqueue([cropping], crop);
            setCropping(null);
          }}
        />
      ) : null}
    </Card>
  );
}

/** The app's own fixed-shape crop (iOS's picker only crops square): drag inside the frame, zoom with buttons. */
function CropStep({ asset, aspect, onCancel, onConfirm }: { asset: Asset; aspect: number; onCancel: () => void; onConfirm: (crop: CropRect) => void }) {
  const { locale } = useI18n();
  const { type } = useType();
  const t = uploadsText(locale).crop;
  const { width: screen } = useWindowDimensions();
  const frameWidth = screen - layout.screenX * 2;
  const frameHeight = frameWidth / aspect;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const rect = cropRect(asset.width, asset.height, aspect, zoom, pan.x, pan.y);
  // Where the drag started (finger position and pan), read only in the touch handlers.
  const start = useRef({ x: 0, y: 0, pan });

  function onGrant(event: GestureResponderEvent) {
    start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, pan };
  }
  function onMove(event: GestureResponderEvent) {
    const s = start.current;
    const dx = event.nativeEvent.pageX - s.x;
    const dy = event.nativeEvent.pageY - s.y;
    const scale = rect.width / frameWidth;
    const spareX = (asset.width - rect.width) / 2;
    const spareY = (asset.height - rect.height) / 2;
    setPan({
      x: spareX > 0 ? Math.min(1, Math.max(-1, s.pan.x - (dx * scale) / spareX)) : 0,
      y: spareY > 0 ? Math.min(1, Math.max(-1, s.pan.y - (dy * scale) / spareY)) : 0,
    });
  }

  // The frame shows the chosen part: the photo is drawn larger and moved so the part fills the frame.
  const shown = frameWidth / rect.width;
  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: layout.screenX, paddingTop: space.huge, gap: space.lg }}>
        <Text accessibilityRole="header" style={type.title}>{t.title}</Text>
        <Muted>{t.appHelp}</Muted>
        <View onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={onGrant} onResponderMove={onMove} onResponderTerminationRequest={() => false} accessible accessibilityLabel={t.area} style={{ width: frameWidth, height: frameHeight, overflow: 'hidden', borderRadius: radius.media, backgroundColor: colors.fill }}>
          <Image
            source={{ uri: asset.uri }}
            style={{ position: 'absolute', width: asset.width * shown, height: asset.height * shown, left: -rect.x * shown, top: -rect.y * shown }}
            contentFit="fill"
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button title={t.zoomOut} variant="outline" size="md" icon={GLYPHS.minus} disabled={zoom <= 1} onPress={() => setZoom((z) => Math.max(1, z - 0.25))} />
          <Button title={t.zoomIn} variant="outline" size="md" icon={GLYPHS.plus} disabled={zoom >= 4} onPress={() => setZoom((z) => Math.min(4, z + 0.25))} />
          <Button title={t.centre} variant="text" size="md" onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} />
        </View>
        <Button title={t.use} onPress={() => onConfirm(rect)} />
        <Button title={t.cancel} variant="outline" onPress={onCancel} />
      </View>
    </Modal>
  );
}
