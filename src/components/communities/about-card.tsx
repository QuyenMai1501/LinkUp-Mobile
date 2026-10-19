import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { getCommunityMembers, getCommunityRules } from '@/api/communities';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityDetail, CommunityMember, CommunityRule } from '@/types/community';

const PREVIEW_MEMBERS = 5;
const PREVIEW_RULES = 3;

interface AboutCardProps {
  community: CommunityDetail;
  onGoTab: (tab: 'members' | 'rules') => void;
}

/** Port CommunityAboutRail — 3 card: Giới thiệu / Thành viên (preview) / Quy tắc (preview). */
export default function AboutCard({ community, onGoTab }: AboutCardProps) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [members, setMembers] = useState<CommunityMember[] | null>(null);
  const [rules, setRules] = useState<CommunityRule[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCommunityMembers(community.id);
        if (!cancelled) setMembers(res.members);
      } catch {
        if (!cancelled) setMembers([]);
      }
      try {
        const res = await getCommunityRules(community.id);
        if (!cancelled) setRules(res.rules);
      } catch {
        if (!cancelled) setRules([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [community.id]);

  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const preview = (members ?? []).slice(0, PREVIEW_MEMBERS);
  const extra = Math.max(0, community.member_count - preview.length);
  const rulesPreview = (rules ?? []).slice(0, PREVIEW_RULES);
  const totalRules = rules?.length ?? 0;

  const cardStyle = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }];

  const renderSectionHead = (title: string, onMore?: () => void) => (
    <View style={styles.cardHead}>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      {onMore && (
        <Pressable onPress={onMore} hitSlop={6}>
          <ThemedText style={[styles.linkBtn, { color: theme.primary }]}>
            {t('communities.viewAll')}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {/* Giới thiệu */}
      <View style={cardStyle}>
        <ThemedText style={styles.cardTitle}>{t('communities.about')}</ThemedText>
        {community.description ? (
          <ThemedText themeColor="textSecondary" style={styles.desc}>
            {community.description}
          </ThemedText>
        ) : null}
        <View style={styles.fact}>
          <ThemedText themeColor="textSecondary" style={styles.factLabel}>
            {t('communities.privacy')}
          </ThemedText>
          <ThemedText style={styles.factValue}>
            {community.privacy === 'public'
              ? t('communities.privacyPublic')
              : t('communities.privacyInvitation')}
          </ThemedText>
        </View>
        <View style={styles.fact}>
          <ThemedText themeColor="textSecondary" style={styles.factLabel}>
            {t('communities.memberCount')}
          </ThemedText>
          <ThemedText style={styles.factValue}>
            {community.member_count.toLocaleString(locale)}
          </ThemedText>
        </View>
        <View style={styles.fact}>
          <ThemedText themeColor="textSecondary" style={styles.factLabel}>
            {t('communities.createdBy')}
          </ThemedText>
          <Pressable
            onPress={() => (router as any).push(`/(drawer)/profile/${community.creator_id}`)}
            hitSlop={6}>
            <ThemedText style={[styles.factValue, { color: theme.primary }]}>
              @{community.creator_name}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Thành viên */}
      <View style={cardStyle}>
        {renderSectionHead(t('communities.memberList'), () => onGoTab('members'))}
        {members === null ? (
          <ThemedText themeColor="textSecondary" style={styles.muted}>
            {t('common.loading')}
          </ThemedText>
        ) : preview.length > 0 ? (
          <View style={styles.avatarStack}>
            {preview.map((m, i) => (
              <Pressable
                key={m.user_id}
                onPress={() => (router as any).push(`/(drawer)/profile/${m.user_id}`)}
                style={[
                  styles.stackAvatar,
                  {
                    borderColor: theme.card,
                    backgroundColor: theme.bgSecondary,
                    marginLeft: i === 0 ? 0 : -10,
                    zIndex: PREVIEW_MEMBERS - i,
                  },
                ]}>
                {m.avatar_uri ? (
                  <Image source={{ uri: m.avatar_uri }} style={styles.stackAvatarImg} contentFit="cover" />
                ) : (
                  <Icon name="person" size={16} color={theme.textSecondary} />
                )}
              </Pressable>
            ))}
            {extra > 0 && (
              <ThemedText themeColor="textSecondary" style={styles.stackMore}>
                +{extra}
              </ThemedText>
            )}
          </View>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.muted}>
            {t('communities.noMembers')}
          </ThemedText>
        )}
      </View>

      {/* Quy tắc */}
      <View style={cardStyle}>
        {renderSectionHead(t('communities.rules'), () => onGoTab('rules'))}
        {rules === null ? (
          <ThemedText themeColor="textSecondary" style={styles.muted}>
            {t('common.loading')}
          </ThemedText>
        ) : rulesPreview.length > 0 ? (
          <View style={styles.rulesList}>
            {rulesPreview.map((r, i) => (
              <View key={r.id} style={styles.ruleRow}>
                <View style={[styles.ruleIndex, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText style={[styles.ruleIndexText, { color: theme.primary }]}>
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText numberOfLines={1} style={styles.ruleTitle}>
                  {r.title}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.muted}>
            {t('communities.noRules')}
          </ThemedText>
        )}
        {totalRules > rulesPreview.length && (
          <ThemedText themeColor="textSecondary" style={styles.muted}>
            {t('communities.moreRules', { count: totalRules - rulesPreview.length })}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
  },
  linkBtn: {
    ...Typography.caption,
    fontWeight: '600',
  },
  desc: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  factLabel: {
    ...Typography.caption,
  },
  factValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarImg: {
    width: '100%',
    height: '100%',
  },
  stackMore: {
    ...Typography.caption,
    fontWeight: '600',
    marginLeft: Spacing.xs + 2,
  },
  rulesList: {
    gap: Spacing.sm + 2,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ruleIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleIndexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ruleTitle: {
    ...Typography.body,
    fontSize: 14,
    flex: 1,
  },
  muted: {
    ...Typography.caption,
  },
});
