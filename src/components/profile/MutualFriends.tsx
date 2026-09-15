import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getMutualFriends } from '@/api/follow';
import type { MutualFriendsResponse } from '@/types/profile';

export function MutualFriends({ userId }: { userId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<MutualFriendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMutualFriends(userId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading || !data || data.total === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('friends.mutual.count', { count: data.total })}
      </ThemedText>
      <View style={styles.avatars}>
        {data.data.slice(0, 4).map((friend) => (
          <Image
            key={friend.user_id}
            source={{ uri: friend.avatar_uri }}
            style={[styles.avatar, { borderColor: theme.background }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  label: { ...Typography.caption },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    marginLeft: -8,
  },
});
