import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

export default function SavedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Icon name="bookmarkFilled" size={48} color={theme.primary} />
          <ThemedText style={styles.title}>{t('sidebar.saved')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {t('saved.subtitle')}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  title: { ...Typography.h1, textAlign: 'center' },
  subtitle: { ...Typography.body, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
