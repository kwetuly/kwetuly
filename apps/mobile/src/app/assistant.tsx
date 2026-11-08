import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { fetch } from 'expo/fetch';
import { useI18n } from '@/lib/i18n';
import { SITE_URL } from '@/lib/supabase';
import { Bubble, Composer, chatListStyle } from '@/components/chat-ui';
import { useType } from '@/lib/use-type';
import { colors, space } from '@/theme';

type Message = { role: 'user' | 'assistant'; content: string };

// Kwetuly AI concierge: the same service as the website (kwetuly.com/api/concierge), answers stream in.
export default function AssistantScreen() {
  const { t } = useI18n();
  const c = t.concierge;
  const { type } = useType();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    const history: Message[] = [...messages, { role: 'user', content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);

    const append = (text: string) =>
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + text };
        return next;
      });

    try {
      const response = await fetch(`${SITE_URL}/api/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.filter((m) => m.content) }),
      });
      if (!response.ok || !response.body) throw new Error(String(response.status));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }).replace('\n\n[error]', `\n\n${c.error}`));
      }
    } catch {
      append(c.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Title>{c.title}</Stack.Title>
      <FlatList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        data={messages}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={chatListStyle}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Bubble mine={false}>{c.intro}</Bubble>
            <Text style={type.caption}>{c.disclaimer}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Bubble mine={item.role === 'user'} selectable>
              {item.content || '…'}
            </Bubble>
          </View>
        )}
      />
      <Composer value={input} onChangeText={setInput} placeholder={c.placeholder} maxLength={2000} onSend={send} sendLabel={c.send} canSend={!busy && !!input.trim()} />
    </KeyboardAvoidingView>
  );
}
