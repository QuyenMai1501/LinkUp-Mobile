import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';

const SYSTEM_TYPES = [
  'member_invited',
  'member_joined',
  'member_left',
  'admin_transferred',
  'group_settings_updated',
];

/** Nhận diện tin nhắn hệ thống (mirror điều kiện của Web ChatWindow). */
export function isSystemMessage(msg: ChatMessage): boolean {
  return (
    msg.message_category === 'system' ||
    msg.sender_id === 'SYSTEM' ||
    SYSTEM_TYPES.includes(msg.type ?? '')
  );
}

interface Props {
  message: ChatMessage;
  myUserId: string;
  partnerUserId?: string | null;
  partnerName?: string | null;
}

export function SystemMessage({ message, myUserId, partnerUserId, partnerName }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const text = getSystemMessageText(message, { myUserId, partnerUserId, partnerName, t });

  return (
    <View style={styles.row}>
      <ThemedText style={[styles.text, { color: theme.textSecondary }]} numberOfLines={2}>
        {text}
      </ThemedText>
    </View>
  );
}

function getSystemMessageText(
  msg: ChatMessage,
  ctx: {
    myUserId: string;
    partnerUserId?: string | null;
    partnerName?: string | null;
    t: (key: string, params?: Record<string, string | number>) => string;
  },
): string {
  const { t } = ctx;
  if (!msg.content.includes('|')) return msg.content;

  const parts = msg.content.split('|');
  const translationKey = parts[0];
  const actorId = parts[1] || '';
  const extraParam = parts[2] || '';

  // 1-1 không có memberNames map → resolve theo ngữ cảnh hội thoại.
  const actorName = !actorId
    ? ''
    : actorId === ctx.myUserId
      ? t('chat.you')
      : actorId === ctx.partnerUserId
        ? ctx.partnerName || actorId
        : actorId;

  switch (translationKey) {
    case 'member_left':
      return t('chat.systemMemberLeft', { name: actorName });
    case 'member_joined':
      return t('chat.systemMemberJoined', { name: actorName });
    case 'member_invited':
      return t('chat.systemMemberInvited', { name: actorName });
    case 'admin_transferred':
      return t('chat.systemAdminTransferred', { name: actorName });
    case 'group_settings_updated':
    case 'group_name_changed':
      return t('chat.systemGroupNameChanged', { name: actorName, groupName: extraParam });
    case 'group_avatar_changed':
      return t('chat.systemGroupAvatarChanged', { name: actorName });
    case 'call_started':
      return t('chat.callStarted');
    case 'call_ended':
      return t('chat.callEnded', { name: actorName });
    case 'call_timeout':
      return t('chat.callTimeout');
    default:
      return msg.content;
  }
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 48,
  },
  text: {
    ...Typography.caption,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
