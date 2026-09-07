import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import VideoPlayer from './video-player';
import type { FeedPost, FeedMedia } from '../types/post';

const CONTENT_TRUNCATE_LENGTH = 200;

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays <= 7) return `${diffDays} ngày`;

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

function MediaGrid({ media }: { media: FeedMedia[] }) {
  if (media.length === 0) return null;

  const count = Math.min(media.length, 4);

  return (
    <View style={styles.mediaGrid}>
      {media.slice(0, 4).map((m, idx) => (
        <View
          key={m.id}
          style={[
            styles.mediaItem,
            count === 1 && styles.mediaSingle,
            count === 2 && styles.mediaHalf,
            count === 3 && idx === 0 && styles.mediaHalf,
            count === 3 && idx > 0 && styles.mediaHalf,
            count === 4 && styles.mediaQuarter,
          ]}>
          {isVideo(m.file_type) ? (
            <VideoPlayer uri={m.file_uri} />
          ) : (
            <Image
              source={{ uri: m.file_uri }}
              style={styles.mediaImage}
              contentFit="cover"
            />
          )}
        </View>
      ))}
    </View>
  );
}

interface PostCardProps {
  post: FeedPost;
  onLike?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onComment?: (postId: string) => void;
}

export default function PostCard({ post, onLike, onSave, onComment }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);

  const needsTruncation = post.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent =
    needsTruncation && !expanded
      ? post.content.slice(0, CONTENT_TRUNCATE_LENGTH) + '...'
      : post.content;

  return (
    <ThemedView style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
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
          <ThemedText style={styles.displayName}>{post.display_name}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.usernameTime}>
            @{post.username} · {formatRelativeTime(post.created_at)}
          </ThemedText>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {post.title ? <ThemedText style={styles.title}>{post.title}</ThemedText> : null}
        {post.content ? (
          <View>
            <ThemedText style={styles.content}>{displayContent}</ThemedText>
            {needsTruncation && (
              <Pressable onPress={() => setExpanded((v) => !v)}>
                <ThemedText style={styles.toggleBtn}>
                  {expanded ? 'Thu gọn' : 'Xem thêm'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      {/* Media */}
      {!post.shared_from_post_id && <MediaGrid media={post.media} />}

      {/* Action bar */}
      <View style={styles.actionBar}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => onLike?.(post.id)}>
          <ThemedText style={[styles.actionIcon, post.is_liked && { color: '#E53935' }]}>
            {post.is_liked ? '❤️' : '🤍'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.actionCount}>
            {formatCount(post.likes_count)}
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => onComment?.(post.id)}>
          <ThemedText style={styles.actionIcon}>💬</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.actionCount}>
            {formatCount(post.comments_count)}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.actionBtn}>
          <ThemedText style={styles.actionIcon}>↗️</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.actionCount}>
            {formatCount(post.shares_count)}
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => onSave?.(post.id)}>
          <ThemedText style={[styles.actionIcon, post.is_saved && { color: '#FBBC04' }]}>
            {post.is_saved ? '🔖' : '📑'}
          </ThemedText>
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
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 2,
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
  actionIcon: {
    fontSize: 16,
  },
  actionCount: {
    fontSize: 12,
  },
});
