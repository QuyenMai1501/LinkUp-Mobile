import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
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
 * 3–4 ảnh = 2×2, 5+ = 3 cột; ô vuông cover crop. Giờ + trạng thái (✓/✓✓/
 * spinner) của tin CUỐI cụm: hàng dưới lưới, hug mép phải, dính đáy.
 *
 * Ô lưới dùng px CỐ ĐỊNH tính từ bề rộng màn hình (không dùng % width trong
 * flex-wrap parent auto) — Yoga resolve % qua nhiều pass, grid height dao động
 * (time nhảy lên đỉnh lúc đầu, gap dư sau settle). Ảnh đơn không dính vì dùng
 * 240px cố định (message-media).
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
  const { width: winW } = useWindowDimensions();
  const last = msgs[msgs.length - 1];
  const seen = isMine && (last.seen_by ?? []).some((uid) => uid !== myUserId);
  // ≤4 ảnh → 2 cột ô to (hết hụt cột ở cụm 2 ảnh); ≥5 → 3 cột.
  const cols = msgs.length <= 4 ? 2 : 3;
  // clusterRow padding Spacing.md mỗi bên; wrap maxWidth 78%.
  const wrapWidth = (winW - 2 * Spacing.md) * 0.78;
  const cellSize = (wrapWidth - 3 * (cols - 1)) / cols;

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
            size={cellSize}
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
            <ThemedText
              style={[styles.time, { color: '#F87171' }]}>
              {t('chat.sendFailed')}
            </ThemedText>
          ) : isMine && last.uploading ? (
            // Bọc khung cố định — Android ignore numeric size → spinner
            // default ~20dp sẽ phình chiều cao timeRow.
            <View style={styles.spinnerBox}>
              <ActivityIndicator size={10} color={theme.textSecondary} />
            </View>
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
  size,
  busyBg,
  onPress,
  onLongPress,
}: {
  message: ChatMessage;
  /** Cạnh ô vuông (px cố định — không dùng % + aspectRatio trong wrap). */
  size: number;
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
        { width: size, height: size },
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
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Hug mép phải-dưới lưới — dính đáy 0px, y hệt bubble 1 ảnh.
    justifyContent: 'flex-end',
    gap: 4,
  },
  spinnerBox: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: 10,
    // lineHeight khớp cỡ chữ — ThemedText default kế thừa lineHeight 24.
    lineHeight: 12,
  },
});
