import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ViewProfileResponse } from '@/types/profile';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${month}/${year}`;
}

interface InfoItem {
  icon: string;
  label: string;
  value: string;
  isLink?: boolean;
}

export function ProfileAboutTab({ profile }: { profile: ViewProfileResponse }) {
  const { t } = useTranslation();

  const infoItems: InfoItem[] = [];

  if (profile.work) {
    infoItems.push({ icon: '💼', label: t('profile.work'), value: profile.work });
  }
  if (profile.location) {
    infoItems.push({ icon: '📍', label: t('profile.location'), value: profile.location });
  }
  if (profile.education) {
    infoItems.push({ icon: '🎓', label: t('profile.education'), value: profile.education });
  }
  if (profile.website) {
    infoItems.push({ icon: '🔗', label: t('profile.website'), value: profile.website, isLink: true });
  }
  if (profile.date_of_birth) {
    infoItems.push({ icon: '🎂', label: t('profile.birthday'), value: formatDate(profile.date_of_birth) });
  }

  if (!profile.bio && infoItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.emptyIcon}>📝</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {t('profile.notFound')}
        </ThemedText>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {profile.bio && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('profile.bio')}</ThemedText>
          <ThemedText style={styles.bioText}>{profile.bio}</ThemedText>
        </View>
      )}

      {infoItems.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('profile.about')}</ThemedText>
          {infoItems.map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <ThemedText style={styles.infoIcon}>{item.icon}</ThemedText>
              <View style={styles.infoContent}>
                <ThemedText themeColor="textSecondary" style={styles.infoLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.infoValue}>{item.value}</ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <ThemedText style={styles.infoIcon}>📅</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.infoLabel}>
          {t('profile.joined')} {formatJoinDate(profile.created_at)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h2, fontSize: 16 },
  bioText: { ...Typography.body },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoIcon: { fontSize: 18, marginTop: 2 },
  infoContent: { flex: 1 },
  infoLabel: { ...Typography.caption },
  infoValue: { ...Typography.body },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl * 2, gap: Spacing.md },
  emptyIcon: { fontSize: 48, lineHeight: 60 },
  emptyText: { ...Typography.body },
});
