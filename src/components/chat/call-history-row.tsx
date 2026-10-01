import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatCallDuration } from '@/utils/chat';
import type { CallHistoryItem } from '@/types/call';

interface Props {
  item: CallHistoryItem;
  partnerAvatar?: string | null;
  partnerName?: string | null;
  isInCall: boolean;
  onCallback: (item: CallHistoryItem) => void;
}

/** Row lịch sử cuộc gọi 1-1 trong timeline chat (mirror Web ChatWindow). */
export function CallHistoryRow({ item, partnerAvatar, partnerName, isInCall, onCallback }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const mine = item.direction === 'outgoing';
  const missed = item.is_missed;
  const isVideo = item.call_type === 'video';
  const label = missed
    ? t('call.statusMissed')
    : isVideo
      ? t('call.videoCall')
      : t('call.voiceCall');
  const showDuration = item.duration > 0;
  const accent = missed ? theme.danger : mine ? theme.primary : theme.textSecondary;
  const avatarUri = item.other_user.avatar_url || partnerAvatar || null;
  const letter = (item.other_user.display_name || partnerName || '?')[0]?.toUpperCase();

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine &&
        (avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>{letter}</ThemedText>
          </View>
        ))}

      <View style={[styles.bubble, { backgroundColor: theme.card, borderColor: missed ? theme.danger : theme.border }]}>
        <Icon name={isVideo ? 'video' : 'call'} size={16} color={accent} />
        <View style={styles.content}>
          <ThemedText style={[styles.label, { color: missed ? theme.danger : theme.text }]} numberOfLines={1}>
            {label}
          </ThemedText>
          {showDuration && (
            <ThemedText style={[styles.duration, { color: theme.textSecondary }]}>
              {formatCallDuration(item.duration)}
            </ThemedText>
          )}
        </View>

        {!mine && !isInCall && (
          <Pressable
            onPress={() => onCallback(item)}
            hitSlop={8}
            style={[styles.callbackBtn, { backgroundColor: theme.primaryLight }]}>
            <Icon name="call" size={14} color={theme.primary} />
            <ThemedText style={[styles.callbackText, { color: theme.primary }]}>
              {t('call.callback')}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 3,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '80%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    gap: 1,
  },
  label: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  duration: {
    fontSize: 11,
  },
  callbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  callbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
