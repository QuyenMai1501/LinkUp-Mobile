import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { GIPHY_KEY, fetchGiphyGifs, type GiphyGif } from '@/api/giphy';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (gif: GiphyGif) => void;
}

const COLUMNS = 2;
const CELL_HEIGHT = 116;
const DEBOUNCE_MS = 400;
const LIMIT = 24;

export function GiphyGifPicker({ visible, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    (q: string) => {
      if (!GIPHY_KEY) return;
      const id = ++requestIdRef.current;
      fetchGiphyGifs({ q, limit: LIMIT })
        .then((gifs) => {
          if (requestIdRef.current !== id) return;
          setItems(gifs);
          setError(null);
        })
        .catch(() => {
          if (requestIdRef.current === id) setError(t('composer.gifError'));
        })
        .finally(() => {
          if (requestIdRef.current === id) setLoading(false);
        });
    },
    [t],
  );

  // Khi mở/đổi query -> load (debounce trong setTimeout callback -> không setState đồng bộ trong effect).
  useEffect(() => {
    if (!visible || !GIPHY_KEY) return;
    const term = query.trim();
    const timeout = setTimeout(() => {
      setLoading(true);
      setItems([]);
      load(term);
    }, term ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timeout);
  }, [visible, query, load]);

  // Đóng picker -> reset state ngay trong event handler (không setState trong effect).
  const closePicker = useCallback(() => {
    requestIdRef.current++;
    setQuery('');
    setItems([]);
    setLoading(true);
    setError(null);
    onClose();
  }, [onClose]);

  const handleSelect = (gif: GiphyGif) => {
    onSelect(gif);
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
              placeholder={t('composer.gifSearch')}
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
              keyExtractor={(item) => item.id}
              numColumns={COLUMNS}
              contentContainerStyle={styles.grid}
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
                    {t('composer.gifEmpty')}
                  </ThemedText>
                )
              }
              renderItem={({ item }) => (
                <Pressable style={styles.gifItem} onPress={() => handleSelect(item)}>
                  <Image source={{ uri: item.preview }} style={styles.gifImg} contentFit="cover" />
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
    maxHeight: '60%',
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
    gap: Spacing.xs,
  },
  gifItem: {
    flex: 1 / COLUMNS,
    height: CELL_HEIGHT,
    margin: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  gifImg: {
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
