import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { communityErrorText, joinCommunity } from '@/api/communities';
import { JoinCodeModal } from '@/components/communities/join-code-modal';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityListItem } from '@/types/community';

interface CommunityCardProps {
  community: CommunityListItem;
  onPress: (community: CommunityListItem) => void;
  style?: StyleProp<ViewStyle>;
}

export default function CommunityCard({ community, onPress, style }: CommunityCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [joining, setJoining] = useState(false);
  const [joinedStatus, setJoinedStatus] = useState<'member' | 'pending' | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const cover = !coverError && community.background_uri ? community.background_uri : null;
  const isPublic = community.privacy === 'public';

  const handleJoinPublic = useCallback(async () => {
    if (joining || joinedStatus) return;
    setJoining(true);
    try {
      const res = await joinCommunity(community.id);
      setJoinedStatus(res.request_id ? 'pending' : 'member');
    } catch (err) {
      Alert.alert(t('common.error'), communityErrorText(err, t('communities.joinError')));
    } finally {
      setJoining(false);
    }
  }, [community.id, joinedStatus, joining, t]);

  const handleJoined = useCallback((status: 'member' | 'pending') => {
    setJoinedStatus(status);
  }, []);

  const renderAction = () => {
    if (community.is_creator) {
      return (
        <View style={[styles.actionPill, { borderColor: theme.primary }]}>
          <ThemedText style={[styles.actionPillText, { color: theme.primary }]}>
            {t('communities.manage')}
          </ThemedText>
        </View>
      );
    }
    if (joinedStatus === 'pending') {
      return (
        <View style={[styles.actionPill, { borderColor: theme.warning }]}>
          <Icon name="hourglass" size={14} color={theme.warning} />
          <ThemedText style={[styles.actionPillText, { color: theme.warning }]}>
            {t('communities.pendingApproval')}
          </ThemedText>
        </View>
      );
    }
    if (joinedStatus === 'member') {
      return (
        <View style={[styles.actionPill, { borderColor: theme.success }]}>
          <Icon name="check" size={14} color={theme.success} />
          <ThemedText style={[styles.actionPillText, { color: theme.success }]}>
            {t('communities.joinedBadge')}
          </ThemedText>
        </View>
      );
    }
    if (!isPublic) {
      return (
        <Pressable
          onPress={() => setCodeOpen(true)}
          style={({ pressed }) => [
            styles.actionBtn,
            { borderColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <Icon name="key" size={14} color={theme.primary} />
          <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
            {t('communities.enterCode')}
          </ThemedText>
        </Pressable>
      );
    }
    return (
      <Pressable
        onPress={() => void handleJoinPublic()}
        disabled={joining}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: theme.primary, borderColor: theme.primary },
          (pressed || joining) && styles.pressed,
        ]}>
        {joining ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.actionBtnTextPrimary}>{t('communities.join')}</ThemedText>
        )}
      </Pressable>
    );
  };

  return (
    <>
      <Pressable
        onPress={() => onPress(community)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
          style,
          pressed && styles.pressed,
        ]}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={styles.cover}
              contentFit="cover"
              transition={150}
              onError={() => setCoverError(true)}
            />
          ) : (
            <View style={[styles.coverFallback, { backgroundColor: theme.primaryLight }]}>
              <Icon name="globe" size={28} color={theme.primary} />
            </View>
          )}
          <View style={[styles.privacyBadge, { backgroundColor: 'rgba(0, 0, 0, 0.55)' }]}>
            <Icon name={isPublic ? 'globe' : 'lock'} size={12} color="#FFFFFF" />
            <ThemedText style={styles.privacyBadgeText}>
              {isPublic ? t('communities.privacyPublic') : t('communities.inviteOnlyShort')}
            </ThemedText>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <View style={[styles.avatarWrap, { borderColor: theme.card }]}>
            {community.avatar_uri ? (
              <Image source={{ uri: community.avatar_uri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primaryLight }]}>
                <Icon name="people" size={22} color={theme.primary} />
              </View>
            )}
          </View>

          <View style={styles.nameRow}>
            <ThemedText numberOfLines={1} style={styles.name}>
              {community.name}
            </ThemedText>
            {community.is_creator && (
              <View style={[styles.creatorBadge, { backgroundColor: theme.primaryLight }]}>
                <ThemedText style={[styles.creatorBadgeText, { color: theme.primary }]}>
                  {t('communities.yourCommunity')}
                </ThemedText>
              </View>
            )}
          </View>

          {community.description ? (
            <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.description}>
              {community.description}
            </ThemedText>
          ) : null}

          <View style={styles.meta}>
            <Icon name="people" size={13} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {community.member_count.toLocaleString('vi-VN')} {t('communities.members')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.metaDot}>
              ·
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {new Date(community.created_at).toLocaleDateString('vi-VN')}
            </ThemedText>
          </View>

          <View style={styles.footer}>{renderAction()}</View>
        </View>
      </Pressable>

      <JoinCodeModal
        visible={codeOpen}
        communityId={community.id}
        communityName={community.name}
        onClose={() => setCodeOpen(false)}
        onJoined={handleJoined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  coverWrap: {
    height: 84,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  privacyBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: Spacing.sm + 4,
    paddingBottom: Spacing.sm + 4,
    gap: 6,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    marginTop: -26,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    flexShrink: 1,
  },
  creatorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  creatorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  description: {
    ...Typography.caption,
    lineHeight: 17,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaDot: {
    fontSize: 12,
  },
  footer: {
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs + 3,
    minHeight: 34,
  },
  actionBtnText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  actionBtnTextPrimary: {
    ...Typography.caption,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs + 3,
    minHeight: 34,
  },
  actionPillText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
