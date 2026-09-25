import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { RichContent } from '@/components/rich-content';
import { getEmojiTextMap } from '@/utils/emojis';
import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommentItem as CommentItemType } from '../types/post';

const EMOJI_MAP = getEmojiTextMap();

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays <= 7) return `${diffDays} ngày`;

  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface CommentNode {
  comment: CommentItemType;
  replies: CommentNode[];
}

export function buildCommentTree(comments: CommentItemType[], sort: string): CommentNode[] {
  const byId = new Map<string, CommentItemType>(comments.map((c) => [c.id, c]));

  const rootOf = (id: string): string => {
    const visited = new Set<string>();
    let currentId = id;
    while (currentId && byId.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const parentId = byId.get(currentId)!.parent_id;
      if (!parentId || !byId.has(parentId)) return currentId;
      currentId = parentId;
    }
    return currentId;
  };

  const nodes = new Map<string, CommentNode>();
  for (const c of comments) nodes.set(c.id, { comment: c, replies: [] });

  const roots: CommentNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    const rootId = c.parent_id ? rootOf(c.id) : c.id;
    if (rootId !== c.id) {
      nodes.get(rootId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  if (sort === 'newest') {
    roots.sort(
      (a, b) => new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime(),
    );
  } else if (sort === 'oldest') {
    roots.sort(
      (a, b) => new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime(),
    );
  }

  for (const root of roots) {
    root.replies.sort(
      (a, b) => new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime(),
    );
  }

  return roots;
}

interface CommentItemProps {
  node: CommentNode;
  postUserId: string;
  allComments: CommentItemType[];
  onLike: (commentId: string) => void;
  onReply: (comment: CommentItemType) => void;
  depth?: number;
}

export default function CommentItem({
  node,
  postUserId,
  allComments,
  onLike,
  onReply,
  depth = 0,
}: CommentItemProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { comment } = node;

  const parentComment = comment.parent_id
    ? allComments.find((x) => x.id === comment.parent_id)
    : null;

  return (
    <View style={[styles.container, depth > 0 && styles.replyContainer]}>
      <View style={styles.row}>
        <View style={styles.avatarContainer}>
          {comment.avatar_uri ? (
            <Image source={{ uri: comment.avatar_uri }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.bgSecondary }]}>
              <ThemedText style={styles.avatarInitial}>
                {comment.display_name?.charAt(0)?.toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}
        </View>
        <View style={styles.contentCol}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.authorName}>{comment.display_name}</ThemedText>
            {postUserId === comment.user_id && (
              <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
                <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                  {t('postDetail.postAuthorBadge')}
                </ThemedText>
              </View>
            )}
            <ThemedText themeColor="textSecondary" style={styles.time}>
              {formatRelativeTime(comment.created_at)}
            </ThemedText>
          </View>
          {parentComment && (
            <ThemedText style={[styles.mention, { color: theme.primary }]}>
              @{parentComment.display_name}{' '}
            </ThemedText>
          )}
          <RichContent content={comment.content} emojiMap={EMOJI_MAP} style={styles.content} />
          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => onLike(comment.id)}>
              {comment.is_liked ? (
                <Icon name="heartFilled" size={14} color="#E53935" />
              ) : (
                <Icon name="heart" size={14} />
              )}
              {comment.likes_count > 0 && (
                <ThemedText themeColor="textSecondary" style={styles.actionCount}>
                  {comment.likes_count}
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => onReply(comment)}>
              <ThemedText themeColor="textSecondary" style={styles.replyBtnText}>
                {t('postDetail.reply')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
      {node.replies.length > 0 && (
        <View style={styles.replies}>
          {node.replies.map((reply) => (
            <CommentItem
              key={reply.comment.id}
              node={reply}
              postUserId={postUserId}
              allComments={allComments}
              onLike={onLike}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  replyContainer: {
    marginLeft: 36,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  contentCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  mention: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 12,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  replies: {
    marginTop: Spacing.xs,
  },
});
