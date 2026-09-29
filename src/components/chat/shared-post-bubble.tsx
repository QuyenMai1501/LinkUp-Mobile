import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';

const CONTENT_TRUNCATE = 120;

interface Props {
  message: ChatMessage;
  isMine?: boolean;
  onOpenPost?: (postId: string) => void;
  /** Bubbles lồng nhau nên card tự chuyển long-press ra ngoài (mở menu thao tác). */
  onLongPress?: () => void;
}

export function SharedPostBubble({ message, isMine = false, onOpenPost, onLongPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const post = message.shared_post;
  const subColor = isMine ? 'rgba(255,255,255,0.75)' : theme.textSecondary;
  const titleColor = isMine ? '#FFFFFF' : theme.text;
  const bodyColor = isMine ? 'rgba(255,255,255,0.85)' : theme.textSecondary;
  const borderColor = isMine ? 'rgba(255,255,255,0.3)' : theme.border;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon name="share" size={12} color={subColor} />
        <ThemedText style={[styles.headerText, { color: subColor }]}>
          {t('chat.sharedPost')}
        </ThemedText>
      </View>

      {post ? (
        <Pressable
          style={[styles.card, { borderColor }]}
          onPress={() => {
            if (message.shared_post_id) onOpenPost?.(message.shared_post_id);
          }}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityRole="link">
          {post.media_uri ? (
            <Image source={{ uri: post.media_uri }} style={styles.media} contentFit="cover" transition={150} />
          ) : null}
          <View style={styles.cardBody}>
            <View style={styles.authorRow}>
              {post.avatar_uri ? (
                <Image source={{ uri: post.avatar_uri }} style={styles.authorAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.authorAvatar, styles.authorAvatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText style={[styles.authorLetter, { color: theme.primary }]}>
                    {(post.display_name || '?')[0]?.toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <ThemedText style={[styles.authorName, { color: titleColor }]} numberOfLines={1}>
                {post.display_name}
              </ThemedText>
            </View>
            {post.title ? (
              <ThemedText style={[styles.postTitle, { color: titleColor }]} numberOfLines={2}>
                {post.title}
              </ThemedText>
            ) : null}
            {post.content ? (
              <ThemedText style={[styles.postText, { color: bodyColor }]} numberOfLines={3}>
                {post.content.length > CONTENT_TRUNCATE
                  ? post.content.slice(0, CONTENT_TRUNCATE) + '...'
                  : post.content}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.card, styles.placeholder, { borderColor }]}
          onLongPress={onLongPress}
          delayLongPress={400}>
          <ThemedText style={[styles.placeholderText, { color: subColor }]}>
            {t('chat.postNotAvailable')}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    minWidth: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerText: {
    ...Typography.caption,
    fontSize: 11,
    fontStyle: 'italic',
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: 140,
  },
  cardBody: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    gap: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  authorAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorLetter: {
    fontSize: 10,
    fontWeight: '700',
  },
  authorName: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  postTitle: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
  },
  postText: {
    ...Typography.caption,
    fontSize: 12,
  },
  placeholder: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  placeholderText: {
    ...Typography.caption,
    fontSize: 12,
  },
});
