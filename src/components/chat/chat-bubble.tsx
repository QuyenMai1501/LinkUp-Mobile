import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatTime } from '@/utils/chat';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  isMine: boolean;
  showTime?: boolean;
}

export function ChatBubble({ message, isMine, showTime = true }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (message.deleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, styles.bubbleDeleted, { backgroundColor: theme.bgSecondary }]}>
          <ThemedText themeColor="textSecondary" style={styles.deletedText}>
            {t('chat.messageDeleted')}
          </ThemedText>
          {showTime && (
            <ThemedText themeColor="textSecondary" style={styles.time}>
              {formatChatTime(message.created_at, t)}
            </ThemedText>
          )}
        </View>
      </View>
    );
  }

  if (message.decrypt_failed) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, { backgroundColor: theme.bgSecondary }]}>
          <ThemedText themeColor="textSecondary" style={styles.deletedText}>
            🔒 {t('chat.undecryptable')}
          </ThemedText>
        </View>
      </View>
    );
  }

  const bgColor = isMine ? theme.primary : theme.card;
  const textColor = isMine ? '#FFFFFF' : theme.text;

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bgColor,
            borderBottomRightRadius: isMine ? Radius.sm : Radius.lg,
            borderBottomLeftRadius: isMine ? Radius.lg : Radius.sm,
          },
        ]}>
        <ThemedText style={[styles.content, { color: textColor }]}>
          {message.content}
        </ThemedText>
        {showTime && (
          <ThemedText
            style={[styles.time, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
            {formatChatTime(message.created_at, t)}
            {message.e2e_version === 1 ? ' 🔒' : ''}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 2,
    paddingHorizontal: Spacing.md,
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    gap: 2,
  },
  bubbleDeleted: {
    opacity: 0.6,
  },
  content: {
    ...Typography.body,
    fontSize: 15,
  },
  time: {
    ...Typography.caption,
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  deletedText: {
    ...Typography.caption,
    fontStyle: 'italic',
  },
});
