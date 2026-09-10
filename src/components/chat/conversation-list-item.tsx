import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatTime } from '@/utils/chat';
import type { ChatConversation } from '@/types/chat';

interface Props {
  conversation: ChatConversation;
  myUserId: string;
  isOnline: boolean;
  isActive: boolean;
  onPress: () => void;
}

export function ConversationListItem({
  conversation,
  myUserId,
  isOnline,
  isActive,
  onPress,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { partner, last_message, is_encrypted } = conversation;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? theme.bgHover
            : isActive
              ? theme.bgSecondary
              : 'transparent',
        },
      ]}>
      <View style={styles.avatarWrap}>
        {partner.avatar_uri ? (
          <Image source={{ uri: partner.avatar_uri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
              {(partner.display_name || '?')[0]?.toUpperCase()}
            </ThemedText>
          </View>
        )}
        {isOnline && <View style={[styles.onlineDot, { backgroundColor: '#4CAF50' }]} />}
      </View>

      <View style={styles.meta}>
        <View style={styles.topRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {partner.display_name || t('chat.unknown')}
          </ThemedText>
          {last_message && (
            <ThemedText themeColor="textSecondary" style={styles.time}>
              {formatChatTime(last_message.created_at, t)}
            </ThemedText>
          )}
        </View>
        <View style={styles.previewRow}>
          {is_encrypted && (
            <ThemedText style={styles.lockIcon}>🔒</ThemedText>
          )}
          <ThemedText themeColor="textSecondary" style={styles.preview} numberOfLines={1}>
            {last_message
              ? last_message.sender_id === myUserId
                ? `${t('chat.youPrefix')}${last_message.content || t('chat.mediaMessage')}`
                : last_message.content || t('chat.mediaMessage')
              : t('chat.newChat')}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...Typography.h2,
    fontSize: 18,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    ...Typography.body,
    fontWeight: 600,
    flex: 1,
  },
  time: {
    ...Typography.caption,
    fontSize: 11,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  lockIcon: {
    fontSize: 12,
  },
  preview: {
    ...Typography.caption,
    flex: 1,
  },
});
