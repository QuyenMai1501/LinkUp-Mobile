import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthQuickToggles } from '@/components/auth/auth-quick-toggles';
import { Spacing } from '@/constants/spacing';

export default function AuthLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
      <View style={[styles.toggles, { top: insets.top + Spacing.md }]}>
        <AuthQuickToggles />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toggles: {
    position: 'absolute',
    right: Spacing.lg,
  },
});
