import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Modal, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { showAlert } from '@/utils/alert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { RichContent } from '@/components/rich-content';
import { StoryAvatarRing } from '@/components/story/story-avatar-ring';
import StoryViewer from '@/components/story/story-viewer';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getUserStories } from '@/api/story';
import { batchGetPresence } from '@/api/presence';
import * as Clipboard from 'expo-clipboard';
import { formatCount } from '@/utils/format';
import { useAuth } from '@/contexts/auth-context';
import { getEmojiTextMap } from '@/utils/emojis';
import type { ViewProfileResponse, FollowStats } from '@/types/profile';
import type { StoryItem } from '@/types/story';
import { FriendButton } from './FriendButton';

const EMOJI_MAP = getEmojiTextMap();

// Base web để tạo link hồ sơ khi chia sẻ (vd https://linkup.vn).
const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://linkup.vn').replace(/\/$/, '');

interface ProfileHeaderProps {
  profile: ViewProfileResponse;
  stats: FollowStats | null;
  isSelf: boolean;
  isFollowing?: boolean;
  followBusy?: boolean;
  hasStory?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
  onEdit?: () => void;
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  onAvatarChange?: (uri: string, mimeType: string) => void;
  onCoverChange?: (uri: string, mimeType: string) => void;
  onViewAvatar?: () => void;
  menuSlot?: React.ReactNode;
}

function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${month}/${year}`;
}

export function ProfileHeader({
  profile,
  stats,
  isSelf,
  isFollowing,
  followBusy,
  onFollow,
  onMessage,
  onEdit,
  onOpenFollowers,
  onOpenFollowing,
  onAvatarChange,
  onCoverChange,
  onViewAvatar,
  menuSlot,
}: ProfileHeaderProps) {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const { user: authUser } = useAuth();
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);
  const [storyItems, setStoryItems] = useState<StoryItem[] | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);

  const openAvatarViewer = useCallback(() => {
    if (onViewAvatar) {
      onViewAvatar();
    } else {
      setAvatarViewerOpen(true);
    }
  }, [onViewAvatar]);

  const handleShareProfile = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(`${WEB_BASE_URL}/profile/${profile.user_id}`);
      showAlert(t('common.success'), t('profile.linkCopied'));
    } catch {
      showAlert(t('common.error'), t('common.error'));
    }
  }, [profile.user_id, t]);

  // Chấm xanh online (chỉ hồ sơ người khác — parity web usePresence).
  useEffect(() => {
    if (isSelf || !profile.user_id) return;
    let cancelled = false;
    batchGetPresence([profile.user_id])
      .then((res) => {
        if (cancelled) return;
        const p = res?.data?.[profile.user_id];
        setIsOnline(p?.status === 'online');
      })
      .catch(() => {
        if (!cancelled) setIsOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, profile.user_id]);

  // Kiểm tra profile này có tin đang active không (1 request — vừa có tin,
  // vừa biết đã xem hết chưa để tô ring xám).
  useEffect(() => {
    const userId = profile.user_id;
    if (!userId) return;
    let cancelled = false;
    getUserStories(userId)
      .then((res) => {
        if (cancelled) return;
        const stories = Array.isArray(res?.stories) ? res.stories : [];
        setStoryItems(stories.length > 0 ? stories : null);
      })
      .catch(() => {
        if (!cancelled) setStoryItems(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.user_id]);

  const hasStory = storyItems !== null && storyItems.length > 0;
  const hasStoryViewed =
    storyItems !== null && storyItems.length > 0 && storyItems.every((s) => s.has_viewed);

  const handleAvatarPress = () => {
    if (isSelf || hasStory) {
      setAvatarMenuVisible(!avatarMenuVisible);
    } else if (profile.avatar_uri) {
      openAvatarViewer();
    }
  };

  const handleViewStory = useCallback(() => {
    setAvatarMenuVisible(false);
    if (!storyItems?.length) return;
    // Mở viewer với bản sao — tránh state trong viewer sửa has_viewed gốc.
    setStoryViewerOpen(true);
  }, [storyItems]);

  const handleChangeAvatar = async () => {
    setAvatarMenuVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('profile.editProfile'), 'Cần cấp quyền truy cập ảnh để thay đổi avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onAvatarChange?.(asset.uri, asset.mimeType || 'image/jpeg');
    }
  };

  const handleChangeCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('profile.editProfile'), 'Cần cấp quyền truy cập ảnh để thay đổi ảnh bìa.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onCoverChange?.(asset.uri, asset.mimeType || 'image/jpeg');
    }
  };

  return (
    <ThemedView style={styles.card}>
      {/* Cover */}
      <Pressable
        onPress={isSelf ? handleChangeCover : undefined}
        style={styles.coverWrap}>
        {profile.cover_uri ? (
          <Image source={{ uri: profile.cover_uri }} style={styles.coverImg} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverGradient}
          />
        )}
        {isSelf && (
          <View style={styles.coverCameraBadge}>
            <Icon name="camera" size={14} color={theme.textOnPrimary} />
          </View>
        )}
      </Pressable>

      {/* Body */}
      <View style={styles.body}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <StoryAvatarRing
            src={profile.avatar_uri}
            name={profile.display_name}
            hasStory={hasStory}
            hasViewed={hasStoryViewed}
            size={96}
            onPress={handleAvatarPress}>
            {profile.avatar_uri?.trim() ? undefined : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.avatarFallbackText, { color: theme.textOnPrimary }]}>
                  {profile.display_name?.charAt(0)?.toUpperCase() || '?'}
                </ThemedText>
              </View>
            )}
          </StoryAvatarRing>
          {isSelf && (
            <View style={styles.avatarCameraBadge}>
              <Icon name="camera" size={12} color={theme.textOnPrimary} />
            </View>
          )}
          {isOnline && (
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: theme.success, borderColor: theme.background },
              ]}
            />
          )}
        </View>

        {/* Avatar menu: self (đổi ảnh) + ai cũng có (xem tin khi có story) */}
        {(isSelf || hasStory) && avatarMenuVisible && (
          <>
            <Pressable style={styles.menuOverlay} onPress={() => setAvatarMenuVisible(false)} />
            <View style={[styles.avatarMenu, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {hasStory && (
                <Pressable onPress={handleViewStory} style={styles.avatarMenuItem}>
                  <ThemedText style={styles.avatarMenuText}>{t('story.viewStory')}</ThemedText>
                </Pressable>
              )}
              {!!profile.avatar_uri && (
                <Pressable
                  onPress={() => {
                    setAvatarMenuVisible(false);
                    openAvatarViewer();
                  }}
                  style={styles.avatarMenuItem}>
                  <ThemedText style={styles.avatarMenuText}>{t('story.viewAvatar')}</ThemedText>
                </Pressable>
              )}
              {isSelf && (
                <Pressable onPress={handleChangeAvatar} style={styles.avatarMenuItem}>
                  <ThemedText style={styles.avatarMenuText}>{t('story.changeAvatar')}</ThemedText>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* User info */}
        <ThemedText style={styles.displayName}>{profile.display_name}</ThemedText>
        <View style={styles.usernameRow}>
          <ThemedText themeColor="textSecondary" style={styles.username}>
            @{profile.username}
          </ThemedText>
          <Pressable onPress={handleShareProfile} hitSlop={8} style={styles.shareBtn}>
            <Icon name="share" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
        {profile.bio ? (
          <RichContent content={profile.bio} emojiMap={EMOJI_MAP} style={[styles.bio, { color: theme.text }]} />
        ) : null}
        <ThemedText themeColor="textSecondary" style={styles.meta}>
          {profile.post_count > 0 &&
            `${t('profile.postsCountLabel', { count: formatCount(profile.post_count, language) })} · `}
          {t('profile.joined')} {formatJoinDate(profile.created_at)}
        </ThemedText>

        {/* Stats */}
        <View style={styles.stats}>
          <Pressable onPress={onOpenFollowers} style={styles.statItem}>
            <ThemedText style={styles.statValue}>{stats?.follower_count ?? 0}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.statLabel}>{t('profile.followers')}</ThemedText>
          </Pressable>
          <Pressable onPress={onOpenFollowing} style={styles.statItem}>
            <ThemedText style={styles.statValue}>{stats?.following_count ?? 0}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.statLabel}>{t('profile.following')}</ThemedText>
          </Pressable>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{profile.friend_count ?? 0}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.statLabel}>{t('friends.title')}</ThemedText>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {isSelf ? (
            <Pressable
              onPress={onEdit}
              style={[styles.actionBtn, { backgroundColor: theme.primaryLight }]}>
              <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                {t('profile.editProfile')}
              </ThemedText>
            </Pressable>
          ) : (
            <>
              <FriendButton userId={profile.user_id} />
              <Pressable
                onPress={onFollow}
                disabled={followBusy}
                style={[
                  styles.actionBtn,
                  { backgroundColor: isFollowing ? theme.border : theme.primaryLight },
                  followBusy && { opacity: 0.6 },
                ]}>
                <ThemedText
                  style={[
                    styles.actionBtnText,
                    { color: isFollowing ? theme.text : theme.primary },
                  ]}>
                  {isFollowing ? t('profile.unfollow') : t('profile.follow')}
                </ThemedText>
              </Pressable>
              {onMessage && (
                <Pressable
                  onPress={onMessage}
                  style={[styles.actionBtn, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                    {t('profile.sendMessage')}
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
          {!isSelf && menuSlot}
        </View>
      </View>

      {/* Viewer tin của profile này */}
      {storyViewerOpen && storyItems && (
        <StoryViewer
          stories={storyItems}
          currentUserId={authUser?.id}
          onClose={() => {
            setStoryViewerOpen(false);
            // Reload trạng thái đã xem.
            getUserStories(profile.user_id)
              .then((res) => {
                const stories = Array.isArray(res?.stories) ? res.stories : [];
                setStoryItems(stories.length > 0 ? stories : null);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* Xem ảnh đại diện full-screen */}
      {avatarViewerOpen && !!profile.avatar_uri && (
        <Modal visible statusBarTranslucent onRequestClose={() => setAvatarViewerOpen(false)}>
          <View style={styles.avatarViewer}>
            <Pressable
              onPress={() => setAvatarViewerOpen(false)}
              style={styles.avatarViewerClose}
              hitSlop={12}>
              <Icon name="close" size={22} color="#FFFFFF" />
            </Pressable>
            <Image
              source={{ uri: profile.avatar_uri }}
              style={styles.avatarViewerImg}
              contentFit="contain"
            />
          </View>
        </Modal>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  coverWrap: {
    height: 180,
    width: '100%',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    flex: 1,
  },
  coverCameraBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    marginTop: -36,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 36,
    fontWeight: '700',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  avatarViewer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarViewerClose: {
    position: 'absolute',
    top: 54,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarViewerImg: {
    width: '100%',
    height: '75%',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
  },
  avatarMenu: {
    position: 'absolute',
    top: 100,
    left: '50%',
    transform: [{ translateX: -80 }],
    minWidth: 160,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 100,
    overflow: 'hidden',
  },
  avatarMenuItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  avatarMenuText: { ...Typography.body, fontSize: 14 },
  displayName: { ...Typography.h2, marginTop: Spacing.sm, textAlign: 'center' },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  username: { ...Typography.caption },
  shareBtn: { padding: 4 },
  bio: { ...Typography.body, textAlign: 'center', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  meta: { ...Typography.caption, marginBottom: Spacing.md },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  statItem: { alignItems: 'center' },
  statValue: { ...Typography.h2, fontWeight: 700 },
  statLabel: { ...Typography.caption },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    alignItems: 'center',
    maxWidth: 200,
  },
  actionBtnText: { ...Typography.body, fontWeight: 600 },
});
