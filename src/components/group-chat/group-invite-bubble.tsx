import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { approveGroupInvite, rejectGroupInvite } from '@/api/group-chat';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';
import type {
  GroupChatInviteContent,
  GroupChatInviteStatus,
} from '@/types/group-chat';

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
 * type=group_invite, content JSON plaintext).
 *
 * Card gọn: avatar + "Lời mời vào nhóm" + tên nhóm. Tap (pending & không phải
 * của mình) → modal thông tin nhóm + 2 nút Tham gia / Từ chối. Mirror Web
 * GroupInviteBubble (modal thay vì Alert).
 */
export function GroupInviteBubble({ message, myUserId, onAccepted }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Server cập nhật status trong DB nhưng KHÔNG broadcast tin cập nhật —
  // override local sau khi accept/reject để badge đổi ngay.
  const [statusOverride, setStatusOverride] =
    useState<GroupChatInviteStatus | null>(null);

  const invite = useMemo(
    () => parseInviteContent(message.content),
    [message.content],
  );

  const isMine = message.sender_id === myUserId;
  const status: GroupChatInviteStatus = statusOverride ?? invite?.status ?? 'pending';
  const canOpenModal = status === 'pending' && !isMine;

  if (!invite) return null;

  const handleAccept = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await approveGroupInvite(invite.chat_id, invite.request_id);
      setStatusOverride('accepted');
      setModalOpen(false);
      Alert.alert(t('common.success'), t('chat.inviteAccepted'));
      onAccepted?.(invite.chat_id);
    } catch {
      Alert.alert(t('common.error'), t('chat.inviteAcceptFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await rejectGroupInvite(invite.chat_id, invite.request_id);
      setStatusOverride('rejected');
      setModalOpen(false);
      Alert.alert(t('common.success'), t('chat.inviteDeclined'));
    } catch {
      Alert.alert(t('common.error'), t('chat.inviteDeclineFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <Pressable
          onPress={canOpenModal ? () => setModalOpen(true) : undefined}
          disabled={!canOpenModal}
          style={[
            styles.bubble,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={styles.header}>
            {invite.group_avatar ? (
              <Image
                source={{ uri: invite.group_avatar }}
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
                <Icon name="people" size={18} color={theme.primary} />
              </View>
            )}
            <View style={styles.info}>
              <ThemedText style={styles.title} numberOfLines={1}>
                {t('chat.groupInviteTitle')}
              </ThemedText>
              <ThemedText
                themeColor="textSecondary"
                numberOfLines={1}>
                {invite.group_name}
              </ThemedText>
            </View>
            {canOpenModal && (
              <Icon name="chevronRight" size={18} color={theme.textSecondary} />
            )}
          </View>

          {status !== 'pending' || isMine ? (
            <View style={styles.statusRow}>
              <Icon
                name={
                  status === 'accepted'
                    ? 'checkCircle'
                    : status === 'rejected'
                      ? 'xCircle'
                      : 'hourglass'
                }
                size={12}
                color={
                  status === 'accepted'
                    ? theme.success
                    : status === 'rejected'
                      ? theme.danger
                      : theme.textSecondary
                }
              />
              <ThemedText themeColor="textSecondary" style={styles.statusText}>
                {status === 'accepted'
                  ? t('chat.inviteStatusAccepted')
                  : status === 'rejected'
                    ? t('chat.inviteStatusRejected')
                    : t('chat.inviteStatusPending')}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Modal thông tin nhóm + Tham gia / Từ chối */}
      <Modal
        visible={modalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <ThemedText style={styles.modalTitle}>
              {t('chat.groupInviteTitle')}
            </ThemedText>

            {invite.group_avatar ? (
              <Image
                source={{ uri: invite.group_avatar }}
                style={styles.modalAvatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.modalAvatar,
                  styles.avatarPlaceholder,
                  { backgroundColor: theme.primaryLight },
                ]}>
                <Icon name="people" size={36} color={theme.primary} />
              </View>
            )}

            <ThemedText style={styles.modalInviteText}>
              <ThemedText style={styles.modalRequester}>
                {invite.requester_name}
              </ThemedText>
              {` ${t('chat.groupInviteLabel')}`}
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              style={styles.modalGroupName}
              numberOfLines={2}>
              {invite.group_name}
            </ThemedText>

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleReject}
                disabled={loading}
                style={[
                  styles.modalBtn,
                  styles.modalBtnDecline,
                  { borderColor: theme.border },
                ]}>
                <ThemedText style={{ color: theme.text }}>
                  {t('chat.inviteDecline')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleAccept}
                disabled={loading}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: loading ? theme.bgSecondary : theme.primary,
                  },
                ]}>
                {loading ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <ThemedText style={styles.modalBtnAcceptText}>
                    {t('chat.groupInviteJoin')}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    // flexShrink thay vì flex:1 (flexBasis 0%) — card tự fit theo nội dung,
    // text chỉ wrap khi chạm maxWidth bubble.
    flexShrink: 1,
    gap: 2,
  },
  title: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
  },
  modalAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginTop: Spacing.sm,
  },
  modalInviteText: {
    ...Typography.body,
    fontSize: 14,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  modalRequester: {
    fontWeight: '700',
  },
  modalGroupName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    alignSelf: 'stretch',
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.sm,
  },
  modalBtnDecline: {
    borderWidth: 1,
  },
  modalBtnAcceptText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
