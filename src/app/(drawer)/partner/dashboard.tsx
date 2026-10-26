import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { apiErrorMessage } from '@/api/client';
import { getOverview } from '@/api/partner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { AdOverview } from '@/types/partner';
import {
  formatCount,
  formatDate,
  formatPercent,
  formatVnd,
} from '@/utils/format';

export default function PartnerDashboardScreen() {
  const colors = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();

  const [overview, setOverview] = useState<AdOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getOverview();
      setOverview(data);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, t('common.error')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    void load();
  }, [load]);

  if (loading && !overview) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </ThemedView>
    );
  }

  if (!overview) {
    // Không tải được (403 chưa có gói / lỗi mạng) → retry + lối vào packages.
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="small" style={[styles.errorText, { color: colors.danger }]}>
          {error}
        </ThemedText>
        <View style={styles.errBtns}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.errBtn, { backgroundColor: colors.primary }]}
            onPress={retry}>
            <ThemedText style={styles.errBtnPrimaryText}>
              {t('common.retry')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.errBtn, styles.errBtnOutline, { borderColor: colors.primary }]}
            onPress={() => router.push('/partner/packages' as never)}>
            <ThemedText style={[styles.errBtnPrimaryText, { color: colors.primary }]}>
              {t('packages.becomePartner')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const o = overview;
  const spentPct =
    o.total_budget > 0 ? Math.min(1, o.total_spent / o.total_budget) : 0;

  const stats = [
    { labelKey: 'partner.overview.totalBudget', value: formatVnd(o.total_budget) },
    { labelKey: 'partner.overview.totalSpent', value: formatVnd(o.total_spent) },
    { labelKey: 'partner.overview.impressions', value: formatCount(o.impressions, language) },
    { labelKey: 'partner.overview.clicks', value: formatCount(o.clicks, language) },
    { labelKey: 'partner.overview.ctr', value: formatPercent(o.ctr) },
    { labelKey: 'partner.overview.activeAds', value: formatCount(o.active_ads, language) },
  ];
  const statRows: (typeof stats)[] = [];
  for (let i = 0; i < stats.length; i += 2) {
    statRows.push(stats.slice(i, i + 2));
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        {error && (
          <ThemedText type="small" style={{ color: colors.danger }}>
            {error}
          </ThemedText>
        )}

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('partner.overview.remaining')}
          </ThemedText>
          <ThemedText style={[styles.heroValue, { color: colors.primary }]}>
            {formatVnd(o.remaining_budget)}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.primary,
                  width: `${spentPct * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.heroRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('partner.overview.totalBudget')}: {formatVnd(o.total_budget)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('partner.overview.totalSpent')}: {formatVnd(o.total_spent)}
            </ThemedText>
          </View>
        </ThemedView>

        {statRows.map((row, index) => (
          <View key={index} style={styles.statRow}>
            {row.map((stat) => (
              <ThemedView
                key={stat.labelKey}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}>
                  {t(stat.labelKey)}
                </ThemedText>
                <ThemedText style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        ))}

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/partner/ads' as never)}>
          <ThemedText style={styles.ctaBtnText}>{t('partner.ads.title')}</ThemedText>
        </TouchableOpacity>

        {o.subscription_name ? (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <ThemedText style={styles.cardTitle}>
              {t('partner.overview.subscription')}
            </ThemedText>
            <ThemedText type="smallBold">{o.subscription_name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('partner.overview.slotsUsed')}: {o.slots_used}/{o.max_slots}
            </ThemedText>
            {o.expires_at && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.overview.expiresAt')}:{' '}
                {formatDate(o.expires_at, language)}
              </ThemedText>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.upgradeBtn, { borderColor: colors.primary }]}
              onPress={() => router.push('/partner/packages' as never)}>
              <ThemedText
                type="small"
                style={{ color: colors.primary, fontWeight: '600' }}>
                {t('partner.packages.upgrade')}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: { textAlign: 'center' },
  errBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  errBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  errBtnOutline: { borderWidth: 1 },
  errBtnPrimaryText: { color: '#fff', fontWeight: '600' },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  heroValue: { fontSize: 30, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  fill: { height: 8, borderRadius: 4 },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: 2,
  },
  statValue: { fontSize: 17, fontWeight: '700' },
  upgradeBtn: {
    marginTop: 4,
    height: 36,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
