import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { communityErrorText, getCommunityDetail } from '@/api/communities';
import AboutCard from '@/components/communities/about-card';
import CommunityFeed from '@/components/communities/community-feed';
import CommunityHeader from '@/components/communities/community-header';
import { JoinCodeModal } from '@/components/communities/join-code-modal';
import ManageTab from '@/components/communities/manage-tab';
import MemberList from '@/components/communities/member-list';
import RuleList from '@/components/communities/rule-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTranslation } from '@/hooks/useTranslation';
import {
  isCommunityPrivileged,
  type CommunityDetail,
  type MembershipStatus,
} from '@/types/community';

type Tab = 'posts' | 'members' | 'rules' | 'manage';

export default function CommunityDetailScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();

  if (!communityId) return null;

  return <DetailBody key={communityId} communityId={communityId} router={router} />;
}

function DetailBody({
  communityId,
  router,
}: {
  communityId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const shimmer = useShimmer();

  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<MembershipStatus | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [codeOpen, setCodeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getCommunityDetail(communityId);
      setDetail(res);
      setError(null);
    } catch (err) {
      setError(communityErrorText(err, t('communities.detailNotFound')));
    } finally {
      setInitialLoading(false);
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleStatusChange = useCallback(
    (status: MembershipStatus) => {
      setStatusOverride(status);
      void load();
    },
    [load],
  );

  const goBackToList = useCallback(() => {
    if (router.canGoBack()) router.back();
    else (router as any).replace('/(drawer)/communities');
  }, [router]);

  if (initialLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()}>
              <Icon name="chevronLeft" size={22} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.topTitle} numberOfLines={1}>
              {t('communities.title')}
            </ThemedText>
          </View>
          <View style={[styles.skeletonHeader, { opacity: shimmer }]}>
            <View style={[styles.skeletonCover, { backgroundColor: theme.bgSecondary }]} />
            <View style={styles.skeletonInfo}>
              <View
                style={[
                  styles.skeletonAvatar,
                  { backgroundColor: theme.bgHover, borderColor: theme.card },
                ]}
              />
              <View style={[styles.skeletonLine, { backgroundColor: theme.bgHover, width: '60%' }]} />
              <View style={[styles.skeletonLine, { backgroundColor: theme.bgHover, width: '40%' }]} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error || !detail) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()}>
              <Icon name="chevronLeft" size={22} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.topTitle} numberOfLines={1}>
              {t('communities.title')}
            </ThemedText>
          </View>
          <View style={styles.centerContent}>
            <Icon name="warning" size={48} color="#FB8C00" />
            <ThemedText style={styles.errorTitle}>
              {error ?? t('communities.detailNotFound')}
            </ThemedText>
            <Pressable
              onPress={() => {
                setInitialLoading(true);
                void load();
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.primaryBtnText}>{t('common.retry')}</ThemedText>
            </Pressable>
            <Pressable onPress={goBackToList} hitSlop={6}>
              <ThemedText style={[styles.linkBtn, { color: theme.primary }]}>
                {t('communities.backToList')}
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const effective: CommunityDetail =
    statusOverride === null ? detail : { ...detail, membership_status: statusOverride };
  const status = effective.membership_status;
  const isMember = status === 'member' || status === 'admin' || status === 'creator';
  const isPrivileged = isCommunityPrivileged(status, effective.user_member_role);
  const activeTab: Tab = tab === 'manage' && !isPrivileged ? 'posts' : tab;

  const tabs: { key: Tab; labelKey: string }[] = [
    { key: 'posts', labelKey: 'communities.posts' },
    { key: 'members', labelKey: 'communities.memberList' },
    { key: 'rules', labelKey: 'communities.rules' },
  ];
  if (isPrivileged) tabs.push({ key: 'manage', labelKey: 'communities.manage' });

  const renderPostsTab = () => {
    if (!isMember) {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.locked, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name="lock" size={44} color={theme.primary} />
            <ThemedText style={styles.lockedTitle}>{t('communities.lockedTitle')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lockedHint}>
              {t('communities.lockedHint')}
            </ThemedText>
          </View>
          <AboutCard community={effective} onGoTab={setTab} />
        </ScrollView>
      );
    }
    return (
      <CommunityFeed
        communityId={communityId}
        header={<AboutCard community={effective} onGoTab={setTab} />}
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Icon name="chevronLeft" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.topTitle} numberOfLines={1}>
            {effective.name}
          </ThemedText>
        </View>

        {/* Header */}
        <CommunityHeader
          community={effective}
          onStatusChange={handleStatusChange}
          onRequestCode={() => setCodeOpen(true)}
        />

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {tabs.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[
                  styles.tabItem,
                  isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
                ]}>
                <ThemedText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={[
                    styles.tabLabel,
                    { color: isActive ? theme.primary : theme.textSecondary },
                  ]}>
                  {t(item.labelKey)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'members' && (
            <MemberList communityId={communityId} isAdmin={isPrivileged} />
          )}
          {activeTab === 'rules' && (
            <RuleList communityId={communityId} isAdmin={isPrivileged} />
          )}
          {activeTab === 'manage' && (
            <ManageTab
              communityId={communityId}
              community={effective}
              onUpdate={() => {
                void load();
              }}
            />
          )}
        </View>

        <JoinCodeModal
          visible={codeOpen}
          communityId={effective.id}
          communityName={effective.name}
          onClose={() => setCodeOpen(false)}
          onJoined={handleStatusChange}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingHorizontal: Spacing.xs,
  },
  tabLabel: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  locked: {
    margin: Spacing.md,
    marginBottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lockedTitle: {
    ...Typography.h2,
    fontSize: 17,
    textAlign: 'center',
  },
  lockedHint: {
    ...Typography.body,
    fontSize: 14,
    textAlign: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  errorTitle: {
    ...Typography.h2,
    fontSize: 17,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 9999,
  },
  primaryBtnText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  linkBtn: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  skeletonHeader: {
    backgroundColor: 'transparent',
  },
  skeletonCover: {
    height: 140,
    width: '100%',
  },
  skeletonInfo: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  skeletonAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginTop: -42,
    borderWidth: 3,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
});
