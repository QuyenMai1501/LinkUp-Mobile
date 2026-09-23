import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import VideoPlayer from './video-player';
import type { FeedPost, FeedMedia } from '../types/post';

const CONTENT_TRUNCATE_LENGTH = 200;

function formatRelativeTime(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('notifications.time.justNow');
  if (diffMins < 60) return t('notifications.time.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('notifications.time.hoursAgo', { count: diffHours });
  if (diffDays <= 7) return t('notifications.time.daysAgo', { count: diffDays });

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

interface MediaGridProps {
  media: FeedMedia[];
  onPress?: (index: number) => void;
  embedded?: boolean;
}

function MediaGrid({ media, onPress, embedded }: MediaGridProps) {
  if (media.length === 0) return null;

  const count = Math.min(media.length, 4);

  return (
    <View style={[styles.mediaGrid, embedded && styles.mediaGridEmbedded]}>
      {media.slice(0, 4).map((m, idx) => (
        <Pressable
          key={m.id}
          onPress={() => onPress?.(idx)}
          style={[
            styles.mediaItem,
            count === 1 && styles.mediaSingle,
            count === 2 && styles.mediaHalf,
            count === 3 && idx === 0 && styles.mediaHalf,
            count === 3 && idx > 0 && styles.mediaHalf,
            count === 4 && styles.mediaQuarter,
          ]}>
          {isVideo(m.file_type) ? (
            <VideoPlayer uri={m.file_uri} interactive={false} />
          ) : (
            <Image
              source={{ uri: m.file_uri }}
              style={styles.mediaImage}
              contentFit="cover"
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

interface PostCardProps {
  post: FeedPost;
  onPress?: (postId: string) => void;
  onContentPress?: () => void;
  onMediaPress?: (index: number, targetPost?: FeedPost) => void;
  onLike?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onCommentPress?: () => void;
  onSharePress?: () => void;
}

export default function PostCard({
  post,
  onPress,
  onContentPress,
  onMediaPress,
  onLike,
  onSave,
  onCommentPress,
  onSharePress,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = user?.id != null && post.user_id === user.id;
  const sharedPost = post.shared_from_post_id ? post.shared_post : undefined;
  const isRepost = Boolean(sharedPost);

  const needsTruncation = post.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent =
    needsTruncation && !expanded
      ? post.content.slice(0, CONTENT_TRUNCATE_LENGTH) + '...'
      : post.content;

  const sharedContent = sharedPost?.content ?? '';
  const sharedNeedsTruncation = sharedContent.length > CONTENT_TRUNCATE_LENGTH;
  const displaySharedContent = sharedNeedsTruncation
    ? sharedContent.slice(0, CONTENT_TRUNCATE_LENGTH) + '...'
    : sharedContent;

  const handleContentPress = () => {
    if (isRepost) {
      onContentPress?.();
      return;
    }
    if (needsTruncation) {
      setExpanded((v) => !v);
    }
    onContentPress?.();
  };

  return (
    <ThemedView style={styles.card}>
      {/* Zone 1: Header — navigate to post detail */}
      <Pressable style={styles.header} onPress={() => onPress?.(post.id)}>
        <View style={styles.avatarContainer}>
          {post.avatar_uri ? (
            <Image source={{ uri: post.avatar_uri }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
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
            @{post.username} · {formatRelativeTime(post.created_at, t)}
          </ThemedText>
        </View>
      </Pressable>

      {/* Zone 2: Content — normal post or repost embed */}
      <Pressable style={styles.body} onPress={handleContentPress}>
        {isRepost && sharedPost ? (
          <View>
            {post.share_content ? (
              <ThemedText style={styles.shareContent}>{post.share_content}</ThemedText>
            ) : null}
            <View style={styles.embeddedPost}>
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
              {displaySharedContent ? (
                <ThemedText style={styles.embeddedContent}>{displaySharedContent}</ThemedText>
              ) : null}
              <MediaGrid
                media={sharedPost.media}
                embedded
                onPress={(index) => onMediaPress?.(index, sharedPost)}
              />
            </View>
          </View>
        ) : (
          <>
            {post.title ? <ThemedText style={styles.title}>{post.title}</ThemedText> : null}
            {post.content ? (
              <View>
                <ThemedText style={styles.content}>{displayContent}</ThemedText>
                {needsTruncation && (
                  <ThemedText style={styles.toggleBtn}>
                    {expanded ? t('post.collapse') : t('post.readMore')}
                  </ThemedText>
                )}
              </View>
            ) : null}
          </>
        )}
      </Pressable>

      {/* Zone 3: Media — outer media only for non-reposts (repost media is embedded above) */}
      {!isRepost && (
        <MediaGrid media={post.media} onPress={(index) => onMediaPress?.(index, post)} />
      )}

      {/* Zone 4: Action bar */}
      <View style={styles.actionBar}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => onLike?.(post.id)}>
          <Icon name={post.is_liked ? 'heartFilled' : 'heart'} size={18} color={post.is_liked ? '#E53935' : undefined} />
          <ThemedText themeColor="textSecondary" style={styles.actionCount}>
            {formatCount(post.likes_count)}
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={onCommentPress}>
          <Icon name="chat" size={18} />
          <ThemedText themeColor="textSecondary" style={styles.actionCount}>
            {formatCount(post.comments_count)}
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={onSharePress}
          disabled={isOwner || post.is_shared}>
          <Icon name="share" size={18} color={isOwner || post.is_shared ? '#00000040' : undefined} />
          <ThemedText themeColor="textSecondary" style={styles.actionCount}>
            {formatCount(post.shares_count)}
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => onSave?.(post.id)}
          disabled={isOwner}>
          <Icon name={post.is_saved ? 'bookmarkFilled' : 'bookmark'} size={18} color={post.is_saved ? '#FBBC04' : isOwner ? '#00000040' : undefined} />
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: 0,
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
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666666',
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
  body: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  content: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  toggleBtn: {
    color: '#12A5A1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  shareContent: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  embeddedPost: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
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
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  mediaGridEmbedded: {
    paddingHorizontal: 0,
    marginTop: Spacing.xs,
  },
  mediaItem: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  mediaSingle: {
    width: '100%',
    height: 200,
  },
  mediaHalf: {
    width: '49.5%',
    height: 160,
  },
  mediaQuarter: {
    width: '49.5%',
    height: 120,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  actionCount: {
    fontSize: 12,
  },
});
