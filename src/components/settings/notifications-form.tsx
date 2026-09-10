import { useEffect, useState } from 'react';
import { Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPreferences, updatePreferences as apiUpdatePreferences } from '@/api/notifications';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';
import type { NotificationPreferences } from '@/types/notification';

type PrefKey = keyof NotificationPreferences;

const PREF_ROWS: { key: PrefKey; labelKey: string }[] = [
  { key: 'like_enabled', labelKey: 'settings.notificationsPrefs.likePost' },
  { key: 'comment_enabled', labelKey: 'settings.notificationsPrefs.comment' },
  { key: 'follow_enabled', labelKey: 'settings.notificationsPrefs.follow' },
  { key: 'message_enabled', labelKey: 'settings.notificationsPrefs.message' },
  { key: 'friend_request_enabled', labelKey: 'settings.notificationsPrefs.friendRequest' },
  { key: 'community_enabled', labelKey: 'settings.notificationsPrefs.community' },
  { key: 'voice_call_enabled', labelKey: 'settings.notificationsPrefs.voiceCall' },
];

const DEFAULT_PREFS: NotificationPreferences = {
  like_enabled: true,
  comment_enabled: true,
  follow_enabled: true,
  message_enabled: true,
  friend_request_enabled: true,
  community_enabled: true,
  voice_call_enabled: true,
};

export default function NotificationsForm() {
  const colors = useTheme();
  const { t } = useTranslation();

  const [values, setValues] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [initial, setInitial] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await getPreferences();
        if (cancelled) return;
        const data = res.data ?? DEFAULT_PREFS;
        setValues(data);
        setInitial(data);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const dirty =
    initial !== null &&
    PREF_ROWS.some((row) => values[row.key] !== initial[row.key]);

  const handleSave = async () => {
    if (!initial || !dirty) return;
    setSaving(true);
    try {
      const input: Partial<NotificationPreferences> = {};
      for (const row of PREF_ROWS) {
        if (values[row.key] !== initial[row.key]) {
          input[row.key] = values[row.key];
        }
      }
      await apiUpdatePreferences(input);
      setInitial({ ...values });
      Alert.alert(t('common.success'), t('settings.notificationsPrefs.saveSuccess'));
    } catch {
      Alert.alert(t('common.error'), t('settings.notificationsPrefs.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {PREF_ROWS.map((row) => (
        <ThemedView key={row.key} style={[styles.row, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.label}>{t(row.labelKey)}</ThemedText>
          <Switch
            value={values[row.key]}
            onValueChange={(v) =>
              setValues((prev) => ({ ...prev, [row.key]: v }))
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </ThemedView>
      ))}

      {dirty && (
        <ThemedView style={styles.saveRow}>
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ThemedText
              style={[styles.saveBtn, { color: colors.primary }]}
              onPress={handleSave}>
              {t('settings.notificationsPrefs.saveButton')}
            </ThemedText>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 12,
  },
  label: { fontSize: 15, fontWeight: '500' },
  saveRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  saveBtn: { fontSize: 16, fontWeight: '600' },
});
