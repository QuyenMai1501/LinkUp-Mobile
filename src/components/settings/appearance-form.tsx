import { useState } from 'react';
import { Switch, StyleSheet, Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { updateAppearance } from '@/api/settings';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import type { ThemeMode, LanguageCode } from '@/types/settings';

export default function AppearanceForm() {
  const colors = useTheme();
  const { scheme, setScheme } = useThemeMode();

  const [theme, setTheme] = useState<ThemeMode>(scheme);
  const [language, setLanguage] = useState<LanguageCode>('vi');

  const handleThemeChange = async (mode: ThemeMode) => {
    setTheme(mode);
    setScheme(mode);
    try {
      await updateAppearance({ theme: mode });
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu cài đặt giao diện');
    }
  };

  const handleLanguageChange = async (lang: LanguageCode) => {
    setLanguage(lang);
    try {
      await updateAppearance({ language: lang });
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu cài đặt ngôn ngữ');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.row, { backgroundColor: colors.card }]}>
        <ThemedView style={styles.info}>
          <ThemedText style={styles.label}>Giao diện tối</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Chế độ tối giúp giảm mỏi mắt
          </ThemedText>
        </ThemedView>
        <Switch
          value={theme === 'dark'}
          onValueChange={(v) => handleThemeChange(v ? 'dark' : 'light')}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </ThemedView>

      <ThemedView style={[styles.row, { backgroundColor: colors.card }]}>
        <ThemedView style={styles.info}>
          <ThemedText style={styles.label}>Ngôn ngữ</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Chọn ngôn ngữ hiển thị
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.langGroup}>
          <ThemedView
            style={[
              styles.langBtn,
              language === 'vi' && { backgroundColor: colors.primary },
            ]}>
            <ThemedText
              style={[
                styles.langText,
                language === 'vi' && { color: '#fff' },
              ]}
              onPress={() => handleLanguageChange('vi')}>
              VI
            </ThemedText>
          </ThemedView>
          <ThemedView
            style={[
              styles.langBtn,
              language === 'en' && { backgroundColor: colors.primary },
            ]}>
            <ThemedText
              style={[
                styles.langText,
                language === 'en' && { color: '#fff' },
              ]}
              onPress={() => handleLanguageChange('en')}>
              EN
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
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
  langGroup: { flexDirection: 'row', gap: Spacing.xs },
  langBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langText: { fontSize: 14, fontWeight: '600' },
});
