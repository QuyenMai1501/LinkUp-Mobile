import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
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
 * Bubble lịch sử cuộc gọi nhóm trong timeline tin nhắn — mirror Web
 * ChatWindow item.kind==='group_call': icon + nhãn (nhỡ/thoại/video) +
 * thời lượng + nút Yêu cầu tham gia khi call đang diễn ra.
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

  const icon: IconName = mine ? 'call' : call.is_video ? 'video' : 'call';
  const label = missed
    ? t('call.statusMissed')
    : call.is_video
      ? t('call.videoCallGroup')
      : t('call.voiceCallGroup');
  const sub = mine && !missed ? t('groupCall.callerYou') : callerName;

  // Cột avatar của caller: avatar ở đầu chuỗi, spacer (cùng bề rộng) cho bubble sau.
  const avatarColumn = !mine ? (
    showAvatar && avatarUri ? (
      <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
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
          { backgroundColor: theme.bgSecondary },
        ]}>
        <Icon name={icon} size={16} color={missed ? '#EF4444' : '#22C55E'} />
        <View style={styles.info}>
          <ThemedText style={styles.label} numberOfLines={1}>
            {label}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sub} numberOfLines={1}>
            {sub}
            {showDuration ? ` · ${formatDuration(duration)}` : ''}
          </ThemedText>
          {showJoin && onRequestJoin && (
            <Pressable
              onPress={() => onRequestJoin(call.call_id)}
              style={styles.joinBtn}>
              <Icon name="call" size={12} color="#FFF" />
              <ThemedText style={styles.joinText}>
                {t('groupCall.requestJoin')}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 16,
    gap: 6,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
  },
  avatarSpacer: {
    width: 28,
    height: 1,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '85%',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  info: {
    flexShrink: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  sub: {
    fontSize: 11,
    marginTop: 1,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  joinText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
