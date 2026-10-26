import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

export function AuthQuickToggles() {
  const theme = useTheme();
  const { scheme, toggleTheme } = useThemeMode();
  const { language, setLanguage, t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggleTheme}
        accessibilityRole="button"
        accessibilityLabel={scheme === 'dark' ? t('common.dark') : t('common.light')}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.card, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <Icon name={scheme === 'dark' ? 'moon' : 'sun'} size={20} />
      </Pressable>

      <Pressable
        onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
        accessibilityRole="button"
        accessibilityLabel={t('settings.appearance.language')}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.card, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <Icon name="globe" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: Radius.circle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
