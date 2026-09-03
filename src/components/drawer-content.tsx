import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';

type NavItem = {
  key: string;
  label: string;
  icon: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Trang chủ', icon: '🏠', href: '/(tabs)' },
  { key: 'messages', label: 'Tin nhắn', icon: '💬', href: '/(tabs)/messages' },
  { key: 'notifications', label: 'Thông báo', icon: '🔔', href: '/(tabs)/notifications' },
];

const SECONDARY_ITEMS: NavItem[] = [
  { key: 'friends', label: 'Bạn bè', icon: '👥', href: '/friends' },
  { key: 'communities', label: 'Cộng đồng', icon: '🌐', href: '/communities' },
  { key: 'saved', label: 'Đã lưu', icon: '🔖', href: '/saved' },
];

interface DrawerContentProps {
  state: { index: number; routeNames: string[] };
  navigation: { closeDrawer: () => void; navigate: (name: string) => void };
}

export default function DrawerContent({ state, navigation }: DrawerContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];

  const handleNavigate = (href: string) => {
    navigation.closeDrawer();
    // expo-router typed routes don't cover dynamic drawer paths
    router.push(href as any);
  };

  const isActive = (href: string) => {
    if (href === '/(tabs)') return pathname === '/';
    return pathname.startsWith(href.replace('(tabs)', ''));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/images/S-Logo-Rmbg.png')}
            style={styles.logoImg}
            contentFit="contain"
          />
          <ThemedText style={[styles.logoText, { color: colors.primary }]}>LinkUp</ThemedText>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Primary nav */}
          <View style={styles.navSection}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleNavigate(item.href)}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && { backgroundColor: colors.primaryLight },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <ThemedText style={styles.navIcon}>{item.icon}</ThemedText>
                  <ThemedText
                    style={[styles.navLabel, active && { color: colors.primary, fontWeight: '700' }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Secondary nav */}
          <View style={styles.navSection}>
            {SECONDARY_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleNavigate(item.href)}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && { backgroundColor: colors.primaryLight },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <ThemedText style={styles.navIcon}>{item.icon}</ThemedText>
                  <ThemedText
                    style={[styles.navLabel, active && { color: colors.primary, fontWeight: '700' }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* User section */}
        <View style={[styles.userSection, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => handleNavigate('/profile')}
            style={({ pressed }) => [styles.userRow, pressed && { opacity: 0.7 }]}>
            <View style={[styles.avatar, { backgroundColor: colors.bgSecondary }]}>
              <ThemedText style={styles.avatarText}>
                {user?.username?.charAt(0)?.toUpperCase() || '?'}
              </ThemedText>
            </View>
            <View style={styles.userInfo}>
              <ThemedText style={styles.displayName} numberOfLines={1}>
                {user?.username || 'User'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.email} numberOfLines={1}>
                {user?.email || ''}
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.userActions}>
            <Pressable
              onPress={() => handleNavigate('/settings')}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}>
              <ThemedText style={styles.actionIcon}>⚙️</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                navigation.closeDrawer();
                signOut();
              }}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}>
              <ThemedText style={styles.actionIcon}>🚪</ThemedText>
            </Pressable>
          </View>
        </View>
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  logoText: {
    ...Typography.h2,
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  navSection: {
    paddingHorizontal: Spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  navIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  navLabel: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  userSection: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  email: {
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
});
