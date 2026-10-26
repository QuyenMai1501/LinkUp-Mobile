import { useEffect, useState } from 'react';
import { Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import SettingsRow from '@/components/settings/settings-row';
import { getPrivacy, updatePrivacy } from '@/api/settings';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';
import type { PrivacySettingsResponse } from '@/types/settings';

export default function PrivacyForm() {
  const colors = useTheme();
  const { t } = useTranslation();

  const [initial, setInitial] = useState<PrivacySettingsResponse | null>(null);
  const [discoverable, setDiscoverable] = useState(false);
  const [allowStrangers, setAllowStrangers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await getPrivacy();
        if (cancelled) return;
        setInitial(res);
        setDiscoverable(res.discoverable_in_search);
        setAllowStrangers(res.allow_stranger_messages);
      } catch {
        if (!cancelled) Alert.alert(t('common.error'), t('settings.privacy.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const dirty =
    initial !== null &&
    (discoverable !== initial.discoverable_in_search ||
      allowStrangers !== initial.allow_stranger_messages);

  const handleSave = async () => {
    if (!initial || !dirty) return;
    setSaving(true);
    try {
      const input: Record<string, boolean> = {};
      if (discoverable !== initial.discoverable_in_search) input.discoverable_in_search = discoverable;
      if (allowStrangers !== initial.allow_stranger_messages) input.allow_stranger_messages = allowStrangers;
      const res = await updatePrivacy(input);
      setInitial(res);
      Alert.alert(t('common.success'), t('settings.privacy.saveSuccess'));
    } catch {
      Alert.alert(t('common.error'), t('settings.privacy.saveFailed'));
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
      <SettingsRow
        card
        icon="search"
        tone="info"
        label={t('settings.privacy.searchable')}
        hint={t('settings.privacy.searchableDesc')}>
        <Switch
          value={discoverable}
          onValueChange={setDiscoverable}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.textOnPrimary}
        />
      </SettingsRow>

      <SettingsRow
        card
        icon="chat"
        tone="accent"
        label={t('settings.privacy.strangers')}
        hint={t('settings.privacy.strangersDesc')}>
        <Switch
          value={allowStrangers}
          onValueChange={setAllowStrangers}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.textOnPrimary}
        />
      </SettingsRow>

      {dirty && (
        <ThemedView style={styles.saveRow}>
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ThemedText
              style={[styles.saveBtn, { color: colors.primary }]}
              onPress={handleSave}>
              {t('settings.privacy.saveButton')}
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
  saveRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  saveBtn: { fontSize: 16, fontWeight: '600' },
});
