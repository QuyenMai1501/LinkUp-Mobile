import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { apiErrorMessage } from '@/api/client';
import { getAdAnalytics } from '@/api/partner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AD_STATUS_BADGES } from '@/constants/ad-status';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { AdPerformance } from '@/types/partner';
import {
  formatCount,
  formatDate,
  formatPercent,
  formatVnd,
} from '@/utils/format';

/** CPC/CPM có thể là số lẻ → giữ 2 chữ số thay vì làm tròn về 0. */
const money = (v: number) =>
  Number.isInteger(v) ? formatVnd(v) : `${v.toFixed(2)} ₫`;

export default function AdAnalyticsScreen() {
  const colors = useTheme();
  const { t, language } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' && params.id ? params.id : '';

  const [data, setData] = useState<AdPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await getAdAnalytics(id);
      setData(d);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, t('common.error')));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    void load();
  }, [load]);

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

  if (loading && !data) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </ThemedView>
    );
  }

  if (!data) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText
          type="small"
          style={[styles.errorText, { color: colors.danger }]}>
          {error}
        </ThemedText>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={retry}>
          <ThemedText style={styles.retryText}>{t('common.retry')}</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const o = data;
  const badge = AD_STATUS_BADGES[o.status] ?? {
    bg: colors.card,
    fg: colors.text,
  };
  const spentPct =
    o.budget > 0 ? Math.min(1, o.total_spent / o.budget) : 0;

  const performanceStats = [
    { labelKey: 'partner.analytics.impressions', value: formatCount(o.impressions, language) },
    { labelKey: 'partner.analytics.uniqueReach', value: formatCount(o.unique_reach, language) },
    { labelKey: 'partner.analytics.clicks', value: formatCount(o.clicks, language) },
    { labelKey: 'partner.analytics.interactions', value: formatCount(o.interactions, language) },
  ];
  const perfRows: (typeof performanceStats)[] = [];
  for (let i = 0; i < performanceStats.length; i += 2) {
    perfRows.push(performanceStats.slice(i, i + 2));
  }

  const rates: { labelKey: string; value: string }[] = [
    { labelKey: 'partner.analytics.ctr', value: formatPercent(o.click_through_rate) },
    { labelKey: 'partner.analytics.cpc', value: money(o.cost_per_click) },
    { labelKey: 'partner.analytics.cpm', value: money(o.cost_per_thousand_impressions) },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
          <View style={styles.headerRow}>
            <ThemedText
              type="smallBold"
              style={styles.adTitle}
              numberOfLines={2}>
              {o.title}
            </ThemedText>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <ThemedText style={[styles.badgeText, { color: badge.fg }]}>
                {statusLabel(o.status)}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('partner.form.format')}:{' '}
            {o.format.charAt(0).toUpperCase() + o.format.slice(1)}
          </ThemedText>
          {o.started_at && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('partner.ads.startDate')}:{' '}
              {formatDate(o.started_at, language)}
            </ThemedText>
          )}
          {o.expires_at && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('partner.ads.endDate')}: {formatDate(o.expires_at, language)}
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('partner.analytics.remainingBudget')}
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
          <ThemedText type="small" themeColor="textSecondary">
            {t('partner.analytics.totalSpent')}: {formatVnd(o.total_spent)}
            {'  ·  '}
            {t('partner.overview.totalBudget')}: {formatVnd(o.budget)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('partner.form.dailyBudget')}: {formatVnd(o.daily_budget)}
          </ThemedText>
        </ThemedView>

        {perfRows.map((row, index) => (
          <View key={index} style={styles.statRow}>
            {row.map((stat) => (
              <ThemedView
                key={stat.labelKey}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                <ThemedText style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}>
                  {t(stat.labelKey)}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        ))}

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          <ThemedText style={styles.cardTitle}>
            {t('partner.analytics.performance')}
          </ThemedText>
          {rates.map((r) => (
            <View key={r.labelKey} style={styles.kvRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t(r.labelKey)}
              </ThemedText>
              <ThemedText type="smallBold">{r.value}</ThemedText>
            </View>
          ))}
        </ThemedView>

        {o.format === 'video' && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <ThemedText style={styles.cardTitle}>
              {t('partner.form.format')}: Video
            </ThemedText>
            <View style={styles.kvRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.analytics.videoStarts')}
              </ThemedText>
              <ThemedText type="smallBold">
                {formatCount(o.video_starts ?? 0, language)}
              </ThemedText>
            </View>
            <View style={styles.kvRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.analytics.videoCompletions')}
              </ThemedText>
              <ThemedText type="smallBold">
                {formatCount(o.video_completions ?? 0, language)}
              </ThemedText>
            </View>
          </ThemedView>
        )}
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
  retryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  retryText: { color: '#fff', fontWeight: '600' },
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
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  adTitle: { flex: 1, fontSize: 16 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  heroValue: { fontSize: 28, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  fill: { height: 8, borderRadius: 4 },
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
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
