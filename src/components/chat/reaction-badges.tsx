import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { MergedReaction } from '@/utils/reactions';

interface Props {
  /** Danh sách đã gộp (server + override local) — render null khi rỗng. */
  reactions: MergedReaction[];
  /** Tap badge → thả mới / hủy / đổi cảm xúc (logic local). */
  onToggle: (key: string) => void;
}

/**
 * Badge cảm xúc gắn góc dưới-trái bong bóng tin nhắn, đè nhẹ (~6px) ra ngoài
 * mép dưới (marginTop âm) — badge của mình viền/nền nổi bật (active).
 */
export function ReactionBadges({ reactions, onToggle }: Props) {
  const theme = useTheme();
  if (reactions.length === 0) return null;

  return (
    <View style={styles.row}>
      {reactions.map((r) => (
        <Pressable
          key={r.key}
          accessibilityLabel={`Cảm xúc ${r.char}`}
          onPress={() => onToggle(r.key)}
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
        </Pressable>
      ))}
    </View>
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
