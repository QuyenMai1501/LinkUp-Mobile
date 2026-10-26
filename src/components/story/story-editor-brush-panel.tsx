import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { COLOR_PRESETS, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, CANVAS_PER_WEB, type BrushState } from './story-editor-constants';
import { ScrubSlider, SwatchRow, ToggleChip } from './story-editor-controls';

interface StoryEditorBrushPanelProps {
  brush: BrushState;
  onChange: (patch: Partial<BrushState>) => void;
  hasStrokes: boolean;
  onClear: () => void;
}

export default function StoryEditorBrushPanel({
  brush,
  onChange,
  hasStrokes,
  onClear,
}: StoryEditorBrushPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const webMin = Math.round(BRUSH_SIZE_MIN / CANVAS_PER_WEB);
  const webMax = Math.round(BRUSH_SIZE_MAX / CANVAS_PER_WEB);
  const webSize = Math.max(webMin, Math.min(webMax, Math.round(brush.size / CANVAS_PER_WEB)));

  return (
    <View
      style={[styles.panel, { backgroundColor: theme.card, borderTopColor: theme.border }]}
      accessibilityLabel={t('story.editor.draw')}>
      <View style={styles.row}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          {t('story.editor.brushSize')}
        </ThemedText>
        <ThemedText style={[styles.value, { color: theme.text }]}>{webSize}</ThemedText>
        <ScrubSlider
          value={webSize}
          min={webMin}
          max={webMax}
          color={brush.eraser ? theme.border : brush.color}
          onChange={(v) => onChange({ size: Math.round(v * CANVAS_PER_WEB) })}
          onStart={() => {}}
          ariaLabel={t('story.editor.brushSize')}
        />
      </View>

      <View style={styles.chipRow}>
        <ToggleChip
          label={t('story.editor.eraser')}
          active={brush.eraser}
          onPress={() => onChange({ eraser: !brush.eraser })}
        />
        <ToggleChip
          label={t('story.editor.clear')}
          active={false}
          disabled={!hasStrokes}
          onPress={onClear}
        />
        <ToggleChip
          label={t('story.editor.brushGradient')}
          active={brush.gradient.enabled}
          onPress={() =>
            onChange({ gradient: { ...brush.gradient, enabled: !brush.gradient.enabled } })
          }
        />
      </View>

      <View style={styles.swatchRow}>
        <SwatchRow
          colors={COLOR_PRESETS}
          active={brush.eraser ? null : brush.color}
          onPick={(color) => onChange({ color, eraser: false })}
          label={t('story.editor.draw')}
        />
      </View>

      {brush.gradient.enabled && (
        <View style={styles.gradRow}>
          <View style={styles.gradCol}>
            <ThemedText style={[styles.hex, { color: theme.textSecondary }]}>
              {brush.gradient.from}
            </ThemedText>
            <SwatchRow
              colors={COLOR_PRESETS}
              active={brush.gradient.from}
              onPick={(from) => onChange({ gradient: { ...brush.gradient, from } })}
              label={`${t('story.editor.brushGradient')} from`}
            />
          </View>
          <View style={styles.gradCol}>
            <ThemedText style={[styles.hex, { color: theme.textSecondary }]}>
              {brush.gradient.to}
            </ThemedText>
            <SwatchRow
              colors={COLOR_PRESETS}
              active={brush.gradient.to}
              onPick={(to) => onChange({ gradient: { ...brush.gradient, to } })}
              label={`${t('story.editor.brushGradient')} to`}
            />
          </View>
        </View>
      )}
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
    minWidth: 22,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  swatchRow: {
    paddingVertical: 2,
  },
  gradRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  gradCol: {
    gap: 4,
  },
  hex: {
    fontSize: 11,
    fontWeight: '600',
  },
});
