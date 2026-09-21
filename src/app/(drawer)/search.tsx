import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { search as searchApi } from '@/api/search';
import type {
  SearchResponse,
  UserSearchResult,
  PostSearchResult,
  HashtagSearchResult,
  CommunitySearchResult,
} from '@/types/search';

type Tab = 'all' | 'users' | 'posts' | 'hashtags' | 'communities';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'all', labelKey: 'search.tabAll' },
  { key: 'users', labelKey: 'search.tabUsers' },
  { key: 'posts', labelKey: 'search.tabPosts' },
  { key: 'hashtags', labelKey: 'search.tabHashtags' },
  { key: 'communities', labelKey: 'search.tabCommunities' },
];

const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const goBack = () => {
    if ((navigation as any).canGoBack?.()) {
      (navigation as any).goBack();
    } else {
      (navigation as any).navigate?.('index');
    }
  };

  const executeSearch = useCallback(
    async (keyword: string, type: string = 'all') => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        setResults(null);
        setHasSearched(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setHasSearched(true);
      try {
        const res = await searchApi(trimmed, type);
        if (!controller.signal.aborted) {
          setResults(res);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setResults(null);
        setHasSearched(false);
        setLoading(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        executeSearch(text, activeTab);
      }, DEBOUNCE_MS);
    },
    [activeTab, executeSearch],
  );

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    executeSearch(query, activeTab);
    Keyboard.dismiss();
  }, [query, activeTab, executeSearch]);

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      if (query.trim()) {
        executeSearch(query, tab);
      }
    },
    [query, executeSearch],
  );

  useEffect(() => {
    return () => {
      debounceRef.current && clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const users = results?.users ?? [];
  const posts = results?.posts ?? [];
  const hashtags = results?.hashtags ?? [];
  const communities = results?.communities ?? [];
  const hasResults = users.length > 0 || posts.length > 0 || hashtags.length > 0 || communities.length > 0;

  const navigateToProfile = (userId: string) => {
    (router as any).push(`/(drawer)/profile/${userId}`);
  };

  const navigateToPost = (postId: string) => {
    (router as any).push(`/(drawer)/post/${postId}`);
  };

  const handleHashtagPress = (name: string) => {
    setQuery(`#${name}`);
    executeSearch(`#${name}`, activeTab);
  };

  const navigateToCommunities = () => {
    (router as any).push('/(drawer)/communities');
  };

  // ---------- RENDER HELPERS ----------

  const renderUserItem = ({ item }: { item: UserSearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: theme.bgHover }]}
      onPress={() => navigateToProfile(item.id)}>
      <View style={[styles.avatar, { backgroundColor: theme.bgHover }]}>
        {item.avatar_uri ? (
          <Image source={{ uri: item.avatar_uri }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <ThemedText style={[styles.avatarFallback, { color: theme.textSecondary }]}>
            {item.display_name?.charAt(0)?.toUpperCase() || '?'}
          </ThemedText>
        )}
      </View>
      <View style={styles.itemMeta}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          {item.display_name || item.username}
        </ThemedText>
        {item.display_name && item.username && (
          <ThemedText themeColor="textSecondary" style={styles.itemSub} numberOfLines={1}>
            @{item.username}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );

  const renderPostItem = ({ item }: { item: PostSearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: theme.bgHover }]}
      onPress={() => navigateToPost(item.id)}>
      <View style={[styles.iconBox, { backgroundColor: theme.bgHover }]}>
        <ThemedText style={[styles.iconBoxText, { color: theme.textSecondary }]}>📄</ThemedText>
      </View>
      <View style={styles.itemMeta}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.itemSub} numberOfLines={1}>
          @{item.username}
        </ThemedText>
      </View>
    </Pressable>
  );

  const renderHashtagItem = ({ item }: { item: HashtagSearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: theme.bgHover }]}
      onPress={() => handleHashtagPress(item.name)}>
      <View style={[styles.iconBox, { backgroundColor: theme.primaryLight }]}>
        <ThemedText style={[styles.iconBoxHash, { color: theme.primary }]}>#</ThemedText>
      </View>
      <View style={styles.itemMeta}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          #{item.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.itemSub} numberOfLines={1}>
          {item.post_count} {t('search.posts')}
        </ThemedText>
      </View>
    </Pressable>
  );

  const renderCommunityItem = ({ item }: { item: CommunitySearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: theme.bgHover }]}
      onPress={navigateToCommunities}>
      <View style={[styles.avatar, { backgroundColor: theme.bgHover }]}>
        {item.avatar_uri ? (
          <Image source={{ uri: item.avatar_uri }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <ThemedText style={[styles.avatarFallback, { color: theme.textSecondary }]}>🌐</ThemedText>
        )}
      </View>
      <View style={styles.itemMeta}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.itemSub} numberOfLines={1}>
          {item.member_count} {t('search.members')}
        </ThemedText>
      </View>
    </Pressable>
  );

  const renderSection = <T,>(
    title: string,
    data: T[],
    renderItem: (info: { item: T }) => React.JSX.Element,
    keyExtractor: (item: T) => string,
  ) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        />
      </View>
    );
  };

  // ---------- MAIN CONTENT ----------

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            {t('common.loading')}
          </ThemedText>
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>🔍</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {t('search.emptyHint')}
          </ThemedText>
        </View>
      );
    }

    if (!hasResults) {
      return (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>🔍</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {t('search.noResults')}{' '}
            <ThemedText style={{ fontWeight: '600', color: theme.text }}>&ldquo;{query}&rdquo;</ThemedText>
          </ThemedText>
        </View>
      );
    }

    if (activeTab === 'all') {
      return (
        <View style={styles.listContent}>
          {renderSection(t('search.peopleSection', { count: users.length }), users, renderUserItem, (u) => u.id)}
          {renderSection(t('search.postsSection', { count: posts.length }), posts, renderPostItem, (p) => p.id)}
          {renderSection(t('search.hashtagsSection', { count: hashtags.length }), hashtags, renderHashtagItem, (h) => h.name)}
          {renderSection(t('search.communitiesSection', { count: communities.length }), communities, renderCommunityItem, (c) => c.id)}
        </View>
      );
    }

    if (activeTab === 'users') {
      return (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (activeTab === 'posts') {
      return (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderPostItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (activeTab === 'hashtags') {
      return (
        <FlatList
          data={hashtags}
          keyExtractor={(h) => h.name}
          renderItem={renderHashtagItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    return (
      <FlatList
        data={communities}
        keyExtractor={(c) => c.id}
        renderItem={renderCommunityItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <ThemedText style={[styles.backIcon, { color: theme.text }]}>←</ThemedText>
          </Pressable>
          <View style={[styles.searchInputWrapper, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <ThemedText style={styles.searchIcon}>🔍</ThemedText>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={query}
              onChangeText={handleQueryChange}
              onSubmitEditing={handleSubmit}
              placeholder={t('search.placeholder')}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => handleQueryChange('')} style={styles.clearBtn}>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 16 }}>✕</ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabChange(tab.key)}
                style={[
                  styles.tabItem,
                  isActive && { backgroundColor: theme.primaryLight },
                ]}>
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: isActive ? theme.primary : theme.textSecondary },
                  ]}>
                  {t(tab.labelKey)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <View style={styles.content}>{renderContent()}</View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
  backIcon: { fontSize: 20 },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    height: 40,
    gap: Spacing.xs,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  tabLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },

  // Content
  content: { flex: 1 },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  // Section
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.02,
    marginBottom: Spacing.sm,
  },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxText: { fontSize: 16 },
  iconBoxHash: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  itemMeta: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  itemSub: {
    fontSize: 12,
  },

  // Center states
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  loadingText: { ...Typography.body },
  emptyIcon: { fontSize: 48, lineHeight: 56 },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
  },
});
