import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import CommentItem, { buildCommentTree } from '@/components/comment-item';
import CommentInput from '@/components/comment-input';
import VideoPlayer from '@/components/video-player';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getPostDetail,
  getComments,
  createComment,
  reactPost,
  toggleCommentReaction,
  savePost,
  sharePost,
  deletePost,
  getEmojis,
} from '../api/posts';
import type { FeedPost, CommentItem as CommentItemType, EmojiItem, CommentSort } from '../types/post';

const COMMENT_PAGE_SIZE = 10;

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

interface PostDetailProps {
  postId: string;
  postData?: FeedPost;
  onBack?: () => void;
  onDeleted?: () => void;
}

export default function PostDetail({ postId, postData, onBack, onDeleted }: PostDetailProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [post, setPost] = useState<FeedPost | null>(postData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItemType | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>('newest');
  const [mediaIndex, setMediaIndex] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const commentsLenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    getPostDetail(postId)
      .then((postRes) => {
        if (cancelled) return;
        const detail = postRes.data;
        setPost((prev) => ({
          ...detail,
          avatar_uri: detail.avatar_uri || prev?.avatar_uri || '',
          display_name: detail.display_name || prev?.display_name || '',
          username: detail.username || prev?.username || '',
          is_liked: prev?.is_liked ?? detail.is_liked,
          is_saved: prev?.is_saved ?? detail.is_saved,
          is_shared: prev?.is_shared ?? detail.is_shared,
          is_following: prev?.is_following ?? detail.is_following,
        }));
        return getComments(postId, 1, COMMENT_PAGE_SIZE, 'newest');
      })
      .then((commentsRes) => {
        if (cancelled || !commentsRes) return;
        setComments(commentsRes.data);
        setCommentTotal(commentsRes.total);
        commentsLenRef.current = commentsRes.data.length;
        hasMoreRef.current = commentsRes.data.length < commentsRes.total;
      })
      .catch(() => {
        if (!cancelled) setError('Không thể tải bài viết.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [postId]);

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
        setCommentTotal(res.total);
        hasMoreRef.current = commentsLenRef.current < res.total;
      }
    } catch {
      // keep existing list
    } finally {
      loadingMoreRef.current = false;
      setCommentsLoading(false);
    }
  }, [commentPage, postId, commentSort]);

  const handleSortChange = useCallback(
    (sort: CommentSort) => {
      setCommentSort(sort);
      setComments([]);
      setCommentPage(1);
      setCommentsLoading(true);
      hasMoreRef.current = true;
      loadingMoreRef.current = false;
      commentsLenRef.current = 0;
      getComments(postId, 1, COMMENT_PAGE_SIZE, sort)
        .then((res) => {
          setComments(res.data);
          setCommentTotal(res.total);
          commentsLenRef.current = res.data.length;
          hasMoreRef.current = res.data.length < res.total;
        })
        .catch(() => {})
        .finally(() => setCommentsLoading(false));
    },
    [postId],
  );

  const handleLike = async () => {
    if (!post) return;
    const emojiId = await ensureLikeEmojiId();
    if (!emojiId) return;
    const prev = post;
    const next = {
      ...post,
      is_liked: !post.is_liked,
      likes_count: post.likes_count + (post.is_liked ? -1 : 1),
    };
    setPost(next);
    try {
      await reactPost(post.id, emojiId);
    } catch {
      setPost(prev);
    }
  };

  const handleSave = async () => {
    if (!post) return;
    const prev = post;
    const next = { ...post, is_saved: !post.is_saved };
    setPost(next);
    try {
      await savePost(post.id);
    } catch {
      setPost(prev);
    }
  };

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!currentUserId) return;
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
    [currentUserId],
  );

  const handleSubmitComment = async () => {
    const content = commentText.trim();
    if (!content || !post || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await createComment(post.id, content, replyingTo?.id);
      setComments(res.data);
      setCommentTotal(res.data.length);
      setCommentPage(1);
      commentsLenRef.current = res.data.length;
      hasMoreRef.current = false;
      setCommentText('');
      setReplyingTo(null);
      setPost((prev) => (prev ? { ...prev, comments_count: res.data.length } : prev));
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await sharePost(post.id);
      setPost((prev) =>
        prev
          ? { ...prev, shares_count: prev.shares_count + 1, is_shared: true }
          : prev,
      );
      Alert.alert(t('postDetail.shared'));
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
    }
  };

  const handleDelete = () => {
    if (!post) return;
    Alert.alert(
      t('postDetail.delete'),
      t('postDetail.deleteConfirm'),
      [
        { text: t('postDetail.cancel'), style: 'cancel' },
        {
          text: t('postDetail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              Alert.alert(t('postDetail.deleted'));
              onDeleted?.();
              onBack?.();
            } catch {
              Alert.alert(t('common.error'), t('common.error'));
            }
          },
        },
      ],
    );
  };

  const handleReply = (comment: CommentItemType) => {
    setReplyingTo((cur) => (cur?.id === comment.id ? null : comment));
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <Icon name="hourglass" size={32} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (error || !post) {
    return (
      <ThemedView style={styles.center}>
        <Icon name="warning" size={32} color="#FB8C00" />
        <ThemedText themeColor="textSecondary">{error ?? t('common.error')}</ThemedText>
        <Pressable onPress={onBack} style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.retryText}>{t('common.back')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const isOwner = currentUserId !== null && post.user_id === currentUserId;
  const commentTree = buildCommentTree(comments, commentSort);
  const sharedPost = post.shared_from_post_id ? post.shared_post : undefined;
  const isRepost = Boolean(sharedPost);
  const mediaList = (isRepost && sharedPost ? sharedPost.media : post.media) ?? [];
  const hasMedia = mediaList.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <ThemedView style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Icon name="close" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('postDetail.title')}</ThemedText>
          {isOwner && (
            <Pressable onPress={handleDelete} style={styles.backBtn}>
              <Icon name="trash" size={20} color="#E53935" />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <FlatList
          ref={flatListRef}
          data={commentTree}
          keyExtractor={(item) => item.comment.id}
          style={styles.flexList}
          renderItem={({ item }) => (
            <CommentItem
              node={item}
              postUserId={post.user_id}
              allComments={comments}
              onLike={handleToggleCommentLike}
              onReply={handleReply}
            />
          )}
          ListHeaderComponent={
            <View>
              {/* Author */}
              <View style={styles.authorRow}>
                <View style={styles.avatarContainer}>
                  {post.avatar_uri ? (
                    <Image source={{ uri: post.avatar_uri }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.bgSecondary }]}>
                      <ThemedText style={styles.avatarInitial}>
                        {post.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.authorMeta}>
                  <ThemedText style={styles.displayName}>
                    {post.display_name}
                    {isRepost ? ` · ${t('post.sharedPost')}` : ''}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.usernameTime}>
                    @{post.username} · {formatRelativeTime(post.created_at)}
                  </ThemedText>
                </View>
              </View>

              {/* Media carousel */}
              {hasMedia && (
                <View style={styles.mediaSection}>
                  <FlatList
                    data={mediaList}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                      setMediaIndex(idx);
                    }}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: m }) => (
                      <View style={styles.mediaItem}>
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
                  {mediaList.length > 1 && (
                    <View style={[styles.mediaCounter, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                      <ThemedText style={styles.mediaCounterText}>
                        {mediaIndex + 1} / {mediaList.length}
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {/* Title + Content / Repost embed */}
              <View style={styles.body}>
                {isRepost && sharedPost ? (
                  <View>
                    {post.share_content ? (
                      <ThemedText style={styles.content}>{post.share_content}</ThemedText>
                    ) : null}
                    <View style={[styles.embeddedPost, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}>
                      <View style={styles.embeddedAuthor}>
                        <View style={styles.embeddedAvatar}>
                          {sharedPost.avatar_uri ? (
                            <Image source={{ uri: sharedPost.avatar_uri }} style={styles.embeddedAvatarImg} />
                          ) : (
                            <ThemedText style={styles.embeddedAvatarInitial}>
                              {sharedPost.display_name?.charAt(0)?.toUpperCase() || '?'}
                            </ThemedText>
                          )}
                        </View>
                        <View style={styles.embeddedAuthorMeta}>
                          <ThemedText style={styles.embeddedName}>{sharedPost.display_name}</ThemedText>
                          <ThemedText themeColor="textSecondary" style={styles.embeddedUsername}>
                            @{sharedPost.username}
                          </ThemedText>
                        </View>
                      </View>
                      {sharedPost.title ? (
                        <ThemedText style={styles.embeddedTitle}>{sharedPost.title}</ThemedText>
                      ) : null}
                      {sharedPost.content ? (
                        <ThemedText style={styles.embeddedContent}>{sharedPost.content}</ThemedText>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <>
                    {post.title ? <ThemedText style={styles.title}>{post.title}</ThemedText> : null}
                    {post.content ? (
                      <ThemedText style={styles.content}>{post.content}</ThemedText>
                    ) : null}
                  </>
                )}
              </View>

              {/* Stats */}
              <View style={[styles.stats, { borderTopColor: theme.border }]}>
                <ThemedText themeColor="textSecondary" style={styles.statsText}>
                  {t('postDetail.viewCount', { count: formatCount(post.views_count) })}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statsText}>
                  {t('postDetail.commentCount', { count: formatCount(post.comments_count) })}
                </ThemedText>
              </View>

              {/* Action bar */}
              <View style={[styles.actionBar, { borderTopColor: theme.border }]}>
              <Pressable style={styles.actionBtn} onPress={handleLike}>
                <Icon name={post.is_liked ? 'heartFilled' : 'heart'} size={18} color={post.is_liked ? '#E53935' : undefined} />
                <ThemedText themeColor="textSecondary" style={styles.actionCount}>
                  {formatCount(post.likes_count)}
                </ThemedText>
              </Pressable>

              <Pressable style={styles.actionBtn}>
                <Icon name="chat" size={18} />
                <ThemedText themeColor="textSecondary" style={styles.actionCount}>
                  {formatCount(post.comments_count)}
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionBtn}
                onPress={handleShare}
                disabled={isOwner || post.is_shared}>
                <Icon name="share" size={18} color={(isOwner || post.is_shared) ? '#00000040' : undefined} />
                <ThemedText themeColor="textSecondary" style={styles.actionCount}>
                  {formatCount(post.shares_count)}
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionBtn}
                onPress={handleSave}
                disabled={isOwner}>
                <Icon name={post.is_saved ? 'bookmarkFilled' : 'bookmark'} size={18} color={post.is_saved ? '#FBBC04' : isOwner ? '#00000040' : undefined} />
              </Pressable>
              </View>

              {/* Comment sort */}
              <View style={[styles.sortBar, { borderTopColor: theme.border }]}>
                <ThemedText themeColor="textSecondary" style={styles.sortLabel}>
                  {t('postDetail.comments')}
                </ThemedText>
                <View style={styles.sortButtons}>
                  {(['newest', 'oldest', 'relevant'] as CommentSort[]).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => handleSortChange(s)}
                      style={[
                        styles.sortBtn,
                        commentSort === s && { backgroundColor: theme.bgSecondary },
                      ]}>
                      <ThemedText
                        style={[
                          styles.sortBtnText,
                          { color: commentSort === s ? theme.text : theme.textSecondary },
                          commentSort === s && { fontWeight: '600' },
                        ]}>
                        {s === 'newest'
                          ? t('postDetail.sortNewest')
                          : s === 'oldest'
                            ? t('postDetail.sortOldest')
                            : t('postDetail.sortRelevant')}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Empty comments */}
              {comments.length === 0 && !commentsLoading && (
                <ThemedText themeColor="textSecondary" style={styles.noComments}>
                  {t('postDetail.noComments')}
                </ThemedText>
              )}
            </View>
          }
          ListFooterComponent={
            <View>
              {comments.length > 0 && comments.length < commentTotal && !commentsLoading && (
                <Pressable onPress={loadMoreComments} style={styles.loadMoreBtn}>
                  <ThemedText style={[styles.loadMoreText, { color: theme.primary }]}>
                    {t('postDetail.loadMore')}
                  </ThemedText>
                </Pressable>
              )}
              {commentsLoading && comments.length < commentTotal && (
                <View style={styles.loadingMore}>
                  <Icon name="hourglass" size={16} color={theme.textSecondary} />
                </View>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
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
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexList: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  loadingIcon: { fontSize: 32 },
  retryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
  },
  retryText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 17,
    flex: 1,
    textAlign: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  authorMeta: {
    flex: 1,
  },
  displayName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  usernameTime: {
    fontSize: 12,
  },
  mediaSection: {
    position: 'relative',
    backgroundColor: '#000',
  },
  mediaItem: {
    width: undefined,
    aspectRatio: 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaCounter: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    fontSize: 17,
    marginBottom: Spacing.xs,
  },
  content: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  embeddedPost: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  embeddedAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  embeddedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embeddedAvatarImg: {
    width: 28,
    height: 28,
  },
  embeddedAvatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  embeddedAuthorMeta: {
    flex: 1,
  },
  embeddedName: {
    fontSize: 13,
    fontWeight: '600',
  },
  embeddedUsername: {
    fontSize: 11,
  },
  embeddedTitle: {
    ...Typography.h2,
    fontSize: 14,
    marginBottom: 2,
  },
  embeddedContent: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statsText: {
    fontSize: 13,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionCount: {
    fontSize: 12,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sortLabel: {
    fontSize: 13,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  sortBtnText: {
    fontSize: 12,
  },
  noComments: {
    padding: Spacing.md,
    textAlign: 'center',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: Spacing.md,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingMore: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
