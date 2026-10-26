import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { showAlert } from '@/utils/alert';
import { apiErrorMessage } from '@/api/client';
import { deleteAd, getMyAds, updateAdStatus } from '@/api/partner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { AD_STATUS_BADGES } from '@/constants/ad-status';
import { type IconName } from '@/constants/icon-map';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { PartnerAdListItem } from '@/types/partner';
import { formatCount, formatPercent, formatVnd } from '@/utils/format';

const PAGE_SIZE = 20;

const STATUS_FILTERS = ['', 'active', 'paused', 'pending', 'rejected', 'completed'];

function ActionButton({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.actionBtn, { borderColor: danger ? colors.danger : colors.border }]}>
      <Icon name={icon} size={14} color={fg} />
      <ThemedText style={[styles.actionLabel, { color: fg }]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

export default function PartnerAdsScreen() {
  const colors = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();

  const [items, setItems] = useState<PartnerAdListItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  // Debounce search 400ms (y hệt web)
  useEffect(() => {
    const id = setTimeout(() => {
      setKeyword((prev) => (prev === searchInput ? prev : searchInput));
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;
      loadingRef.current = true;
      setFetching(true);
      if (reset) setError(null);
      try {
        const next = reset ? 1 : pageRef.current + 1;
        const res = await getMyAds({
          page: next,
          page_size: PAGE_SIZE,
          keyword: keyword.trim() || undefined,
          status: statusFilter || undefined,
        });
        pageRef.current = res.page;
        hasMoreRef.current = res.page * PAGE_SIZE < res.total;
        setItems((prev) => (reset ? res.ads : [...prev, ...res.ads]));
      } catch (e) {
        setError(apiErrorMessage(e, t('common.error')));
      } finally {
        setFetching(false);
        loadingRef.current = false;
      }
    },
    [keyword, statusFilter, t],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchPage(true);
    }, [fetchPage]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchPage(true).finally(() => setRefreshing(false));
  }, [fetchPage]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: t('partner.ads.active'),
      paused: t('partner.ads.paused'),
      completed: t('partner.ads.completed'),
      pending: t('partner.ads.pending'),
      rejected: t('partner.ads.rejected'),
    };
    return map[s] ?? s;
  };

  const handleTogglePause = async (ad: PartnerAdListItem) => {
    const newStatus = ad.status === 'active' ? 'paused' : 'active';
    try {
      await updateAdStatus(ad.id, newStatus);
      showAlert(t('common.success'), t('partner.form.updateSuccess'));
      void fetchPage(true);
    } catch (e) {
      showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
    }
  };

  const handleDelete = (ad: PartnerAdListItem) => {
    showAlert(t('partner.ads.delete'), t('partner.ads.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteAd(ad.id);
              showAlert(t('common.success'), t('partner.form.deleteSuccess'));
              void fetchPage(true);
            } catch (e) {
              showAlert(
                t('common.error'),
                apiErrorMessage(e, t('common.error')),
              );
            }
          })();
        },
      },
    ]);
  };

  const renderItem = ({ item: ad }: { item: PartnerAdListItem }) => {
    const badge = AD_STATUS_BADGES[ad.status] ?? {
      bg: colors.card,
      fg: colors.text,
    };
    const manageable = ad.status === 'active' || ad.status === 'paused';
    return (
      <ThemedView
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}>
        <View style={styles.cardTop}>
          {ad.media_uri ? (
            <Image
              source={{ uri: ad.media_uri }}
              style={styles.thumb}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View
              style={[
                styles.thumb,
                styles.thumbFallback,
                { backgroundColor: colors.primaryLight },
              ]}>
              <Icon name="images" size={20} color={colors.primary} />
            </View>
          )}
          <View style={styles.cardTitleCol}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {ad.title}
            </ThemedText>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <ThemedText style={[styles.badgeText, { color: badge.fg }]}>
                {statusLabel(ad.status)}
              </ThemedText>
            </View>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {t('partner.ads.budget')}: {formatVnd(ad.budget)} ·{' '}
          {t('partner.ads.ctr')}: {formatPercent(ad.ctr)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('partner.ads.impressions')}: {formatCount(ad.impressions, language)}{' '}
          · {t('partner.ads.clicks')}: {formatCount(ad.clicks, language)}
        </ThemedText>

        <View style={styles.actions}>
          {manageable && (
            <ActionButton
              icon={ad.status === 'active' ? 'pause' : 'play'}
              label={
                ad.status === 'active'
                  ? t('partner.ads.pause')
                  : t('partner.ads.resume')
              }
              onPress={() => void handleTogglePause(ad)}
            />
          )}
          <ActionButton
            icon="pencil"
            label={t('common.edit')}
            onPress={() =>
              router.push({
                pathname: '/partner/ad-form',
                params: { id: ad.id },
              } as never)
            }
          />
          <ActionButton
            icon="stats"
            label={t('partner.nav.analytics')}
            onPress={() =>
              router.push({
                pathname: '/partner/ad-analytics',
                params: { id: ad.id },
              } as never)
            }
          />
          <ActionButton
            icon="trash"
            label={t('common.delete')}
            danger
            onPress={() => handleDelete(ad)}
          />
        </View>
      </ThemedView>
    );
  };

  const toolbar = (
    <View style={styles.toolbar}>
      <TextInput
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t('partner.ads.searchPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        returnKeyType="search"
        autoCapitalize="none"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          return (
            <TouchableOpacity
              key={s || 'all'}
              activeOpacity={0.75}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}>
              <ThemedText
                type="small"
                style={{
                  color: active ? colors.textOnPrimary : colors.text,
                  fontWeight: active ? '600' : '400',
                }}>
                {s === '' ? t('partner.ads.allStatus') : statusLabel(s)}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.createBtn, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/partner/ad-form' as never)}>
        <Icon name="add" size={18} color={colors.textOnPrimary} />
        <ThemedText style={[styles.createBtnText, { color: colors.textOnPrimary }]}>
          {t('partner.ads.create')}
        </ThemedText>
      </TouchableOpacity>
      {error && (
        <ThemedText type="small" style={{ color: colors.danger }}>
          {error}
        </ThemedText>
      )}
    </View>
  );

  const initialLoading = fetching && items.length === 0 && !error;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(ad) => ad.id}
        renderItem={renderItem}
        ListHeaderComponent={toolbar}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!fetching) void fetchPage(false);
        }}
        ListFooterComponent={
          fetching && items.length > 0 ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.footerSpinner}
            />
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.emptyBox}
            />
          ) : items.length === 0 && !error ? (
            <View style={styles.emptyBox}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.ads.noAds')}
              </ThemedText>
            </View>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  toolbar: { gap: Spacing.sm, marginBottom: Spacing.xs },
  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipsRow: { gap: Spacing.xs, paddingRight: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
  },
  createBtnText: { fontSize: 15, fontWeight: '600' },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleCol: { flex: 1, gap: 4, alignItems: 'flex-start' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionLabel: { fontSize: 12, fontWeight: '500' },
  footerSpinner: { paddingVertical: Spacing.sm },
  emptyBox: { paddingVertical: Spacing.lg, alignItems: 'center' },
});
