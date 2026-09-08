import { useEffect, useState } from 'react';
import { Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPrivacy, updatePrivacy } from '@/api/settings';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import type { PrivacySettingsResponse } from '@/types/settings';

export default function PrivacyForm() {
  const colors = useTheme();

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
        if (!cancelled) Alert.alert('Lỗi', 'Không thể tải cài đặt bảo mật');
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
      Alert.alert('Thành công', 'Đã lưu cài đặt bảo mật');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu cài đặt');
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
      <ThemedView style={[styles.row, { backgroundColor: colors.card }]}>
        <ThemedView style={styles.info}>
          <ThemedText style={styles.label}>Hiển thị trong tìm kiếm</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Cho phép người khác tìm thấy bạn qua tìm kiếm
          </ThemedText>
        </ThemedView>
        <Switch
          value={discoverable}
          onValueChange={setDiscoverable}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </ThemedView>

      <ThemedView style={[styles.row, { backgroundColor: colors.card }]}>
        <ThemedView style={styles.info}>
          <ThemedText style={styles.label}>Nhận tin từ người lạ</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Cho phép người chưa kết bạn gửi tin nhắn
          </ThemedText>
        </ThemedView>
        <Switch
          value={allowStrangers}
          onValueChange={setAllowStrangers}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </ThemedView>

      {dirty && (
        <ThemedView style={styles.saveRow}>
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ThemedText
              style={[styles.saveBtn, { color: colors.primary }]}
              onPress={handleSave}>
              Lưu thay đổi
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
  info: { flex: 1, marginRight: Spacing.md },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 13, marginTop: 2 },
  saveRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  saveBtn: { fontSize: 16, fontWeight: '600' },
});
