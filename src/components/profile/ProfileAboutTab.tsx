import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { RichContent } from '@/components/rich-content';
import { showAlert } from '@/utils/alert';
import { getEmojiTextMap } from '@/utils/emojis';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ViewProfileResponse } from '@/types/profile';

const EMOJI_MAP = getEmojiTextMap();

function formatDate(dateStr?: string, language = 'vi'): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
  const theme = useTheme();
  const { t, language } = useTranslation();

  const openWebsite = (url: string) => {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    Linking.openURL(href).catch(() => {
      showAlert(t('common.error'), href);
    });
  };

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
    infoItems.push({ icon: '🎂', label: t('profile.birthday'), value: formatDate(profile.date_of_birth, language) });
  }

  if (!profile.bio && infoItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="document" size={48} color={theme.textSecondary} />
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
          <RichContent content={profile.bio} emojiMap={EMOJI_MAP} style={[styles.bioText, { color: theme.text }]} />
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
                {item.isLink ? (
                  <Pressable onPress={() => openWebsite(item.value)}>
                    <ThemedText style={[styles.infoValue, { color: theme.primary, textDecorationLine: 'underline' }]}>
                      {item.value}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText style={styles.infoValue}>{item.value}</ThemedText>
                )}
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
  emptyText: { ...Typography.body },
});
