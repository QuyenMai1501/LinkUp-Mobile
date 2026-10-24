import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';

// Placeholder — Phase 3 sẽ thay bằng overview dashboard thật.
export default function PartnerDashboardScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.center}>
        <ThemedText type="subtitle">{t('partner.overview.title')}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
