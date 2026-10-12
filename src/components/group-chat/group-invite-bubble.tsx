import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { approveGroupInvite, rejectGroupInvite } from '@/api/group-chat';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';
import type { GroupChatInviteContent, GroupChatInviteStatus } from '@/types/group-chat';

interface Props {
  message: ChatMessage;
  myUserId: string;
  /** Gọi sau khi chấp nhận lời mời thành công (dùng để refresh danh sách hội thoại). */
  onAccepted?: (groupChatId: string) => void;
}

/** Parse JSON nội dung tin type=group_invite. Thất bại → null (render nothing). */
function parseInviteContent(content: string): GroupChatInviteContent | null {
  try {
    const parsed = JSON.parse(content) as GroupChatInviteContent;
    if (parsed.request_id && parsed.chat_id && parsed.status) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Bubble lời mời tham gia nhóm trong chat 1-1 (tin do server chèn,
 * type=group_invite, content JSON plaintext). Mirror Web GroupInviteBubble.
 */
export function GroupInviteBubble({ message, myUserId, onAccepted }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  // Server cập nhật status trong DB nhưng KHÔNG broadcast tin cập nhật —
  // override local sau khi accept/reject để badge đổi ngay.
  const [statusOverride, setStatusOverride] = useState<GroupChatInviteStatus | null>(null);

  const invite = useMemo(() => parseInviteContent(message.content), [message.content]);

  const isMine = message.sender_id === myUserId;
  const status: GroupChatInviteStatus = statusOverride ?? invite?.status ?? 'pending';
  const canRespond = status === 'pending' && !isMine && !loading;

  if (!invite) return null;

  const handleAccept = () => {
    if (loading || !invite) return;
    Alert.alert(
      t('chat.groupInviteTitle'),
      `${invite.requester_name} ${t('chat.groupInviteLabel')}\n${invite.group_name}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.inviteAccept'),
          onPress: async () => {
            setLoading(true);
            try {
              await approveGroupInvite(invite.chat_id, invite.request_id);
              setStatusOverride('accepted');
              Alert.alert(t('common.success'), t('chat.inviteAccepted'));
              onAccepted?.(invite.chat_id);
            } catch {
              Alert.alert(t('common.error'), t('chat.inviteAcceptFailed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = () => {
    if (loading || !invite) return;
    Alert.alert(
      t('chat.groupInviteTitle'),
      `${invite.requester_name} ${t('chat.groupInviteLabel')}\n${invite.group_name}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.inviteDecline'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await rejectGroupInvite(invite.chat_id, invite.request_id);
              setStatusOverride('rejected');
              Alert.alert(t('common.success'), t('chat.inviteDeclined'));
            } catch {
              Alert.alert(t('common.error'), t('chat.inviteDeclineFailed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.header}>
          {invite.group_avatar ? (
            <Image source={{ uri: invite.group_avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
              <Icon name="people" size={18} color={theme.primary} />
            </View>
          )}
          <View style={styles.info}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {t('chat.groupInviteTitle')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" numberOfLines={1}>
              {invite.group_name}
            </ThemedText>
          </View>
          {canRespond && <Icon name="chevronRight" size={18} color={theme.textSecondary} />}
        </View>

        {canRespond && (
          <View style={styles.actions}>
            <Pressable
              onPress={handleReject}
              disabled={loading}
              style={[styles.actionBtn, { backgroundColor: theme.bgSecondary }]}>
              <ThemedText style={{ color: theme.text }}>{t('chat.inviteDecline')}</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleAccept}
              disabled={loading}
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: '#FFFFFF' }}>{t('chat.inviteAccept')}</ThemedText>
            </Pressable>
          </View>
        )}

        {status !== 'pending' || isMine ? (
          <View style={styles.statusRow}>
            <Icon
              name={status === 'accepted' ? 'checkCircle' : status === 'rejected' ? 'xCircle' : 'hourglass'}
              size={12}
              color={
                status === 'accepted'
                  ? theme.success
                  : status === 'rejected'
                    ? theme.danger
                    : theme.textSecondary
              }
            />
            <ThemedText
              themeColor="textSecondary"
              style={styles.statusText}>
              {status === 'accepted'
                ? t('chat.inviteStatusAccepted')
                : status === 'rejected'
                  ? t('chat.inviteStatusRejected')
                  : t('chat.inviteStatusPending')}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: Spacing.md,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    ...Typography.caption,
    fontSize: 11,
  },
});
