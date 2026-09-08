import { useEffect, useState } from 'react';
import { Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPreferences, updatePreferences as apiUpdatePreferences } from '@/api/notifications';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import type { NotificationPreferences } from '@/types/notification';

type PrefKey = keyof NotificationPreferences;

const PREF_ROWS: { key: PrefKey; label: string }[] = [
  { key: 'like_enabled', label: 'Thích bài viết' },
  { key: 'comment_enabled', label: 'Bình luận' },
  { key: 'follow_enabled', label: 'Theo dõi' },
  { key: 'message_enabled', label: 'Tin nhắn' },
  { key: 'friend_request_enabled', label: 'Lời mời kết bạn' },
  { key: 'community_enabled', label: 'Cộng đồng' },
  { key: 'voice_call_enabled', label: 'Cuộc gọi thoại' },
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
      Alert.alert('Thành công', 'Đã lưu tùy chọn thông báo');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu tùy chọn');
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
          <ThemedText style={styles.label}>{row.label}</ThemedText>
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
  label: { fontSize: 15, fontWeight: '500' },
  saveRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  saveBtn: { fontSize: 16, fontWeight: '600' },
});
