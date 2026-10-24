import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useMessageMedia } from '@/hooks/useMessageMedia';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatTime } from '@/utils/chat';
import type { ChatMessage } from '@/types/chat';

interface Props {
  /** Ảnh trong cụm (≥2, cùng media_group_id). */
  msgs: ChatMessage[];
  isMine: boolean;
  myUserId: string;
  /** busyBg (Web): ảnh nền preset/custom → ô theirs viền + shadow. */
  busyBg?: boolean;
  showTime?: boolean;
  onOpen: (index: number) => void;
  onLongPress?: (msg: ChatMessage) => void;
}

/**
 * Cụm ảnh gửi cùng lúc — lưới thích ứng (Messenger/iOS): 2 ảnh = 2 cột đầy,
 * 3–4 ảnh = 2×2, 5+ = 3 cột; ô vuông cover crop. Hàng nhỏ dưới lưới: giờ +
 * trạng thái (✓/✓✓/spinner) của tin CUỐI cụm.
 */
export function MediaCluster({
  msgs,
  isMine,
  myUserId,
  busyBg = false,
  showTime = false,
  onOpen,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const last = msgs[msgs.length - 1];
  const seen = isMine && (last.seen_by ?? []).some((uid) => uid !== myUserId);
  // ≤4 ảnh → 2 cột ô to (hết hụt cột ở cụm 2 ảnh); ≥5 → 3 cột.
  const wide = msgs.length <= 4;

  return (
    <View
      style={[
        styles.wrap,
        { alignSelf: isMine ? 'flex-end' : 'flex-start' },
      ]}>
      <View style={styles.grid}>
        {msgs.map((m, i) => (
          <MediaCell
            key={m.id}
            message={m}
            wide={wide}
            busyBg={busyBg && !isMine}
            onPress={() => onOpen(i)}
            onLongPress={() => onLongPress?.(m)}
          />
        ))}
      </View>
      {showTime || isMine ? (
        <View style={styles.timeRow}>
          {showTime && (
            <ThemedText
              style={[styles.time, { color: theme.textSecondary }]}>
              {formatChatTime(last.created_at, t)}
            </ThemedText>
          )}
          {isMine && last.failed ? (
            <ThemedText style={[styles.time, { color: '#F87171' }]}>
              {t('chat.sendFailed')}
            </ThemedText>
          ) : isMine && last.uploading ? (
            <ActivityIndicator size={10} color={theme.textSecondary} />
          ) : isMine && !last.sending ? (
            <ThemedText
              style={[
                styles.time,
                { color: seen ? '#A5F3FC' : theme.textSecondary },
              ]}>
              {seen ? '✓✓' : '✓'}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** 1 ô lưới: ảnh vuông cover crop; loading/failed = ô xám + trạng thái. */
function MediaCell({
  message,
  wide,
  busyBg,
  onPress,
  onLongPress,
}: {
  message: ChatMessage;
  /** true = cột 48.5% (lưới 2 cột), false = cột 31% (lưới 3 cột). */
  wide: boolean;
  busyBg: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const { src, failed, loading } = useMessageMedia(message);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[
        styles.cell,
        wide ? styles.cellWide : styles.cellNarrow,
        { backgroundColor: theme.bgSecondary },
        busyBg && {
          borderWidth: 1,
          borderColor: theme.textSecondary,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        },
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : failed || !src ? (
        <Icon name="warning" size={18} color={theme.textSecondary} />
      ) : (
        <Image
          source={{ uri: src }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: '78%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 2 cột (2–4 ảnh): ô ~48.5% — to, hết hụt cột ở cụm 2 ảnh.
  cellWide: {
    width: '48.5%',
  },
  // 3 cột (5+ ảnh): ô ~31%.
  cellNarrow: {
    width: '31%',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  time: {
    fontSize: 10,
  },
});
