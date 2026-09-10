import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export function ChatComposer({ onSend, onTyping }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    onTyping(false);
  };

  const handleChangeText = (value: string) => {
    setText(value);
    onTyping(value.length > 0);
  };

  return (
    <View style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
        value={text}
        onChangeText={handleChangeText}
        placeholder={t('chat.placeholder')}
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={2000}
      />
      <Pressable
        onPress={handleSend}
        style={({ pressed }) => [
          styles.sendBtn,
          {
            backgroundColor: text.trim() ? theme.primary : theme.bgSecondary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        disabled={!text.trim()}>
        <View>
          <View style={[styles.sendIcon, { borderColor: text.trim() ? '#FFF' : theme.textSecondary }]} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'currentColor',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
});
