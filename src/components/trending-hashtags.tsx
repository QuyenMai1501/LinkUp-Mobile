import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getTrendingHashtags } from '@/api/search';
import { formatCount } from '@/utils/format';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { HashtagSearchResult } from '@/types/search';

/**
 * Danh sách hashtag thịnh hành (GET /api/trending) — mirror web RightSidebar
 * trending card, dùng làm tab trên feed (web không có tab này — mobile-only).
 * Tap row → screen hashtag feed.
 */
export default function TrendingHashtags() {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();

  const [items, setItems] = useState<HashtagSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Nhường event loop trước khi setState — react-hooks/set-state-in-effect.
      await Promise.resolve();
      setError(null);
      const res = await getTrendingHashtags();
      setItems(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('feed.trendingError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleRefresh = useCallback(async () => {
    await load();
  }, [load]);
  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const openHashtag = useCallback(
    (name: string) => {
      (router as any).push(`/(drawer)/hashtag/${encodeURIComponent(name)}`);
    },
    [router],
  );

  const renderItem = ({ item }: { item: HashtagSearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: theme.bgHover }]}
      onPress={() => openHashtag(item.name)}>
      <View style={[styles.iconBox, { backgroundColor: theme.primaryLight }]}>
        <ThemedText style={[styles.iconBoxHash, { color: theme.primary }]}>#</ThemedText>
      </View>
      <View style={styles.itemMeta}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          #{item.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.itemSub} numberOfLines={1}>
          {formatCount(item.post_count, language)} {t('search.posts')}
        </ThemedText>
      </View>
      <Icon name="chevronRight" size={18} color={theme.textSecondary} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText themeColor="textSecondary" style={styles.stateText}>
          {t('common.loading')}
        </ThemedText>
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Icon name="warning" size={48} color={theme.accent} />
        <ThemedText style={styles.stateText}>{error}</ThemedText>
        <Pressable
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={({ pressed }) => [styles.retryBtn, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText style={[styles.retryBtnText, { color: theme.textOnPrimary }]}>
            {t('common.retry')}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.name}
      renderItem={renderItem}
      contentContainerStyle={[
        styles.listContent,
        items.length === 0 && styles.listContentEmpty,
      ]}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <ThemedText style={styles.emptyHash}>#</ThemedText>
          <ThemedText style={styles.stateText}>{t('feed.trendingEmpty')}</ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxHash: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 17,
  },
  itemMeta: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  itemSub: {
    fontSize: 12,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  stateText: {
    ...Typography.body,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHash: {
    fontSize: 48,
    fontWeight: '700',
    opacity: 0.4,
    lineHeight: 54,
  },
  retryBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
  },
  retryBtnText: {
    ...Typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
