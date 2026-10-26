import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { STICKERS, type StickerDef } from './story-editor-constants';

interface StoryEditorStickerPanelProps {
  onPick: (sticker: StickerDef) => void;
}

export default function StoryEditorStickerPanel({ onPick }: StoryEditorStickerPanelProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.panel, { backgroundColor: theme.card, borderTopColor: theme.border }]}
      accessibilityLabel="Stickers">
      <View style={styles.grid}>
        {STICKERS.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={s.emoji}
            onPress={() => onPick(s)}
            style={[styles.cell, { backgroundColor: 'rgba(128,128,128,0.15)' }]}>
            <ThemedText style={styles.emoji}>{s.emoji}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  cell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
    lineHeight: 32,
  },
});
