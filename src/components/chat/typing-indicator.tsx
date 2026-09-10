import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

export function TypingIndicator() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
      <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
      <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
});
