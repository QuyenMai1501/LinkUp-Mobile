import { Pressable, StyleSheet, Text } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { MergedReaction } from '@/utils/reactions';

interface Props {
  /** Danh sách đã gộp + sort (count desc) — render null khi rỗng. */
  reactions: MergedReaction[];
  /** Tap vùng badge → mở modal chi tiết cảm xúc. */
  onPress: () => void;
}

/** Số emoji hiển thị trực tiếp — phần còn lại gộp vào "+N". */
const MAX_VISIBLE = 3;

/**
 * Badge cảm xúc góc dưới-trái bong bóng tin nhắn, đè nhẹ (~6px) ra ngoài
 * mép dưới — GỘP 1 pill duy nhất: tối đa 3 emoji đầu (đã sort) + 1 số
 * TỔNG (số lượng chi tiết chỉ có trong modal). Pill nổi bật nếu có
 * reaction của mình. Tap → modal chi tiết.
 */
export function ReactionBadges({ reactions, onPress }: Props) {
  const theme = useTheme();
  if (reactions.length === 0) return null;

  const visible = reactions.slice(0, MAX_VISIBLE);
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  const hasMine = reactions.some((r) => r.mine);

  return (
    <Pressable
      accessibilityLabel="Chi tiết cảm xúc"
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: hasMine ? theme.primaryLight : theme.bgSecondary,
          borderColor: hasMine ? theme.primary : theme.border,
        },
      ]}>
      {visible.map((r) => (
        <Text key={r.key} style={styles.emoji}>
          {r.char}
        </Text>
      ))}
      <ThemedText style={[styles.total, { color: theme.text }]}>
        {total}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    // Đè nhẹ ra mép dưới bubble (vẫn nằm trong padding đáy ~10px, không đè giờ).
    marginTop: -6,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 12,
    lineHeight: 14,
  },
  total: {
    fontSize: 10,
    fontWeight: '600',
  },
});
