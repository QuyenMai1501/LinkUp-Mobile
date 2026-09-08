import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Feed from '@/components/feed';
import FriendsListPanel from '@/components/friends-list-panel';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';

type TabKey = 'home' | 'friends' | 'notifications' | 'profile';

const TABS: { key: TabKey; icon: string }[] = [
  { key: 'home', icon: '🏠' },
  { key: 'friends', icon: '👥' },
  { key: 'notifications', icon: '🔔' },
  { key: 'profile', icon: '👤' },
];

function NotificationsContent() {
  return (
    <View style={styles.centerContent}>
      <ThemedText style={styles.emptyIcon}>🔔</ThemedText>
      <ThemedText style={styles.emptyTitle}>Thông báo</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
        Theo dõi hoạt động của bạn bè
      </ThemedText>
    </View>
  );
}

function ProfileContent() {
  const { user } = useAuth();

  return (
    <View style={styles.centerContent}>
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>
          {user?.username?.charAt(0)?.toUpperCase() || '?'}
        </ThemedText>
      </View>
      <ThemedText style={styles.emptyTitle}>{user?.username || 'User'}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
        {user?.email || ''}
      </ThemedText>
    </View>
  );
}

const CONTENT_MAP: Partial<Record<TabKey, React.ComponentType>> = {
  home: Feed,
  notifications: NotificationsContent,
  profile: ProfileContent,
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const [activeTab, setActiveTab] = React.useState<TabKey>('home');

  const ActiveContent = CONTENT_MAP[activeTab];

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            style={styles.actionBtn}
            onPress={openDrawer}>
            <ThemedText style={[styles.actionIcon, { color: colors.text }]}>☰</ThemedText>
          </Pressable>
          <ThemedText style={[styles.brandName, { color: colors.primary }]}>LinkUp</ThemedText>
          <View style={styles.headerActions}>
            <Pressable style={styles.actionBtn} onPress={() => {}}>
              <ThemedText style={[styles.actionIcon, { color: colors.text }]}>➕</ThemedText>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => {}}>
              <ThemedText style={[styles.actionIcon, { color: colors.text }]}>🔍</ThemedText>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => {}}>
              <ThemedText style={[styles.actionIcon, { color: colors.text }]}>💬</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Horizontal tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabItem,
                  isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                ]}>
                <ThemedText
                  style={[
                    styles.tabIcon,
                    { color: isActive ? colors.primary : colors.textSecondary },
                  ]}>
                  {tab.icon}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Tab content */}
        {activeTab === 'home' ? (
          <View style={styles.content}>
            <Feed />
          </View>
        ) : activeTab === 'friends' ? (
          <View style={styles.content}>
            <FriendsListPanel />
          </View>
        ) : ActiveContent ? (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <ActiveContent />
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  brandName: {
    ...Typography.h1,
    fontSize: 22,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: 'auto',
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl * 2,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...Typography.h2, textAlign: 'center' },
  emptySubtitle: { ...Typography.body, textAlign: 'center', paddingHorizontal: Spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#12A5A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
