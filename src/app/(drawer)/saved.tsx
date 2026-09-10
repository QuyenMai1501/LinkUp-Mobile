import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTranslation } from '@/hooks/useTranslation';

export default function SavedScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ThemedText style={styles.icon}>🔖</ThemedText>
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
  icon: { fontSize: 48 },
  title: { ...Typography.h1, textAlign: 'center' },
  subtitle: { ...Typography.body, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
