import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAlert } from '@/utils/alert';
import { formatCount } from '@/utils/format';
import { getEmojis, getPostsByHashtag, reactPost, savePost, sharePost } from '@/api/posts';
import { ShareToChatModal } from '@/components/chat/share-to-chat-modal';
import CommentSheet from '@/components/comment-sheet';
import { feedPostCache } from '@/components/feed';
import MediaViewer from '@/components/media-viewer';
import PostCard from '@/components/post-card';
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
        <View style={[styles.skelAvatar, { backgroundColor: theme.border }]} />
        <View style={styles.skelLines}>
          <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '40%' }]} />
          <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '25%' }]} />
        </View>
      </View>
      <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '80%', marginTop: 12 }]} />
      <View style={[styles.skelLine, { backgroundColor: theme.border }]} />
      <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '55%' }]} />
    </Animated.View>
  );
}

/**
 * Feed bài viết theo hashtag — mirror web app/(user)/hashtag/[name]/page.tsx
 * (header #tag + số bài, skeleton, error/retry, empty, phân trang page-based).
 */
export default function HashtagScreen() {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const params = useLocalSearchParams<{ name: string }>();
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const name = decodeURIComponent(rawName ?? '');

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  // Trang kế tiếp sẽ tải (page-based — khác cursor của community-feed)
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const lastNameRef = useRef(name);

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
      loadingRef.current = true;
      try {
        // Nhường event loop trước khi setState — react-compiler
        // cấm setState đồng bộ trong effect (fetchNext chạy từ useEffect).
        await Promise.resolve();
        if (!reset) setLoadingMore(true);
        setError(null);
        const pageNum = reset ? 1 : pageRef.current;
        const res = await getPostsByHashtag(name, pageNum, PAGE_SIZE);
        // Server cũ trả data:null khi list rỗng → guard để không crash.
        const data = res.data ?? [];
        setPosts((prev) => {
          const base = reset ? data : [...prev, ...data];
          const seen = new Set<string>();
          return base.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
        });
        pageRef.current = pageNum + 1;
        setHasMore(data.length >= PAGE_SIZE);
        for (const p of data) {
          feedPostCache.set(p.id, p);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('hashtag.error'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [name, t],
  );

  useEffect(() => {
    // setTimeout(0): không gọi fetch (và setState) trực tiếp trong effect —
    // react-hooks/set-state-in-effect cấm gọi đồng bộ.
    const timer = setTimeout(() => {
      if (lastNameRef.current !== name) {
        // Đổi tag trong cùng screen instance → reset danh sách.
        lastNameRef.current = name;
        setPosts([]);
        pageRef.current = 1;
        setHasMore(true);
        setLoading(true);
        setError(null);
      }
      void fetchNext(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNext, name]);

  const handleRefresh = useCallback(async () => {
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
      showAlert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
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
        showAlert(t('postDetail.shared'));
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, is_shared: false, shares_count: Math.max(0, p.shares_count - 1) }
              : p,
          ),
        );
        showAlert(t('common.error'), t('common.error'));
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

  const goBack = () => {
    if ((navigation as any).canGoBack?.()) {
      (navigation as any).goBack();
    } else {
      (navigation as any).navigate?.('index');
    }
  };

  const headerCount =
    !loading && !error ? `${formatCount(posts.length, language)} ${t('hashtag.posts')}` : null;

  const renderContent = () => {
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
          <Icon name="warning" size={48} color={theme.accent} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable
            onPress={() => {
              pageRef.current = 1;
              setLoading(true);
              void fetchNext(true);
            }}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
              {t('common.retry')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
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
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <ThemedText style={styles.emptyHash}>#</ThemedText>
            <ThemedText style={styles.emptyTitle}>{t('hashtag.empty')}</ThemedText>
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
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      {/* Header cố định: back + #tag + số bài (mirror web hashtag header) */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Icon name="chevronLeft" size={22} color={theme.text} />
        </Pressable>
        <View style={[styles.hashBox, { backgroundColor: theme.primaryLight }]}>
          <ThemedText style={[styles.hashBoxText, { color: theme.primary }]}>#</ThemedText>
        </View>
        <View style={styles.headerMeta}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            #{name}
          </ThemedText>
          {headerCount && (
            <ThemedText themeColor="textSecondary" style={styles.headerCount} numberOfLines={1}>
              {headerCount}
            </ThemedText>
          )}
        </View>
      </View>

      <View style={styles.container}>{renderContent()}</View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashBoxText: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerMeta: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 17,
  },
  headerCount: {
    fontSize: 12,
    marginTop: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyHash: {
    fontSize: 48,
    fontWeight: '700',
    opacity: 0.4,
    lineHeight: 54,
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
  },
  skelLines: {
    flex: 1,
    gap: 6,
  },
  skelLine: {
    height: 14,
    borderRadius: 8,
  },
});
