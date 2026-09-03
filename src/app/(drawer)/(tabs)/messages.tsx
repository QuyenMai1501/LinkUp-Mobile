import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useRouter } from 'expo-router';

export default function MessagesScreen() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ThemedText style={styles.icon}>💬</ThemedText>
          <ThemedText style={styles.title}>Tin nhắn</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Trò chuyện với bạn bè và nhóm
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
