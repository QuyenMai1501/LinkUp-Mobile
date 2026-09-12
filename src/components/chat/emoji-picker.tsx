import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmojiImage } from '@/components/chat/emoji-image';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useTranslation } from '@/hooks/useTranslation';
import { getEmotionEmojis, EMOTION_GROUPS } from '@/utils/emojis';
import type { EmojiGroup, EmojiItem } from '@/utils/emojis';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: EmojiItem) => void;
}

const COLUMNS = 6;

export function EmojiPicker({ visible, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const [activeGroup, setActiveGroup] = useState<EmojiGroup>('positive');

  const emojis = useMemo(() => getEmotionEmojis(), []);

  const grouped = useMemo(() => {
    const map = new Map<EmojiGroup, EmojiItem[]>();
    for (const g of EMOTION_GROUPS) {
      map.set(g, emojis.filter((e) => e.group === g));
    }
    return map;
  }, [emojis]);

  const currentEmojis = grouped.get(activeGroup) ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          {/* Tabs */}
          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {EMOTION_GROUPS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setActiveGroup(g)}
                style={[
                  styles.tab,
                  activeGroup === g && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                ]}>
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: activeGroup === g ? colors.primary : colors.textSecondary },
                  ]}>
                  {t(`chat.emojiCat.${g}`)}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Grid */}
          <FlatList
            data={currentEmojis}
            keyExtractor={(item) => item.id}
            numColumns={COLUMNS}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <Pressable
                style={styles.emojiItem}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}>
                <EmojiImage emoji={item} size={32} />
              </Pressable>
            )}
          />
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '50%',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    padding: 8,
  },
  emojiItem: {
    flex: 1 / COLUMNS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
