import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';

// Placeholder — Phase 5 (form tạo/sửa quảng cáo, nhận param ?id=).
export default function AdFormScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.center}>
        <ThemedText type="subtitle">{t('partner.ads.create')}</ThemedText>
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
  },
});
