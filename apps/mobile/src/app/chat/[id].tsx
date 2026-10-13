import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatMedia } from '@/components/chat-media';
import { ScreenState } from '@/components/ui';
import { deleteChatMessage, getGroupChat, listChatMessages, markChatRead, sendChatMessage, setObjection, setShareConsent, type ChatMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { shareLink, shareMediaFile } from '@/lib/share';
import { useLive } from '@/hooks/use-live';
import { brand, colors, radius } from '@/theme/colors';

const MAX_BYTES = 50 * 1024 * 1024;

type Picked = { uri: string; mimeType: string; kind: 'image' | 'video'; name: string };

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const c = t.chats;
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const chat = useQuery({ queryKey: ['group-chat', id], queryFn: () => getGroupChat(id), enabled: !!userId });
  const messages = useQuery({ queryKey: ['chat-messages', id], queryFn: () => listChatMessages(id), enabled: !!userId });
  useLive('group_chat_messages', `chat_id=eq.${id}`, ['chat-messages', id]);

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 120 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_BYTES) return setError(c.tooBig);
    const kind = asset.type === 'video' ? 'video' : 'image';
    setPicked({ uri: asset.uri, kind, mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'), name: asset.fileName ?? `rafrika.${kind === 'video' ? 'mp4' : 'jpg'}` });
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
      setError(c.uploadError);
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
      buttons.push({ text: c.shareToApps, onPress: () => shareMediaFile(message.media_url!, message.media_path!.split('/').pop() ?? 'rafrika.jpg') });
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

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Title>{chat.data?.chat?.name ?? c.title}</Stack.Title>
      <FlatList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        data={messages.data ?? []}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: 8, paddingBottom: 4 }}>
            <Text style={{ color: colors.secondaryLabel, fontSize: 12, textAlign: 'center' }}>
              {c.members}: {members.length} · {members.map((m) => m.display_name.split(' ')[0]).join(', ')}
            </Text>
            {chat.data?.chat && (
              <Pressable
                onPress={() => shareLink(`/${locale}/chats/join/${chat.data!.chat!.invite_code}`, `${c.invite}: ${chat.data!.chat!.name}`)}
                accessibilityRole="button"
                style={{ backgroundColor: brand.mint, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: brand.forest, fontWeight: '700' }}>+ {c.invite}</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={<ScreenState loading={messages.isLoading} error={messages.error} />}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          const blocked = item.objectors.length > 0;
          return (
            <Pressable onLongPress={() => openActions(item)} delayLongPress={300} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
              {!mine && <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryLabel }}>{item.sender_name}</Text>}
              {item.media_url && item.media_type && <ChatMedia url={item.media_url} type={item.media_type} />}
              {item.body && (
                <Text
                  style={{ maxWidth: '85%', backgroundColor: mine ? brand.night : colors.card, color: mine ? '#ffffff' : colors.label, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', fontSize: 15 }}
                >
                  {item.body}
                </Text>
              )}
              <Text style={{ fontSize: 11, color: colors.secondaryLabel }}>
                {time.format(new Date(item.created_at))}
                {item.share_public ? ` · ${blocked ? c.objected : item.featured ? c.featured : c.sharedPublicly}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={{ gap: 8, padding: 12, borderTopWidth: 0.5, borderColor: colors.separator, backgroundColor: colors.card }}>
        {error ? <Text selectable style={{ color: '#b42318' }}>{error}</Text> : null}
        {picked && (
          <View style={{ gap: 6 }}>
            <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.label }}>
              {picked.kind === 'video' ? '🎬' : '📷'} {picked.name}{' '}
              <Text onPress={() => setPicked(null)} style={{ color: brand.sunset }}>✕</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Switch value={sharePublic} onValueChange={setSharePublic} trackColor={{ true: brand.sunset }} />
              <Text style={{ flex: 1, color: colors.label, fontWeight: '600' }}>{c.shareConsent}</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{c.consentNote}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel={c.attach} style={{ backgroundColor: brand.mint, borderRadius: radius.button, width: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>＋</Text>
          </Pressable>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={c.placeholder}
            placeholderTextColor={colors.secondaryLabel}
            multiline
            maxLength={4000}
            style={{ flex: 1, maxHeight: 120, backgroundColor: colors.background, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.label }}
          />
          <Pressable onPress={send} disabled={sending || (!body.trim() && !picked)} accessibilityRole="button" accessibilityLabel={c.send} style={{ backgroundColor: brand.sunset, borderRadius: radius.button, paddingHorizontal: 16, justifyContent: 'center', opacity: sending || (!body.trim() && !picked) ? 0.5 : 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: '800' }}>{sending ? c.uploading : c.send}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
