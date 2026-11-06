import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { MergedReaction } from '@/utils/reactions';

interface Props {
  /** Danh sách đã gộp + sort (count desc) — render null khi rỗng. */
  reactions: MergedReaction[];
  /** Tap vùng badge → mở modal chi tiết cảm xúc. */
  onPress: () => void;
}

/** Số emoji hiển thị trực tiếp — phần còn lại gộp vào badge "+N". */
const MAX_VISIBLE = 3;

/**
 * Badge cảm xúc góc dưới-trái bong bóng tin nhắn, đè nhẹ (~6px) ra ngoài
 * mép dưới — hiện tối đa 3 emoji đầu (đã sort) + "+N" (tổng count phần
 * còn lại). Tap → modal chi tiết. Badge của mình viền/nền nổi bật.
 */
export function ReactionBadges({ reactions, onPress }: Props) {
  const theme = useTheme();
  if (reactions.length === 0) return null;

  const visible = reactions.slice(0, MAX_VISIBLE);
  const rest = reactions.slice(MAX_VISIBLE);
  const restCount = rest.reduce((sum, r) => sum + r.count, 0);

  return (
    <Pressable
      accessibilityLabel="Chi tiết cảm xúc"
      onPress={onPress}
      style={styles.row}>
      {visible.map((r) => (
        <View
          key={r.key}
          style={[
            styles.badge,
            {
              backgroundColor: r.mine
                ? theme.primaryLight
                : theme.bgSecondary,
              borderColor: r.mine ? theme.primary : theme.border,
            },
          ]}>
          <Text style={styles.badgeEmoji}>{r.char}</Text>
          {r.count > 1 && (
            <ThemedText style={[styles.badgeCount, { color: theme.text }]}>
              {r.count}
            </ThemedText>
          )}
        </View>
      ))}
      {restCount > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}>
          <ThemedText style={[styles.badgeCount, { color: theme.text }]}>
            +{restCount}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    // Đè nhẹ ra mép dưới bubble (vẫn nằm trong padding đáy ~10px, không đè giờ).
    marginTop: -6,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeEmoji: {
    fontSize: 12,
    lineHeight: 14,
  },
  badgeCount: {
    fontSize: 10,
    fontWeight: '600',
  },
});
