import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { GLYPHS } from '@/components/glyph';
import { Avatar, Badge, Button, Card, EmptyState, ErrorText, Field, ListGroup, ListRow, ScreenState, Section } from '@/components/ui';
import { conversationView, createGroupChat, joinGroupChat, listConversations, listGroupChats } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { useType } from '@/lib/use-type';
import { brand, colors, iconBox, layout, space } from '@/theme';

export default function ChatsScreen() {
  const { t } = useI18n();
  const { type } = useType();
  const { session } = useSession();
  const userId = session?.user.id;

  const conversations = useQuery({ queryKey: ['conversations', userId], queryFn: listConversations, enabled: !!userId });
  const chats = useQuery({ queryKey: ['group-chats', userId], queryFn: () => listGroupChats(userId!), enabled: !!userId });

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  const needsSetup = useNeedsSetup();
  if (!userId) {
    return (
      <>
        <Stack.Title large>{t.app.tabChats}</Stack.Title>
        <SignInPrompt screen />
      </>
    );
  }

  async function create() {
    if (!name.trim()) return;
    if (needsSetup) return router.push(welcomeHref('/chats'));
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
    if (needsSetup) return router.push(welcomeHref('/chats'));
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
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: layout.screenX, gap: layout.sectionGap, paddingBottom: space.xxxl }}
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

      <Section title={t.chats.title}>
        {chats.isLoading || chats.error ? (
          <ScreenState loading={chats.isLoading} error={chats.error} onRetry={() => chats.refetch()} />
        ) : chats.data?.length === 0 ? (
          <EmptyState glyph={GLYPHS.chat} text={t.chats.none} />
        ) : (
          <ListGroup>
            {(chats.data ?? []).map((chat) => (
              <ListRow
                key={chat.id}
                leading={<Avatar name={chat.name} size={iconBox.lg} />}
                title={chat.name}
                strong={!!chat.unread}
                subtitle={chat.group_trip_id ? t.chats.tripChat : undefined}
                accessory={chat.unread ? <Badge label={t.messages.newBadge} /> : undefined}
                accessibilityRole="link"
                onPress={() => router.push(`/chat/${chat.id}`)}
              />
            ))}
          </ListGroup>
        )}

        <Card>
          <Text accessibilityRole="header" style={type.cardTitle}>{t.chats.newChat}</Text>
          <Field label={t.chats.chatName} value={name} onChangeText={setName} placeholder={t.chats.chatNamePlaceholder} maxLength={80} />
          <Button title={t.chats.create} onPress={create} loading={busy === 'create'} disabled={!name.trim()} />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.xs }} />
          <Text accessibilityRole="header" style={type.cardTitle}>{t.chats.joinWithCode}</Text>
          <Field label={t.chats.codePlaceholder} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
          <Button title={t.chats.join} variant="outline" onPress={join} loading={busy === 'join'} disabled={!code.trim()} />
          <ErrorText>{error}</ErrorText>
        </Card>
      </Section>

      <Section title={t.app.conversations}>
        {conversations.isLoading || conversations.error || conversations.data?.length === 0 ? (
          <ScreenState
            loading={conversations.isLoading}
            error={conversations.error}
            onRetry={() => conversations.refetch()}
            empty={conversations.data?.length === 0}
            emptyText={t.messages.noneTraveler}
            emptyGlyph={GLYPHS.chat}
          />
        ) : (
          <ListGroup>
            {(conversations.data ?? []).map((c) => {
              const { otherName, unread } = conversationView(c, userId);
              return (
                <ListRow
                  key={c.id}
                  leading={<Avatar name={otherName} uri={c.guides?.photo_url} size={iconBox.lg} />}
                  title={otherName}
                  strong={unread}
                  subtitle={c.last_message_preview ?? '…'}
                  subtitleLines={1}
                  accessory={unread && c.last_message_preview ? <Badge label={t.messages.newBadge} /> : undefined}
                  accessibilityRole="link"
                  onPress={() => router.push(`/conversation/${c.id}`)}
                />
              );
            })}
          </ListGroup>
        )}
      </Section>
    </ScrollView>
  );
}
