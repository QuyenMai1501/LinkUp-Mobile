import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getCommunityPosts } from '@/api/communities';
import { getEmojis, reactPost, savePost, sharePost } from '@/api/posts';
import { ShareToChatModal } from '@/components/chat/share-to-chat-modal';
import CommentSheet from '@/components/comment-sheet';
import { feedPostCache } from '@/components/feed';
import MediaViewer from '@/components/media-viewer';
import PostCard from '@/components/post-card';
import PostComposer from '@/components/post-composer';
import { ShareOptionsSheet } from '@/components/share-options-sheet';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTranslation } from '@/hooks/useTranslation';
import type { EmojiItem, FeedPost } from '@/types/post';

const PAGE_SIZE = 10;

async function ensureLikeEmojiId(): Promise<string | undefined> {
  try {
    const res = await getEmojis();
    const emoji = res.data.find((e: EmojiItem) => e.code === ':like:');
    if (emoji) return emoji.id;
  } catch {
    /* ignore */
  }
  return undefined;
}

function SkeletonCard() {
  const theme = useTheme();
  const shimmer = useShimmer();
  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          opacity: shimmer,
        },
      ]}>
      <View style={styles.skelHeader}>
        <View style={styles.skelAvatar} />
        <View style={styles.skelLines}>
          <View style={[styles.skelLine, { width: '40%' }]} />
          <View style={[styles.skelLine, { width: '25%' }]} />
        </View>
      </View>
      <View style={[styles.skelLine, { width: '80%', marginTop: 12 }]} />
      <View style={styles.skelLine} />
      <View style={[styles.skelLine, { width: '55%' }]} />
    </Animated.View>
  );
}

interface CommunityFeedProps {
  communityId: string;
  /** AboutCard (Giới thiệu/thành viên/quy tắc) hiển thị trên đầu feed. */
  header?: ReactNode;
}

export default function CommunityFeed({ communityId, header }: CommunityFeedProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  // undefined = chưa tải trang nào, null = hết bài, chuỗi = cursor kế tiếp
  const cursorRef = useRef<string | null | undefined>(undefined);
  const loadingRef = useRef(false);

  const [composerVisible, setComposerVisible] = useState(false);

  // Media viewer state
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaModalPost, setMediaModalPost] = useState<FeedPost | null>(null);
  const [mediaModalIndex, setMediaModalIndex] = useState(0);

  // Comment sheet state
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentSheetPost, setCommentSheetPost] = useState<FeedPost | null>(null);

  // Share state
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [shareSheetPost, setShareSheetPost] = useState<FeedPost | null>(null);

  const fetchNext = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      if (!reset && cursorRef.current === null) return;
      loadingRef.current = true;
      try {
        // Nhường event loop trước khi setState — react-compiler
        // cấm setState đồng bộ trong effect (fetchNext chạy từ useEffect).
        await Promise.resolve();
        if (!reset) setLoadingMore(true);
        setError(null);
        // Server không trả next_cursor — tự lấy từ bài cuối:
        // cursor = "<RFC3339Nano created_at>,<post_id>"
        const res = await getCommunityPosts(
          communityId,
          reset ? undefined : cursorRef.current ?? undefined,
          PAGE_SIZE,
        );
        setPosts((prev) => {
          const base = reset ? res.posts : [...prev, ...res.posts];
          const seen = new Set<string>();
          return base.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
        });
        const last = res.posts[res.posts.length - 1];
        cursorRef.current = last ? `${last.created_at},${last.id}` : null;
        setHasMore(res.posts.length === PAGE_SIZE && last !== undefined);
        for (const p of res.posts) {
          feedPostCache.set(p.id, p);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('feed.loadError'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [communityId, t],
  );

  useEffect(() => {
    // setTimeout(0): không gọi fetch (và setState) trực tiếp trong effect —
    // react-hooks/set-state-in-effect cấm gọi đồng bộ.
    const timer = setTimeout(() => {
      void fetchNext(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNext]);

  const handleRefresh = useCallback(async () => {
    cursorRef.current = undefined;
    setHasMore(true);
    await fetchNext(true);
  }, [fetchNext]);
  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingRef.current) void fetchNext(false);
  }, [hasMore, fetchNext]);

  const handleLike = useCallback(async (postId: string) => {
    const emojiId = await ensureLikeEmojiId();
    if (!emojiId) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p,
      ),
    );

    try {
      await reactPost(postId, emojiId);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
            : p,
        ),
      );
    }
  }, []);

  const handleSave = useCallback(async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_saved: !p.is_saved } : p)),
    );

    try {
      await savePost(postId);
    } catch (e) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: !p.is_saved } : p)),
      );
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    }
  }, [t]);

  const doRepost = useCallback(
    async (post: FeedPost, content?: string) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, is_shared: true, shares_count: p.shares_count + 1 } : p,
        ),
      );
      try {
        await sharePost(post.id, content);
        Alert.alert(t('postDetail.shared'));
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, is_shared: false, shares_count: Math.max(0, p.shares_count - 1) }
              : p,
          ),
        );
        Alert.alert(t('common.error'), t('common.error'));
      }
    },
    [t],
  );

  // Media viewer handlers
  const handleOpenMedia = useCallback((post: FeedPost, index: number) => {
    setMediaModalPost(post);
    setMediaModalIndex(index);
    setMediaModalVisible(true);
  }, []);

  const handleCloseMedia = useCallback(() => {
    setMediaModalVisible(false);
    setMediaModalPost(null);
    setMediaModalIndex(0);
  }, []);

  // Comment sheet handlers
  const handleOpenComments = useCallback((post: FeedPost) => {
    setCommentSheetPost(post);
    setCommentSheetVisible(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    setCommentSheetVisible(false);
    setCommentSheetPost(null);
  }, []);

  const handlePostPress = useCallback(
    (postId: string) => {
      (router as any).push(`/(drawer)/post/${postId}`);
    },
    [router],
  );

  const handlePosted = useCallback((post: FeedPost) => {
    setComposerVisible(false);
    feedPostCache.set(post.id, post);
    setPosts((prev) => {
      if (prev.some((p) => p.id === post.id)) return prev;
      return [post, ...prev];
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.listContent}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={styles.centerContent}>
        <Icon name="warning" size={48} color="#FB8C00" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <Pressable
          onPress={() => {
            cursorRef.current = undefined;
            setLoading(true);
            void fetchNext(true);
          }}
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText style={styles.primaryBtnText}>{t('common.retry')}</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={handlePostPress}
            onLike={handleLike}
            onSave={handleSave}
            onMediaPress={(index, targetPost) => handleOpenMedia(targetPost ?? item, index)}
            onCommentPress={() => handleOpenComments(item)}
            onSharePress={() => setShareSheetPost(item)}
          />
        )}
        onEndReached={commentSheetVisible ? undefined : handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={5}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {header}
            {/* Đăng bài trong cộng đồng (gap-fill — Web chưa có) */}
            <Pressable
              onPress={() => setComposerVisible(true)}
              style={({ pressed }) => [
                styles.composerEntry,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <Icon name="person" size={20} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.composerPlaceholder} numberOfLines={1}>
                {t('composer.placeholder')}
              </ThemedText>
              <Icon name="images" size={18} color={theme.primary} />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Icon name="chat" size={48} color={theme.primary} />
            <ThemedText style={styles.emptyTitle}>{t('communities.noPosts')}</ThemedText>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endMessage}>
              {t('feed.endOfFeed')}
            </ThemedText>
          ) : null
        }
        contentContainerStyle={[styles.listContent, posts.length === 0 && styles.listContentEmpty]}
      />

      <PostComposer
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        onPosted={handlePosted}
        communityId={communityId}
      />

      {mediaModalPost && (
        <MediaViewer
          visible={mediaModalVisible}
          media={mediaModalPost.media}
          post={mediaModalPost}
          initialIndex={mediaModalIndex}
          onClose={handleCloseMedia}
          onLike={() => handleLike(mediaModalPost.id)}
          onSave={() => handleSave(mediaModalPost.id)}
          onCommentPress={() => {
            setMediaModalVisible(false);
            if (mediaModalPost) {
              setCommentSheetPost(mediaModalPost);
              setCommentSheetVisible(true);
            }
          }}
          onSharePress={() => {
            setMediaModalVisible(false);
            if (mediaModalPost) setShareSheetPost(mediaModalPost);
          }}
        />
      )}

      {commentSheetPost && (
        <CommentSheet
          visible={commentSheetVisible}
          postId={commentSheetPost.id}
          postUserId={commentSheetPost.user_id}
          onClose={handleCloseComments}
        />
      )}

      <ShareOptionsSheet
        visible={shareSheetPost !== null}
        onClose={() => setShareSheetPost(null)}
        onRepost={(content) => {
          if (shareSheetPost) doRepost(shareSheetPost, content);
        }}
        onSendToFriend={() => {
          if (shareSheetPost) setSharePostId(shareSheetPost.id);
        }}
      />

      <ShareToChatModal
        visible={sharePostId !== null}
        postId={sharePostId ?? ''}
        onClose={() => setSharePostId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  composerEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 4,
    minHeight: 44,
  },
  composerPlaceholder: {
    ...Typography.body,
    fontSize: 14,
    flex: 1,
  },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h2,
    fontSize: 17,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
  },
  primaryBtnText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: 14,
  },
  endMessage: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: 14,
  },
  skeleton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
  },
  skelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  skelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  skelLines: {
    flex: 1,
    gap: 6,
  },
  skelLine: {
    height: 14,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
});
