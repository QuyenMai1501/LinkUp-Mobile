import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface Props {
  /** Tap → thả / hủy / đổi ❤️ trực tiếp (logic local). */
  onPress: () => void;
  /** Long-press ~0.4s → rung nhẹ + mở pill chọn cảm xúc. */
  onLongPress: () => void;
}

/**
 * Nút thả cảm xúc nhanh ❤️ — neo ngoài góc phải-dưới của bubble ĐỐI PHƯƠNG.
 * Chống nhầm: sau long-press, RN có thể vẫn gọi onPress khi nhả → chặn bằng cờ.
 */
export function QuickHeart({ onPress, onLongPress }: Props) {
  const theme = useTheme();
  const longFiredRef = useRef(false);

  return (
    <Pressable
      hitSlop={6}
      accessibilityLabel="Thả cảm xúc nhanh"
      onPressIn={() => {
        longFiredRef.current = false;
      }}
      onPress={() => {
        if (longFiredRef.current) return;
        onPress();
      }}
      onLongPress={() => {
        longFiredRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onLongPress();
      }}
      delayLongPress={400}
      style={[
        styles.heart,
        { backgroundColor: theme.bgSecondary, borderColor: theme.border },
      ]}>
      <Text style={styles.char}>❤️</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heart: {
    // Neo ngoài góc phải-dưới của bubble (parent overflow visible).
    position: 'absolute',
    right: -30,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontSize: 13,
    lineHeight: 15,
  },
});
