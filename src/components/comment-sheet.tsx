/* eslint-disable react-hooks/refs */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import CommentItem, { buildCommentTree } from '@/components/comment-item';
import CommentInput from '@/components/comment-input';
import {
  getComments,
  createComment,
  toggleCommentReaction,
  getEmojis,
} from '../api/posts';
import type { CommentItem as CommentItemType, EmojiItem, CommentSort } from '../types/post';

const COMMENT_PAGE_SIZE = 10;
const DISMISS_THRESHOLD = 100;
// Đóng nhanh như media-viewer: ~0,22s thay vì spring nặng (1-2s).
const CLOSE_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
const OPEN_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) } as const;
// Tham chiếu kéo để backdrop mờ dần / sheet scale (px).
const DRAG_REFERENCE = 300;

let likeEmojiIdPromise: Promise<string | undefined> | undefined;

function ensureLikeEmojiId(): Promise<string | undefined> {
  likeEmojiIdPromise ??= (async () => {
    try {
      const res = await getEmojis();
      const emoji = res.data.find((e: EmojiItem) => e.code === ':like:');
      return emoji ? emoji.id : undefined;
    } catch {
      return undefined;
    }
  })();
  return likeEmojiIdPromise;
}

interface CommentSheetProps {
  visible: boolean;
  postId: string;
  postUserId: string;
  onClose: () => void;
}

export default function CommentSheet({
  visible,
  postId,
  postUserId,
  onClose,
}: CommentSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItemType | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSort] = useState<CommentSort>('newest');
  const flatListRef = useRef<FlatList>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const commentsLenRef = useRef(0);

  // Khởi tạo ngoài màn hình (900) để mở vào slide-up thay vì nhảy ra.
  const translateY = useSharedValue(900);
  const backdropOpacity = useSharedValue(1);
  const scale = useSharedValue(1);
  // Dùng SharedValue thay vì ref để đọc an toàn từ worklet (giống pattern media-viewer)
  const scrollY = useSharedValue(0);

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

  // Gesture cuộn native của FlatList — pan của sheet chạy song song với nó
  // (pattern y hệt media-viewer) để vuốt xuống không bị gesture cuộn nuốt.
  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        // Giống media-viewer: nhận cả 2 hướng, nhưng chỉ xử lý vuốt xuống
        .activeOffsetY([-10, 10])
        // Chặn khi vuốt ngang quá nhiều (tránh conflict)
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

  useEffect(() => {
    if (visible) {
      scrollY.value = 0;
      handleOpen();
    }
  }, [visible, handleOpen, scrollY]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments([]);
    setCommentPage(1);
    setCommentText('');
    setReplyingTo(null);
    setCommentsLoading(true);
    hasMoreRef.current = true;
    loadingMoreRef.current = false;
    commentsLenRef.current = 0;

    getComments(postId, 1, COMMENT_PAGE_SIZE, 'newest')
      .then((res) => {
        if (cancelled) return;
        setComments(res.data);
        commentsLenRef.current = res.data.length;
        hasMoreRef.current = res.data.length < res.total;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => { cancelled = true; };
  }, [visible, postId]);

  const loadMoreComments = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setCommentsLoading(true);
    try {
      const nextPage = commentPage + 1;
      const res = await getComments(postId, nextPage, COMMENT_PAGE_SIZE, commentSort);
      if (res.data.length === 0) {
        hasMoreRef.current = false;
      } else {
        setComments((prev) => [...prev, ...res.data]);
        commentsLenRef.current += res.data.length;
        setCommentPage(nextPage);
        hasMoreRef.current = commentsLenRef.current < res.total;
      }
    } catch {
      // keep existing list
    } finally {
      loadingMoreRef.current = false;
      setCommentsLoading(false);
    }
  }, [commentPage, postId, commentSort]);

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      const emojiId = await ensureLikeEmojiId();
      if (!emojiId) return;

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, is_liked: !c.is_liked, likes_count: c.is_liked ? c.likes_count - 1 : c.likes_count + 1 }
            : c,
        ),
      );

      try {
        await toggleCommentReaction(commentId, emojiId);
      } catch {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, is_liked: !c.is_liked, likes_count: c.is_liked ? c.likes_count - 1 : c.likes_count + 1 }
              : c,
          ),
        );
      }
    },
    [],
  );

  const handleSubmitComment = async () => {
    const content = commentText.trim();
    if (!content || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await createComment(postId, content, replyingTo?.id);
      setComments(res.data);
      setCommentPage(1);
      commentsLenRef.current = res.data.length;
      hasMoreRef.current = false;
      setCommentText('');
      setReplyingTo(null);
    } catch {
      // ignore
    } finally {
      setSubmittingComment(false);
    }
  };

  const commentTree = buildCommentTree(comments, commentSort);

  const handleScroll = useCallback((e: any) => {
    // Cập nhật SharedValue để worklet đọc được chính xác
    scrollY.value = e.nativeEvent.contentOffset.y;
  }, [scrollY]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent>
      {/* Bắt buộc có GestureHandlerRootView bên trong Modal (giống media-viewer) */}
      <GestureHandlerRootView style={styles.flex}>
        {/* Backdrop — bấm để đóng; opacity animate theo mức vuốt */}
        <Pressable style={styles.backdropHit} onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        </Pressable>

        {/* Sheet container — flex child, KeyboardAvoidingView pushes up when keyboard opens */}
        <KeyboardAvoidingView
          style={styles.sheetContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                { backgroundColor: theme.card },
                animatedStyle,
              ]}
            >
              {/* Drag handle */}
              <View style={styles.handleRow}>
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
              </View>

              {/* Header */}
              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <ThemedText style={styles.headerTitle}>
                  {t('postDetail.comments')}
                </ThemedText>
              </View>

              {/* Comments list — FlatList cuộn qua Gesture.Native riêng,
                  pan dismiss chạy song song (không tranh chấp) */}
              <GestureDetector gesture={nativeScrollGesture}>
                <FlatList
                  ref={flatListRef}
                  data={commentTree}
                  keyExtractor={(item) => item.comment.id}
                  renderItem={({ item }) => (
                    <CommentItem
                      node={item}
                      postUserId={postUserId}
                      allComments={comments}
                      onLike={handleToggleCommentLike}
                      onReply={setReplyingTo}
                    />
                  )}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  onEndReached={() => {
                    if (hasMoreRef.current) loadMoreComments();
                  }}
                  onEndReachedThreshold={0.5}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    !commentsLoading ? (
                      <ThemedText
                        themeColor="textSecondary"
                        style={styles.emptyText}
                      >
                        {t('postDetail.noComments')}
                      </ThemedText>
                    ) : null
                  }
                  ListFooterComponent={
                    commentsLoading && hasMoreRef.current ? (
                      <View style={styles.loadingMore}>
                        <ThemedText themeColor="textSecondary">⏳</ThemedText>
                      </View>
                    ) : null
                  }
                />
              </GestureDetector>

              {/* Comment input */}
              <CommentInput
                value={commentText}
                onChangeText={setCommentText}
                onSubmit={handleSubmitComment}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                submitting={submittingComment}
              />
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 14,
  },
  loadingMore: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
