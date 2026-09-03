import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.feedScroll}>
          <View style={styles.feedHeader}>
            <Image
              source={require('@/assets/images/S-Logo-Rmbg.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <ThemedText style={styles.brandName}>LinkUp</ThemedText>
            <Pressable
              onPress={signOut}
              style={({ pressed }) => [
                styles.logoutButton,
                { backgroundColor: theme.dangerLight },
                pressed && { opacity: 0.7 },
              ]}>
              <ThemedText style={[styles.logoutText, { color: theme.danger }]}>Đăng xuất</ThemedText>
            </Pressable>
          </View>

          <View style={styles.feedEmpty}>
            <ThemedText style={styles.feedEmptyIcon}>📰</ThemedText>
            <ThemedText style={styles.feedEmptyTitle}>Chưa có bài viết nào</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.feedEmptySubtitle}>
              {user?.username
                ? `Xin chào ${user.username}! Hãy kết bạn và theo dõi mọi người để xem bài viết.`
                : 'Hãy kết bạn và theo dõi mọi người để xem bài viết.'}
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  feedScroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: BottomTabInset + Spacing.xl,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandName: {
    ...Typography.h2,
    fontSize: 22,
  },
  logoutButton: {
    marginLeft: 'auto',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  logoutText: {
    ...Typography.caption,
    fontWeight: 700,
  },
  feedEmpty: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl * 3,
  },
  feedEmptyIcon: {
    fontSize: 48,
  },
  feedEmptyTitle: {
    ...Typography.h2,
    textAlign: 'center',
  },
  feedEmptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
});
