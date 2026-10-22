import { useCallback, useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/constants/icon-map';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
}

const DISMISS_THRESHOLD = 100;
// Đóng nhanh như comment-sheet/media-viewer: ~0,22s thay vì spring nặng.
const CLOSE_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
const OPEN_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) } as const;
// Tham chiếu kéo để backdrop mờ dần / sheet scale (px).
const DRAG_REFERENCE = 300;

/**
 * Bottom sheet menu hành động (chrome giống share-options-sheet):
 * bấm item → đóng sheet (animate) rồi chạy onPress của item.
 * Gesture drag-to-dismiss mirror comment-sheet; luôn mount, mở/closed theo prop visible.
 */
export function MenuSheet({ visible, title, items, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  // Khởi tạo ngoài màn hình (900) để mở vào slide-up thay vì nhảy ra.
  const translateY = useSharedValue(900);
  const backdropOpacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const dismissWorklet = useCallback(() => {
    'worklet';
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(900, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(0.96, CLOSE_TIMING);
  }, [handleDismiss, translateY, backdropOpacity, scale]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-25, 25])
        .onUpdate((e) => {
          // Chỉ cho kéo xuống — vuốt lên/không ăn.
          if (e.translationY > 0) {
            // eslint-disable-next-line react-hooks/immutability
            translateY.value = e.translationY;

            const progress = Math.min(e.translationY / DRAG_REFERENCE, 1);

            // eslint-disable-next-line react-hooks/immutability
            backdropOpacity.value = 1 - progress * 0.85;
            // eslint-disable-next-line react-hooks/immutability
            scale.value = 1 - progress * 0.02;
          }
        })
        .onEnd((e) => {
          if (e.translationY >= DISMISS_THRESHOLD || e.velocityY >= 500) {
            dismissWorklet();
            return;
          }

          // eslint-disable-next-line react-hooks/immutability
          translateY.value = withSpring(0, { damping: 20 });
          // eslint-disable-next-line react-hooks/immutability
          backdropOpacity.value = withSpring(1, { damping: 20 });
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withSpring(1, { damping: 20 });
        }),
    [translateY, backdropOpacity, scale, dismissWorklet],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleOpen = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(0, OPEN_TIMING);
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = 1;
    // eslint-disable-next-line react-hooks/immutability
    scale.value = 1;
  }, [translateY, backdropOpacity, scale]);

  const handleClose = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(900, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(0.96, CLOSE_TIMING);
  }, [handleDismiss, translateY, backdropOpacity, scale]);

  // Luôn mount → mở/closed theo prop visible; reset khi đóng (kể cả đóng
  // bên ngoài qua state flip) để lần mở sau vẫn slide-up từ dưới lên.
  useEffect(() => {
    if (visible) {
      handleOpen();
    } else {
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = 900;
      // eslint-disable-next-line react-hooks/immutability
      backdropOpacity.value = 1;
      // eslint-disable-next-line react-hooks/immutability
      scale.value = 1;
    }
  }, [visible, handleOpen, translateY, backdropOpacity, scale]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={handleClose}>
      {/* Bắt buộc có GestureHandlerRootView bên trong Modal (giống comment-sheet) */}
      <GestureHandlerRootView style={styles.flex}>
        {/* Backdrop — bấm để đóng; opacity animate theo mức vuốt */}
        <Pressable style={styles.backdropHit} onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        </Pressable>

        <View style={styles.sheetContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[styles.sheet, { backgroundColor: theme.card }, animatedStyle]}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
              {title ? (
                <ThemedText themeColor="textSecondary" style={styles.title}>
                  {title}
                </ThemedText>
              ) : null}

              {items.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: theme.bgHover },
                  ]}
                  onPress={() => {
                    handleClose();
                    item.onPress();
                  }}>
                  <Icon
                    name={item.icon}
                    size={22}
                    color={item.danger ? theme.danger : theme.text}
                  />
                  <ThemedText
                    style={[styles.rowText, { color: item.danger ? theme.danger : theme.text }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              ))}

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  styles.cancelRow,
                  pressed && { backgroundColor: theme.bgHover },
                ]}
                onPress={handleClose}>
                <ThemedText
                  style={[styles.rowText, styles.cancelText, { color: theme.textSecondary }]}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdropHit: {
    ...StyleSheet.absoluteFill,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowText: {
    ...Typography.body,
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cancelRow: {
    justifyContent: 'center',
  },
  cancelText: {
    fontWeight: '600',
  },
});
