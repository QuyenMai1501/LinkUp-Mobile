import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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

  const translateY = useSharedValue(400);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const dismissWorklet = useCallback(() => {
    'worklet';
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withSpring(800, { damping: 30, stiffness: 300 }, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
  }, [handleDismiss, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 500) {
        dismissWorklet();
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withSpring(0, { damping: 20 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleOpen = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = 0;
  }, [translateY]);

  const handleClose = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withSpring(800, { damping: 30, stiffness: 300 }, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
  }, [handleDismiss, translateY]);

  useEffect(() => {
    if (visible) {
      handleOpen();
    }
  }, [visible, handleOpen]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments([]);
    setCommentPage(1);
    setCommentText('');
    setReplyingTo(null);

    getComments(postId, 1, COMMENT_PAGE_SIZE, 'newest')
      .then((res) => {
        if (!cancelled) {
          setComments(res.data);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [visible, postId]);

  const loadMoreComments = useCallback(async () => {
    if (commentsLoading) return;
    const nextPage = commentPage + 1;
    setCommentsLoading(true);
    try {
      const res = await getComments(postId, nextPage, COMMENT_PAGE_SIZE, commentSort);
      setComments((prev) => [...prev, ...res.data]);
      setCommentPage(nextPage);
    } catch {
      // keep existing list
    } finally {
      setCommentsLoading(false);
    }
  }, [commentPage, postId, commentSort, commentsLoading]);

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
      setCommentText('');
      setReplyingTo(null);
    } catch {
      // ignore
    } finally {
      setSubmittingComment(false);
    }
  };

  const commentTree = buildCommentTree(comments, commentSort);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent>
      {/* Backdrop — absolute, taps to close */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      {/* Sheet container — flex child, KeyboardAvoidingView pushes up when keyboard opens */}
      <KeyboardAvoidingView
        style={styles.sheetContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.card },
            animatedStyle,
          ]}
        >
          {/* Drag handle — with pan gesture for dismiss */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
            </View>
          </GestureDetector>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <ThemedText style={styles.headerTitle}>{t('postDetail.comments')}</ThemedText>
          </View>

          {/* Comments list — FlatList handles its own scrolling */}
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
            onEndReached={loadMoreComments}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !commentsLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {t('postDetail.noComments')}
                </ThemedText>
              ) : null
            }
            ListFooterComponent={
              commentsLoading ? (
                <View style={styles.loadingMore}>
                  <ThemedText themeColor="textSecondary">⏳</ThemedText>
                </View>
              ) : null
            }
          />

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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
