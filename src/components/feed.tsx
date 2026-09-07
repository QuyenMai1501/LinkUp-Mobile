import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import PostCard from './post-card';
import { getFeedPosts, reactPost, savePost, getEmojis } from '../api/posts';
import type { FeedPost, EmojiItem } from '../types/post';

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

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const fetchNext = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const isFirst = cursorRef.current === null;
    try {
      const res = await getFeedPosts(cursorRef.current, PAGE_SIZE);
      setPosts((prev) => {
        const list = isFirst ? res.data : [...prev, ...res.data];
        const seen = new Set<string>();
        return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      });
      cursorRef.current = res.next_cursor;
      setHasMore(res.next_cursor !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
      setInitialLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  const handleLike = async (postId: string) => {
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
  };

  const handleSave = async (postId: string) => {
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
  };

  const handleEndReached = () => {
    if (hasMore && !loadingRef.current) {
      fetchNext();
    }
  };

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
        <ThemedText style={styles.emptyIcon}>⚠️</ThemedText>
        <ThemedText style={styles.emptyTitle}>{error}</ThemedText>
        <Pressable
          onPress={() => {
            cursorRef.current = null;
            fetchNext();
          }}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}>
          <ThemedText style={styles.retryText}>Thử lại</ThemedText>
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
          onLike={handleLike}
          onSave={handleSave}
          onComment={() => {}}
        />
      )}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loading && !initialLoading ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" />
            <ThemedText themeColor="textSecondary" style={styles.loadingText}>
              Đang tải...
            </ThemedText>
          </View>
        ) : !hasMore && posts.length > 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.endMessage}>
            Đã xem hết bài viết.
          </ThemedText>
        ) : null
      }
      ListEmptyComponent={
        !initialLoading && !error ? (
          <View style={styles.centerContent}>
            <ThemedText style={styles.emptyIcon}>📰</ThemedText>
            <ThemedText style={styles.emptyTitle}>Chưa có bài viết nào</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Hãy kết bạn và theo dõi mọi người để xem bài viết.
            </ThemedText>
          </View>
        ) : null
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
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
  emptyIcon: { fontSize: 48 },
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
