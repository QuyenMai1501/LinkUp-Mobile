import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchEmojifyiEmojis, type EmojiOption } from '@/api/emojifyi';

interface Props {
  onClose: () => void;
  onSelect: (emoji: EmojiOption) => void;
}

const COLUMNS = 4;
const DEBOUNCE_MS = 400;
/** Chiều cao panel inline (đặt trên ô nhập — không che composer). */
const PANEL_HEIGHT = 240;

export function EmojiPicker({ onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<EmojiOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const offsetRef = useRef(0);
  /** Đã chạy search ít nhất 1 lần — phân biệt "mở panel" vs "xóa ô search". */
  const didSearchRef = useRef(false);

  const load = useCallback((q: string, offset: number) => {
    const id = ++requestIdRef.current;
    fetchEmojifyiEmojis({ q, offset })
      .then((res) => {
        if (requestIdRef.current !== id) return;
        setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        offsetRef.current = offset + res.items.length;
        setError(null);
      })
      .catch(() => {
        if (requestIdRef.current === id) setError(t('composer.gifError'));
      })
      .finally(() => {
        if (requestIdRef.current === id) setLoading(false);
      });
  }, [t]);

  // Đóng panel -> hủy request đang chạy (state tự reset khi unmount).
  const closePicker = useCallback(() => {
    requestIdRef.current++;
    onClose();
  }, [onClose]);

  // Panel mount = đang mở -> load catalog 1 lần.
  useEffect(() => {
    load('', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search — xóa hết ô search -> quay về catalog.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      if (didSearchRef.current) {
        didSearchRef.current = false;
        offsetRef.current = 0;
        setItems([]);
        setLoading(true);
        load('', 0);
      }
      return;
    }
    const timeout = setTimeout(() => {
      didSearchRef.current = true;
      setLoading(true);
      setItems([]);
      offsetRef.current = 0;
      load(term, 0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, load]);

  const onEndReached = () => {
    if (!hasMore || loading) return;
    setLoading(true);
    load(query.trim(), offsetRef.current);
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
        <ThemedText themeColor="textSecondary" style={styles.status}>
          {error}
        </ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <View>
              {loading ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : null}
              <ThemedText themeColor="textSecondary" style={styles.attribution}>
                Powered by EmojiFYI
              </ThemedText>
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
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
  grid: {
    padding: Spacing.sm,
  },
  emojiItem: {
    flex: 1 / COLUMNS,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
    padding: 4,
  },
  emojiImg: {
    width: '100%',
    height: '100%',
  },
  loading: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  status: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
  },
  attribution: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: Spacing.sm,
  },
});
