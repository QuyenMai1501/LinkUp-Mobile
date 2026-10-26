import { useMemo } from 'react';
import { Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';

import { decodeToken } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import SettingsRow, { type SettingsTone } from '@/components/settings/settings-row';
import { type IconName } from '@/constants/icon-map';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';

type GroupKey = 'account' | 'app' | 'more';

type SettingsItem = {
  key: string;
  icon: IconName;
  tone: SettingsTone;
  group: GroupKey;
  labelKey: string;
  descKey: string;
  path?: string;
};

const SETTINGS_ITEMS: SettingsItem[] = [
  { key: 'change-password', icon: 'lock', tone: 'primary', group: 'account', labelKey: 'settings.items.changePassword.label', descKey: 'settings.items.changePassword.desc' },
  { key: 'privacy', icon: 'shield', tone: 'info', group: 'account', labelKey: 'settings.items.privacy.label', descKey: 'settings.items.privacy.desc' },
  { key: 'security', icon: 'key', tone: 'success', group: 'account', labelKey: 'settings.items.security.label', descKey: 'settings.items.security.desc' },
  { key: 'sessions', icon: 'laptop', tone: 'accent', group: 'account', labelKey: 'settings.items.sessions.label', descKey: 'settings.items.sessions.desc' },
  { key: 'appearance', icon: 'palette', tone: 'accent', group: 'app', labelKey: 'settings.items.appearance.label', descKey: 'settings.items.appearance.desc' },
  { key: 'notifications', icon: 'bell', tone: 'primary', group: 'app', labelKey: 'settings.items.notifications.label', descKey: 'settings.items.notifications.desc' },
  { key: 'storage', icon: 'save', tone: 'info', group: 'app', labelKey: 'settings.items.storage.label', descKey: 'settings.items.storage.desc' },
  { key: 'deactivate', icon: 'warning', tone: 'danger', group: 'more', labelKey: 'settings.items.deactivate.label', descKey: 'settings.items.deactivate.desc' },
];

const GROUPS: { key: GroupKey; titleKey: string }[] = [
  { key: 'account', titleKey: 'settings.sections.account' },
  { key: 'app', titleKey: 'settings.sections.app' },
  { key: 'more', titleKey: 'settings.sections.more' },
];

export default function SettingsIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useTheme();
  const { t } = useTranslation();
  const { accessToken } = useAuth();

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  // Role lấy từ JWT (USER → "Become a Partner"; PARTNER+ → "Partner Hub").
  const items = useMemo(() => {
    const role = accessToken ? decodeToken(accessToken)?.role : undefined;
    if (!role) return SETTINGS_ITEMS;
    const partner: SettingsItem =
      role === 'USER'
        ? {
            key: 'partner-packages',
            icon: 'stats',
            tone: 'primary',
            group: 'more',
            labelKey: 'settings.items.partnerBecome.label',
            descKey: 'settings.items.partnerBecome.desc',
            path: '/partner/packages',
          }
        : {
            key: 'partner-hub',
            icon: 'stats',
            tone: 'primary',
            group: 'more',
            labelKey: 'settings.items.partnerHub.label',
            descKey: 'settings.items.partnerHub.desc',
            path: '/partner/dashboard',
          };
    const idx = SETTINGS_ITEMS.findIndex((i) => i.key === 'deactivate');
    return [...SETTINGS_ITEMS.slice(0, idx), partner, ...SETTINGS_ITEMS.slice(idx)];
  }, [accessToken]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.headerRow}>
          <Pressable onPress={openDrawer} style={styles.menuBtn}>
            <Icon name="menu" size={20} color={colors.text} />
          </Pressable>
          <ThemedText style={styles.header}>{t('settings.title')}</ThemedText>
        </ThemedView>
        <ScrollView contentContainerStyle={styles.list}>
          {GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group.key);
            if (groupItems.length === 0) return null;
            return (
              <ThemedView key={group.key} style={styles.group}>
                <ThemedText themeColor="textSecondary" style={styles.groupTitle}>
                  {t(group.titleKey)}
                </ThemedText>
                <ThemedView
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}>
                  {groupItems.map((item, idx) => (
                    <SettingsRow
                      key={item.key}
                      icon={item.icon}
                      tone={item.tone}
                      label={t(item.labelKey)}
                      hint={t(item.descKey)}
                      onPress={() =>
                        router.push(
                          (item.path ?? `/(drawer)/settings/${item.key}`) as never,
                        )
                      }
                      style={
                        idx < groupItems.length - 1
                          ? { borderBottomWidth: 1, borderBottomColor: colors.border }
                          : undefined
                      }
                    />
                  ))}
                </ThemedView>
              </ThemedView>
            );
          })}
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
  header: {
    fontSize: 28,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  group: { gap: Spacing.sm },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: Spacing.xs,
  },
  card: { borderRadius: 12, borderWidth: 1 },
});
