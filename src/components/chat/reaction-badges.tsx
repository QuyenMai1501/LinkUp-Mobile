import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { MergedReaction } from '@/utils/reactions';

interface Props {
  /** Danh sách đã gộp + sort (count desc) — render null khi rỗng. */
  reactions: MergedReaction[];
  /** Tap vùng badge → mở modal chi tiết cảm xúc. */
  onPress: () => void;
  /** Đo width pill — bubble tính margin âm cho phần tràn mép trái. */
  onLayout?: (width: number) => void;
  /** Inject từ bubble: marginLeft = min(0, bubbleW - badgeW). */
  style?: StyleProp<ViewStyle>;
}

/** Số emoji hiển thị trực tiếp — phần còn lại gộp vào "+N". */
const MAX_VISIBLE = 3;

/**
 * Badge cảm xúc góc dưới-trái bong bóng tin nhắn, đè nhẹ (~6px) ra ngoài
 * mép dưới — GỘP 1 pill duy nhất: tối đa 3 emoji đầu + 1 số TỔNG.
 * Nền LUÔN trắng (phân biệt bubble trắng bằng viền + shadow), intrinsic
 * (alignSelf flex-start); khi nội dung dài hơn bubble → bubble set margin
 * âm để pill tràn ra ngoài mép trái. Tap → modal chi tiết.
 */
export function ReactionBadges({ reactions, onPress, onLayout, style }: Props) {
  if (reactions.length === 0) return null;

  const visible = reactions.slice(0, MAX_VISIBLE);
  const total = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <Pressable
      accessibilityLabel="Chi tiết cảm xúc"
      onPress={onPress}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.width)}
      style={[styles.pill, style]}>
      {visible.map((r) => (
        <Text key={r.key} style={styles.emoji}>
          {r.char}
        </Text>
      ))}
      <Text style={styles.total}>{total}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    // Nền trắng LUÔN — tách khỏi bubble trắng (card light) bằng viền + shadow.
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
    color: '#1F2937',
  },
});
