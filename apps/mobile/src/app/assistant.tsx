import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { fetch } from 'expo/fetch';
import { useI18n } from '@/lib/i18n';
import { SITE_URL } from '@/lib/supabase';
import { brand, colors, radius, space, textSize } from '@/theme';

type Message = { role: 'user' | 'assistant'; content: string };

// Kwetuly AI concierge: the same service as the website (kwetuly.com/api/concierge), answers stream in.
export default function AssistantScreen() {
  const { t } = useI18n();
  const c = t.concierge;
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
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Text style={{ backgroundColor: colors.card, color: colors.label, padding: space.md, borderRadius: radius.bubble, overflow: 'hidden' }}>{c.intro}</Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{c.disclaimer}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Text
            selectable
            style={{
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              backgroundColor: item.role === 'user' ? brand.night : colors.card,
              color: item.role === 'user' ? brand.onDark : colors.label,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              borderRadius: radius.bubble,
              overflow: 'hidden',
              fontSize: textSize.callout,
              lineHeight: 21,
            }}
          >
            {item.content || '…'}
          </Text>
        )}
      />
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 0.5, borderColor: colors.separator, backgroundColor: colors.card }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={c.placeholder}
          placeholderTextColor={colors.secondaryLabel}
          multiline
          maxLength={2000}
          style={{ flex: 1, maxHeight: 120, backgroundColor: colors.background, borderRadius: radius.button, paddingHorizontal: space.lg, paddingVertical: space.md, fontSize: textSize.body, color: colors.label }}
        />
        <Pressable onPress={send} disabled={busy || !input.trim()} accessibilityRole="button" accessibilityLabel={c.send} style={{ backgroundColor: brand.leaf, borderRadius: radius.button, paddingHorizontal: space.lg, justifyContent: 'center', opacity: busy || !input.trim() ? 0.5 : 1 }}>
          <Text style={{ color: brand.onDark, fontWeight: '800' }}>{c.send}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
