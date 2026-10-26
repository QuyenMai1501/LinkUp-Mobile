import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { showAlert } from '@/utils/alert';
import { communityErrorText, joinCommunity, leaveCommunity } from '@/api/communities';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityDetail, MembershipStatus } from '@/types/community';

interface CommunityHeaderProps {
  /** membership_status đã qua statusOverride (join/leave tối ưu local). */
  community: CommunityDetail;
  onStatusChange: (status: MembershipStatus) => void;
  onRequestCode: () => void;
}

export default function CommunityHeader({
  community,
  onStatusChange,
  onRequestCode,
}: CommunityHeaderProps) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const status = community.membership_status;
  const isPublic = community.privacy === 'public';
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  const handleJoin = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await joinCommunity(community.id);
      onStatusChange(res.request_id ? 'pending' : 'member');
    } catch (err) {
      showAlert(t('common.error'), communityErrorText(err, t('communities.joinError')));
    } finally {
      setLoading(false);
    }
  }, [community.id, loading, onStatusChange, t]);

  const handleLeave = useCallback(() => {
    showAlert(t('communities.leaveConfirmTitle'), t('communities.leaveConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('communities.leave'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (loading) return;
            setLoading(true);
            try {
              await leaveCommunity(community.id);
              onStatusChange('none');
            } catch (err) {
              showAlert(
                t('common.error'),
                communityErrorText(err, t('communities.leaveError')),
              );
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  }, [community.id, loading, onStatusChange, t]);

  const renderAction = () => {
    if (status === 'admin' || status === 'creator') {
      return (
        <View style={[styles.pill, { borderColor: theme.primary }]}>
          <Icon name="settings" size={14} color={theme.primary} />
          <ThemedText style={[styles.pillText, { color: theme.primary }]}>
            {t('communities.manage')}
          </ThemedText>
        </View>
      );
    }
    if (status === 'pending') {
      return (
        <View style={[styles.pill, { borderColor: theme.warning }]}>
          <Icon name="hourglass" size={14} color={theme.warning} />
          <ThemedText style={[styles.pillText, { color: theme.warning }]}>
            {t('communities.pendingApproval')}
          </ThemedText>
        </View>
      );
    }
    if (status === 'member') {
      return (
        <Pressable
          onPress={handleLeave}
          disabled={loading}
          style={({ pressed }) => [
            styles.actionBtn,
            { borderColor: theme.danger },
            pressed && styles.pressed,
          ]}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.danger} />
          ) : (
            <ThemedText style={[styles.actionText, { color: theme.danger }]}>
              {t('communities.leave')}
            </ThemedText>
          )}
        </Pressable>
      );
    }
    if (!isPublic) {
      return (
        <Pressable
          onPress={onRequestCode}
          style={({ pressed }) => [
            styles.actionBtn,
            { borderColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <Icon name="key" size={14} color={theme.primary} />
          <ThemedText style={[styles.actionText, { color: theme.primary }]}>
            {t('communities.enterCode')}
          </ThemedText>
        </Pressable>
      );
    }
    return (
      <Pressable
        onPress={() => void handleJoin()}
        disabled={loading}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: theme.primary, borderColor: theme.primary },
          (pressed || loading) && styles.pressed,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.textOnPrimary} />
        ) : (
          <ThemedText style={[styles.actionTextPrimary, { color: theme.textOnPrimary }]}>{t('communities.join')}</ThemedText>
        )}
      </Pressable>
    );
  };

  const showCover = !coverError && community.background_uri;

  return (
    <View>
      {/* Cover */}
      <View style={styles.coverWrap}>
        {showCover ? (
          <Image
            source={{ uri: community.background_uri }}
            style={styles.cover}
            contentFit="cover"
            transition={150}
            onError={() => setCoverError(true)}
          />
        ) : (
          <View style={[styles.coverFallback, { backgroundColor: theme.primaryLight }]}>
            <Icon name="globe" size={40} color={theme.primary} />
          </View>
        )}
        <View style={[styles.privacyBadge, { backgroundColor: 'rgba(0, 0, 0, 0.55)' }]}>
          <Icon name={isPublic ? 'globe' : 'lock'} size={12} color={theme.textOnPrimary} />
          <ThemedText style={[styles.privacyBadgeText, { color: theme.textOnPrimary }]}>
            {isPublic ? t('communities.privacyPublic') : t('communities.inviteOnlyShort')}
          </ThemedText>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameActionsRow}>
          <View style={[styles.avatarWrap, { backgroundColor: theme.textOnPrimary }, { borderColor: theme.card }]}>
            {avatarError || !community.avatar_uri ? (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primaryLight }]}>
                <Icon name="people" size={28} color={theme.primary} />
              </View>
            ) : (
              <Image
                source={{ uri: community.avatar_uri }}
                style={styles.avatar}
                contentFit="cover"
                onError={() => setAvatarError(true)}
              />
            )}
          </View>

          <View style={styles.titleBlock}>
            <ThemedText style={styles.name} numberOfLines={2}>
              {community.name}
            </ThemedText>
            <View style={styles.actions}>{renderAction()}</View>
          </View>
        </View>

        {community.description ? (
          <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.description}>
            {community.description}
          </ThemedText>
        ) : null}

        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: theme.bgSecondary }]}>
            <Icon name="people" size={13} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.statText}>
              {community.member_count.toLocaleString(locale)} {t('communities.members')}
            </ThemedText>
          </View>
          <View style={[styles.statPill, { backgroundColor: theme.bgSecondary }]}>
            <Icon name="calendar" size={13} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.statText}>
              {new Date(community.created_at).toLocaleDateString(locale)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.createdByRow}>
          <ThemedText themeColor="textSecondary" style={styles.statText}>
            {t('communities.createdBy')}
          </ThemedText>
          <Pressable
            onPress={() => (router as any).push(`/(drawer)/profile/${community.creator_id}`)}
            hitSlop={6}>
            <ThemedText style={[styles.creatorLink, { color: theme.primary }]}>
              @{community.creator_name}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: {
    height: 140,
    width: '100%',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  privacyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  info: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  nameActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginTop: -34,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
    paddingBottom: 2,
  },
  name: {
    ...Typography.h2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    minHeight: 36,
  },
  actionText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  actionTextPrimary: {
    ...Typography.caption,
    fontWeight: '600',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 3,
    minHeight: 36,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  description: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  statText: {
    fontSize: 12,
    lineHeight: 16,
  },
  createdByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  creatorLink: {
    fontSize: 12,
    fontWeight: '600',
  },
});
