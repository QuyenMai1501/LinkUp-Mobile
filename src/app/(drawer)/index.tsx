import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import NotificationItem from '@/components/notification-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Feed from '@/components/feed';
import FriendsListPanel from '@/components/friends-list-panel';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth-context';
import { useNotification } from '@/contexts/notification-context';
import { useThemeMode } from '@/contexts/theme-context';

type TabKey = 'home' | 'friends' | 'notifications' | 'profile';
type Filter = 'all' | 'unread' | 'read';

const TABS: { key: TabKey; icon: string }[] = [
  { key: 'home', icon: '🏠' },
  { key: 'friends', icon: '👥' },
  { key: 'notifications', icon: '🔔' },
  { key: 'profile', icon: '👤' },
];

function NotificationPanel() {
  const theme = useTheme();
  const { unreadCount, notifications, loading, markAsRead, markAllAsRead } = useNotification();
  const [filter, setFilter] = React.useState<Filter>('all');

  const filtered = React.useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.is_read);
    if (filter === 'read') return notifications.filter((n) => n.is_read);
    return notifications;
  }, [notifications, filter]);

  const handleItemPress = (item: typeof notifications[0]) => {
    if (!item.is_read) {
      markAsRead(item);
    }
  };

  const handleMarkAll = () => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText themeColor="textSecondary" style={styles.loadingText}>
          Đang tải...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.panelContainer}>
      {/* Filter tabs + actions */}
      <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
        {(['all', 'unread', 'read'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterTab,
              filter === f && { backgroundColor: theme.primaryLight },
            ]}>
            <ThemedText
              style={[
                styles.filterLabel,
                { color: filter === f ? theme.primary : theme.textSecondary },
              ]}>
              {f === 'all' ? 'Tất cả' : f === 'unread' ? 'Chưa đọc' : 'Đã đọc'}
            </ThemedText>
          </Pressable>
        ))}
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAll} style={styles.markAllBtn}>
            <ThemedText style={[styles.markAllLabel, { color: theme.primary }]}>
              Đọc tất cả
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>🔔</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {filter === 'unread'
              ? 'Không có thông báo chưa đọc'
              : filter === 'read'
                ? 'Chưa có thông báo đã đọc'
                : 'Chưa có thông báo nào'}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              onPress={() => handleItemPress(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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

export default function HomeScreen() {
  const navigation = useNavigation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const [activeTab, setActiveTab] = React.useState<TabKey>('home');

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
        ) : activeTab === 'notifications' ? (
          <View style={styles.content}>
            <NotificationPanel />
          </View>
        ) : (
          <View style={styles.content}>
            <ProfileContent />
          </View>
        )}
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
  // Notification panel styles
  panelContainer: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  filterLabel: {
    ...Typography.caption,
    fontWeight: 600,
  },
  markAllBtn: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  markAllLabel: {
    ...Typography.caption,
    fontWeight: 600,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
});
