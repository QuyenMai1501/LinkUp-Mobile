import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MessageMedia } from '@/components/chat/message-media';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/types/chat';

interface Props {
  msgs: ChatMessage[];
  onOpen: (index: number) => void;
  onLongPress?: (msg: ChatMessage) => void;
}

/**
 * Gộp 2+ media liên tiếp cùng người gửi thành một chồng ảnh (mirror Web MediaStack):
 * 2 ảnh xếp chồng, 3+ hiện 3 ảnh trên cùng, badge đếm tổng số.
 */
export function MediaStack({ msgs, onOpen, onLongPress }: Props) {
  const theme = useTheme();
  const count = msgs.length;
  const visible = msgs.slice(0, 3);

  return (
    <View style={styles.wrap}>
      {visible.map((m, i) => (
        <View
          key={m.id}
          style={[
            styles.item,
            i > 0 && { marginTop: -28 },
            { transform: [{ rotate: i === 1 ? '1.5deg' : i === 2 ? '-1.5deg' : '0deg' }] },
          ]}>
          <Pressable onLongPress={() => onLongPress?.(m)} delayLongPress={400}>
            <MessageMedia message={m} onPress={() => onOpen(i)} />
          </Pressable>
          {i < visible.length - 1 && <View style={[styles.itemShade, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />}
        </View>
      ))}
      {count > 1 && (
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.badgeText}>{count}</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: '78%',
  },
  item: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  itemShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
  },
  badge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
