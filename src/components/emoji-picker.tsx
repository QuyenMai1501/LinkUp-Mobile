import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  fetchCategoryEmojis,
  fetchEmojiCategories,
  prefetchCategoryEmojis,
  searchEmojis,
  type EmojiCategory,
  type EmojiOption,
} from '@/api/emojifyi';

interface Props {
  onClose: () => void;
  onSelect: (emoji: EmojiOption) => void;
}

const COLUMNS = 8;
const DEBOUNCE_MS = 400;
/** Chiều cao panel inline (đặt trên ô nhập — không che composer). */
const PANEL_HEIGHT = 280;
const TAB_BAR_HEIGHT = 44;
/** Prefetch nền: delay đầu né animation mở panel, gap giữa 2 request. */
const PREFETCH_DELAY_MS = 400;
const PREFETCH_GAP_MS = 250;

export function EmojiPicker({ onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<EmojiCategory[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [items, setItems] = useState<EmojiOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  /** slug category đang chọn — đọc stale trong effect search mà không re-trigger. */
  const activeSlugRef = useRef<string | null>(null);
  /** Đã chạy search ít nhất 1 lần — phân biệt "mở panel" vs "xóa ô search". */
  const didSearchRef = useRef(false);
  /** Đã kick prefetch nền cho phiên mở panel này. */
  const prefetchedRef = useRef(false);

  const searching = query.trim().length > 0;

  /** Nạp emoji của 1 category (cache per-slug — mở lại là tức thì). */
  const loadCategory = useCallback(
    (slug: string) => {
      const id = ++requestIdRef.current;
      setLoading(true);
      // Xóa lưới ngay -> spinner hiện liền khi đổi tab (hết hiện emoji category cũ).
      setItems([]);
      fetchCategoryEmojis(slug)
        .then((res) => {
          if (requestIdRef.current !== id) return;
          setItems(res);
          setError(null);
        })
        .catch(() => {
          if (requestIdRef.current === id) setError(t('chat.emojiUnavailable'));
        })
        .finally(() => {
          if (requestIdRef.current === id) setLoading(false);
        });
    },
    [t],
  );

  /** Search (debounce gọi từ effect) — kết quả phẳng, tối đa 50 kq. */
  const runSearch = useCallback(
    (term: string) => {
      const id = ++requestIdRef.current;
      setLoading(true);
      searchEmojis(term)
        .then((res) => {
          if (requestIdRef.current !== id) return;
          setItems(res);
          setError(null);
        })
        .catch(() => {
          if (requestIdRef.current === id) setError(t('chat.emojiUnavailable'));
        })
        .finally(() => {
          if (requestIdRef.current === id) setLoading(false);
        });
    },
    [t],
  );

  /** Panel mount = đang mở -> lấy danh sách category rồi nạp category đầu.
   *  Không setLoading đồng bộ trong này (state khởi tạo đã loading=true) —
   *  tránh lỗi react-hooks/set-state-in-effect. */
  const bootstrap = useCallback(() => {
    const id = ++requestIdRef.current;
    fetchEmojiCategories()
      .then((cats) => {
        if (requestIdRef.current !== id) return;
        setCategories(cats);
        const first = cats[0];
        if (first) {
          activeSlugRef.current = first.slug;
          setActiveSlug(first.slug);
          loadCategory(first.slug);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (requestIdRef.current === id) {
          setError(t('chat.emojiUnavailable'));
          setLoading(false);
        }
      });
  }, [loadCategory, t]);

  // Đóng panel -> hủy request đang chạy (state tự reset khi unmount).
  const closePicker = useCallback(() => {
    requestIdRef.current++;
    onClose();
  }, [onClose]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch nền toàn bộ category (1 lần khi panel mở) — ghi vào cache module-level,
  // KHÔNG setState nên không ảnh hưởng grid/search/request guard. Đóng panel giữa chừng
  // thì dừng, phần đã tải vẫn còn cache, lần mở sau tiếp tục (cache hit -> không network).
  useEffect(() => {
    if (!categories.length || prefetchedRef.current) return;
    prefetchedRef.current = true;
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const cat = categories[index++];
      if (!cat) return;
      prefetchCategoryEmojis(cat.slug);
      timer = setTimeout(tick, PREFETCH_GAP_MS);
    };
    timer = setTimeout(tick, PREFETCH_DELAY_MS);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [categories]);

  // Debounced search — xóa hết ô search -> quay về category đang chọn (cache).
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      if (didSearchRef.current) {
        didSearchRef.current = false;
        const slug = activeSlugRef.current;
        if (slug) loadCategory(slug);
      }
      return;
    }
    const timeout = setTimeout(() => {
      didSearchRef.current = true;
      runSearch(term);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, loadCategory, runSearch]);

  const selectCategory = (slug: string) => {
    if (slug === activeSlugRef.current) return;
    activeSlugRef.current = slug;
    setActiveSlug(slug);
    loadCategory(slug);
  };

  // Thử lại sau lỗi — theo ngữ cảnh đang search hay đang ở category.
  const retry = () => {
    const term = query.trim();
    if (term) {
      runSearch(term);
      return;
    }
    const slug = activeSlugRef.current;
    if (slug) loadCategory(slug);
    else {
      setLoading(true); // event handler — đồng bộ OK, không ở trong effect
      bootstrap();
    }
  };

  // Chọn emoji -> GIỮ panel mở để nhập nhiều emoji liên tiếp; đóng bằng ✕ hoặc bấm lại nút emoji.
  const handleSelect = (emoji: EmojiOption) => {
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
          key={searching ? 'search' : (activeSlug ?? 'category')}
          style={styles.gridFlex}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          ListFooterComponent={
            <View>
              <ThemedText themeColor="textSecondary" style={styles.attribution}>
                Powered by EmojiFYI
              </ThemedText>
            </View>
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
            <Pressable style={styles.emojiItem} onPress={() => handleSelect(item)}>
              <Image source={{ uri: item.preview }} style={styles.emojiImg} contentFit="contain" />
            </Pressable>
          )}
        />
      )}

      {/* Tab bar category — ẩn khi search (kết quả search gộp nhiều category) */}
      {!searching && !error && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { borderTopColor: theme.border }]}
          contentContainerStyle={styles.tabBarContent}>
          {categories.map((cat) => {
            const active = cat.slug === activeSlug;
            return (
              <Pressable
                key={cat.slug}
                onPress={() => selectCategory(cat.slug)}
                accessibilityRole="tab"
                accessibilityLabel={cat.name}
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
  emojiImg: {
    width: '100%',
    height: '100%',
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
  attribution: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: Spacing.sm,
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
