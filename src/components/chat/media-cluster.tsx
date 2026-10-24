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
 * 3–4 ảnh = 2×2, 5+ = 3 cột; ô vuông cover crop. Giờ + trạng thái (✓/✓✓/
 * spinner) của tin CUỐI cụm hiện dạng pill overlay absolute góc phải-dưới
 * trên ô ảnh cuối (Messenger-style) — dính media, không hở dưới lưới.
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
      {/* Pill overlay góc phải-dưới TRÊN ô ảnh cuối (Messenger-style) — dính
          media 100%, không phụ thuộc hàng dưới; pointerEvents none để tap/long-press
          vẫn qua ô ảnh. */}
      {showTime || isMine ? (
        <View style={styles.timeOverlay} pointerEvents="none">
          {showTime && (
            <ThemedText style={styles.timeOverlayText}>
              {formatChatTime(last.created_at, t)}
            </ThemedText>
          )}
          {isMine && last.failed ? (
            <ThemedText style={[styles.timeOverlayText, { color: '#F87171' }]}>
              {t('chat.sendFailed')}
            </ThemedText>
          ) : isMine && last.uploading ? (
            <View style={styles.spinnerBox}>
              <ActivityIndicator size={10} color="#FFF" />
            </View>
          ) : isMine && !last.sending ? (
            <ThemedText
              style={[
                styles.timeOverlayText,
                { color: seen ? '#A5F3FC' : '#FFF' },
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
  // Pill overlay absolute trong wrap — anchor góc phải-dưới trên ô ảnh cuối.
  timeOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeOverlayText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#FFF',
  },
  spinnerBox: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
