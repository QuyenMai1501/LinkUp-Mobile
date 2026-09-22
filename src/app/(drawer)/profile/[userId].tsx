import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { getProfileByUserID } from '@/api/profile';
import { useFollowStats } from '@/hooks/useFollowStats';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import type { ViewProfileResponse } from '@/types/profile';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { MutualFriends } from '@/components/profile/MutualFriends';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';
import { Icon } from '@/components/ui/icon';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ViewProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'private' | 'not-found' | 'network' | null>(null);

  const isSelf = user?.id === userId;
  const { stats, following, followBusy, handleFollow } = useFollowStats(userId ?? null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setErrorType(null);
    try {
      const data = await getProfileByUserID(userId);
      setProfile(data);
    } catch (err: any) {
      if (err?.message?.includes('PRIVATE') || err?.status === 403) {
        setErrorType('private');
        setError(t('profile.notFound'));
      } else if (err?.status === 404) {
        setErrorType('not-found');
        setError(t('profile.notFound'));
      } else {
        setErrorType('network');
        setError(err?.message || 'Network error');
      }
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleRefresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleMessage = () => {
    if (!userId) return;
    (router as any).push(`/(drawer)/chat/${userId}`);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ProfileSkeleton />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error || !profile) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>{t('profile.title')}</ThemedText>
          </View>
          <View style={styles.center}>
            {errorType === 'private' ? (
              <Icon name="lock" size={32} />
            ) : errorType === 'not-found' ? (
              <Icon name="person" size={32} />
            ) : (
              <Icon name="warning" size={32} color="#FB8C00" />
            )}
            <ThemedText themeColor="textSecondary" style={styles.errorText}>
              {error || t('profile.notFound')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => (navigation as any).openDrawer?.()}>
            <Icon name="menu" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>{profile.display_name}</ThemedText>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          <ProfileHeader
            profile={profile}
            stats={stats}
            isSelf={isSelf}
            isFollowing={following}
            followBusy={followBusy}
            onFollow={handleFollow}
            onMessage={!isSelf ? handleMessage : undefined}
            menuSlot={!isSelf ? <ProfileMenu userId={userId!} isSelf={false} /> : undefined}
          />
          {!isSelf && <MutualFriends userId={userId!} />}
          <ProfileTabs
            userId={userId!}
            isSelf={isSelf}
            profile={profile}
          />
        </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.h2, fontSize: 16 },
  scroll: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  errorText: { ...Typography.body, textAlign: 'center' },
});
