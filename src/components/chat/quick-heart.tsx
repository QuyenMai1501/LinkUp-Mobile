import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { REACTION_EMOJIS } from '@/utils/reactions';

interface Props {
  /** Char emoji của REACTION ĐẦU TIÊN tin nhận được — null = chưa có. */
  reactionChar?: string | null;
  /** Tap → thả code của emoji đang hiển thị (fallback ':heart:'). */
  onPress: (code: string) => void;
  /** Long-press ~0.4s → rung nhẹ + mở pill chọn cảm xúc. */
  onLongPress: () => void;
}

/**
 * Nút thả cảm xúc nhanh — neo ngoài góc phải-dưới của bubble ĐỐI PHƯƠNG.
 * Ban đầu = icon ❤️ KHÔNG FILL (heart-outline); tin nhận reaction đầu tiên
 * → hiển thị emoji reaction đó, tap = thả chính emoji đang hiện.
 * Chống nhầm: sau long-press, RN có thể vẫn gọi onPress khi nhả → chặn bằng cờ.
 */
export function QuickHeart({ reactionChar, onPress, onLongPress }: Props) {
  const theme = useTheme();
  const longFiredRef = useRef(false);

  const handlePress = () => {
    if (longFiredRef.current) return;
    const code = reactionChar
      ? REACTION_EMOJIS.find((e) => e.char === reactionChar)?.code ?? ':heart:'
      : ':heart:';
    onPress(code);
  };

  return (
    <Pressable
      hitSlop={6}
      accessibilityLabel="Thả cảm xúc nhanh"
      onPressIn={() => {
        longFiredRef.current = false;
      }}
      onPress={handlePress}
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
      {reactionChar ? (
        <Text style={styles.char}>{reactionChar}</Text>
      ) : (
        <Icon name="heart" size={15} color={theme.textSecondary} />
      )}
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
