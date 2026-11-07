import type { ReactNode } from 'react';
import { Platform, Text, TextInput, View, type TextStyle } from 'react-native';
import { useType } from '@/lib/use-type';
import { brand, colors, control, layout, media, radius, space, textSize } from '@/theme';
import { GLYPHS } from './glyph';
import { IconButton } from './ui';

/**
 * One chat message. Your own messages are mint with dark text, everyone else's are white with a thin border.
 * Both pass contrast easily; there is no white text on grey or light green.
 */
export function Bubble({ mine, children, selectable }: { mine: boolean; children: ReactNode; selectable?: boolean }) {
  const { type } = useType();
  return (
    <Text
      selectable={selectable}
      style={{
        ...type.callout,
        maxWidth: '85%',
        backgroundColor: mine ? brand.mint : colors.card,
        borderWidth: mine ? 0 : 1,
        borderColor: colors.border,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radius.bubble,
        overflow: 'hidden',
      }}
    >
      {children}
    </Text>
  );
}

const noWebOutline: TextStyle | null = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

/** The message box at the bottom of a chat: optional leading button, the text, and a green send button. */
export function Composer({
  value,
  onChangeText,
  placeholder,
  maxLength,
  onSend,
  sendLabel,
  canSend,
  leading,
  children,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  onSend: () => void;
  sendLabel: string;
  /** False while sending or when there is nothing to send. */
  canSend: boolean;
  leading?: ReactNode;
  /** Shown above the box, for example an error or the picked photo. */
  children?: ReactNode;
}) {
  const { font } = useType();
  return (
    <View style={{ gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      {children}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        {leading}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.secondaryLabel}
          accessibilityLabel={placeholder}
          multiline
          maxLength={maxLength}
          style={[
            {
              flex: 1,
              minHeight: control.touch,
              maxHeight: media.composerMax,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.button,
              borderCurve: 'continuous',
              paddingHorizontal: space.md,
              paddingVertical: space.sm + space.xxs,
              fontSize: textSize.body,
              color: colors.label,
              ...font.regular,
            },
            noWebOutline,
          ]}
        />
        <IconButton glyph={GLYPHS.send} tone="primary" accessibilityLabel={sendLabel} onPress={onSend} disabled={!canSend} />
      </View>
    </View>
  );
}

/** Spacing for the message list inside a chat. */
export const chatListStyle = { padding: layout.screenX, gap: space.md } as const;
