import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { IconName } from '@/constants/icon-map';
import type { GroupCallHistoryItem } from '@/types/group-call';

interface Props {
  call: GroupCallHistoryItem;
  myUserId: string;
  callerName: string;
  /** Avatar của caller — hiện khi theirs + đầu chuỗi (mirror ChatBubble). */
  avatarUri?: string | null;
  /** true = đầu chuỗi → hiện avatar; false = spacer giữ căn lề. */
  showAvatar?: boolean;
  /** call_id của cuộc gọi đang diễn ra (để hiện nút Yêu cầu tham gia). */
  activeCallId: string | null;
  onRequestJoin?: (callId: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Bubble lịch sử cuộc gọi nhóm trong timeline tin nhắn — style khớp
 * CallHistoryRow (1-1): card + hairline border, icon theo accent theme,
 * pill Yêu cầu tham gia ngang bên phải khi call đang diễn ra.
 */
export function GroupCallHistoryBubble({
  call,
  myUserId,
  callerName,
  avatarUri,
  showAvatar = false,
  activeCallId,
  onRequestJoin,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const mine = call.caller_id === myUserId;
  const missed = call.status === 'missed';
  const isVideo = call.is_video;
  const duration =
    call.ended_at && call.created_at
      ? Math.floor(
          (new Date(call.ended_at).getTime() -
            new Date(call.created_at).getTime()) /
            1000,
        )
      : 0;
  const isThisActive = activeCallId === call.call_id;
  const showDuration = !missed && !isThisActive && duration > 0;
  const showJoin =
    isThisActive && !mine && !call.participants.includes(myUserId);
  // Meta "Anh · 02:35 · 14:30" — caller + duration (nếu có) · giờ gọi.
  const started = new Date(call.created_at);
  const timeText = `${String(started.getHours()).padStart(2, '0')}:${String(
    started.getMinutes(),
  ).padStart(2, '0')}`;
  const sub = mine && !missed ? t('groupCall.callerYou') : callerName;
  const meta = `${sub}${showDuration ? ` · ${formatDuration(duration)}` : ''} · ${timeText}`;

  const icon: IconName = isVideo ? 'video' : 'call';
  const iconColor = missed
    ? theme.danger
    : isVideo
      ? theme.primary
      : theme.textSecondary;
  const label = missed
    ? t('call.statusMissed')
    : isVideo
      ? t('call.videoCallGroup')
      : t('call.voiceCallGroup');
  const letter = (callerName || '?')[0]?.toUpperCase();

  // Cột avatar của caller: avatar ở đầu chuỗi, spacer (cùng bề rộng) cho bubble sau.
  const avatarColumn = !mine ? (
    showAvatar ? (
      avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View
          style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
          <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
            {letter}
          </ThemedText>
        </View>
      )
    ) : (
      <View style={styles.avatarSpacer} />
    )
  ) : null;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {avatarColumn}
      <View
        style={[
          styles.bubble,
          { backgroundColor: theme.card, borderColor: missed ? theme.danger : theme.border },
        ]}>
        <Icon name={icon} size={16} color={iconColor} />
        <View style={styles.content}>
          <ThemedText
            style={[styles.label, { color: missed ? theme.danger : theme.text }]}
            numberOfLines={1}>
            {label}
          </ThemedText>
          <ThemedText style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
            {meta}
          </ThemedText>
        </View>

        {showJoin && onRequestJoin && (
          <Pressable
            onPress={() => onRequestJoin(call.call_id)}
            hitSlop={8}
            style={[styles.joinBtn, { backgroundColor: theme.primaryLight }]}>
            <Icon name="call" size={14} color={theme.primary} />
            <ThemedText style={[styles.joinText, { color: theme.primary }]}>
              {t('groupCall.requestJoin')}
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
  avatarSpacer: {
    width: 26,
    height: 1,
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
    flexShrink: 1,
    gap: 1,
  },
  label: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  joinText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
