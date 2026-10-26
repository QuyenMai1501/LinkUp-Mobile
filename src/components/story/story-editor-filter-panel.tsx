import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Canvas, ColorMatrix, Image, useImage } from '@shopify/react-native-skia';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FILTER_PRESETS,
  filterMatrix,
  type FilterPresetId,
  type StoryFilterState,
} from './story-editor-constants';
import { ScrubSlider } from './story-editor-controls';

const TILE_W = 56;
const TILE_H = 64;

interface StoryEditorFilterPanelProps {
  uri: string;
  filter: StoryFilterState;
  onSelect: (id: FilterPresetId) => void;
  onIntensity: (v: number) => void;
  onCheckpoint: () => void;
}

export default function StoryEditorFilterPanel({
  uri,
  filter,
  onSelect,
  onIntensity,
  onCheckpoint,
}: StoryEditorFilterPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const thumb = useImage(uri);

  const pct = Math.round(filter.intensity * 100);

  return (
    <View
      style={[styles.panel, { backgroundColor: theme.card, borderTopColor: theme.border }]}
      accessibilityLabel={t('story.editor.filters')}>
      <View style={styles.row}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          {t('story.editor.intensity')}
        </ThemedText>
        <ThemedText style={[styles.value, { color: theme.text }]}>{pct}</ThemedText>
        <ScrubSlider
          value={pct}
          min={0}
          max={100}
          color={theme.primary}
          onChange={(v) => onIntensity(v / 100)}
          onStart={onCheckpoint}
          ariaLabel={t('story.editor.intensity')}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiles}>
        {FILTER_PRESETS.map((id) => {
          const active = filter.id === id;
          const mx = filterMatrix(id, active ? filter.intensity : 1);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`story.editor.${id}`)}
              onPress={() => {
                onCheckpoint();
                onSelect(id);
              }}>
              <View
                style={[
                  styles.tile,
                  { backgroundColor: theme.border },
                  active && { borderColor: theme.primary },
                ]}>
                {thumb && (
                  <Canvas style={{ width: TILE_W, height: TILE_H - 20 }}>
                    <Image
                      image={thumb}
                      x={0}
                      y={0}
                      width={TILE_W}
                      height={TILE_H - 20}
                      fit="cover">
                      {mx && <ColorMatrix matrix={mx} />}
                    </Image>
                  </Canvas>
                )}
                <View style={[styles.tileLabel, { backgroundColor: theme.card }]}>
                  <ThemedText
                    style={[styles.tileText, { color: active ? theme.primary : theme.text }]}>
                    {t(`story.editor.${id}`)}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  tiles: {
    gap: 8,
    paddingVertical: 2,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
  },
  tileLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 1,
  },
  tileText: {
    fontSize: 9,
    fontWeight: '600',
  },
});
