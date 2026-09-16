import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ViewProfileResponse, FollowStats } from '@/types/profile';
import { FriendButton } from './FriendButton';

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
  hasStory,
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
  const { t } = useTranslation();
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);

  const handleAvatarPress = () => {
    if (isSelf) {
      setAvatarMenuVisible(!avatarMenuVisible);
    } else if (onViewAvatar) {
      onViewAvatar();
    }
  };

  const handleChangeAvatar = async () => {
    setAvatarMenuVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.editProfile'), 'Cần cấp quyền truy cập ảnh để thay đổi avatar.');
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
      Alert.alert(t('profile.editProfile'), 'Cần cấp quyền truy cập ảnh để thay đổi ảnh bìa.');
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
          <Image source={{ uri: profile.cover_uri }} style={styles.coverImg} />
        ) : (
          <LinearGradient
            colors={['#12A5A1', '#0A1F44']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverGradient}
          />
        )}
        {isSelf && (
          <View style={styles.coverCameraBadge}>
            <ThemedText style={styles.cameraIcon}>📷</ThemedText>
          </View>
        )}
      </Pressable>

      {/* Body */}
      <View style={styles.body}>
        {/* Avatar */}
        <Pressable onPress={handleAvatarPress} style={styles.avatarWrap}>
          {profile.avatar_uri?.trim() ? (
            <Image source={{ uri: profile.avatar_uri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.avatarFallbackText}>
                {profile.display_name?.charAt(0)?.toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}
          {isSelf && (
            <View style={styles.avatarCameraBadge}>
              <ThemedText style={styles.cameraIconSmall}>📷</ThemedText>
            </View>
          )}
        </Pressable>

        {/* Avatar menu for self */}
        {isSelf && avatarMenuVisible && (
          <>
            <Pressable style={styles.menuOverlay} onPress={() => setAvatarMenuVisible(false)} />
            <View style={[styles.avatarMenu, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Pressable onPress={handleChangeAvatar} style={styles.avatarMenuItem}>
                <ThemedText style={styles.avatarMenuText}>{t('profile.editProfile')}</ThemedText>
              </Pressable>
              {onViewAvatar && (
                <Pressable onPress={() => { setAvatarMenuVisible(false); onViewAvatar(); }} style={styles.avatarMenuItem}>
                  <ThemedText style={styles.avatarMenuText}>{t('common.done')}</ThemedText>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* User info */}
        <ThemedText style={styles.displayName}>{profile.display_name}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.username}>@{profile.username}</ThemedText>
        {profile.bio ? (
          <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
        ) : null}
        <ThemedText themeColor="textSecondary" style={styles.meta}>
          📅 {t('profile.joined')} {formatJoinDate(profile.created_at)}
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
    resizeMode: 'cover',
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
  cameraIcon: { fontSize: 14 },
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
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
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
  cameraIconSmall: { fontSize: 12 },
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
  username: { ...Typography.caption, marginBottom: Spacing.sm },
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
