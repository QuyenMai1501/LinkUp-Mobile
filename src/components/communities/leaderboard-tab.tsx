import { useCallback, useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { communityErrorText } from '@/api/communities';
import { getLeaderboard, getMyContribution } from '@/api/contribution';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/contexts/auth-context';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ContributionSummary, LeaderboardEntry } from '@/types/contribution';

interface LeaderboardTabProps {
  communityId: string;
  isMember: boolean;
  /** CommunityHeader — scroll cùng nội dung (mirror web page-level header). */
  header?: ReactNode;
}

const STAT_ITEMS: { key: keyof ContributionSummary; icon: 'pencil' | 'chat' | 'heart' | 'flag'; labelKey: string }[] = [
  { key: 'valid_posts', icon: 'pencil', labelKey: 'contribution.validPosts' },
  { key: 'quality_comments', icon: 'chat', labelKey: 'contribution.qualityComments' },
  { key: 'positive_reactions', icon: 'heart', labelKey: 'contribution.positiveReactions' },
  { key: 'event_participations', icon: 'flag', labelKey: 'contribution.eventParticipations' },
];

/** Port CommunityLeaderboard — podium top-3 + list + card "Thành tích của bạn". */
export default function LeaderboardTab({
  communityId,
  isMember,
  header,
}: LeaderboardTabProps) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const shimmer = useShimmer();
  const { user } = useAuth();
  const myUserId = user?.id ?? '';
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB';

  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [mine, setMine] = useState<ContributionSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getLeaderboard(communityId, 1, 20);
      setEntries(res.data);
      setLoadError(null);
    } catch (err) {
      setEntries((prev) => prev ?? []);
      setLoadError(communityErrorText(err, t('contribution.loadError')));
    }
    if (isMember) {
      try {
        const res = await getMyContribution(communityId);
        setMine(res.data);
      } catch {
        setMine(null);
      }
    }
  }, [communityId, isMember, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const renderBadge = (badgeType: string | null | undefined) =>
    badgeType ? (
      <View style={[styles.badgeChip, { backgroundColor: theme.accentLight }]}>
        <Icon name="star" size={11} color={theme.accent} />
        <ThemedText style={[styles.badgeChipText, { color: theme.accent }]}>
          {t('contribution.topContributor')}
        </ThemedText>
      </View>
    ) : null;

  const podium = (entries ?? []).slice(0, 3);
  const rest = (entries ?? []).slice(3);

  const cardStyle = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {header}

      <View style={styles.headerText}>
        <View style={styles.eyebrow}>
          <Icon name="medal" size={13} color={theme.accent} />
          <ThemedText style={[styles.eyebrowText, { color: theme.accent }]}>
            {t('contribution.leaderboardBadge')}
          </ThemedText>
        </View>
        <ThemedText style={styles.title}>{t('contribution.leaderboardTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {t('contribution.leaderboardSubtitle')}
        </ThemedText>
      </View>

      {entries === null && !loadError ? (
        <View style={styles.podium}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.podiumCard,
                { backgroundColor: theme.card, borderColor: theme.border, opacity: shimmer },
              ]}>
              <View style={[styles.podiumAvatar, { backgroundColor: theme.bgSecondary }]} />
              <View style={[styles.skelLine, { backgroundColor: theme.bgSecondary, width: '70%' }]} />
              <View style={[styles.skelLine, { backgroundColor: theme.bgSecondary, width: '45%' }]} />
            </Animated.View>
          ))}
        </View>
      ) : loadError ? (
        <View style={[styles.stateWrap, cardStyle]}>
          <Icon name="warning" size={32} color={theme.accent} />
          <ThemedText style={styles.stateTitle}>{loadError}</ThemedText>
          <Pressable
            onPress={() => {
              setEntries(null);
              setLoadError(null);
              void load();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
              {t('common.retry')}
            </ThemedText>
          </Pressable>
        </View>
      ) : podium.length === 0 ? (
        <View style={[styles.stateWrap, cardStyle]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
            <Icon name="stats" size={26} color={theme.primary} />
          </View>
          <ThemedText style={styles.stateTitle}>{t('contribution.noLeaderboard')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.stateHint}>
            {t('contribution.noLeaderboardHint')}
          </ThemedText>
        </View>
      ) : (
        <>
          {/* Podium top-3 */}
          <View style={styles.podium}>
            {podium.map((entry) => {
              const isMe = entry.user_id === myUserId;
              return (
                <View
                  key={entry.user_id}
                  style={[
                    styles.podiumCard,
                    cardStyle,
                    isMe && { borderColor: theme.primary },
                    entry.rank === 1 && styles.podiumFirst,
                  ]}>
                  <View style={[styles.medal, { backgroundColor: theme.primaryLight }]}>
                    <ThemedText style={[styles.medalText, { color: theme.primary }]}>
                      {entry.rank}
                    </ThemedText>
                  </View>
                  {entry.avatar_uri ? (
                    <Image
                      source={{ uri: entry.avatar_uri }}
                      style={styles.podiumAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.podiumAvatar,
                        styles.avatarFallback,
                        { backgroundColor: theme.bgSecondary },
                      ]}>
                      <Icon name="person" size={24} color={theme.textSecondary} />
                    </View>
                  )}
                  <ThemedText numberOfLines={1} style={styles.podiumName}>
                    {entry.display_name}
                  </ThemedText>
                  {renderBadge(entry.badge_type)}
                  <View style={styles.podiumScoreRow}>
                    <ThemedText style={styles.podiumScore}>
                      {entry.contribution_score.toLocaleString(locale)}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.scoreUnit}>
                      {t('contribution.score')}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>

          {/* List các hạng còn lại */}
          {rest.length > 0 && (
            <View style={cardStyle}>
              <View style={styles.listHead}>
                <ThemedText themeColor="textSecondary" style={styles.headRank}>
                  {t('contribution.rank')}
                </ThemedText>
                <View style={styles.headAvatarSpacer} />
                <ThemedText themeColor="textSecondary" style={styles.headName}>
                  {t('contribution.member')}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.headScore}>
                  {t('contribution.score')}
                </ThemedText>
              </View>
              {rest.map((entry) => {
                const isMe = entry.user_id === myUserId;
                return (
                  <View
                    key={entry.user_id}
                    style={[
                      styles.row,
                      isMe && { backgroundColor: theme.primaryLight, borderRadius: 10 },
                    ]}>
                    <ThemedText style={[styles.rank, { color: theme.textSecondary }]}>
                      {entry.rank}
                    </ThemedText>
                    {entry.avatar_uri ? (
                      <Image
                        source={{ uri: entry.avatar_uri }}
                        style={styles.rowAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.rowAvatar,
                          styles.avatarFallback,
                          { backgroundColor: theme.bgSecondary },
                        ]}>
                        <Icon name="person" size={16} color={theme.textSecondary} />
                      </View>
                    )}
                    <View style={styles.rowInfo}>
                      <View style={styles.rowNameLine}>
                        <ThemedText numberOfLines={1} style={styles.rowName}>
                          {entry.display_name}
                        </ThemedText>
                        {isMe && (
                          <View style={[styles.youChip, { backgroundColor: theme.primaryLight }]}>
                            <ThemedText style={[styles.youChipText, { color: theme.primary }]}>
                              {t('contribution.you')}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      {renderBadge(entry.badge_type)}
                    </View>
                    <ThemedText style={styles.rowScore}>
                      {entry.contribution_score.toLocaleString(locale)}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}

          {/* Card thành tích cá nhân (member) */}
          {isMember && mine && (
            <View style={cardStyle}>
              <View style={styles.eyebrow}>
                <Icon name="person" size={13} color={theme.primary} />
                <ThemedText style={[styles.eyebrowText, { color: theme.primary }]}>
                  {t('contribution.yourStats')}
                </ThemedText>
              </View>
              <ThemedText style={styles.myScore}>
                {mine.contribution_score.toLocaleString(locale)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.myScoreLabel}>
                {t('contribution.yourScore')}
              </ThemedText>
              <View style={styles.myChips}>
                {renderBadge(mine.badge_type)}
                {mine.promoted_to_mod && (
                  <View style={[styles.modChip, { backgroundColor: theme.primaryLight }]}>
                    <Icon name="shield" size={11} color={theme.primary} />
                    <ThemedText style={[styles.modChipText, { color: theme.primary }]}>
                      {t('contribution.moderator')}
                    </ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.statList}>
                {STAT_ITEMS.map((item) => (
                  <View key={item.key} style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: theme.bgSecondary }]}>
                      <Icon name={item.icon} size={14} color={theme.textSecondary} />
                    </View>
                    <ThemedText themeColor="textSecondary" style={[styles.statLabel, styles.flex1]}>
                      {t(item.labelKey)}
                    </ThemedText>
                    <ThemedText style={styles.statValue}>
                      {Number(mine[item.key] ?? 0).toLocaleString(locale)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  headerText: {
    gap: 4,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrowText: {
    ...Typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.h2,
    fontSize: 20,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  podium: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  podiumCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    alignItems: 'center',
    gap: 5,
  },
  podiumFirst: {
    paddingBottom: Spacing.md - 2,
  },
  medal: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    fontSize: 12,
    fontWeight: '800',
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  podiumScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  podiumScore: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '800',
  },
  scoreUnit: {
    ...Typography.caption,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headRank: {
    width: 26,
    ...Typography.caption,
    textAlign: 'center',
  },
  headAvatarSpacer: {
    width: 36,
  },
  headName: {
    flex: 1,
    ...Typography.caption,
  },
  headScore: {
    flex: 1,
    ...Typography.caption,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  rank: {
    width: 26,
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowScore: {
    flex: 1,
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  youChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  youChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  modChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  myScore: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: Spacing.xs,
  },
  myScoreLabel: {
    ...Typography.caption,
  },
  myChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statList: {
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    ...Typography.body,
    fontSize: 13,
  },
  flex1: {
    flex: 1,
  },
  statValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
  stateWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    ...Typography.h2,
    fontSize: 16,
    textAlign: 'center',
  },
  stateHint: {
    ...Typography.body,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 4,
    marginTop: Spacing.xs,
  },
  primaryBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  skelLine: {
    height: 14,
    borderRadius: 7,
    width: '100%',
  },
  pressed: {
    opacity: 0.75,
  },
});
