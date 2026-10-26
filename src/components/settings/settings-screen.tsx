import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';

type SettingsScreenProps = {
  title: string;
  children: ReactNode;
};

export default function SettingsScreen({ title, children }: SettingsScreenProps) {
  const colors = useTheme();
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else (router as any).replace('/(drawer)/settings');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.headerRow}>
          <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
            <Icon name="chevronLeft" size={22} color={colors.text} />
          </Pressable>
          <ThemedText style={styles.header} numberOfLines={1}>
            {title}
          </ThemedText>
        </ThemedView>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  header: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
});
