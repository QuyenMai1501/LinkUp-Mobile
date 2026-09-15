import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useProfilePosts } from '@/hooks/useProfilePosts';
import type { ViewProfileResponse } from '@/types/profile';
import PostCard from '@/components/post-card';
import { ProfileAboutTab } from './ProfileAboutTab';
import { ProfileFriendsTab } from './ProfileFriendsTab';
import { ProfileMediaGrid } from './ProfileMediaGrid';

type ProfileTab = 'posts' | 'media' | 'friends' | 'about';

interface ProfileTabsProps {
  userId: string;
  isSelf: boolean;
  profile?: ViewProfileResponse;
}

export function ProfileTabs({ userId, isSelf, profile }: ProfileTabsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<ProfileTab>('posts');

  const {
    posts,
    postsLoading,
    hasMore,
    handleLike,
    handleSavePost,
  } = useProfilePosts(userId);

  const tabs: { key: ProfileTab; label: string; icon: string }[] = [
    { key: 'posts', label: t('profile.posts'), icon: '📝' },
    { key: 'media', label: t('profile.media'), icon: '🖼️' },
    { key: 'friends', label: t('profile.friends'), icon: '👥' },
    { key: 'about', label: t('profile.about'), icon: 'ℹ️' },
  ];

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabItem,
                isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}>
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.primary : theme.textSecondary },
                ]}>
                {tab.icon} {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === 'posts' && (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {postsLoading && posts.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.center}>
              <ThemedText style={styles.emptyIcon}>📝</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('feed.emptyTitle')}
              </ThemedText>
            </View>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={() => handleLike(post.id)}
                  onSave={() => handleSavePost(post.id)}
                />
              ))}
              {postsLoading && <ActivityIndicator size="small" color={theme.primary} />}
              {!hasMore && posts.length > 0 && (
                <ThemedText themeColor="textSecondary" style={styles.endOfFeed}>
                  {t('feed.endOfFeed')}
                </ThemedText>
              )}
            </>
          )}
        </ScrollView>
      )}

      {activeTab === 'media' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ProfileMediaGrid userId={userId} />
        </ScrollView>
      )}

      {activeTab === 'friends' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ProfileFriendsTab userId={userId} />
        </ScrollView>
      )}

      {activeTab === 'about' && profile && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ProfileAboutTab profile={profile} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  tabLabel: {
    ...Typography.caption,
    fontWeight: 600,
  },
  content: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { ...Typography.body },
  endOfFeed: {
    textAlign: 'center',
    padding: Spacing.md,
    ...Typography.caption,
  },
});
