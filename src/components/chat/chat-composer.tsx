import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmojiPicker } from '@/components/chat/emoji-picker';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';
import type { EmojiItem } from '@/utils/emojis';

interface Props {
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo?: ChatMessage | null;
  onClearReply?: () => void;
}

export function ChatComposer({ onSend, onTyping, replyingTo, onClearReply }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);

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

  const handleEmojiSelect = (emoji: EmojiItem) => {
    setText((prev) => prev + emoji.code);
  };

  return (
    <View style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
      {/* Reply bar */}
      {replyingTo && (
        <View style={[styles.replyBar, { backgroundColor: theme.bgSecondary, borderLeftColor: theme.primary }]}>
          <View style={styles.replyContent}>
            <View style={styles.replyLabel}>
              <ThemedText style={[styles.replyIcon]}>↩️</ThemedText>
              <ThemedText style={[styles.replyName, { color: theme.primary }]} numberOfLines={1}>
                {replyingTo.sender_name || t('chat.unknown')}
              </ThemedText>
            </View>
            <ThemedText style={[styles.replySnippet, { color: theme.textSecondary }]} numberOfLines={1}>
              {replyingTo.deleted ? t('chat.messageDeleted') : replyingTo.content || t('chat.attachment')}
            </ThemedText>
          </View>
          <Pressable onPress={onClearReply} hitSlop={8} style={styles.replyCancel}>
            <ThemedText style={[styles.replyCancelIcon, { color: theme.textSecondary }]}>✕</ThemedText>
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        {/* Emoji button */}
        <Pressable
          onPress={() => setEmojiOpen((prev) => !prev)}
          style={[styles.emojiBtn, emojiOpen && { backgroundColor: theme.bgSecondary }]}>
          <ThemedText style={styles.emojiBtnIcon}>😊</ThemedText>
        </Pressable>

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

      {/* Emoji picker */}
      <EmojiPicker visible={emojiOpen} onClose={() => setEmojiOpen(false)} onSelect={handleEmojiSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  replyContent: {
    flex: 1,
    gap: 2,
  },
  replyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyIcon: {
    fontSize: 12,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
  },
  replySnippet: {
    fontSize: 12,
  },
  replyCancel: {
    padding: Spacing.xs,
  },
  replyCancelIcon: {
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnIcon: {
    fontSize: 20,
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
