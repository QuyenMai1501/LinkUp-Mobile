import React, { useState, useCallback } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import type { FeedPost, FeedMedia } from '../types/post';
import VideoPlayer from './video-player';

const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY = 600;
const INFO_COLLAPSED_HEIGHT = 160;
const INFO_EXPANDED_RATIO = 0.65;

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays <= 7) return `${diffDays} ngày trước`;

  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function isVideo(fileType: string): boolean {
  return fileType.startsWith('video/');
}

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
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const infoMaxHeight = useSharedValue(INFO_COLLAPSED_HEIGHT);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const dismissWorklet = useCallback(() => {
    'worklet';
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withSpring(SCREEN_HEIGHT, { damping: 30, stiffness: 300 });
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = withSpring(0, { damping: 30, stiffness: 300 }, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
  }, [handleDismiss, translateY, opacity, SCREEN_HEIGHT]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = e.translationY;
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = Math.max(0, 1 - e.translationY / SCREEN_HEIGHT);
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
        dismissWorklet();
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withSpring(0, { damping: 20 });
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = withSpring(1, { damping: 20 });
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const infoOverlayStyle = useAnimatedStyle(() => ({
    maxHeight: infoMaxHeight.value,
  }));

  const handleClose = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = 1;
    onClose();
  }, [onClose, translateY, opacity]);

  const handleToggleInfo = useCallback(() => {
    setInfoExpanded((prev) => {
      const next = !prev;
      const targetHeight = next
        ? SCREEN_HEIGHT * INFO_EXPANDED_RATIO
        : INFO_COLLAPSED_HEIGHT;
      infoMaxHeight.value = withTiming(targetHeight, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      return next;
    });
  }, [infoMaxHeight, SCREEN_HEIGHT]);

  const handleOpenComments = useCallback(() => {
    onCommentPress();
  }, [onCommentPress]);

  if (!visible || media.length === 0) return null;

  const safeIndex = Math.min(currentIndex, media.length - 1);

  return (
    <Modal visible={visible} transparent>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, containerStyle]}>
          <StatusBar hidden />

          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <ThemedText style={styles.closeIcon}>✕</ThemedText>
          </Pressable>

          {/* Counter */}
          {media.length > 1 && (
            <View style={[styles.counter, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
              <ThemedText style={styles.counterText}>
                {safeIndex + 1} / {media.length}
              </ThemedText>
            </View>
          )}

          {/* Media — FlatList handles its own horizontal scrolling */}
          <FlatList
            data={media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width,
              );
              setCurrentIndex(idx);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item: m }) => (
              <View style={[styles.mediaStage, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
                {isVideo(m.file_type) ? (
                  <VideoPlayer uri={m.file_uri} />
                ) : (
                  <Image
                    source={{ uri: m.file_uri }}
                    style={styles.mediaImage}
                    contentFit="contain"
                  />
                )}
              </View>
            )}
          />

          {/* Info overlay — always at bottom, expands upward via maxHeight */}
          <Animated.View style={[styles.infoOverlay, infoOverlayStyle]}>
            <Pressable onPress={handleToggleInfo} style={styles.infoPressable}>
              {/* Gradient background */}
              <View style={[styles.infoGradient, infoExpanded && styles.infoGradientExpanded]} />

              <View style={styles.infoContent}>
                {/* Author row */}
                <View style={styles.authorRow}>
                  <ThemedText style={styles.displayName}>{post.display_name}</ThemedText>
                  <ThemedText style={styles.username}>@{post.username}</ThemedText>
                  <ThemedText style={styles.dot}>·</ThemedText>
                  <ThemedText style={styles.time}>{formatRelativeTime(post.created_at)}</ThemedText>
                </View>

                {/* Content */}
                {post.content ? (
                  <ThemedText
                    style={styles.content}
                    numberOfLines={infoExpanded ? undefined : 2}>
                    {post.content}
                  </ThemedText>
                ) : null}

                {/* Action icons */}
                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} onPress={onLike}>
                    <ThemedText style={[styles.actionIcon, post.is_liked && { color: '#E53935' }]}>
                      {post.is_liked ? '❤️' : '🤍'}
                    </ThemedText>
                    <ThemedText style={styles.actionCount}>{formatCount(post.likes_count)}</ThemedText>
                  </Pressable>

                  <Pressable style={styles.actionBtn} onPress={handleOpenComments}>
                    <ThemedText style={styles.actionIcon}>💬</ThemedText>
                    <ThemedText style={styles.actionCount}>{formatCount(post.comments_count)}</ThemedText>
                  </Pressable>

                  <Pressable style={styles.actionBtn} onPress={onSharePress}>
                    <ThemedText style={styles.actionIcon}>↗️</ThemedText>
                    <ThemedText style={styles.actionCount}>{formatCount(post.shares_count)}</ThemedText>
                  </Pressable>

                  <Pressable style={styles.actionBtn} onPress={onSave}>
                    <ThemedText style={[styles.actionIcon, post.is_saved && { color: '#FBBC04' }]}>
                      {post.is_saved ? '🔖' : '📑'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  counter: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  counterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  mediaStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  infoPressable: {
    minHeight: INFO_COLLAPSED_HEIGHT,
  },
  infoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'transparent',
  },
  infoGradientExpanded: {
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  infoContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  displayName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  dot: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  time: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  content: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
});
