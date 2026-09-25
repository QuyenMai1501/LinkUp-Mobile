import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Image } from "expo-image";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";

import type { FeedMedia, FeedPost } from "../types/post";
import VideoPlayer from "./video-player";

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 850;

interface MediaViewerProps {
  visible: boolean;
  media: FeedMedia[];
  post: FeedPost;
  initialIndex?: number;
  onClose: () => void;
  onLike: () => void;
  onSave: () => void;
  onCommentPress: () => void;
  onSharePress: () => void;
}

function isVideo(fileType: string): boolean {
  return fileType.startsWith("video/");
}

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return String(n);
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();

  const diffMs = now - past;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return "vừa xong";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  if (diffDays <= 7) {
    return `${diffDays} ngày trước`;
  }

  const date = new Date(dateStr);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export default function MediaViewer({
  visible,
  media,
  post,
  initialIndex = 0,
  onClose,
  onLike,
  onSave,
  onCommentPress,
  onSharePress,
}: MediaViewerProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const initialSafeIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(media.length - 1, 0),
  );

  const [currentIndex, setCurrentIndex] = useState(initialSafeIndex);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const backdropOpacity = useSharedValue(1);

  const handleDismissComplete = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    translateY.value = 0;
    scale.value = 1;
    backdropOpacity.value = 1;

    setCurrentIndex(initialSafeIndex);
    setInfoExpanded(false);
  }, [visible, initialSafeIndex, translateY, scale, backdropOpacity]);

  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-30, 30])
        .simultaneousWithExternalGesture(nativeScrollGesture)
        .onUpdate((event) => {
          const y = Math.max(0, event.translationY);

          translateY.value = y;

          const progress = Math.min(y / (screenHeight * 0.5), 1);

          scale.value = 1 - progress * 0.04;
          backdropOpacity.value = 1 - progress * 0.85;
        })
        .onEnd((event) => {
          const distanceReached = event.translationY >= DISMISS_DISTANCE;

          const velocityReached = event.velocityY >= DISMISS_VELOCITY;

          const shouldDismiss =
            event.translationY > 0 && (distanceReached || velocityReached);

          if (shouldDismiss) {
            translateY.value = withTiming(
              screenHeight,
              {
                duration: 220,
                easing: Easing.out(Easing.cubic),
              },
              (finished) => {
                if (finished) {
                  runOnJS(handleDismissComplete)();
                }
              },
            );

            backdropOpacity.value = withTiming(0, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
            });

            scale.value = withTiming(0.96, {
              duration: 220,
              easing: Easing.out(Easing.cubic),
            });

            return;
          }

          translateY.value = withSpring(0, {
            damping: 22,
            stiffness: 240,
            mass: 0.85,
          });

          scale.value = withSpring(1, {
            damping: 22,
            stiffness: 240,
            mass: 0.85,
          });

          backdropOpacity.value = withSpring(1, {
            damping: 22,
            stiffness: 240,
            mass: 0.85,
          });
        }),
    [
      screenHeight,
      nativeScrollGesture,
      translateY,
      scale,
      backdropOpacity,
      handleDismissComplete,
    ],
  );

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const viewerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: translateY.value,
      },
      {
        scale: scale.value,
      },
    ],
  }));

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleToggleInfo = useCallback(() => {
    setInfoExpanded((previous) => !previous);
  }, []);

  if (!visible || media.length === 0) {
    return null;
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), media.length - 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden />

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            backdropAnimatedStyle,
          ]}
        />

        <GestureDetector gesture={dismissGesture}>
          <Animated.View style={[styles.viewer, viewerAnimatedStyle]}>
            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={12}>
              <Icon name="close" size={20} color="#FFFFFF" />
            </Pressable>

            {media.length > 1 && (
              <View style={styles.counter}>
                <ThemedText style={styles.counterText}>
                  {safeIndex + 1} / {media.length}
                </ThemedText>
              </View>
            )}

            <GestureDetector gesture={nativeScrollGesture}>
              <FlatList
                data={media}
                horizontal
                pagingEnabled
                bounces={false}
                directionalLockEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={initialSafeIndex}
                keyExtractor={(item) => item.id}
                getItemLayout={(_, index) => ({
                  length: screenWidth,
                  offset: screenWidth * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const width = event.nativeEvent.layoutMeasurement.width;

                  const offset = event.nativeEvent.contentOffset.x;

                  const nextIndex = Math.round(offset / width);

                  setCurrentIndex(nextIndex);
                }}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.mediaStage,
                      {
                        width: screenWidth,
                        height: screenHeight,
                      },
                    ]}>
                    {isVideo(item.file_type) ? (
                      <VideoPlayer uri={item.file_uri} />
                    ) : (
                      <Image
                        source={{
                          uri: item.file_uri,
                        }}
                        style={styles.mediaImage}
                        contentFit="contain"
                      />
                    )}
                  </View>
                )}
              />
            </GestureDetector>

            <View
              style={[
                styles.infoContainer,
                infoExpanded && styles.infoContainerExpanded,
              ]}>
              <Pressable
                style={styles.infoPressable}
                onPress={handleToggleInfo}>
                <View style={styles.infoContent}>
                  <View style={styles.authorRow}>
                    <ThemedText style={styles.displayName}>
                      {post.display_name}
                    </ThemedText>

                    <ThemedText style={styles.username}>
                      @{post.username}
                    </ThemedText>

                    <ThemedText style={styles.separator}>·</ThemedText>

                    <ThemedText style={styles.time}>
                      {formatRelativeTime(post.created_at)}
                    </ThemedText>
                  </View>

                  {post.content ? (
                    <ThemedText
                      style={styles.content}
                      numberOfLines={infoExpanded ? undefined : 2}>
                      {post.content}
                    </ThemedText>
                  ) : null}

                  <View style={styles.actions}>
                    <Pressable style={styles.actionButton} onPress={onLike}>
                      {post.is_liked ? (
                        <Icon name="heartFilled" size={19} color="#E53935" />
                      ) : (
                        <Icon name="heart" size={19} color="#FFFFFF" />
                      )}

                      <ThemedText style={styles.actionCount}>
                        {formatCount(post.likes_count)}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      style={styles.actionButton}
                      onPress={onCommentPress}>
                      <Icon name="chat" size={19} color="#FFFFFF" />

                      <ThemedText style={styles.actionCount}>
                        {formatCount(post.comments_count)}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      style={styles.actionButton}
                      onPress={onSharePress}>
                      <Icon name="share" size={19} color="#FFFFFF" />

                      <ThemedText style={styles.actionCount}>
                        {formatCount(post.shares_count)}
                      </ThemedText>
                    </Pressable>

                    <Pressable style={styles.actionButton} onPress={onSave}>
                      {post.is_saved ? (
                        <Icon name="bookmarkFilled" size={19} color="#FBBC04" />
                      ) : (
                        <Icon name="bookmark" size={19} color="#FFFFFF" />
                      )}
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  backdrop: {
    backgroundColor: "#000000",
  },

  viewer: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: "hidden",
  },

  closeButton: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.50)",
  },

  counter: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.50)",
  },

  counterText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  mediaStage: {
    alignItems: "center",
    justifyContent: "center",
  },

  mediaImage: {
    width: "100%",
    height: "100%",
  },

  infoContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
    backgroundColor: "rgba(0,0,0,0.28)",
  },

  infoContainerExpanded: {
    backgroundColor: "rgba(0,0,0,0.90)",
  },

  infoPressable: {
    width: "100%",
  },

  infoContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },

  displayName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  username: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
  },

  separator: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },

  time: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
  },

  content: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },

  actionButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  actionCount: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },
});
