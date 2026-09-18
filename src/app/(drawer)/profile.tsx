import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { getMyProfile, updateProfile, uploadMedia } from '@/api/profile';
import { useFollowStats } from '@/hooks/useFollowStats';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import type { ViewProfileResponse } from '@/types/profile';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { ProfileEditModal } from '@/components/profile/ProfileEditModal';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';

export default function SelfProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<ViewProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { stats } = useFollowStats(user?.id ?? null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getMyProfile();
      setProfile(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchProfile();
  }, [user?.id, fetchProfile]);

  const handleRefresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleAvatarChange = async (uri: string, mimeType: string) => {
    if (!profile) return;
    try {
      const ext = mimeType.split('/')[1] || 'jpeg';
      const res = await uploadMedia(uri, `avatar.${ext}`, mimeType);
      const fileUri = res.data?.file_uri || uri;
      await updateProfile({ avatar_uri: fileUri });
      setProfile((prev) => prev ? { ...prev, avatar_uri: fileUri } : prev);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg || t('profile.notFound'));
    }
  };

  const handleCoverChange = async (uri: string, mimeType: string) => {
    if (!profile) return;
    try {
      const ext = mimeType.split('/')[1] || 'jpeg';
      const res = await uploadMedia(uri, `cover.${ext}`, mimeType);
      const fileUri = res.data?.file_uri || uri;
      await updateProfile({ cover_uri: fileUri });
      setProfile((prev) => prev ? { ...prev, cover_uri: fileUri } : prev);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg || t('profile.notFound'));
    }
  };

  const handleSaved = (updated: ViewProfileResponse) => {
    setProfile(updated);
    setShowEditModal(false);
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
          <View style={styles.center}>
            <ThemedText style={styles.errorIcon}>⚠️</ThemedText>
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
            <ThemedText style={[styles.headerBtnIcon, { color: theme.text }]}>☰</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('profile.title')}</ThemedText>
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
            isSelf
            onEdit={() => setShowEditModal(true)}
            onAvatarChange={handleAvatarChange}
            onCoverChange={handleCoverChange}
          />
          <ProfileTabs
            userId={user?.id ?? ''}
            isSelf
            profile={profile}
          />
        </ScrollView>

        {showEditModal && (
          <ProfileEditModal
            profile={profile}
            onClose={() => setShowEditModal(false)}
            onSaved={handleSaved}
          />
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
  headerBtnIcon: {
    fontSize: 18,
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
  errorIcon: { fontSize: 48 },
  errorText: { ...Typography.body, textAlign: 'center' },
});
