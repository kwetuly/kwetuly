import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenState } from '@/components/ui';
import { conversationView, listConversations, listMessages, markConversationRead, sendMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useLive } from '@/hooks/use-live';
import { reportMessage } from '@/lib/api-more';
import { brand, colors, radius } from '@/theme/colors';

// One-to-one chat with a guide. Phone numbers and emails stay hidden until a booking is confirmed (done by the database).
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const conversations = useQuery({ queryKey: ['conversations', userId], queryFn: listConversations, enabled: !!userId });
  const messages = useQuery({ queryKey: ['messages', id], queryFn: () => listMessages(id), enabled: !!userId });
  useLive('messages', `conversation_id=eq.${id}`, ['messages', id]);

  const conversation = conversations.data?.find((c) => c.id === id);
  const view = conversation ? conversationView(conversation, userId) : null;
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (view) markConversationRead(id, view.isTraveler);
  }, [id, view, messages.data?.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendMessage(id, userId, text);
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['messages', id] });
    } finally {
      setSending(false);
    }
  }

  const time = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Title>{view?.otherName ?? t.messages.title}</Stack.Title>
      <FlatList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        data={messages.data ?? []}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <Text style={{ backgroundColor: conversation?.contact_unlocked ? brand.mint : brand.sand, color: conversation?.contact_unlocked ? brand.forest : brand.sunsetDark, padding: 12, borderRadius: 14, fontSize: 12, marginBottom: 6 }}>
            {conversation?.contact_unlocked ? t.messages.unlockedNote : t.messages.hiddenNote}
          </Text>
        }
        ListEmptyComponent={<ScreenState loading={messages.isLoading} error={messages.error} />}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          return (
            <Pressable
              onLongPress={() =>
                !mine &&
                Alert.alert(t.messages.report, item.body.slice(0, 120), [
                  { text: t.app.clear, style: 'cancel' },
                  { text: t.messages.report, style: 'destructive', onPress: () => reportMessage(item.id, userId).then(() => Alert.alert(t.messages.reported)) },
                ])
              }
              delayLongPress={300}
              style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}
            >
              <Text
                selectable
                style={{
                  maxWidth: '85%',
                  backgroundColor: mine ? brand.night : colors.card,
                  color: mine ? '#ffffff' : colors.label,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 18,
                  overflow: 'hidden',
                  fontSize: 15,
                }}
              >
                {item.body}
              </Text>
              <Text style={{ fontSize: 11, color: colors.secondaryLabel }}>{time.format(new Date(item.created_at))}</Text>
            </Pressable>
          );
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 0.5, borderColor: colors.separator, backgroundColor: colors.card }}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t.messages.placeholder}
          placeholderTextColor={colors.secondaryLabel}
          multiline
          maxLength={4000}
          style={{ flex: 1, maxHeight: 120, backgroundColor: colors.background, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.label }}
        />
        <Pressable onPress={send} disabled={sending || !body.trim()} accessibilityRole="button" accessibilityLabel={t.messages.send} style={{ backgroundColor: brand.sunset, borderRadius: radius.button, paddingHorizontal: 16, justifyContent: 'center', opacity: sending || !body.trim() ? 0.5 : 1 }}>
          <Text style={{ color: '#ffffff', fontWeight: '800' }}>{t.messages.send}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
