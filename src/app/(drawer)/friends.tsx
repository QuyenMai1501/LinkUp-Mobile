import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import FriendCard from '@/components/friend-card';
import FriendRequestCard from '@/components/friend-request-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  acceptFriendRequest,
  getFriendRequests,
  getFriendSuggestions,
  getFriends,
  rejectFriendRequest,
  toggleFriendRequest,
  unfriend,
} from '@/api/friends';
import type {
  FriendRequestItem,
  FriendSuggestionUser,
  FriendUser,
} from '@/types/friend';

type MainTab = 'requests' | 'suggestions' | 'list';
type SubTab = 'received' | 'sent';

const PAGE_SIZE = 20;
const MAX_BADGE = 99;

export default function FriendsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  const [mainTab, setMainTab] = useState<MainTab>('requests');
  const [subTab, setSubTab] = useState<SubTab>('received');

  // --- Requests ---
  const [received, setReceived] = useState<FriendRequestItem[]>([]);
  const [sent, setSent] = useState<FriendRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const requestsLoadingRef = useRef(false);

  // --- Suggestions ---
  const [suggestions, setSuggestions] = useState<FriendSuggestionUser[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsInitial, setSuggestionsInitial] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(true);
  const suggestionsPageRef = useRef(0);
  const suggestionsLoadingRef = useRef(false);

  // --- Friends list ---
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsInitial, setFriendsInitial] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendsHasMore, setFriendsHasMore] = useState(true);
  const friendsPageRef = useRef(0);
  const friendsLoadingRef = useRef(false);

  // --- Unfriend modal ---
  const [unfriendTarget, setUnfriendTarget] = useState<FriendUser | null>(null);
  const [unfriending, setUnfriending] = useState(false);

  // ============ DATA LOADERS ============

  const loadRequests = useCallback(async () => {
    if (requestsLoadingRef.current) return;
    requestsLoadingRef.current = true;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const res = await getFriendRequests();
      setReceived(res.received);
      setSent(res.sent);
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setRequestsLoading(false);
      requestsLoadingRef.current = false;
    }
  }, [t]);

  const loadSuggestions = useCallback(async () => {
    if (suggestionsLoadingRef.current) return;
    suggestionsLoadingRef.current = true;
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    const page = suggestionsPageRef.current + 1;
    try {
      const res = await getFriendSuggestions(page, PAGE_SIZE);
      suggestionsPageRef.current = res.page;
      setSuggestions((prev) => {
        const list = page === 1 ? res.data : [...prev, ...res.data];
        const seen = new Set<string>();
        return list.filter((u) => (seen.has(u.user_id) ? false : (seen.add(u.user_id), true)));
      });
      setSuggestionsHasMore(res.has_more);
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSuggestionsLoading(false);
      setSuggestionsInitial(false);
      suggestionsLoadingRef.current = false;
    }
  }, [t]);

  const loadFriends = useCallback(async () => {
    if (friendsLoadingRef.current) return;
    friendsLoadingRef.current = true;
    setFriendsLoading(true);
    setFriendsError(null);
    const page = friendsPageRef.current + 1;
    try {
      const res = await getFriends(page, PAGE_SIZE);
      friendsPageRef.current = res.page;
      setFriends((prev) => {
        const list = page === 1 ? res.data : [...prev, ...res.data];
        const seen = new Set<string>();
        return list.filter((u) => (seen.has(u.user_id) ? false : (seen.add(u.user_id), true)));
      });
      setFriendsHasMore(res.has_more);
    } catch (err) {
      setFriendsError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setFriendsLoading(false);
      setFriendsInitial(false);
      friendsLoadingRef.current = false;
    }
  }, [t]);

  // ============ EFFECTS ============

  // Reset + load for requests tab
  useEffect(() => {
    if (mainTab !== 'requests') return;
    const id = requestAnimationFrame(() => loadRequests());
    return () => cancelAnimationFrame(id);
  }, [mainTab, loadRequests]);

  // Reset + load for suggestions tab
  useEffect(() => {
    if (mainTab !== 'suggestions') return;
    suggestionsPageRef.current = 0;
    const id = requestAnimationFrame(() => {
      setSuggestions([]);
      setSuggestionsInitial(true);
      loadSuggestions();
    });
    return () => cancelAnimationFrame(id);
  }, [mainTab, loadSuggestions]);

  // Reset + load for friends list tab
  useEffect(() => {
    if (mainTab !== 'list') return;
    friendsPageRef.current = 0;
    const id = requestAnimationFrame(() => {
      setFriends([]);
      setFriendsInitial(true);
      loadFriends();
    });
    return () => cancelAnimationFrame(id);
  }, [mainTab, loadFriends]);

  // ============ ACTION HANDLERS ============

  const runAction = useCallback(
    async (fn: Promise<unknown>, onSuccess: () => void, successMsg: string) => {
      try {
        await fn;
        onSuccess();
        Alert.alert(t('common.success'), successMsg);
      } catch (err) {
        Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.error'));
      }
    },
    [t],
  );

  const handleAccept = (item: FriendRequestItem) => {
    runAction(
      acceptFriendRequest(item.id),
      () => {
        setReceived((prev) => prev.filter((r) => r.id !== item.id));
        setSuggestions((prev) => prev.filter((s) => s.user_id !== item.user_id));
      },
      t('friends.actions.acceptSuccess'),
    );
  };

  const handleReject = (item: FriendRequestItem) => {
    runAction(
      rejectFriendRequest(item.id),
      () => setReceived((prev) => prev.filter((r) => r.id !== item.id)),
      t('friends.actions.rejectSuccess'),
    );
  };

  const handleRevoke = (item: FriendRequestItem) => {
    runAction(
      toggleFriendRequest(item.user_id),
      () => setSent((prev) => prev.filter((r) => r.id !== item.id)),
      t('friends.actions.revokeSuccess'),
    );
  };

  const handleAddFriend = (user: FriendSuggestionUser) => {
    runAction(
      toggleFriendRequest(user.user_id),
      () => {
        setSuggestions((prev) =>
          prev.map((s) => (s.user_id === user.user_id ? { ...s, _friendStatus: 'sent' } : s)),
        );
        setSent((prev) => [
          ...prev,
          {
            id: '',
            user_id: user.user_id,
            display_name: user.display_name,
            avatar_uri: user.avatar_uri,
            status: 'pending',
            created_at: '',
            direction: 'sent' as const,
          },
        ]);
      },
      t('friends.actions.sendSuccess'),
    );
  };

  const handleUnfriend = (user: FriendUser) => {
    setUnfriendTarget(user);
  };

  const confirmUnfriend = async () => {
    if (!unfriendTarget) return;
    setUnfriending(true);
    try {
      await unfriend(unfriendTarget.user_id);
      setFriends((prev) => prev.filter((f) => f.user_id !== unfriendTarget.user_id));
      Alert.alert(t('common.success'), t('friends.actions.unfriendSuccess'));
      setUnfriendTarget(null);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.error'));
    } finally {
      setUnfriending(false);
    }
  };

  // ============ TAB CONFIG ============

  const MAIN_TABS: { key: MainTab; labelKey: string; icon: string }[] = [
    { key: 'requests', labelKey: 'friends.tabs.pending', icon: '📩' },
    { key: 'suggestions', labelKey: 'friends.tabs.all', icon: '👤' },
    { key: 'list', labelKey: 'friends.title', icon: '👥' },
  ];

  const SUB_TABS: { key: SubTab; labelKey: string }[] = [
    { key: 'received', labelKey: 'friends.actions.accept' },
    { key: 'sent', labelKey: 'friends.actions.decline' },
  ];

  // ============ RENDER: REQUESTS ============

  const renderRequests = () => {
    const items = subTab === 'received' ? received : sent;

    if (requestsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            {t('common.loading')}
          </ThemedText>
        </View>
      );
    }

    if (requestsError && items.length === 0) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>⚠️</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {requestsError}
          </ThemedText>
          <Pressable onPress={loadRequests} style={[styles.retryBtn, { borderColor: theme.primary }]}>
            <ThemedText style={[styles.retryLabel, { color: theme.primary }]}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>
            {subTab === 'received' ? '📩' : '📤'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {subTab === 'received' ? t('friends.empty.noPending') : t('friends.empty.noPending')}
          </ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FriendRequestCard
            avatarUri={item.avatar_uri}
            displayName={item.display_name}
            direction={item.direction}
            onAccept={() => handleAccept(item)}
            onReject={() => handleReject(item)}
            onRevoke={() => handleRevoke(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // ============ RENDER: SUGGESTIONS ============

  const renderSuggestions = () => {
    if (suggestionsInitial) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            {t('common.loading')}
          </ThemedText>
        </View>
      );
    }

    if (suggestionsError && suggestions.length === 0) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>⚠️</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {suggestionsError}
          </ThemedText>
          <Pressable
            onPress={() => {
              suggestionsPageRef.current = 0;
              loadSuggestions();
            }}
            style={[styles.retryBtn, { borderColor: theme.primary }]}>
            <ThemedText style={[styles.retryLabel, { color: theme.primary }]}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (suggestions.length === 0) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>👤</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {t('friends.empty.noFriends')}
          </ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => {
          const subtitle =
            item.mutual_count > 0
              ? item.mutual_names && item.mutual_names.length > 0
                ? `${item.mutual_names.join(', ')}${item.mutual_count > item.mutual_names.length ? ` ${t('friends.mutual.more', { count: item.mutual_count - item.mutual_names.length })}` : ''}`
                : t('friends.mutual.count', { count: item.mutual_count })
              : undefined;

          return (
            <FriendCard
              avatarUri={item.avatar_uri}
              displayName={item.display_name}
              subtitle={subtitle}
              actionLabel={item._friendStatus === 'sent' ? t('common.done') : t('friends.actions.addFriend')}
              actionIcon={item._friendStatus === 'sent' ? '✓' : '👤+'}
              onAction={() => {
                if (item._friendStatus !== 'sent') handleAddFriend(item);
              }}
              actionDisabled={item._friendStatus === 'sent'}
              actionVariant={item._friendStatus === 'sent' ? 'ghost' : 'primary'}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (suggestionsHasMore && !suggestionsLoadingRef.current) loadSuggestions();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          suggestionsLoading ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : !suggestionsHasMore && suggestions.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endText}>
              {t('common.done')}
            </ThemedText>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // ============ RENDER: FRIENDS LIST ============

  const renderFriends = () => {
    if (friendsInitial) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            {t('common.loading')}
          </ThemedText>
        </View>
      );
    }

    if (friendsError && friends.length === 0) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>⚠️</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {friendsError}
          </ThemedText>
          <Pressable
            onPress={() => {
              friendsPageRef.current = 0;
              loadFriends();
            }}
            style={[styles.retryBtn, { borderColor: theme.primary }]}>
            <ThemedText style={[styles.retryLabel, { color: theme.primary }]}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (friends.length === 0) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>👥</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {t('friends.empty.noFriends')}
          </ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        data={friends}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <FriendCard
            avatarUri={item.avatar_uri}
            displayName={item.display_name}
            actionLabel={t('friends.actions.removeFriend')}
            actionIcon="✕"
            onAction={() => handleUnfriend(item)}
            actionVariant="danger"
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (friendsHasMore && !friendsLoadingRef.current) loadFriends();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          friendsLoading ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : !friendsHasMore && friends.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endText}>
              {t('common.done')}
            </ThemedText>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // ============ MAIN RENDER ============

  const unreadCount = received.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.backBtn} onPress={openDrawer}>
            <ThemedText style={[styles.backIcon, { color: theme.text }]}>☰</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('friends.title')}</ThemedText>
        </View>

        {/* Main tabs */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {MAIN_TABS.map((tab) => {
            const isActive = mainTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setMainTab(tab.key)}
                style={[
                  styles.tabItem,
                  isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
                ]}>
                <ThemedText
                  style={[
                    styles.tabIcon,
                    { color: isActive ? theme.primary : theme.textSecondary },
                  ]}>
                  {tab.icon}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: isActive ? theme.primary : theme.textSecondary },
                  ]}>
                  {t(tab.labelKey)}
                </ThemedText>
                {tab.key === 'requests' && unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                    <ThemedText style={styles.badgeText}>
                      {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Sub-tabs for requests */}
        {mainTab === 'requests' && (
          <View style={[styles.subTabBar, { borderBottomColor: theme.border }]}>
            {SUB_TABS.map((tab) => {
              const isActive = subTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setSubTab(tab.key)}
                  style={[
                    styles.subTabItem,
                    isActive && { backgroundColor: theme.primaryLight },
                  ]}>
                  <ThemedText
                    style={[
                      styles.subTabLabel,
                      { color: isActive ? theme.primary : theme.textSecondary },
                    ]}>
                    {t(tab.labelKey)}
                    {tab.key === 'received' && received.length > 0
                      ? ` (${received.length})`
                      : ''}
                    {tab.key === 'sent' && sent.length > 0 ? ` (${sent.length})` : ''}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {mainTab === 'requests' && renderRequests()}
          {mainTab === 'suggestions' && renderSuggestions()}
          {mainTab === 'list' && renderFriends()}
        </View>
      </SafeAreaView>

      {/* Unfriend confirmation */}
      {unfriendTarget && (
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={styles.modalTitle}>{t('friends.actions.removeFriend')}</ThemedText>
            <View style={styles.modalBody}>
              <View style={[styles.modalAvatar, { backgroundColor: theme.primaryLight }]}>
                {unfriendTarget.avatar_uri ? (
                  <Image
                    source={{ uri: unfriendTarget.avatar_uri }}
                    style={styles.modalAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText style={[styles.modalAvatarFallback, { color: theme.primary }]}>
                    {unfriendTarget.display_name.charAt(0).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <ThemedText style={styles.modalName}>{unfriendTarget.display_name}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.modalDesc}>
                {t('friends.confirm.removeFriend', { name: unfriendTarget.display_name })}
              </ThemedText>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setUnfriendTarget(null)}
                disabled={unfriending}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { backgroundColor: 'transparent', borderColor: theme.border },
                  pressed && styles.modalBtnPressed,
                ]}>
                <ThemedText style={[styles.modalBtnLabel, { color: theme.textSecondary }]}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmUnfriend}
                disabled={unfriending}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { backgroundColor: theme.danger, borderColor: theme.danger },
                  pressed && styles.modalBtnPressed,
                ]}>
                {unfriending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={[styles.modalBtnLabel, { color: '#FFFFFF' }]}>
                    {t('friends.actions.removeFriend')}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      )}
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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 22,
  },

  // Main tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: Spacing.xs,
  },
  tabIcon: {
    fontSize: 18,
    lineHeight: 24,
  },
  tabLabel: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 700,
  },

  // Sub tabs
  subTabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  subTabItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  subTabLabel: {
    ...Typography.caption,
    fontWeight: 600,
  },

  // Content
  content: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  // Center states
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
  emptyIcon: {
    fontSize: 48,
    lineHeight: 56,
  },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  retryLabel: {
    ...Typography.caption,
    fontWeight: 600,
  },

  // Loading more
  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  endText: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalCard: {
    width: '85%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    ...Typography.h2,
    fontSize: 18,
    textAlign: 'center',
  },
  modalBody: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  modalAvatarFallback: {
    ...Typography.h1,
    fontSize: 24,
  },
  modalName: {
    ...Typography.body,
    fontWeight: 700,
    fontSize: 16,
  },
  modalDesc: {
    ...Typography.body,
    textAlign: 'center',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPressed: {
    opacity: 0.7,
  },
  modalBtnLabel: {
    ...Typography.body,
    fontWeight: 600,
    fontSize: 14,
  },
});
