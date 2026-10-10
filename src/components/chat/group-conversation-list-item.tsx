import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatTime } from '@/utils/chat';
import type { GroupChatConversation } from '@/types/group-chat';

interface Props {
  group: GroupChatConversation;
  myUserId: string;
  onPress: () => void;
}

export function GroupConversationListItem({ group, myUserId, onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { last_message } = group;

  const previewText = !last_message
    ? t('chat.noMessages')
    : last_message.media_id
      ? last_message.media_type?.startsWith('audio/')
        ? t('chat.voiceMessage')
        : t('chat.mediaMessage')
      : last_message.emoji_id
        ? t('chat.emojiMessage')
        : last_message.content || t('chat.mediaMessage');
  const preview =
    last_message && last_message.sender_id === myUserId
      ? `${t('chat.youPrefix')}${previewText}`
      : previewText;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bgHover : 'transparent' },
      ]}>
      {group.avatar_uri ? (
        <Image
          source={{ uri: group.avatar_uri }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.avatarPlaceholder,
            { backgroundColor: theme.primaryLight },
          ]}>
          <Icon name="people" size={22} color={theme.primary} />
        </View>
      )}

      <View style={styles.meta}>
        <View style={styles.topRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {group.name || t('chat.groupChat')}
          </ThemedText>
          {last_message && (
            <ThemedText themeColor="textSecondary" style={styles.time}>
              {formatChatTime(last_message.created_at, t)}
            </ThemedText>
          )}
        </View>
        <View style={styles.previewRow}>
          <ThemedText themeColor="textSecondary" style={styles.memberCount}>
            {t('chat.membersCount', { count: group.member_count })}
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.preview}
            numberOfLines={1}>
            {preview}
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 6,
  },
  memberCount: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  preview: {
    ...Typography.caption,
    flex: 1,
  },
});
