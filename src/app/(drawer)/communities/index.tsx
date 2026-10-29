import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';

import {
  communityErrorText,
  listCommunities,
  listCreatedCommunities,
  listJoinedCommunities,
} from '@/api/communities';
import CommunityCard from '@/components/communities/community-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityListItem, CommunityListResponse } from '@/types/community';

type Tab = 'discover' | 'joined' | 'created';
type PrivacyFilter = 'all' | 'public' | 'invitation_only';

const PAGE_SIZE = 20;
const MAX_PAGE = 50;
const SKELETON_KEYS = ['sk1', 'sk2', 'sk3', 'sk4', 'sk5', 'sk6'];

function SkeletonCard() {
  const theme = useTheme();
  const shimmer = useShimmer();
  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          opacity: shimmer,
        },
      ]}>
      <View style={[styles.skelCover, { backgroundColor: theme.border }]} />
      <View style={styles.skelBody}>
        <View style={[styles.skelAvatar, { backgroundColor: theme.border, borderColor: theme.bgSecondary }]} />
        <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '70%' }]} />
        <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '90%' }]} />
        <View style={[styles.skelLine, { backgroundColor: theme.border }, { width: '50%' }]} />
        <View style={[styles.skelAction, { backgroundColor: theme.border }]} />
      </View>
    </Animated.View>
  );
}

export default function CommunitiesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  const [tab, setTab] = useState<Tab>('discover');
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all');

  const [items, setItems] = useState<CommunityListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const fetchKey = `${tab}|${debounced.trim()}`;

  // Debounce search 300ms
  useEffect(() => {
    const id = setTimeout(() => setDebounced(keyword), 300);
    return () => clearTimeout(id);
  }, [keyword]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;
      loadingRef.current = true;
      setFetching(true);
      if (reset) setError(null);
      try {
        const page = reset ? 1 : pageRef.current + 1;
        const fetcher =
          tab === 'joined'
            ? listJoinedCommunities
            : tab === 'created'
              ? listCreatedCommunities
              : listCommunities;
        const res: CommunityListResponse = await fetcher(
          page,
          debounced.trim() || undefined,
          PAGE_SIZE,
        );
        const full = res.communities.length === PAGE_SIZE;
        const more =
          full && page < MAX_PAGE && (res.total === 0 || page * PAGE_SIZE < res.total);
        pageRef.current = page;
        hasMoreRef.current = more;
        setHasMore(more);
        setTotal(res.total);
        setItems((prev) => {
          const base = reset ? res.communities : [...prev, ...res.communities];
          const seen = new Set<string>();
          return base.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
        });
        setError(null);
        setLoadedKey(fetchKey);
      } catch (err) {
        setError(communityErrorText(err, t('feed.loadError')));
      } finally {
        setFetching(false);
        loadingRef.current = false;
      }
    },
    [tab, debounced, fetchKey, t],
  );

  // Tải trang 1 khi mount / đổi tab / đổi từ khóa / quay lại màn (focus)
  useFocusEffect(
    useCallback(() => {
      void fetchPage(true);
    }, [fetchPage]),
  );

  const handleRefresh = useCallback(async () => {
    await fetchPage(true);
  }, [fetchPage]);
  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingRef.current) void fetchPage(false);
  }, [hasMore, fetchPage]);

  const handleCardPress = useCallback(
    (community: CommunityListItem) => {
      (router as any).push(`/(drawer)/communities/${community.id}`);
    },
    [router],
  );

  // Sau khi join/pending trong card — cập nhật item tại chỗ để card
  // remount (đổi tab qua skeleton rồi quay lại) vẫn hiển thị đúng badge.
  const handleJoinedCommunity = useCallback((communityId: string, status: 'member' | 'pending') => {
    setItems((prev) =>
      prev.map((c) => (c.id === communityId ? { ...c, membership_status: status } : c)),
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setKeyword('');
    setDebounced('');
    setPrivacyFilter('all');
  }, []);

  const handleOpenCreate = useCallback(() => {
    (router as any).push('/(drawer)/communities/create');
  }, [router]);

  const visible =
    privacyFilter === 'all' ? items : items.filter((c) => c.privacy === privacyFilter);

  const keyMismatch = loadedKey !== fetchKey;
  const showError = keyMismatch && error !== null;
  const showSkeleton = keyMismatch && !showError;
  const filtersActive = keyword.trim().length > 0 || privacyFilter !== 'all';

  const tabs: { key: Tab; labelKey: string }[] = [
    { key: 'discover', labelKey: 'communities.discover' },
    { key: 'joined', labelKey: 'communities.joined' },
    { key: 'created', labelKey: 'communities.created' },
  ];

  const renderBody = () => {
    if (showError) {
      return (
        <View style={styles.centerContent}>
          <Icon name="warning" size={48} color={theme.accent} />
          <ThemedText style={styles.emptyTitle}>{error}</ThemedText>
          <Pressable
            onPress={() => void fetchPage(true)}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (showSkeleton) {
      return (
        <View style={styles.gridFallback}>
          {SKELETON_KEYS.map((k) => (
            <SkeletonCard key={k} />
          ))}
        </View>
      );
    }

    return (
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridColumn}
        renderItem={({ item }) => (
          <CommunityCard
            community={item}
            onPress={handleCardPress}
            onJoinedCommunity={handleJoinedCommunity}
            style={styles.gridItem}
          />
        )}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Icon name="people" size={48} color={theme.primary} />
            <ThemedText style={styles.emptyTitle}>{t('communities.emptyDiscover')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              {t('communities.emptyDiscoverHint')}
            </ThemedText>
            <Pressable
              onPress={handleOpenCreate}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>{t('communities.createBtn')}</ThemedText>
            </Pressable>
            {filtersActive && (
              <Pressable
                onPress={handleClearFilters}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={[styles.ghostBtnText, { color: theme.textSecondary }]}>
                  {t('communities.clearFilters')}
                </ThemedText>
              </Pressable>
            )}
          </View>
        }
        ListFooterComponent={
          fetching && items.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : !hasMore && visible.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endMessage}>
              {t('feed.endOfFeed')}
            </ThemedText>
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          visible.length === 0 && styles.listContentEmpty,
        ]}
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.iconBtn} onPress={openDrawer}>
            <Icon name="menu" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {t('communities.title')}
          </ThemedText>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: theme.primaryLight }]}
            onPress={handleOpenCreate}
            accessibilityLabel={t('communities.createBtn')}>
            <Icon name="add" size={20} color={theme.primary} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {tabs.map((item) => {
            const isActive = tab === item.key;
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
                  {isActive && total > 0 ? ` (${total})` : ''}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.toolbar}>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}>
            <Icon name="search" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={keyword}
              onChangeText={setKeyword}
              placeholder={t('communities.searchPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {keyword.length > 0 && (
              <Pressable onPress={() => setKeyword('')} hitSlop={8}>
                <Icon name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Privacy filter chips */}
          <View style={styles.chipsRow}>
            {(['all', 'public', 'invitation_only'] as const).map((filter) => {
              const active = privacyFilter === filter;
              const label =
                filter === 'all'
                  ? t('communities.filterAll')
                  : filter === 'public'
                    ? t('communities.filterPublic')
                    : t('communities.filterInvitation');
              return (
                <Pressable
                  key={filter}
                  onPress={() => setPrivacyFilter(filter)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.primaryLight : theme.bgSecondary,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText
                    style={[styles.chipLabel, { color: active ? theme.primary : theme.textSecondary }]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {renderBody()}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 20,
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
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
  toolbar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 4,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs + 2,
  },
  chipLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  gridFallback: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  skeleton: {
    width: '47%',
    flexGrow: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  skelCover: {
    height: 84,
  },
  skelBody: {
    padding: Spacing.sm + 4,
    gap: 8,
  },
  skelAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -26,
    borderWidth: 3,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
  },
  skelAction: {
    height: 30,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  gridColumn: {
    gap: Spacing.md,
  },
  gridItem: {
    flex: 1,
  },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
  },
  primaryBtnText: {
    ...Typography.body,
    fontWeight: '600',
  },
  ghostBtn: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
  },
  ghostBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: 14,
  },
  endMessage: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: 14,
  },
});
