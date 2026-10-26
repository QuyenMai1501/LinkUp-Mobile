import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, Animated, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { Colors } from '@/constants/colors';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useThemeMode } from '@/contexts/theme-context';
import { useTranslation } from '@/hooks/useTranslation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PostCard from './post-card';
import MediaViewer from './media-viewer';
import CommentSheet from './comment-sheet';
import { ShareOptionsSheet } from './share-options-sheet';
import { ShareToChatModal } from './chat/share-to-chat-modal';
import StoryBar from './story/story-bar';
import StoryViewer from './story/story-viewer';
import StoryComposer from './story/story-composer';
import { getFeedPosts, reactPost, savePost, sharePost, getEmojis, trackPostView } from '../api/posts';
import { getFeedAds, trackAdAction } from '../api/partner';
import { getFeedStories, toggleMuteStoryUser } from '../api/story';
import { getMyProfile } from '../api/profile';
import { followUser } from '../api/follow';
import { useAuth } from '@/contexts/auth-context';
import type { FeedPost, EmojiItem } from '../types/post';
import type { FeedAd } from '../types/partner';
import type { StoryFeedItem, StoryItem } from '../types/story';
import SponsoredAdCard from './sponsored-ad-card';

const INITIAL_PAGE_SIZE = 2;
const PAGE_SIZE = 10;

// Ngưỡng impression chuẩn viewable (theo X/MRC cho video):
// bài hiện ≥50% liên tục 2s mới tính 1 view.
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 2000,
};

// Module-level cache: feed posts keyed by ID, for passing to detail screen
export const feedPostCache = new Map<string, FeedPost>();

type FeedRow =
  | { kind: 'post'; post: FeedPost }
  | { kind: 'ad'; ad: FeedAd; slot: number };

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
      <View style={[styles.skelLine, { width: '60%', marginTop: 12 }]} />
      <View style={[styles.skelLine, { width: '80%' }]} />
      <View style={styles.skelMedia} />
    </Animated.View>
  );
}

interface FeedProps {
  onPostPress?: (postId: string) => void;
  onOpenComposer?: () => void;
  /** Bộ lọc feed: undefined = Khám phá, 'following' = chỉ bài từ người đang theo dõi. */
  filter?: string;
  /** Chuyển về tab Khám phá (dùng ở empty state của tab Following). */
  onExplore?: () => void;
}

export default function Feed({ onPostPress, onOpenComposer, filter, onExplore }: FeedProps) {
  const theme = useTheme();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { t } = useTranslation();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedAds, setFeedAds] = useState<FeedAd[]>([]);
  const trackedAdsRef = useRef(new Set<string>());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  // Media modal state
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaModalPost, setMediaModalPost] = useState<FeedPost | null>(null);
  const [mediaModalIndex, setMediaModalIndex] = useState(0);

  // Comment sheet state
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentSheetPost, setCommentSheetPost] = useState<FeedPost | null>(null);

  // Share-to-chat modal state
  const [sharePostId, setSharePostId] = useState<string | null>(null);

  // Bottom sheet chọn Đăng lại / Gửi cho bạn bè
  const [shareSheetPost, setShareSheetPost] = useState<FeedPost | null>(null);

  // Stories
  const [stories, setStories] = useState<StoryFeedItem[]>([]);
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyViewer, setStoryViewer] = useState<StoryItem[] | null>(null);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [myAvatarUri, setMyAvatarUri] = useState<string | undefined>(undefined);

  // Ads sponsored: 1 lần khi mount (server tự target theo gender/age/location).
  useEffect(() => {
    let active = true;
    getFeedAds()
      .then((ads) => {
        if (active) setFeedAds(ads);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadStories = useCallback(async () => {
    // setState luôn sau await — tránh react-hooks/set-state-in-effect
    await Promise.resolve();
    try {
      const res = await getFeedStories();
      setStories(Array.isArray(res) ? res : []);
    } catch {
      /* silent — bar ẩn khi không có story */
    } finally {
      setStoryLoading(false);
    }
  }, []);

  // Nạp story lúc mount — IIFE trong effect (pattern codebase) để tách khỏi
  // lần gọi loadStories từ event handler (refresh / mute / created / deleted).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        const res = await getFeedStories();
        if (!cancelled) setStories(Array.isArray(res) ? res : []);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getMyProfile()
      .then((p) => {
        if (!cancelled) setMyAvatarUri(p.avatar_uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const markStoryViewed = useCallback((storyId: string) => {
    setStories((prev) =>
      prev.map((g) => ({
        ...g,
        stories: g.stories.map((s) => (s.id === storyId ? { ...s, has_viewed: true } : s)),
      })),
    );
  }, []);

  const handleMuteStoryUser = useCallback(
    (userId: string) => {
      toggleMuteStoryUser(userId)
        .then(() => loadStories())
        .catch(() => {});
    },
    [loadStories],
  );

  const fetchNext = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const isFirst = cursorRef.current === null;
    try {
      const res = await getFeedPosts(cursorRef.current, isFirst ? INITIAL_PAGE_SIZE : PAGE_SIZE, filter);
      setPosts((prev) => {
        const list = isFirst ? res.data : [...prev, ...res.data];
        const seen = new Set<string>();
        return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      });
      // Populate cache for detail screen
      for (const p of res.data) {
        feedPostCache.set(p.id, p);
      }
      cursorRef.current = res.next_cursor;
      setHasMore(res.next_cursor !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('feed.loadError'));
    } finally {
      setLoading(false);
      setInitialLoading(false);
      loadingRef.current = false;
    }
  }, [t, filter]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  const handleRefresh = useCallback(async () => {
    cursorRef.current = null;
    setError(null);
    await Promise.all([fetchNext(), loadStories()]);
  }, [fetchNext, loadStories]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

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
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: !p.is_saved } : p)),
      );
    }
  }, []);

  // Follow từ feed: optimistic is_following=true cho MỌI post của tác giả,
  // lỗi → rollback false (mirror Web Feed.tsx:263-278).
  const handleFollow = useCallback(async (userId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, is_following: true } : p)),
    );
    try {
      await followUser(userId);
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, is_following: false } : p)),
      );
    }
  }, []);

  const handleEndReached = () => {
    if (hasMore && !loadingRef.current) {
      fetchNext();
    }
  };

  // Ghép ads vào danh sách: trên web cứ mỗi 6 post (idx 5, 11, ...) chèn 1
  // card phía trên bài đó; ads xoay vòng theo slot — thuần tính toán, không
  // setState trong render (web đang setAdIndex lúc render).
  const rows = useMemo<FeedRow[]>(() => {
    const out: FeedRow[] = [];
    let adSlot = 0;
    posts.forEach((post, idx) => {
      if (feedAds.length > 0 && idx > 0 && (idx + 1) % 6 === 0) {
        out.push({
          kind: 'ad',
          ad: feedAds[adSlot % feedAds.length],
          slot: adSlot,
        });
        adSlot += 1;
      }
      out.push({ kind: 'post', post });
    });
    return out;
  }, [posts, feedAds]);

  // Impressions: bài + ads cùng chung ngưỡng viewability (≥50% trong 2s);
  // ads dedupe theo session qua trackedAdsRef (trackAdAction không tự dedupe).
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: FeedRow }> }) => {
      for (const { item } of viewableItems) {
        if (item.kind === 'ad') {
          if (!trackedAdsRef.current.has(item.ad.id)) {
            trackedAdsRef.current.add(item.ad.id);
            trackAdAction(item.ad.id, 'impression').catch(() => {});
          }
        } else {
          trackPostView(item.post.id, 'feed');
        }
      }
    },
  );

  // Media modal handlers
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

  // Share handler: hiện action sheet — Đăng lại (repost) hoặc Gửi vào chat
  const doRepost = useCallback(async (post: FeedPost, content?: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, is_shared: true, shares_count: p.shares_count + 1 }
          : p,
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
  }, [t]);

  const handleShare = useCallback((post: FeedPost) => {
    setShareSheetPost(post);
  }, []);

  // Media modal like/save handlers
  const handleMediaLike = useCallback(() => {
    if (mediaModalPost) handleLike(mediaModalPost.id);
  }, [mediaModalPost, handleLike]);

  const handleMediaSave = useCallback(() => {
    if (mediaModalPost) handleSave(mediaModalPost.id);
  }, [mediaModalPost, handleSave]);

  const handleMediaCommentPress = useCallback(() => {
    setMediaModalVisible(false);
    if (mediaModalPost) {
      setCommentSheetPost(mediaModalPost);
      setCommentSheetVisible(true);
    }
  }, [mediaModalPost]);

  const handleMediaSharePress = useCallback(() => {
    setMediaModalVisible(false);
    if (mediaModalPost) {
      handleShare(mediaModalPost);
    }
  }, [mediaModalPost, handleShare]);

  if (initialLoading) {
    return (
      <View style={styles.container}>
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
        <ThemedText style={styles.emptyTitle}>{error}</ThemedText>
        <Pressable
          onPress={() => {
            cursorRef.current = null;
            fetchNext();
          }}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}>
          <ThemedText style={styles.retryText}>{t('common.retry')}</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === 'ad' ? `ad-${row.slot}` : row.post.id)}
        renderItem={({ item: row }) =>
          row.kind === 'ad' ? (
            <SponsoredAdCard ad={row.ad} />
          ) : (
            <PostCard
              post={row.post}
              onPress={onPostPress}
              onLike={handleLike}
              onSave={handleSave}
              onFollow={handleFollow}
              onMediaPress={(index, targetPost) =>
                handleOpenMedia(targetPost ?? row.post, index)
              }
              onCommentPress={() => handleOpenComments(row.post)}
              onSharePress={() => handleShare(row.post)}
            />
          )
        }
        ListHeaderComponent={
          <>
            <StoryBar
              stories={stories}
              loading={storyLoading}
              currentUserId={user?.id}
              avatarUri={myAvatarUri}
              onSelectStory={(_userId, userStories) => setStoryViewer(userStories)}
              onCreateStory={() => setShowStoryComposer(true)}
              onMuteUser={handleMuteStoryUser}
            />
            <Pressable
              style={[styles.composerTrigger, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={onOpenComposer}>
              <ThemedText themeColor="textSecondary" style={styles.composerPlaceholder}>
                {t('composer.placeholder')}
              </ThemedText>
            </Pressable>
          </>
        }
        onEndReached={commentSheetVisible ? undefined : handleEndReached}
        onEndReachedThreshold={1}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged.current}
        removeClippedSubviews={true}
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
        ListFooterComponent={
          loading && !initialLoading ? (
            <View>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endMessage}>
              {t('feed.endOfFeed')}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          !initialLoading && !error ? (
            <View style={styles.centerContent}>
              <Icon name={filter === 'following' ? 'people' : 'newspaper'} size={48} />
              <ThemedText style={styles.emptyTitle}>
                {filter === 'following' ? t('feed.emptyFollowing') : t('feed.emptyTitle')}
              </ThemedText>
              {filter === 'following' ? (
                <Pressable onPress={onExplore} hitSlop={8}>
                  <ThemedText themeColor="primary" style={styles.exploreLink}>
                    {t('feed.exploreLink')}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                  {t('feed.emptySubtitle')}
                </ThemedText>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Media Viewer Modal */}
      {mediaModalPost && (
        <MediaViewer
          visible={mediaModalVisible}
          media={mediaModalPost.media}
          post={mediaModalPost}
          initialIndex={mediaModalIndex}
          onClose={handleCloseMedia}
          onLike={handleMediaLike}
          onSave={handleMediaSave}
          onCommentPress={handleMediaCommentPress}
          onSharePress={handleMediaSharePress}
        />
      )}

      {/* Comment Sheet */}
      {commentSheetPost && (
        <CommentSheet
          visible={commentSheetVisible}
          postId={commentSheetPost.id}
          postUserId={commentSheetPost.user_id}
          onClose={handleCloseComments}
        />
      )}

      {/* Share options: Đăng lại / Gửi cho bạn bè */}
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

      {/* Share post to chat */}
      <ShareToChatModal
        visible={sharePostId !== null}
        postId={sharePostId ?? ''}
        onClose={() => setSharePostId(null)}
      />

      {/* Story viewer */}
      {storyViewer && (
        <StoryViewer
          stories={storyViewer}
          currentUserId={user?.id}
          onClose={() => setStoryViewer(null)}
          onStoryViewed={markStoryViewed}
          onStoryDeleted={loadStories}
        />
      )}

      {/* Tạo tin mới */}
      {showStoryComposer && (
        <StoryComposer
          visible={showStoryComposer}
          onClose={() => setShowStoryComposer(false)}
          onCreated={loadStories}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  listContent: {
    padding: Spacing.md,
  },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },

  emptyTitle: { ...Typography.h2, textAlign: 'center' },
  emptySubtitle: { ...Typography.body, textAlign: 'center' },
  exploreLink: {
    ...Typography.body,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  retryBtn: {
    backgroundColor: '#12A5A1',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 9999,
  },
  retryText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
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
  composerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  composerPlaceholder: {
    ...Typography.body,
    fontSize: 14,
  },
  skeleton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
  skelMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginTop: 12,
  },
});
