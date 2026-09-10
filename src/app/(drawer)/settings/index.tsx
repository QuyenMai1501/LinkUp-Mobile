import { TouchableOpacity, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';

const SETTINGS_ITEMS = [
  { key: 'change-password', icon: '🔒', labelKey: 'settings.items.changePassword.label', descKey: 'settings.items.changePassword.desc' },
  { key: 'privacy', icon: '🛡️', labelKey: 'settings.items.privacy.label', descKey: 'settings.items.privacy.desc' },
  { key: 'storage', icon: '💾', labelKey: 'settings.items.storage.label', descKey: 'settings.items.storage.desc' },
  { key: 'appearance', icon: '🎨', labelKey: 'settings.items.appearance.label', descKey: 'settings.items.appearance.desc' },
  { key: 'sessions', icon: '💻', labelKey: 'settings.items.sessions.label', descKey: 'settings.items.sessions.desc' },
  { key: 'notifications', icon: '🔔', labelKey: 'settings.items.notifications.label', descKey: 'settings.items.notifications.desc' },
  { key: 'deactivate', icon: '⚠️', labelKey: 'settings.items.deactivate.label', descKey: 'settings.items.deactivate.desc' },
] as const;

export default function SettingsIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useTheme();
  const { t } = useTranslation();

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.headerRow}>
          <Pressable onPress={openDrawer} style={styles.menuBtn}>
            <ThemedText style={[styles.menuIcon, { color: colors.text }]}>☰</ThemedText>
          </Pressable>
          <ThemedText style={styles.header}>{t('settings.title')}</ThemedText>
        </ThemedView>
        <ScrollView contentContainerStyle={styles.list}>
          {SETTINGS_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => router.push(`/(drawer)/settings/${item.key}` as any)}
              activeOpacity={0.7}>
              <ThemedView
                style={[
                  styles.item,
                  { backgroundColor: colors.card },
                  index === SETTINGS_ITEMS.length - 1 && styles.itemLast,
                ]}>
                <ThemedText style={styles.icon}>{item.icon}</ThemedText>
                <ThemedView style={styles.itemContent}>
                  <ThemedText style={styles.label}>{t(item.labelKey)}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.desc}>
                    {t(item.descKey)}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={[styles.arrow, { color: colors.textSecondary }]}>›</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  menuBtn: { padding: Spacing.xs },
  menuIcon: { fontSize: 22 },
  header: {
    fontSize: 28,
    fontWeight: '700',
  },
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.md,
  },
  itemLast: {},
  icon: { fontSize: 24 },
  itemContent: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 13 },
  arrow: { fontSize: 22, fontWeight: '300' },
});
