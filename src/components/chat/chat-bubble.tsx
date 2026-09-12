import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmojiImage } from '@/components/chat/emoji-image';
import { MessageMedia } from '@/components/chat/message-media';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatTime } from '@/utils/chat';
import { getEmojiTextMap, singleEmojiCode } from '@/utils/emojis';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  isMine: boolean;
  showTime?: boolean;
  onLongPress?: (msg: ChatMessage) => void;
  onReplyPress?: (messageId: string) => void;
  onMediaPress?: (msg: ChatMessage) => void;
}

export function ChatBubble({ message, isMine, showTime = true, onLongPress, onReplyPress, onMediaPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const emojiMap = useMemo(() => getEmojiTextMap(), []);

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
  const singleEmoji = singleEmojiCode(message.content, emojiMap);

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={[
          styles.bubble,
          {
            backgroundColor: singleEmoji ? 'transparent' : bgColor,
            borderBottomRightRadius: isMine ? Radius.sm : Radius.lg,
            borderBottomLeftRadius: isMine ? Radius.lg : Radius.sm,
          },
        ]}>
        {/* Reply snippet */}
        {message.reply_to && (
          <Pressable
            onPress={() => onReplyPress?.(message.reply_to!.id)}
            style={[styles.replySnippet, { borderLeftColor: isMine ? 'rgba(255,255,255,0.5)' : theme.primary }]}>
            <ThemedText
              style={[styles.replyName, { color: isMine ? 'rgba(255,255,255,0.8)' : theme.primary }]}
              numberOfLines={1}>
              {message.reply_to.sender_name || t('chat.unknown')}
            </ThemedText>
            <ThemedText
              style={[styles.replyText, { color: isMine ? 'rgba(255,255,255,0.6)' : theme.textSecondary }]}
              numberOfLines={1}>
              {message.reply_to.content || t('chat.attachment')}
            </ThemedText>
          </Pressable>
        )}

        {/* Content */}
        {singleEmoji ? (
          <EmojiImage emoji={emojiMap.get(singleEmoji)!} size={64} />
        ) : (message.media_id || message.media_uri) ? (
          <MessageMedia
            message={message}
            onPress={() => onMediaPress?.(message)}
          />
        ) : (
          <MessageText content={message.content} emojiMap={emojiMap} color={textColor} />
        )}

        {/* Caption below media */}
        {singleEmoji ? null : (message.media_id || message.media_uri) && message.content?.trim() ? (
          <MessageText content={message.content} emojiMap={emojiMap} color={textColor} />
        ) : null}

        {showTime && (
          <ThemedText
            style={[styles.time, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
            {formatChatTime(message.created_at, t)}
            {message.e2e_version === 1 ? ' 🔒' : ''}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

function MessageText({
  content,
  emojiMap,
  color,
}: {
  content: string;
  emojiMap: Map<string, { emoji: string }>;
  color: string;
}) {
  const EMOJI_RE = /(:[a-z0-9+_-]+:)/gi;
  const parts = content.split(EMOJI_RE);

  return (
    <Text style={[styles.content, { color }]}>
      {parts.map((part, i) => {
        if (part.startsWith(':') && part.endsWith(':')) {
          const emoji = emojiMap.get(part);
          if (emoji) {
            return <Text key={i}>{emoji.emoji}</Text>;
          }
        }
        return part;
      })}
    </Text>
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
  replySnippet: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 4,
    gap: 1,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyText: {
    fontSize: 12,
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
