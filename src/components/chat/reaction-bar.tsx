import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { REACTION_EMOJIS, type ReactionAnchor } from '@/utils/reactions';

export interface ReactionBarTarget {
  messageId: string;
  anchor: ReactionAnchor;
}

interface Props {
  /** null = đóng. Anchor = bubble rect đo được (measureInWindow). */
  target: ReactionBarTarget | null;
  /** Code các emoji mình đang thả — highlight nút active (multi-select). */
  activeCodes: string[];
  /** Chọn emoji → toggle local + screen tự đóng pill. */
  onSelect: (code: string) => void;
  onClose: () => void;
}

// Ước lượng pill (6 × nút 42 + padding) để đặt vị trí lần đầu không nháy —
// onLayout sẽ tinh chỉnh nếu lệch > 1px.
const PILL_EST_W = 6 * 42 + 16;
const PILL_EST_H = 56;

/**
 * Thanh cảm xúc nổi (pill) — Overlay/Modal layer luôn trên cùng, neo ngay
 * PHÍA TRÊN bubble được chọn (không đủ chỗ phía trên → nhảy xuống dưới).
 * Xuất hiện: scale-up (ZoomIn) + Modal fade. Tap backdrop / chọn / Android
 * back → đóng.
 */
export function ReactionBar({
  target,
  activeCodes,
  onSelect,
  onClose,
}: Props) {
  const theme = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Số đo thật của pill — kèm id tin để tự "quên" khi đổi mục tiêu
  // (derive trong render, không cần effect reset).
  const [measured, setMeasured] = useState<{
    id: string;
    w: number;
    h: number;
  } | null>(null);

  if (!target) return null;
  const { anchor } = target;
  const real = measured && measured.id === target.messageId ? measured : null;
  const w = real?.w ?? PILL_EST_W;
  const h = real?.h ?? PILL_EST_H;

  // Căn giữa pill theo tâm bubble, clamp trong màn hình.
  let left = anchor.x + anchor.w / 2 - w / 2;
  left = Math.min(Math.max(left, 12), Math.max(winW - w - 12, 12));
  // Ưu tiên phía trên bubble; thiếu chỗ → xuống dưới; vẫn trượt mép → clamp.
  let top = anchor.y - h - 10;
  if (top < insets.top + 8) top = anchor.y + anchor.h + 10;
  top = Math.min(Math.max(top, insets.top + 8), Math.max(winH - h - insets.bottom - 12, insets.top + 8));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop trong suốt — tap vùng trống màn hình để đóng. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          key={target.messageId}
          onPress={(e) => e.stopPropagation()}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setMeasured((prev) =>
              prev &&
              prev.id === target.messageId &&
              Math.abs(prev.w - width) < 1 &&
              Math.abs(prev.h - height) < 1
                ? prev
                : { id: target.messageId, w: width, h: height },
            );
          }}
          style={[
            styles.pill,
            {
              left,
              top,
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}>
          <Animated.View
            entering={ZoomIn.springify().damping(14).mass(0.6)}
            style={styles.row}>
            {REACTION_EMOJIS.map((emoji) => {
              const active = activeCodes.includes(emoji.code);
              return (
                <Pressable
                  key={emoji.code}
                  accessibilityLabel={`Thả cảm xúc ${emoji.char}`}
                  onPress={() => onSelect(emoji.code)}
                  style={[
                    styles.emojiBtn,
                    active && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                  ]}>
                  <Text style={styles.emojiChar}>{emoji.char}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    // Đổ bóng rõ để tách khỏi nền chat.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiChar: {
    fontSize: 24,
    lineHeight: 26,
  },
});
