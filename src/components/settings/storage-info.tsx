import { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getStorage } from '@/api/settings';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';
import type { UserStorageInfo } from '@/types/settings';

function formatBytes(bytes: number): { value: string; unit: string } {
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024 * 1024) {
    return { value: (bytes / (1024 * 1024 * 1024)).toFixed(1), unit: 'GB' };
  }
  if (abs >= 1024 * 1024) {
    return { value: (bytes / (1024 * 1024)).toFixed(1), unit: 'MB' };
  }
  return { value: (bytes / 1024).toFixed(1), unit: 'KB' };
}

export default function StorageInfo() {
  const colors = useTheme();
  const { t } = useTranslation();

  const [storage, setStorage] = useState<UserStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await getStorage();
        if (!cancelled) setStorage(res);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (!storage) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('settings.storage.loadFailed')}</ThemedText>
      </ThemedView>
    );
  }

  const quota = formatBytes(storage.quota_bytes);
  const used = formatBytes(storage.used_bytes);
  const avail = formatBytes(storage.avail_bytes);
  const percent = storage.quota_bytes > 0
    ? Math.min(100, (storage.used_bytes / storage.quota_bytes) * 100)
    : 0;

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.usedValue}>
          {used.value}
          <ThemedText style={styles.usedUnit}> {used.unit}</ThemedText>
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.quotaLabel}>
          {t('settings.storage.quota')}{quota.value} {quota.unit}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.progressBg}>
        <ThemedView
          style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.primary }]}
        />
      </ThemedView>

      <ThemedView style={styles.stats}>
        <ThemedView style={[styles.stat, { backgroundColor: colors.card }]}>
          <ThemedText style={[styles.statValue, { color: colors.primary }]}>
            {used.value} {used.unit}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel}>{t('settings.storage.used')}</ThemedText>
        </ThemedView>
        <ThemedView style={[styles.stat, { backgroundColor: colors.card }]}>
          <ThemedText style={[styles.statValue, { color: colors.primary }]}>
            {avail.value} {avail.unit}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel}>{t('settings.storage.free')}</ThemedText>
        </ThemedView>
        <ThemedView style={[styles.stat, { backgroundColor: colors.card }]}>
          <ThemedText style={[styles.statValue, { color: colors.primary }]}>
            {Math.round(percent)}%
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel}>{t('settings.storage.rate')}</ThemedText>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: Spacing.xs },
  usedValue: { fontSize: 32, fontWeight: '700' },
  usedUnit: { fontSize: 16, fontWeight: '400' },
  quotaLabel: { fontSize: 14 },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 12 },
});
