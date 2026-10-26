import { useState } from 'react';
import { Switch, StyleSheet, Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import SettingsRow from '@/components/settings/settings-row';
import { updateAppearance } from '@/api/settings';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';
import type { ThemeMode, LanguageCode } from '@/types/settings';

export default function AppearanceForm() {
  const colors = useTheme();
  const { scheme, setScheme } = useThemeMode();
  const { t, language, setLanguage } = useTranslation();

  const [theme, setTheme] = useState<ThemeMode>(scheme);

  const handleThemeChange = async (mode: ThemeMode) => {
    setTheme(mode);
    setScheme(mode);
    try {
      await updateAppearance({ theme: mode });
    } catch {
      Alert.alert(t('common.error'), t('settings.appearance.saveFailed'));
    }
  };

  const handleLanguageChange = async (lang: LanguageCode) => {
    setLanguage(lang);
    try {
      await updateAppearance({ language: lang });
    } catch {
      Alert.alert(t('common.error'), t('settings.appearance.languageSaveFailed'));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SettingsRow
        card
        icon="moon"
        tone="primary"
        label={t('settings.appearance.darkMode')}
        hint={t('settings.appearance.darkModeDesc')}>
        <Switch
          value={theme === 'dark'}
          onValueChange={(v) => handleThemeChange(v ? 'dark' : 'light')}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.textOnPrimary}
        />
      </SettingsRow>

      <SettingsRow
        card
        icon="globe"
        tone="info"
        label={t('settings.appearance.language')}
        hint={t('settings.appearance.languageDesc')}>
        <ThemedView style={styles.langGroup}>
          <ThemedView
            style={[
              styles.langBtn,
              { borderColor: colors.border },
              language === 'vi' && { backgroundColor: colors.primary },
            ]}>
            <ThemedText
              style={[
                styles.langText,
                language === 'vi' && { color: colors.textOnPrimary },
              ]}
              onPress={() => handleLanguageChange('vi')}>
              VI
            </ThemedText>
          </ThemedView>
          <ThemedView
            style={[
              styles.langBtn,
              { borderColor: colors.border },
              language === 'en' && { backgroundColor: colors.primary },
            ]}>
            <ThemedText
              style={[
                styles.langText,
                language === 'en' && { color: colors.textOnPrimary },
              ]}
              onPress={() => handleLanguageChange('en')}>
              EN
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </SettingsRow>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  langGroup: { flexDirection: 'row', gap: Spacing.xs },
  langBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langText: { fontSize: 14, fontWeight: '600' },
});
