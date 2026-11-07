import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, Switch, Text, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatMedia } from '@/components/chat-media';
import { Bubble, Composer, chatListStyle } from '@/components/chat-ui';
import { GLYPHS, Glyph } from '@/components/glyph';
import { Button, ErrorText, IconButton, ScreenState } from '@/components/ui';
import { deleteChatMessage, getGroupChat, listChatMessages, markChatRead, sendChatMessage, setObjection, setShareConsent, type ChatMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { shareLink, shareMediaFile } from '@/lib/share';
import { cleanPhoto } from '@/lib/clean-photo';
import { useLive } from '@/hooks/use-live';
import { getChatMuted, setChatMuted } from '@/lib/api-requests';
import { useType } from '@/lib/use-type';
import { brand, colors, icon, space } from '@/theme';

const MAX_BYTES = 50 * 1024 * 1024;
const PHOTO_SIDE = 2560; // px, same as the website

type Picked = { uri: string; mimeType: string; kind: 'image' | 'video'; name: string };

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const c = t.chats;
  const { type, font } = useType();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const chat = useQuery({ queryKey: ['group-chat', id], queryFn: () => getGroupChat(id), enabled: !!userId });
  const messages = useQuery({ queryKey: ['chat-messages', id], queryFn: () => listChatMessages(id), enabled: !!userId });
  useLive('group_chat_messages', `chat_id=eq.${id}`, ['chat-messages', id]);
  const muted = useQuery({ queryKey: ['chat-muted', id, userId], queryFn: () => getChatMuted(id, userId), enabled: !!userId });
  async function toggleMuted() {
    await setChatMuted(id, userId, !muted.data);
    muted.refetch();
  }

  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [sharePublic, setSharePublic] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) markChatRead(id, userId);
  }, [id, userId, messages.data?.length]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['chat-messages', id] });

  async function pick() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, videoMaxDuration: 120 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.type === 'video') {
      // Videos are uploaded as they are.
      if (asset.fileSize && asset.fileSize > MAX_BYTES) return setError(c.tooBig);
      return setPicked({ uri: asset.uri, kind: 'video', mimeType: asset.mimeType ?? 'video/mp4', name: asset.fileName ?? 'kwetuly.mp4' });
    }
    // Photos can be shared publicly later, so save a new copy without the location and camera data.
    // The picker's own copy keeps that data on Android. If the photo cannot be read, do not send it.
    try {
      const clean = await cleanPhoto(asset, { maxSide: PHOTO_SIDE, compress: 0.8 });
      setPicked({ uri: clean.uri, kind: 'image', mimeType: clean.mimeType, name: (asset.fileName ?? 'kwetuly').replace(/\.[^.]*$/, '') + '.jpg' });
    } catch {
      setError(c.uploadError);
    }
  }

  async function send() {
    if (!body.trim() && !picked) return;
    setSending(true);
    setError('');
    try {
      await sendChatMessage(id, userId, { body, media: picked ?? undefined, sharePublic: !!picked && sharePublic });
      setBody('');
      setPicked(null);
      setSharePublic(false);
      await refresh();
    } catch {
      // The text and the chosen photo stay in the box so nothing is lost.
      setError(picked ? c.uploadError : t.alerts.notSent);
    } finally {
      setSending(false);
    }
  }

  // Actions for one message, shown on long-press: share/download media, consent, objection, delete.
  function openActions(message: ChatMessage) {
    const mine = message.sender_id === userId;
    const objected = message.objectors.includes(userId);
    const buttons: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (message.media_url) {
      buttons.push({ text: c.shareToApps, onPress: () => shareMediaFile(message.media_url!, message.media_path!.split('/').pop() ?? 'kwetuly.jpg') });
    }
    if (mine) {
      buttons.push({ text: message.share_public ? c.stopSharing : c.shareConsent, onPress: () => setShareConsent(message.id, !message.share_public).then(refresh) });
      buttons.push({ text: c.delete, style: 'destructive', onPress: () => deleteChatMessage(message).then(refresh) });
    } else if (message.share_public) {
      buttons.push({ text: objected ? c.withdrawObjection : c.objectCta, onPress: () => setObjection(message.id, userId, !objected).then(refresh) });
    }
    buttons.push({ text: t.app.clear, style: 'cancel' });
    Alert.alert(message.sender_name, message.share_public ? c.consentNote : undefined, buttons);
  }

  const time = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });
  const members = chat.data?.members ?? [];

  const needsSetup = useNeedsSetup();
  if (needsSetup) return <Redirect href={welcomeHref(`/chat/${id}`)} />;
  const canSend = !sending && (!!body.trim() || !!picked);
  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Title>{chat.data?.chat?.name ?? c.title}</Stack.Title>
      <FlatList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        data={messages.data ?? []}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={chatListStyle}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: space.xs, paddingBottom: space.xs }}>
            <Text style={{ ...type.caption, ...font.semibold, textAlign: 'center' }}>
              {c.members}: {members.length}
            </Text>
            {members.length > 0 && <Text style={{ ...type.caption, textAlign: 'center' }}>{members.map((m) => m.display_name.split(' ')[0]).join(', ')}</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.xs }}>
              {chat.data?.chat && (
                <Button
                  title={c.invite}
                  variant="outline"
                  size="md"
                  icon={GLYPHS.invite}
                  onPress={() => shareLink(`/${locale}/chats/join/${chat.data!.chat!.invite_code}`, `${c.invite}: ${chat.data!.chat!.name}`)}
                />
              )}
              <Button title={muted.data ? t.alerts.unmute : t.alerts.mute} variant="text" size="md" icon={muted.data ? GLYPHS.bellOff : GLYPHS.bell} onPress={toggleMuted} />
            </View>
          </View>
        }
        ListEmptyComponent={<ScreenState loading={messages.isLoading} error={messages.error} onRetry={() => messages.refetch()} />}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          const blocked = item.objectors.length > 0;
          return (
            <Pressable onLongPress={() => openActions(item)} delayLongPress={300} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: space.xs }}>
              {!mine && <Text style={{ ...type.caption, ...font.bold }}>{item.sender_name}</Text>}
              {item.media_url && item.media_type && <ChatMedia url={item.media_url} type={item.media_type} />}
              {item.body && <Bubble mine={mine}>{item.body}</Bubble>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <Text style={type.caption}>{time.format(new Date(item.created_at))}</Text>
                {item.share_public ? <Text style={type.caption}>{blocked ? c.objected : item.featured ? c.featured : c.sharedPublicly}</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Composer
        value={body}
        onChangeText={setBody}
        placeholder={c.placeholder}
        maxLength={4000}
        onSend={send}
        sendLabel={c.send}
        canSend={canSend}
        leading={<IconButton glyph={GLYPHS.attach} tone="tonal" accessibilityLabel={c.attach} onPress={pick} />}
      >
        <ErrorText>{error}</ErrorText>
        {sending && <Text style={type.caption}>{c.uploading}</Text>}
        {picked && (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Glyph name={picked.kind === 'video' ? GLYPHS.film : GLYPHS.photo} size={icon.inline} color={colors.secondaryLabel} />
              <Text numberOfLines={1} style={{ ...type.callout, ...font.bold, flex: 1 }}>
                {picked.name}
              </Text>
              <IconButton glyph={GLYPHS.close} accessibilityLabel={t.app.clear} onPress={() => setPicked(null)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Switch value={sharePublic} onValueChange={setSharePublic} trackColor={{ true: brand.leaf }} accessibilityLabel={c.shareConsent} />
              <Text style={{ ...type.callout, ...font.semibold, flex: 1 }}>{c.shareConsent}</Text>
            </View>
            <Text style={type.caption}>{c.consentNote}</Text>
          </View>
        )}
      </Composer>
    </KeyboardAvoidingView>
  );
}
