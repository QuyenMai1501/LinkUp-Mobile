import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { apiErrorMessage } from '@/api/client';
import { getMyPayments } from '@/api/payments';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { PaymentTransaction } from '@/types/wallet';
import { formatDate, formatVnd } from '@/utils/format';

export default function PartnerPaymentsScreen() {
  const colors = useTheme();
  const { t, language } = useTranslation();
  const [items, setItems] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getMyPayments({ page: 1, page_size: 50 });
      setItems(res.data ?? []);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('partner.payments.title') }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }>
        {error ? (
          <ThemedText type="small" style={{ color: colors.danger }}>
            {error}
          </ThemedText>
        ) : null}
        {items.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('partner.payments.empty')}
          </ThemedText>
        ) : (
          items.map((tx) => (
            <ThemedView
              key={tx.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}>
              <View style={styles.rowBetween}>
                <ThemedText type="smallBold">
                  {tx.package?.name ?? tx.package_id}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {tx.status}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {tx.txn_ref} · {tx.gateway}
              </ThemedText>
              <View style={styles.rowBetween}>
                <ThemedText type="smallBold" style={{ color: colors.primary }}>
                  {formatVnd(tx.amount)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(tx.paid_at ?? tx.created_at, language)}
                </ThemedText>
              </View>
            </ThemedView>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
