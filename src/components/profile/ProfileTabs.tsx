import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { type IconName } from '@/constants/icon-map';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useProfilePosts } from '@/hooks/useProfilePosts';
import { getSavedPosts } from '@/api/posts';
import type { ViewProfileResponse } from '@/types/profile';
import type { FeedPost } from '@/types/post';
import PostCard from '@/components/post-card';
import { ProfileAboutTab } from './ProfileAboutTab';
import { ProfileMediaGrid } from './ProfileMediaGrid';

type ProfileTab = 'posts' | 'media' | 'saved' | 'about';

interface ProfileTabsProps {
  userId: string;
  isSelf: boolean;
  profile?: ViewProfileResponse;
}

export function ProfileTabs({ userId, isSelf, profile }: ProfileTabsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const {
    posts,
    postsLoading,
    hasMore,
    handleLike,
    handleSavePost,
  } = useProfilePosts(userId);

  // Saved posts state
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedHasMore, setSavedHasMore] = useState(true);
  const savedLoadingRef = useRef(false);
  const savedCursorRef = useRef<string | null>(null);

  const fetchSavedPosts = useCallback(async (reset = false) => {
    if (savedLoadingRef.current) return;
    savedLoadingRef.current = true;
    setSavedLoading(true);
    try {
      const cursor = reset ? null : savedCursorRef.current;
      const res = await getSavedPosts(cursor);
      savedCursorRef.current = res.next_cursor;
      setSavedHasMore(res.next_cursor !== null);
      setSavedPosts((prev) => (reset ? res.data : [...prev, ...res.data]));
    } catch {
    } finally {
      setSavedLoading(false);
      savedLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'saved' && isSelf && savedPosts.length === 0) {
      fetchSavedPosts(true);
    }
  }, [activeTab, isSelf, savedPosts.length, fetchSavedPosts]);

  const tabs: { key: ProfileTab; label: string; icon: IconName }[] = [
    { key: 'posts', label: t('profile.posts'), icon: 'document' },
    { key: 'media', label: t('profile.media'), icon: 'images' },
    { key: 'about', label: t('profile.about'), icon: 'info' },
  ];

  if (isSelf) {
    tabs.splice(2, 0, { key: 'saved', label: t('profile.saved'), icon: 'bookmarkFilled' });
  }

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={tab.icon} size={16} color={isActive ? theme.primary : theme.textSecondary} />
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: isActive ? theme.primary : theme.textSecondary },
                  ]}>
                  {tab.label}
                </ThemedText>
              </View>
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
              <Icon name="document" size={48} color={theme.textSecondary} />
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

      {activeTab === 'saved' && (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {savedLoading && savedPosts.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : savedPosts.length === 0 ? (
            <View style={styles.center}>
              <Icon name="bookmarkFilled" size={48} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('profile.noSavedPosts')}
              </ThemedText>
            </View>
          ) : (
            <>
              {savedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={() => handleLike(post.id)}
                  onSave={() => {
                    setSavedPosts((prev) => prev.filter((p) => p.id !== post.id));
                    handleSavePost(post.id);
                  }}
                />
              ))}
              {savedLoading && <ActivityIndicator size="small" color={theme.primary} />}
              {!savedHasMore && savedPosts.length > 0 && (
                <ThemedText themeColor="textSecondary" style={styles.endOfFeed}>
                  {t('feed.endOfFeed')}
                </ThemedText>
              )}
            </>
          )}
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
  emptyText: { ...Typography.body },
  endOfFeed: {
    textAlign: 'center',
    padding: Spacing.md,
    ...Typography.caption,
  },
});
