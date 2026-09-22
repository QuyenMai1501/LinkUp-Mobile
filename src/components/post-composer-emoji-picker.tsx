import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

type EmojiGroup = 'positive' | 'neutral' | 'negative';

const EMOJI_GROUPS: { key: EmojiGroup; label: string }[] = [
  { key: 'positive', label: '😊' },
  { key: 'neutral', label: '😐' },
  { key: 'negative', label: '😢' },
];

const EMOJIS: Record<EmojiGroup, string[]> = {
  positive: [
    '😊', '😄', '😁', '😆', '🤣', '😂', '🙂', '😍', '🥰', '😘',
    '😎', '🤩', '🥳', '😏', '🤗', '😋', '😜', '🤪', '😝', '🤑',
    '👍', '👏', '🙌', '💪', '❤️', '🔥', '⭐', '🎉', '🎊', '✅',
    '💕', '💖', '💗', '💓', '💞', '🌹', '🌸', '☀️', '🌈', '✨',
  ],
  neutral: [
    '😐', '😑', '😶', '🤔', '🫡', '🙄', '😏', '😴', '🥱', '🫠',
    '👋', '🤝', '👋', '🤞', '✌️', '🫶', '👀', '💬', '💭', '🫥',
    '📌', '📍', '🏷️', '📎', '🔗', '📝', '📊', '📈', '🗓️', '⏰',
  ],
  negative: [
    '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️',
    '💔', '😞', '😔', '😟', '😰', '😱', '😨', '😥', '😓', '🙁',
    '👎', '🖕', '⚠️', '🚫', '❌', '❗', '❓', '💤', '🩹', '🤒',
  ],
};

export default function EmojiPicker({ visible, onClose, onSelect }: EmojiPickerProps) {
  const [activeGroup, setActiveGroup] = useState<EmojiGroup>('positive');
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: theme.bg }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
            {EMOJI_GROUPS.map((g) => (
              <Pressable
                key={g.key}
                onPress={() => setActiveGroup(g.key)}
                style={[
                  styles.tab,
                  activeGroup === g.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
                ]}>
                <ThemedText style={styles.tabEmoji}>{g.label}</ThemedText>
              </Pressable>
            ))}
          </View>

          <FlatList
            style={styles.flex}
            data={EMOJIS[activeGroup]}
            numColumns={8}
            keyExtractor={(item, idx) => `${activeGroup}-${idx}`}
            renderItem={({ item }) => (
              <Pressable
                style={styles.emojiBtn}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}>
                <ThemedText style={styles.emoji}>{item}</ThemedText>
              </Pressable>
            )}
            contentContainerStyle={styles.grid}
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
    flex: 1,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '50%',
    paddingBottom: 34,
  },
  flex: {
    flex: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCC',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  tabEmoji: {
    fontSize: 22,
  },
  grid: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  emojiBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
    maxWidth: '12.5%',
  },
  emoji: {
    fontSize: 28,
  },
});
