import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { Colors } from '@/constants/colors';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/contexts/theme-context';
import { useTranslation } from '@/hooks/useTranslation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PostCard from './post-card';
import MediaViewer from './media-viewer';
import CommentSheet from './comment-sheet';
import { getFeedPosts, reactPost, savePost, getEmojis } from '../api/posts';
import type { FeedPost, EmojiItem } from '../types/post';

const INITIAL_PAGE_SIZE = 2;
const PAGE_SIZE = 10;

// Module-level cache: feed posts keyed by ID, for passing to detail screen
export const feedPostCache = new Map<string, FeedPost>();

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
  return (
    <ThemedView style={styles.skeleton}>
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
    </ThemedView>
  );
}

interface FeedProps {
  onPostPress?: (postId: string) => void;
  onOpenComposer?: () => void;
}

export default function Feed({ onPostPress, onOpenComposer }: FeedProps) {
  const theme = useTheme();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { t } = useTranslation();
  const [posts, setPosts] = useState<FeedPost[]>([]);
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

  const fetchNext = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const isFirst = cursorRef.current === null;
    try {
      const res = await getFeedPosts(cursorRef.current, isFirst ? INITIAL_PAGE_SIZE : PAGE_SIZE);
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
  }, [t]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  const handleRefresh = useCallback(async () => {
    cursorRef.current = null;
    setError(null);
    await fetchNext();
  }, [fetchNext]);

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

  const handleEndReached = () => {
    if (hasMore && !loadingRef.current) {
      fetchNext();
    }
  };

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
      setCommentSheetPost(mediaModalPost);
      setCommentSheetVisible(true);
    }
  }, [mediaModalPost]);

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
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={onPostPress}
            onLike={handleLike}
            onSave={handleSave}
            onMediaPress={(index) => handleOpenMedia(item, index)}
            onCommentPress={() => handleOpenComments(item)}
            onSharePress={() => handleOpenComments(item)}
          />
        )}
        ListHeaderComponent={
          <Pressable
            style={[styles.composerTrigger, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onOpenComposer}>
            <ThemedText themeColor="textSecondary" style={styles.composerPlaceholder}>
              {t('composer.placeholder')}
            </ThemedText>
          </Pressable>
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={1}
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
              <Icon name="newspaper" size={48} />
              <ThemedText style={styles.emptyTitle}>{t('feed.emptyTitle')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                {t('feed.emptySubtitle')}
              </ThemedText>
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
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
