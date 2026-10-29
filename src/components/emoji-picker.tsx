import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getEmojis } from '@/api/posts';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { EmojiItem } from '@/types/post';

interface Props {
  onClose: () => void;
  onSelect: (emoji: EmojiItem) => void;
}

const COLUMNS = 8;
const DEBOUNCE_MS = 400;
const PAGE_SIZE = 60;
/** Chiều cao panel inline (đặt trên ô nhập — không che composer). */
const PANEL_HEIGHT = 280;
const TAB_BAR_HEIGHT = 44;

/** Tab category — khớp seed server (mirror web EMOJI_CATEGORIES). */
const CATEGORIES = [
  { id: 'smileys', icon: '😀', label: 'Smileys' },
  { id: 'people', icon: '👋', label: 'People' },
  { id: 'nature', icon: '🌿', label: 'Nature' },
  { id: 'food', icon: '🍔', label: 'Food' },
  { id: 'travel', icon: '✈️', label: 'Travel' },
  { id: 'activity', icon: '⚽', label: 'Activity' },
  { id: 'objects', icon: '💡', label: 'Objects' },
  { id: 'symbols', icon: '❤️', label: 'Symbols' },
  { id: 'flags', icon: '🏳️', label: 'Flags' },
] as const;

export function EmojiPicker({ onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>(CATEGORIES[0].id);
  const [items, setItems] = useState<EmojiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestIdRef = useRef(0);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const itemsRef = useRef<EmojiItem[]>([]);
  /** slug category đang chọn — đọc stale trong effect search mà không re-trigger. */
  const activeCatRef = useRef<string>(CATEGORIES[0].id);
  /** Đã chạy search ít nhất 1 lần — phân biệt "mở panel" vs "xóa ô search". */
  const didSearchRef = useRef(false);
  /** Cache tích lũy per-category — mở lại tab là tức thì, infinite scroll tiếp tục. */
  const catCacheRef = useRef(new Map<string, { items: EmojiItem[]; hasMore: boolean }>());

  const searching = query.trim().length > 0;

  const setLoadingBoth = useCallback((v: boolean) => {
    loadingRef.current = v;
    setLoading(v);
  }, []);

  /** Nạp/trang tiếp theo: q (search) hoặc category (browse). offset 0 = thay lưới. */
  const load = useCallback(
    (cat: string, term: string, offset: number) => {
      const id = ++requestIdRef.current;
      setLoadingBoth(true);
      setError(null);
      getEmojis({
        q: term || undefined,
        category: term ? undefined : cat,
        limit: PAGE_SIZE,
        offset,
      })
        .then((res) => {
          if (requestIdRef.current !== id) return;
          const merged = offset === 0 ? res.data : [...itemsRef.current, ...res.data];
          itemsRef.current = merged;
          setItems(merged);
          setHasMore(res.has_more);
          offsetRef.current = merged.length;
          if (!term) catCacheRef.current.set(cat, { items: merged, hasMore: res.has_more });
          setError(null);
        })
        .catch(() => {
          if (requestIdRef.current === id) setError(t('chat.emojiUnavailable'));
        })
        .finally(() => {
          if (requestIdRef.current === id) setLoadingBoth(false);
        });
    },
    [setLoadingBoth, t],
  );

  const restoreCategory = useCallback(
    (cat: string) => {
      requestIdRef.current++; // hủy request đang chạy
      const hit = catCacheRef.current.get(cat);
      itemsRef.current = hit?.items ?? [];
      setItems(itemsRef.current);
      setHasMore(hit?.hasMore ?? false);
      offsetRef.current = itemsRef.current.length;
      setLoadingBoth(false);
      setError(null);
    },
    [setLoadingBoth],
  );

  // Đóng panel -> hủy request đang chạy (state tự reset khi unmount).
  const closePicker = useCallback(() => {
    requestIdRef.current++;
    onClose();
  }, [onClose]);

  // Mở panel = load category đầu (defer 1 tick tránh setState đồng bộ trong effect).
  useEffect(() => {
    const timer = setTimeout(() => load(activeCatRef.current, '', 0), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search — xóa hết ô search -> quay về category đang chọn (cache).
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      if (didSearchRef.current) {
        didSearchRef.current = false;
        const cat = activeCatRef.current;
        if (catCacheRef.current.has(cat)) restoreCategory(cat);
        else load(cat, '', 0);
      }
      return;
    }
    const timeout = setTimeout(() => {
      didSearchRef.current = true;
      load(activeCatRef.current, term, 0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [load, query, restoreCategory]);

  const selectCategory = (cat: string) => {
    if (cat === activeCatRef.current) return;
    activeCatRef.current = cat;
    setActiveCat(cat);
    if (catCacheRef.current.has(cat)) restoreCategory(cat);
    else {
      itemsRef.current = [];
      setItems([]);
      load(cat, '', 0);
    }
  };

  const onEndReached = useCallback(() => {
    if (loadingRef.current || !hasMore || error) return;
    load(activeCatRef.current, didSearchRef.current ? query.trim() : '', offsetRef.current);
  }, [error, hasMore, load, query]);

  // Thử lại sau lỗi — theo ngữ cảnh đang search hay đang ở category.
  const retry = () => {
    const term = query.trim();
    load(activeCatRef.current, term, 0);
  };

  // Chọn emoji -> GIỮ panel mở để nhập nhiều emoji liên tiếp; đóng bằng ✕ hoặc bấm lại nút emoji.
  const handleSelect = (emoji: EmojiItem) => {
    onSelect(emoji);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('composer.emojiSearch')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.bgSecondary }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable onPress={closePicker} style={styles.closeBtn} hitSlop={8}>
          <ThemedText themeColor="textSecondary" style={styles.closeText}>
            ✕
          </ThemedText>
        </Pressable>
      </View>

      {error ? (
        <Pressable style={styles.statusWrap} onPress={retry}>
          <ThemedText themeColor="textSecondary" style={styles.status}>
            {error}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.retryHint}>
            {t('composer.emojiRetry')}
          </ThemedText>
        </Pressable>
      ) : (
        <FlatList
          key={searching ? 'search' : activeCat}
          style={styles.gridFlex}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loading && items.length > 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.status}>
                {t('composer.emojiEmpty')}
              </ThemedText>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.emojiItem}
              onPress={() => handleSelect(item)}
              accessibilityLabel={item.name || item.code}>
              <Text style={styles.emojiChar} numberOfLines={1}>
                {item.character || item.code}
              </Text>
            </Pressable>
          )}
        />
      )}

      {/* Tab bar category — ẩn khi search (kết quả search gộp nhiều category) */}
      {!searching && !error && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { borderTopColor: theme.border }]}
          contentContainerStyle={styles.tabBarContent}>
          {CATEGORIES.map((cat) => {
            const active = cat.id === activeCat;
            return (
              <Pressable
                key={cat.id}
                onPress={() => selectCategory(cat.id)}
                accessibilityRole="tab"
                accessibilityLabel={cat.label}
                accessibilityState={{ selected: active }}
                hitSlop={4}
                style={[
                  styles.tab,
                  active && { backgroundColor: theme.bgSecondary, borderBottomColor: theme.primary },
                ]}>
                <ThemedText
                  style={[styles.tabIcon, active && { color: theme.primary }]}
                  numberOfLines={1}>
                  {cat.icon}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PANEL_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    fontSize: 14,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  closeText: {
    fontSize: 14,
  },
  gridFlex: {
    flex: 1,
  },
  grid: {
    padding: Spacing.sm,
  },
  emojiItem: {
    flex: 1 / COLUMNS,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
    padding: 2,
  },
  emojiChar: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  loading: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statusWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  status: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
  },
  retryHint: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  tabBar: {
    flexGrow: 0,
    height: TAB_BAR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.xs,
  },
  tab: {
    minWidth: 44,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
});
