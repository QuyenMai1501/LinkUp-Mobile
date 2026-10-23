import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { RichContent } from '@/components/rich-content';
import { MenuSheet, type MenuItem } from '@/components/menu-sheet';
import ReportSheet from '@/components/report-sheet';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { getEmojiTextMap } from '@/utils/emojis';
import { navigateToProfile } from '@/utils/profile-nav';
import { separateGiphyUrls } from '@/api/giphy';
import VideoPlayer from './video-player';
import type { IconName } from '@/constants/icon-map';
import type { FeedPost, FeedMedia } from '../types/post';

const CONTENT_TRUNCATE_LENGTH = 200;
const EMOJI_MAP = getEmojiTextMap();

const PRIVACY_ICONS: Record<string, IconName | undefined> = {
  public: 'globe',
  friend: 'people',
  private: 'lock',
};

const PRIVACY_LABELS: Record<string, string | undefined> = {
  public: 'post.privacyPublic',
  friend: 'post.privacyFriend',
  private: 'post.privacyPrivate',
};

/** Cắt nội dung dài, không cắt giữa URL (URL GIPHY bị cắt dở sẽ hỏng ảnh). */
function truncateAvoidingUrl(content: string, max: number): string {
  if (content.length <= max) return content;
  const cut = content.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const tail = lastSpace === -1 ? cut : cut.slice(lastSpace + 1);
  if (tail.includes('://')) {
    return (lastSpace === -1 ? '' : cut.slice(0, lastSpace + 1)) + '...';
  }
  return cut + '...';
}

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
          {/* +N overlay trên ô cuối khi media > 4 (mirror Web MediaGrid) */}
          {idx === 3 && media.length > 4 && (
            <View style={styles.mediaMoreOverlay} pointerEvents="none">
              <ThemedText style={styles.mediaMoreText}>+{media.length - 4}</ThemedText>
            </View>
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
  onFollow?: (userId: string) => void;
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
  onFollow,
  onCommentPress,
  onSharePress,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reporting, setReporting] = useState(false);
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.id != null && post.user_id === user.id;
  const sharedPost = post.shared_from_post_id ? post.shared_post : undefined;
  const isRepost = Boolean(sharedPost);
  const privacyIcon = PRIVACY_ICONS[post.status];
  const privacyLabelKey = PRIVACY_LABELS[post.status];

  // Double-tap media để thích (mirror Web PostCard handleMediaClick) + tim burst
  const [burst, setBurst] = useState(false);
  const burstAnim = useMemo(() => new Animated.Value(0), []);
  const lastTapRef = useRef(0);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, []);

  const openHashtag = (tag: string) => {
    (router as any).push(`/(drawer)/search?q=${encodeURIComponent('#' + tag)}`);
  };

  const triggerBurst = () => {
    setBurst(true);
    burstAnim.setValue(0.3);
    Animated.spring(burstAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setBurst(false), 600);
  };

  const handleMediaPress = (index: number, targetPost?: FeedPost) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
      onLike?.(post.id);
      triggerBurst();
      return;
    }
    lastTapRef.current = now;
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null;
      onMediaPress?.(index, targetPost);
    }, 280);
  };

  const menuItems: MenuItem[] = [
    {
      key: 'report',
      label: t('report.menuReport'),
      icon: 'flag',
      onPress: () => setReporting(true),
    },
  ];

  // Tách URL GIPHY dính nhau TRƯỚC khi cắt — chuỗi liền mạch không có space
  // sẽ bị truncateAvoidingUrl trả về '...' (mất trắng nội dung).
  const repairedContent = separateGiphyUrls(post.content);
  const needsTruncation = repairedContent.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent =
    needsTruncation && !expanded
      ? truncateAvoidingUrl(repairedContent, CONTENT_TRUNCATE_LENGTH)
      : repairedContent;

  const sharedContent = separateGiphyUrls(sharedPost?.content ?? '');
  const sharedNeedsTruncation = sharedContent.length > CONTENT_TRUNCATE_LENGTH;
  const displaySharedContent = sharedNeedsTruncation
    ? truncateAvoidingUrl(sharedContent, CONTENT_TRUNCATE_LENGTH)
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
    <>
    <ThemedView style={styles.card}>
      {/* Zone 1: Header — avatar → hồ sơ; tên/giờ/nền → chi tiết bài */}
      <Pressable style={styles.header} onPress={() => onPress?.(post.id)}>
        <Pressable
          hitSlop={8}
          onPress={() => navigateToProfile(router, post.user_id)}>
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
        </Pressable>
        <View style={styles.authorMeta}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.displayName}>
              {post.display_name}
              {isRepost ? ` · ${t('post.sharedPost')}` : ''}
            </ThemedText>
            {post.is_pinned && (
              <View style={styles.pinBadge}>
                <Icon name="pin" size={11} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.pinBadgeText}>
                  {t('post.pinned')}
                </ThemedText>
              </View>
            )}
            {/* Follow badge/button — chỉ khi parent truyền onFollow (mirror Web PostCard:325-338) */}
            {!isOwner && onFollow &&
              (post.is_following ? (
                <View style={[styles.followBadge, styles.followingBadge, { borderColor: theme.border }]}>
                  <ThemedText style={[styles.followBadgeText, { color: theme.textSecondary }]}>
                    {t('post.following')}
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.followBadge,
                    { borderColor: theme.primary },
                    pressed && { backgroundColor: theme.primaryLight },
                  ]}
                  onPress={() => onFollow(post.user_id)}>
                  <ThemedText style={[styles.followBadgeText, { color: theme.primary }]}>
                    {t('post.follow')}
                  </ThemedText>
                </Pressable>
              ))}
          </View>
          <View style={styles.metaRow}>
            <ThemedText themeColor="textSecondary" style={styles.usernameTime}>
              @{post.username} · {formatRelativeTime(post.created_at, t)}
            </ThemedText>
            {privacyIcon && privacyLabelKey ? (
              <View accessibilityLabel={t(privacyLabelKey)} accessibilityRole="image">
                <Icon name={privacyIcon} size={12} color={theme.textSecondary} />
              </View>
            ) : null}
          </View>
        </View>
        {!isOwner && (
          <Pressable
            hitSlop={8}
            accessibilityLabel={t('report.menuReport')}
            onPress={() => setMenuVisible(true)}>
            <Icon name="more" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </Pressable>

      {/* Zone 2: Content — normal post or repost embed */}
      <Pressable style={styles.body} onPress={handleContentPress}>
        {isRepost && sharedPost ? (
          <View>
            {post.share_content ? (
              <RichContent content={post.share_content} emojiMap={EMOJI_MAP} style={styles.shareContent} onHashtagPress={openHashtag} hashtagStyle={styles.hashtag} />
            ) : null}
            <View style={styles.embeddedPost}>
              <Pressable
                style={styles.embeddedAuthor}
                hitSlop={4}
                onPress={() => navigateToProfile(router, sharedPost.user_id)}>
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
              </Pressable>
              {sharedPost.title ? (
                <ThemedText style={styles.embeddedTitle}>{sharedPost.title}</ThemedText>
              ) : null}
              {displaySharedContent ? (
                <RichContent content={displaySharedContent} emojiMap={EMOJI_MAP} style={styles.embeddedContent} onHashtagPress={openHashtag} hashtagStyle={styles.hashtag} />
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
                <RichContent content={displayContent} emojiMap={EMOJI_MAP} style={styles.content} onHashtagPress={openHashtag} hashtagStyle={styles.hashtag} />
                {needsTruncation && (
                  <ThemedText style={styles.toggleBtn}>
                    {expanded ? t('post.collapse') : t('post.readMore')}
                  </ThemedText>
                )}
              </View>
            ) : null}
            {!post.title && !post.content && post.media.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
                {t('post.noContent')}
              </ThemedText>
            )}
          </>
        )}
      </Pressable>

      {/* Zone 3: Media — outer media only for non-reposts (repost media is embedded above) */}
      {!isRepost && (
        <View>
          <MediaGrid media={post.media} onPress={handleMediaPress} />
          {burst && (
            <Animated.View
              style={[
                styles.burstHeart,
                { opacity: burstAnim, transform: [{ scale: burstAnim }] },
              ]}
              pointerEvents="none">
              <Icon name="heartFilled" size={72} color="#E53935" />
            </Animated.View>
          )}
        </View>
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

        {isOwner ? (
          <View style={styles.viewStat}>
            <Icon name="eye" size={16} color={theme.textSecondary} />
            <ThemedText
              themeColor="textSecondary"
              style={styles.actionCount}
              accessibilityLabel={t('postDetail.viewCount', { count: post.views_count })}>
              {formatCount(post.views_count)}
            </ThemedText>
          </View>
        ) : (
          <Pressable
            style={styles.actionBtn}
            onPress={() => onSave?.(post.id)}>
            <Icon name={post.is_saved ? 'bookmarkFilled' : 'bookmark'} size={18} color={post.is_saved ? '#FBBC04' : undefined} />
          </Pressable>
        )}
      </View>
    </ThemedView>

      <MenuSheet
        visible={menuVisible}
        title={t('postDetail.title')}
        items={menuItems}
        onClose={() => setMenuVisible(false)}
      />
      {reporting && (
        <ReportSheet targetType="post" targetId={post.id} onClose={() => setReporting(false)} />
      )}
    </>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  displayName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  followBadge: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  followingBadge: {
    borderStyle: 'solid',
  },
  followBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pinBadgeText: {
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  hashtag: {
    color: '#12A5A1',
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 14,
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
  mediaMoreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaMoreText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  burstHeart: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
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
  viewStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: 'auto',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
});
