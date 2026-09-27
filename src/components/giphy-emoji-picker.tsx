import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { GIPHY_KEY, fetchGiphyEmojis, type GiphyEmoji } from '@/api/giphy';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

const COLUMNS = 4;
const DEBOUNCE_MS = 400;

export function GiphyEmojiPicker({ visible, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const offsetRef = useRef(0);

  const load = useCallback((q: string, offset: number) => {
    if (!GIPHY_KEY) return;
    const id = ++requestIdRef.current;
    fetchGiphyEmojis({ q, offset })
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

  // Đóng picker -> reset state ngay trong event handler (không setState trong effect).
  const closePicker = useCallback(() => {
    requestIdRef.current++;
    offsetRef.current = 0;
    setQuery('');
    setItems([]);
    setLoading(true);
    setError(null);
    onClose();
  }, [onClose]);

  // Mở picker -> load catalog.
  useEffect(() => {
    if (!visible) return;
    load('', 0);
  }, [visible, load]);

  // Debounced search.
  useEffect(() => {
    if (!visible || !GIPHY_KEY) return;
    const term = query.trim();
    if (!term) return;
    const timeout = setTimeout(() => {
      setLoading(true);
      setItems([]);
      offsetRef.current = 0;
      load(term, 0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, visible, load]);

  const onEndReached = () => {
    if (!hasMore || loading) return;
    setLoading(true);
    load(query.trim(), offsetRef.current);
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    closePicker();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closePicker}>
      <Pressable style={styles.overlay} onPress={closePicker}>
        <Pressable
          style={[styles.container, { backgroundColor: theme.card }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

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
          ) : !GIPHY_KEY ? (
            <ThemedText themeColor="textSecondary" style={styles.status}>
              {t('composer.gifMissingKey')}
            </ThemedText>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => `${item.id}-${item.title}`}
              numColumns={COLUMNS}
              contentContainerStyle={styles.grid}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loading ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                loading ? null : (
                  <ThemedText themeColor="textSecondary" style={styles.status}>
                    {t('composer.emojiEmpty')}
                  </ThemedText>
                )
              }
              renderItem={({ item }) => (
                <Pressable style={styles.emojiItem} onPress={() => handleSelect(item.url)}>
                  <Image source={{ uri: item.preview }} style={styles.emojiImg} contentFit="contain" />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '55%',
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
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
});
