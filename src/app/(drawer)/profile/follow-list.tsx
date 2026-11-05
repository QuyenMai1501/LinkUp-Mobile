import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/contexts/auth-context';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { followUser, getFollowers, getFollowing } from '@/api/follow';
import { navigateToProfile } from '@/utils/profile-nav';
import type { FollowListItem, FollowListResponse } from '@/types/profile';

const PAGE_SIZE = 20;

type ListType = 'followers' | 'following';

interface RowState {
  following: boolean;
  busy: boolean;
}

/**
 * Danh sách người theo dõi / đang theo dõi — mirror web ProfileFollowersModal
 * (GET /follow/:id/followers|following, phân trang page-based, follow inline).
 */
export default function FollowListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { user: authUser } = useAuth();

  const params = useLocalSearchParams<{ userId?: string; type?: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const type: ListType =
    (Array.isArray(params.type) ? params.type[0] : params.type) === 'following'
      ? 'following'
      : 'followers';

  const [items, setItems] = useState<FollowListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const lastKeyRef = useRef(`${userId}:${type}`);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!userId || loadingRef.current) return;
      loadingRef.current = true;
      try {
        // Nhường event loop trước khi setState — react-compiler cấm
        // setState đồng bộ trong effect (fetchPage chạy từ useEffect).
        await Promise.resolve();
        if (!reset) setLoadingMore(true);
        setError(null);
        const page = reset ? 1 : pageRef.current;
        const res: FollowListResponse =
          type === 'followers'
            ? await getFollowers(userId, page, PAGE_SIZE)
            : await getFollowing(userId, page, PAGE_SIZE);
        // Server cũ có thể trả data:null → guard.
        const data = res.data ?? [];
        setItems((prev) => {
          const base = reset ? data : [...prev, ...data];
          const seen = new Set<string>();
          return base.filter((u) => (seen.has(u.user_id) ? false : (seen.add(u.user_id), true)));
        });
        setTotal(res.total);
        pageRef.current = page + 1;
        setHasMore(res.has_more && data.length > 0);
        if (reset) {
          const states: Record<string, RowState> = {};
          for (const u of data) states[u.user_id] = { following: false, busy: false };
          setRowStates(states);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [userId, type, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const key = `${userId}:${type}`;
      if (lastKeyRef.current !== key) {
        lastKeyRef.current = key;
        setItems([]);
        pageRef.current = 1;
        setHasMore(true);
        setLoading(true);
        setError(null);
      }
      void fetchPage(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPage, userId, type]);

  const handleRefresh = useCallback(async () => {
    setHasMore(true);
    await fetchPage(true);
  }, [fetchPage]);
  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingRef.current) void fetchPage(false);
  }, [hasMore, fetchPage]);

  const handleToggleFollow = useCallback(
    async (targetId: string) => {
      setRowStates((prev) => {
        const cur = prev[targetId] ?? { following: false, busy: false };
        if (cur.busy) return prev;
        return { ...prev, [targetId]: { ...cur, busy: true } };
      });
      try {
        const res = await followUser(targetId);
        setRowStates((prev) => ({
          ...prev,
          [targetId]: { following: res.is_following, busy: false },
        }));
      } catch {
        setRowStates((prev) => {
          const cur = prev[targetId] ?? { following: false, busy: false };
          return { ...prev, [targetId]: { ...cur, busy: false } };
        });
      }
    },
    [],
  );

  const goBack = () => {
    if ((navigation as any).canGoBack?.()) {
      (navigation as any).goBack();
    } else {
      (navigation as any).navigate?.('index');
    }
  };

  const title = type === 'followers' ? t('profile.followers') : t('profile.following');

  const renderRow = ({ item }: { item: FollowListItem }) => {
    const isSelf = item.user_id === authUser?.id;
    const row = rowStates[item.user_id] ?? { following: false, busy: false };
    return (
      <Pressable
        onPress={() => navigateToProfile(router, item.user_id)}
        style={[styles.row, { borderBottomColor: theme.divider }]}>
        {item.avatar_uri ? (
          <Image source={{ uri: item.avatar_uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarInitial, { color: theme.primary }]}>
              {(item.display_name || item.username || '?').charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={styles.rowMeta}>
          <ThemedText style={styles.rowName} numberOfLines={1}>
            {item.display_name}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.rowUsername} numberOfLines={1}>
            @{item.username}
          </ThemedText>
        </View>
        {!isSelf && (
          <Pressable
            onPress={() => handleToggleFollow(item.user_id)}
            disabled={row.busy}
            style={[
              styles.followBtn,
              { backgroundColor: row.following ? theme.border : theme.primary },
              row.busy && { opacity: 0.6 },
            ]}>
            {row.busy ? (
              <ActivityIndicator size="small" color={row.following ? theme.text : theme.textOnPrimary} />
            ) : (
              <ThemedText
                style={[
                  styles.followBtnText,
                  { color: row.following ? theme.text : theme.textOnPrimary },
                ]}>
                {row.following ? t('profile.unfollow') : t('profile.follow')}
              </ThemedText>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    if (error && items.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Icon name="warning" size={40} color={theme.accent} />
          <ThemedText themeColor="textSecondary" style={styles.emptyTitle}>
            {error}
          </ThemedText>
          <Pressable
            onPress={() => {
              pageRef.current = 1;
              setLoading(true);
              void fetchPage(true);
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.7 },
            ]}>
            <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
              {t('common.retry')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }
    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item.user_id}
        renderItem={renderRow}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
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
            <Icon name="person" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.emptyTitle}>
              {type === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}
            </ThemedText>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : !hasMore && items.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endMessage}>
              {t('common.noResults')}
            </ThemedText>
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
        ]}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Icon name="chevronLeft" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          {!loading && !error && total > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.headerCount}>
              {total}
            </ThemedText>
          )}
        </View>
      </View>
      <View style={styles.container}>{renderContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: { flex: 1 },
  headerTitle: { ...Typography.h2, fontSize: 17 },
  headerCount: { fontSize: 12, marginTop: 1 },
  listContent: { paddingVertical: Spacing.xs },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { ...Typography.body, textAlign: 'center' },
  primaryBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 999,
  },
  primaryBtnText: { ...Typography.body, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700' },
  rowMeta: { flex: 1 },
  rowName: { ...Typography.body, fontWeight: '600' },
  rowUsername: { fontSize: 13, marginTop: 1 },
  followBtn: {
    minWidth: 100,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  followBtnText: { ...Typography.body, fontSize: 14, fontWeight: '600' },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: { fontSize: 14 },
  endMessage: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: 14,
  },
});
