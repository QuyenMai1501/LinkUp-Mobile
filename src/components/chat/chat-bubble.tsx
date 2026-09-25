import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { EmojiImage } from '@/components/chat/emoji-image';
import { RichContent } from '@/components/rich-content';
import { MessageMedia } from '@/components/chat/message-media';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatTime } from '@/utils/chat';
import { getEmojiTextMap, singleEmojiCode } from '@/utils/emojis';
import { isSingleGiphyUrl } from '@/api/giphy';
import type { EmojiItem } from '@/utils/emojis';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  isMine: boolean;
  showTime?: boolean;
  isPinned?: boolean;
  onLongPress?: (msg: ChatMessage) => void;
  onReplyPress?: (messageId: string) => void;
  onMediaPress?: (msg: ChatMessage) => void;
}

export function ChatBubble({ message, isMine, showTime = true, isPinned, onLongPress, onReplyPress, onMediaPress }: Props) {
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
            {t('chat.undecryptable')}
          </ThemedText>
        </View>
      </View>
    );
  }

  const bgColor = isMine ? theme.primary : theme.card;
  const textColor = isMine ? '#FFFFFF' : theme.text;
  const singleEmoji = singleEmojiCode(message.content, emojiMap);
  const singleGiphy = !singleEmoji && isSingleGiphyUrl(message.content);

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={[
          styles.bubble,
          {
            backgroundColor: singleEmoji || singleGiphy ? 'transparent' : bgColor,
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
        ) : singleGiphy ? (
          <Image
            source={{ uri: message.content.trim() }}
            style={styles.singleGiphy}
            contentFit="contain"
            transition={200}
          />
        ) : (message.media_id || message.media_uri) ? (
          <MessageMedia
            message={message}
            onPress={() => onMediaPress?.(message)}
          />
        ) : (
          <MessageText content={message.content} emojiMap={emojiMap} color={textColor} />
        )}

        {/* Caption below media */}
        {singleEmoji || singleGiphy ? null : (message.media_id || message.media_uri) && message.content?.trim() ? (
          <MessageText content={message.content} emojiMap={emojiMap} color={textColor} />
        ) : null}

        {showTime && (
          <View style={styles.timeRow}>
            {isPinned && <Icon name="pin" size={10} color={isMine ? 'rgba(255,255,255,0.7)' : theme.textSecondary} />}
            <ThemedText
              style={[styles.time, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
              {formatChatTime(message.created_at, t)}
            </ThemedText>
          </View>
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
  emojiMap: Map<string, EmojiItem>;
  color: string;
}) {
  return <RichContent content={content} emojiMap={emojiMap} size={18} style={[styles.content, { color }]} />;
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
  singleGiphy: {
    width: 64,
    height: 64,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
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
