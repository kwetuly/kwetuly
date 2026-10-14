import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Avatar, Badge, Button, Card, ScreenState, SectionTitle, ErrorText } from '@/components/ui';
import { conversationView, createGroupChat, joinGroupChat, listConversations, listGroupChats } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

const inputStyle = {
  backgroundColor: colors.background,
  borderRadius: radius.button,
  borderCurve: 'continuous' as const,
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
  fontSize: textSize.body,
  color: colors.label,
};

export default function ChatsScreen() {
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;

  const conversations = useQuery({ queryKey: ['conversations', userId], queryFn: listConversations, enabled: !!userId });
  const chats = useQuery({ queryKey: ['group-chats', userId], queryFn: () => listGroupChats(userId!), enabled: !!userId });

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  if (!userId) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }}>
        <Stack.Title large>{t.app.tabChats}</Stack.Title>
        <SignInPrompt />
      </ScrollView>
    );
  }

  async function create() {
    if (!name.trim()) return;
    setBusy('create');
    setError('');
    try {
      const id = await createGroupChat(name.trim(), userId!);
      setName('');
      chats.refetch();
      router.push(`/chat/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    if (!code.trim()) return;
    setBusy('join');
    setError('');
    try {
      const id = await joinGroupChat(code);
      setCode('');
      chats.refetch();
      router.push(`/chat/${id}`);
    } catch {
      setError(t.chats.joinError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={conversations.isRefetching || chats.isRefetching}
          onRefresh={() => {
            conversations.refetch();
            chats.refetch();
          }}
          tintColor={brand.leaf}
        />
      }
    >
      <Stack.Title large>{t.app.tabChats}</Stack.Title>

      <View style={{ gap: space.md }}>
        <SectionTitle>{t.chats.title}</SectionTitle>
        <ScreenState loading={chats.isLoading} error={chats.error} />
        {(chats.data ?? []).map((chat) => (
          <Link key={chat.id} href={`/chat/${chat.id}`} asChild>
            <Pressable>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Avatar name={chat.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: chat.unread ? '800' : '600', fontSize: textSize.body, color: colors.label }}>{chat.name}</Text>
                  {chat.group_trip_id && <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{t.chats.tripChat}</Text>}
                </View>
                {chat.unread && <Badge label={t.messages.newBadge} />}
              </Card>
            </Pressable>
          </Link>
        ))}
        {chats.data?.length === 0 && <Text style={{ color: colors.secondaryLabel }}>{t.chats.none}</Text>}

        <Card>
          <Text style={{ fontWeight: '700', color: colors.label }}>{t.chats.newChat}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t.chats.chatNamePlaceholder} placeholderTextColor={colors.secondaryLabel} maxLength={80} style={inputStyle} accessibilityLabel={t.chats.chatName} />
          <Button title={t.chats.create} onPress={create} loading={busy === 'create'} disabled={!name.trim()} />
          <Text style={{ fontWeight: '700', color: colors.label, marginTop: space.sm }}>{t.chats.joinWithCode}</Text>
          <TextInput value={code} onChangeText={setCode} placeholder={t.chats.codePlaceholder} placeholderTextColor={colors.secondaryLabel} autoCapitalize="none" autoCorrect={false} style={inputStyle} accessibilityLabel={t.chats.codePlaceholder} />
          <Button title={t.chats.join} variant="outline" onPress={join} loading={busy === 'join'} disabled={!code.trim()} />
          <ErrorText>{error}</ErrorText>
        </Card>
      </View>

      <View style={{ gap: space.md }}>
        <SectionTitle>{t.app.conversations}</SectionTitle>
        <ScreenState loading={conversations.isLoading} error={conversations.error} empty={conversations.data?.length === 0} emptyText={t.messages.noneTraveler} />
        {(conversations.data ?? []).map((c) => {
          const { otherName, unread } = conversationView(c, userId);
          return (
            <Link key={c.id} href={`/conversation/${c.id}`} asChild>
              <Pressable>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Avatar name={otherName} uri={c.guides?.photo_url} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: unread ? '800' : '600', fontSize: textSize.body, color: colors.label }}>{otherName}</Text>
                    <Text numberOfLines={1} style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>
                      {c.last_message_preview ?? '…'}
                    </Text>
                  </View>
                  {unread && c.last_message_preview && <Badge label={t.messages.newBadge} />}
                </Card>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}
