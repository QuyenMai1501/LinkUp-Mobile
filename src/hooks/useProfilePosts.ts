import { useCallback, useEffect, useRef, useState } from 'react';

import { getUserPosts, reactPost, savePost, getEmojis } from '@/api/posts';
import type { FeedPost } from '@/types/post';

export function useProfilePosts(userId: string | null) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const likeEmojiRef = useRef<string | null>(null);

  const fetchPosts = useCallback(async (reset = false) => {
    if (!userId || loadingRef.current) return;
    loadingRef.current = true;
    setPostsLoading(true);
    setPostsError(null);

    try {
      const cursor = reset ? null : cursorRef.current;
      const res = await getUserPosts(userId, cursor);
      cursorRef.current = res.next_cursor;
      setHasMore(res.next_cursor !== null);
      setPosts((prev) => (reset ? res.data : [...prev, ...res.data]));
    } catch (err: any) {
      setPostsError(err?.message || 'Failed to load posts');
    } finally {
      setPostsLoading(false);
      loadingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    cursorRef.current = null;
    likeEmojiRef.current = null;
    fetchPosts(true);
  }, [userId, fetchPosts]);

  useEffect(() => {
    getEmojis()
      .then((res) => {
        const like = res.data.find((e) => e.code === ':like:');
        if (like) likeEmojiRef.current = like.id;
      })
      .catch(() => {});
  }, []);

  const handleLike = useCallback(async (postId: string) => {
    const emojiId = likeEmojiRef.current;
    if (!emojiId) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
          : p,
      ),
    );

    try {
      await reactPost(postId, emojiId);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
            : p,
        ),
      );
    }
  }, []);

  const handleSavePost = useCallback(async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, is_saved: !p.is_saved } : p,
      ),
    );

    try {
      const res = await savePost(postId);
      if (res.action === 'removed') {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, is_saved: !p.is_saved } : p,
        ),
      );
    }
  }, []);

  const fetchMore = useCallback(() => {
    if (hasMore && !loadingRef.current) {
      fetchPosts(false);
    }
  }, [hasMore, fetchPosts]);

  return {
    posts,
    setPosts,
    postsLoading,
    postsError,
    hasMore,
    selectedPostId,
    setSelectedPostId,
    handleLike,
    handleSavePost,
    fetchMore,
  };
}
