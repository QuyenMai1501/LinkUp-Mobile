import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getFriends } from '@/api/friends';
import type { FriendUser } from '@/types/friend';

interface ProfileFriendsTabProps {
  userId: string;
}

export function ProfileFriendsTab({ userId }: ProfileFriendsTabProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFriends = useCallback(async (p: number) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await getFriends(p, 12);
      setFriends((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setHasMore(res.has_more);
      setPage(p);
    } catch {
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends(1);
  }, [fetchFriends]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={styles.center}>
        <Icon name="people" size={48} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {t('friends.empty.noFriends')}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {friends.map((friend) => (
          <Pressable
            key={friend.user_id}
            style={styles.friendCard}
            onPress={() => (router as any).push(`/(drawer)/profile/${friend.user_id}`)}>
            {friend.avatar_uri ? (
              <Image source={{ uri: friend.avatar_uri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.avatarFallbackText}>
                  {friend.display_name?.charAt(0)?.toUpperCase() || '?'}
                </ThemedText>
              </View>
            )}
            <ThemedText style={styles.friendName} numberOfLines={1}>
              {friend.display_name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      {hasMore && (
        <Pressable
          onPress={() => fetchFriends(page + 1)}
          disabled={loadingMore}
          style={styles.loadMore}>
          {loadingMore ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <ThemedText style={[styles.loadMoreText, { color: theme.primary }]}>
              {t('common.next')}
            </ThemedText>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  friendCard: {
    width: '30%',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  friendName: { ...Typography.caption, textAlign: 'center', fontWeight: 500 },
  loadMore: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  loadMoreText: { ...Typography.body, fontWeight: 600 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: { ...Typography.body },
});
