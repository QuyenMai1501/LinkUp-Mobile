import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';
import type { EmojiItem } from '@/types/post';
import {
  REACTION_EMOJIS,
  summarizeByUser,
  summarizeReactions,
  type LocalReactionCounts,
} from '@/utils/reactions';

/** Tên + avatar đã resolve theo user_id (screen build từ data sẵn). */
export interface ReactionUserProfile {
  name: string;
  avatar: string | null;
}

interface Props {
  visible: boolean;
  /** Tin đang xem chi tiết — null → không render nội dung. */
  message: ChatMessage | null;
  /** Local counts của tin này (choices[msgId]) — undefined = chưa can thiệp. */
  localCounts: LocalReactionCounts | undefined;
  myUserId: string;
  /** Map emoji server (byId) để map emoji_id → char/code. */
  emojis: Map<string, EmojiItem> | null | undefined;
  /** user_id → { name, avatar } (group: memberNames/Avatars; 1-1: partner). */
  userProfiles: Record<string, ReactionUserProfile>;
  /** Gỡ reaction CỦA MÌNH trong tab "Tất cả" (local-only). */
  onRemoveMine?: (codes: string[]) => void;
  onClose: () => void;
}

const TAB_ALL = 'all';

const DISMISS_THRESHOLD = 100;
const CLOSE_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
const OPEN_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) } as const;
// Tham chiếu kéo để backdrop mờ dần / sheet scale (px).
const DRAG_REFERENCE = 300;

/**
 * Modal chi tiết cảm xúc (bottom-sheet) theo TAB: "Tất cả" + 6 emoji.
 * - Tất cả: liệt kê theo USER — avatar, tên, các loại reaction đã thả;
 *   dòng của mình có nút Gỡ (local-only).
 * - Tab emoji: danh sách người thả emoji đó.
 * Gesture drag-to-dismiss mirror report-sheet: kéo sheet xuống quá
 * DRAG_REFERENCE (hoặc velocity) → đóng; chỉ pan khi list đang ở đầu.
 */
export function ReactionDetailModal({
  visible,
  message,
  localCounts,
  myUserId,
  emojis,
  userProfiles,
  onRemoveMine,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string>(TAB_ALL);
  // Ảnh URL hỏng (404/timeout) → fallback chữ cái đầu thay vì ô trống.
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  // Khởi tạo ngoài màn hình (900) để mở vào slide-up thay vì nhảy ra.
  const translateY = useSharedValue(900);
  const backdropOpacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const scrollY = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    setTab(TAB_ALL);
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

  const animateClose = useCallback(() => {
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

  const handleClose = useCallback(() => {
    animateClose();
  }, [animateClose]);

  // Gesture cuộn native của ScrollView — pan của sheet chạy song song với nó
  // (mirror report-sheet) để vuốt xuống không bị gesture cuộn nuốt.
  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-25, 25])
        .simultaneousWithExternalGesture(nativeScrollGesture)
        .onUpdate((e) => {
          // Chỉ cho kéo sheet khi đang ở đầu list (scrollY ≈ 0)
          if (e.translationY > 0 && scrollY.value <= 2) {
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
          const atTop = scrollY.value <= 2;

          if (
            e.translationY > 0 &&
            atTop &&
            (e.translationY >= DISMISS_THRESHOLD || e.velocityY >= 500)
          ) {
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
    [nativeScrollGesture, translateY, backdropOpacity, scale, dismissWorklet, scrollY],
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

  // Mỗi lần mở (visible true) → slide-up từ dưới (kết thúc animateClose đã về 900).
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(0, OPEN_TIMING);
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = 1;
    // eslint-disable-next-line react-hooks/immutability
    scale.value = 1;
  }, [visible, translateY, backdropOpacity, scale]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const byUser = useMemo(() => {
    if (!message) return [];
    return summarizeByUser(message, myUserId, localCounts, emojis);
  }, [message, myUserId, localCounts, emojis]);

  const summary = useMemo(() => {
    if (!message) return [];
    return summarizeReactions(message, myUserId, localCounts, emojis);
  }, [message, myUserId, localCounts, emojis]);

  const tabGroup = tab === TAB_ALL ? null : summary.find((g) => g.key === tab);

  const renderAvatar = (uid: string) => {
    const profile = userProfiles[uid];
    const name = profile?.name || t('chat.unknown');
    const avatar = profile?.avatar ?? null;
    const initial = (name || '?')[0]?.toUpperCase() ?? '?';
    if (avatar && !avatarErrors[uid]) {
      return (
        <Image
          source={{ uri: avatar }}
          style={[styles.avatar, { backgroundColor: theme.bgSecondary }]}
          contentFit="cover"
          onError={() =>
            setAvatarErrors((prev) => ({ ...prev, [uid]: true }))
          }
        />
      );
    }
    return (
      <View
        style={[
          styles.avatar,
          styles.avatarFallback,
          { backgroundColor: theme.primaryLight },
        ]}>
        <Text style={[styles.avatarInitial, { color: theme.primary }]}>
          {initial}
        </Text>
      </View>
    );
  };

  const renderName = (uid: string) => {
    const profile = userProfiles[uid];
    return (
      <ThemedText style={styles.userName} numberOfLines={1}>
        {profile?.name || t('chat.unknown')}
      </ThemedText>
    );
  };

  return (
    <Modal
      visible={visible && !!message}
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}>
      {/* Bắt buộc có GestureHandlerRootView bên trong Modal (mirror report-sheet) */}
      <GestureHandlerRootView style={styles.flex}>
        {/* Backdrop — bấm để đóng; opacity animate theo mức vuốt */}
        <Pressable style={styles.backdropHit} onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        </Pressable>

        <View style={styles.sheetContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.background,
                  paddingBottom: insets.bottom,
                },
                animatedStyle,
              ]}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
              <View style={styles.headerRow}>
                <ThemedText style={styles.title}>
                  {t('chat.reactionsTitle')}
                </ThemedText>
                <Pressable hitSlop={8} onPress={handleClose}>
                  <Icon name="close" size={24} />
                </Pressable>
              </View>

              {/* Hàng tab: Tất cả + 6 emoji */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabs}
                contentContainerStyle={styles.tabsContent}>
                <Pressable
                  onPress={() => setTab(TAB_ALL)}
                  style={[
                    styles.tab,
                    tab === TAB_ALL && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                  ]}>
                  <ThemedText
                    style={[
                      styles.tabLabel,
                      tab === TAB_ALL && { color: theme.primary },
                    ]}>
                    {t('chat.reactionsAll')}
                  </ThemedText>
                </Pressable>
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji.code}
                    onPress={() => setTab(emoji.code)}
                    style={[
                      styles.tab,
                      tab === emoji.code && {
                        backgroundColor: theme.primaryLight,
                        borderColor: theme.primary,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.tabEmoji,
                        tab === emoji.code && { backgroundColor: theme.primary },
                      ]}>
                      {emoji.char}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* ScrollView cuộn qua Gesture.Native riêng, pan dismiss chạy song song */}
              <GestureDetector gesture={nativeScrollGesture}>
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}>
                  {tab === TAB_ALL ? (
                    byUser.length === 0 ? (
                      <ThemedText
                        themeColor="textSecondary"
                        style={styles.empty}>
                        {t('chat.reactionsEmpty')}
                      </ThemedText>
                    ) : (
                      byUser.map((row) => {
                        const isMine = row.user_id === myUserId;
                        return (
                          <View key={row.user_id} style={styles.userRow}>
                            {renderAvatar(row.user_id)}
                            <View style={styles.userMid}>
                              {renderName(row.user_id)}
                              <View style={styles.itemsRow}>
                                {row.items.map((it) => (
                                  <View key={it.key} style={styles.item}>
                                    <Text style={styles.itemEmoji}>{it.char}</Text>
                                    {it.count > 1 && (
                                      <ThemedText
                                        themeColor="textSecondary"
                                        style={styles.itemCount}>
                                        {it.count}
                                      </ThemedText>
                                    )}
                                  </View>
                                ))}
                              </View>
                            </View>
                            {isMine && onRemoveMine && (
                              <Pressable
                                accessibilityLabel={t('chat.removeReaction')}
                                onPress={() =>
                                  onRemoveMine(row.items.map((i) => i.key))
                                }
                                style={[
                                  styles.removeBtn,
                                  { borderColor: theme.primary },
                                ]}>
                                <ThemedText
                                  style={[
                                    styles.removeBtnText,
                                    { color: theme.primary },
                                  ]}>
                                  {t('chat.remove')}
                                </ThemedText>
                              </Pressable>
                            )}
                          </View>
                        );
                      })
                    )
                  ) : !tabGroup || tabGroup.user_ids.length === 0 ? (
                    <ThemedText themeColor="textSecondary" style={styles.empty}>
                      {t('chat.reactionsEmpty')}
                    </ThemedText>
                  ) : (
                    tabGroup.user_ids.map((uid) => (
                      <View key={uid} style={styles.userRow}>
                        {renderAvatar(uid)}
                        {renderName(uid)}
                      </View>
                    ))
                  )}
                </ScrollView>
              </GestureDetector>
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.xs,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  title: {
    ...Typography.h2,
    fontSize: 18,
  },
  tabs: {
    flexGrow: 0,
    marginBottom: Spacing.xs,
  },
  tabsContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  tabEmoji: {
    fontSize: 16,
    lineHeight: 18,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: 2,
  },
  empty: {
    ...Typography.body,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 7,
  },
  userMid: {
    flex: 1,
    gap: 2,
  },
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  itemEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  itemCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  removeBtn: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...Typography.caption,
    fontWeight: '700',
  },
  userName: {
    flex: 1,
    ...Typography.body,
  },
});
