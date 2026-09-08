import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { NotificationGroup, NotificationType } from '../types/notification';

type NotificationItemProps = {
  item: NotificationGroup;
  onPress: () => void;
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays <= 7) return `${diffDays} ngày`;

  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function getIconEmoji(type: NotificationType): string {
  switch (type) {
    case 'like':
      return '❤️';
    case 'comment':
      return '💬';
    case 'share':
      return '↗️';
    case 'follow':
      return '👤';
    case 'message':
      return '📨';
    case 'friend_request':
    case 'friend_accepted':
      return '👥';
    case 'voice_call':
      return '📞';
    case 'community_join_request':
    case 'community_join_approved':
    case 'community_join_rejected':
    case 'community_role_changed':
    case 'community_member_left':
    case 'community_member_kicked':
    case 'community_group_chat_added':
    case 'community_invite_code_used':
    case 'community_invitation_received':
    case 'community_invitation_accepted':
      return '🌐';
    case 'media_approved':
      return '✅';
    case 'media_rejected':
      return '❌';
    case 'media_flagged':
      return '⚠️';
    default:
      return '🔔';
  }
}

function getIconColor(type: NotificationType): string {
  switch (type) {
    case 'like':
      return '#E53935';
    case 'comment':
      return '#43A047';
    case 'share':
      return '#E53935';
    case 'follow':
      return '#1E88E5';
    case 'message':
      return '#FB8C00';
    case 'friend_request':
    case 'friend_accepted':
      return '#8E24AA';
    case 'voice_call':
      return '#00897B';
    case 'media_approved':
      return '#43A047';
    case 'media_rejected':
      return '#E53935';
    case 'media_flagged':
      return '#FB8C00';
    default:
      return '#757575';
  }
}

export default function NotificationItem({ item, onPress }: NotificationItemProps) {
  const theme = useTheme();
  const iconEmoji = getIconEmoji(item.type);
  const iconColor = getIconColor(item.type);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: item.is_read ? theme.card : theme.primaryLight,
          borderColor: theme.border,
        },
        pressed && styles.itemPressed,
      ]}>
      <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}20` }]}>
        {item.sender_avatar ? (
          <Image
            source={{ uri: item.sender_avatar }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <ThemedText style={styles.iconEmoji}>{iconEmoji}</ThemedText>
        )}
      </View>

      <View style={styles.body}>
        <ThemedText style={styles.content} numberOfLines={2}>
          {item.sender_name ? (
            <>
              <ThemedText style={styles.senderName}>{item.sender_name}</ThemedText>
              {' '}
            </>
          ) : null}
          {item.content}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.time}>
          {formatRelativeTime(item.created_at)}
        </ThemedText>
      </View>

      <View style={styles.endSection}>
        {item.count > 1 && (
          <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.countText}>+{item.count}</ThemedText>
          </View>
        )}
        {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  itemPressed: {
    opacity: 0.7,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconEmoji: {
    fontSize: 18,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  content: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  senderName: {
    fontWeight: 700,
  },
  time: {
    ...Typography.caption,
    fontSize: 12,
  },
  endSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 700,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
