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

import FriendCard from '@/components/friend-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFriends, unfriend } from '@/api/friends';
import type { FriendUser } from '@/types/friend';

const PAGE_SIZE = 20;

export default function FriendsListPanel() {
  const theme = useTheme();

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  const [unfriendTarget, setUnfriendTarget] = useState<FriendUser | null>(null);
  const [unfriending, setUnfriending] = useState(false);

  const loadFriends = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const page = pageRef.current + 1;
    try {
      const res = await getFriends(page, PAGE_SIZE);
      pageRef.current = res.page;
      setFriends((prev) => {
        const list = page === 1 ? res.data : [...prev, ...res.data];
        const seen = new Set<string>();
        return list.filter((u) => (seen.has(u.user_id) ? false : (seen.add(u.user_id), true)));
      });
      setHasMore(res.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
      setInitial(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    pageRef.current = 0;
    const id = requestAnimationFrame(() => {
      setFriends([]);
      setInitial(true);
      loadFriends();
    });
    return () => cancelAnimationFrame(id);
  }, [loadFriends]);

  const handleUnfriend = (user: FriendUser) => {
    setUnfriendTarget(user);
  };

  const confirmUnfriend = async () => {
    if (!unfriendTarget) return;
    setUnfriending(true);
    try {
      await unfriend(unfriendTarget.user_id);
      setFriends((prev) => prev.filter((f) => f.user_id !== unfriendTarget.user_id));
      Alert.alert('Thành công', 'Đã hủy kết bạn');
      setUnfriendTarget(null);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Đã xảy ra lỗi');
    } finally {
      setUnfriending(false);
    }
  };

  if (initial) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText themeColor="textSecondary" style={styles.loadingText}>
          Đang tải...
        </ThemedText>
      </View>
    );
  }

  if (error && friends.length === 0) {
    return (
      <View style={styles.center}>
        <ThemedText style={styles.emptyIcon}>⚠️</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {error}
        </ThemedText>
        <Pressable
          onPress={() => {
            pageRef.current = 0;
            loadFriends();
          }}
          style={[styles.retryBtn, { borderColor: theme.primary }]}>
          <ThemedText style={[styles.retryLabel, { color: theme.primary }]}>Thử lại</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={styles.center}>
        <ThemedText style={styles.emptyIcon}>👥</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Chưa có bạn bè nào
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <FriendCard
            avatarUri={item.avatar_uri}
            displayName={item.display_name}
            actionLabel="Hủy kết bạn"
            actionIcon="✕"
            onAction={() => handleUnfriend(item)}
            actionVariant="danger"
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (hasMore && !loadingRef.current) loadFriends();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : !hasMore && friends.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.endText}>
              Đã hiển thị tất cả
            </ThemedText>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {unfriendTarget && (
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={styles.modalTitle}>Hủy kết bạn</ThemedText>
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
                Bạn có chắc muốn hủy kết bạn với người này?
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
                  Đóng
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
                    Hủy kết bạn
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
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

  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  endText: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },

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
    marginTop: Spacing.xs,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPressed: {
    opacity: 0.7,
  },
  modalBtnLabel: {
    ...Typography.caption,
    fontWeight: 600,
  },
});
