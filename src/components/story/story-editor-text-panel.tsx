import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  CANVAS_PER_WEB,
  COLOR_PRESETS,
  FONT_OPTIONS,
  HIGHLIGHT_COLORS,
  OUTLINE_COLORS,
  TYPE_PRESETS,
  type TextPanelStyle,
} from './story-editor-constants';

interface StoryEditorTextPanelProps {
  style: TextPanelStyle;
  hasSelection: boolean;
  onStyleChange: (patch: Partial<TextPanelStyle>) => void;
  onCheckpoint: () => void;
}

interface ScrubSliderProps {
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
  onStart: () => void;
  ariaLabel: string;
}

function ScrubSlider({ value, min, max, color, onChange, onStart, ariaLabel }: ScrubSliderProps) {
  const theme = useTheme();
  const [trackW, setTrackW] = useState(0);

  const setFromX = useCallback(
    (x: number) => {
      if (trackW <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / trackW));
      onChange(Math.round(min + ratio * (max - min)));
    },
    [max, min, onChange, trackW],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          onStart();
          setFromX(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      }),
    [onStart, setFromX],
  );

  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  return (
    <View
      style={[styles.sliderTrack, { backgroundColor: theme.border }]}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={ariaLabel}
      accessibilityValue={{ min, max, now: value }}>
      <View style={[styles.sliderFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <View
        style={[
          styles.sliderThumb,
          { left: Math.max(0, pct * (trackW - 16)), backgroundColor: color },
        ]}
      />
    </View>
  );
}

interface SwatchRowProps {
  colors: string[];
  active: string | null;
  onPick: (color: string) => void;
  label: string;
}

function SwatchRow({ colors, active, onPick, label }: SwatchRowProps) {
  return (
    <View style={styles.swatches} accessibilityLabel={label}>
      {colors.map((color) => (
        <Pressable
          key={color}
          accessibilityRole="button"
          accessibilityLabel={color}
          accessibilityState={{ selected: active === color }}
          onPress={() => onPick(color)}
          style={[
            styles.swatch,
            { backgroundColor: color },
            active === color && styles.swatchActive,
          ]}
        />
      ))}
    </View>
  );
}

interface ToggleChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function ToggleChip({ label, active, onPress }: ToggleChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.border, backgroundColor: active ? theme.primary : 'transparent' },
      ]}>
      <ThemedText
        style={[styles.chipText, { color: active ? theme.textOnPrimary : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function StoryEditorTextPanel({
  style,
  hasSelection,
  onStyleChange,
  onCheckpoint,
}: StoryEditorTextPanelProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [advanced, setAdvanced] = useState(false);
  const gradientOn = style.gradient !== null;
  const outlineOn = style.strokeWidth > 0;
  const highlightOn = style.highlight !== null;

  const change = (patch: Partial<TextPanelStyle>, checkpoint = true) => {
    if (checkpoint) onCheckpoint();
    onStyleChange(patch);
  };

  const webSize = Math.round(style.fontSize / CANVAS_PER_WEB);
  const webOutline = Math.max(1, Math.round(style.strokeWidth / CANVAS_PER_WEB));

  const aligns: { key: 'left' | 'center' | 'right'; glyph: string }[] = [
    { key: 'left', glyph: 'L' },
    { key: 'center', glyph: 'C' },
    { key: 'right', glyph: 'R' },
  ];

  if (!hasSelection) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          <Icon name="textTool" size={14} /> {t('story.editor.tapToAdd')}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {TYPE_PRESETS.map((preset) => {
              const active =
                (preset.style.gradient?.from ?? null) === (style.gradient?.from ?? null) &&
                (preset.style.gradient?.to ?? null) === (style.gradient?.to ?? null) &&
                (preset.style.stroke ?? null) === style.stroke &&
                (preset.style.strokeWidth ?? 0) === style.strokeWidth &&
                (preset.style.highlight ?? null) === style.highlight;
              return (
                <ToggleChip
                  key={preset.id}
                  label={preset.label}
                  active={active}
                  onPress={() => change(preset.style)}
                />
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.toolRow}>
          {(['bold', 'italic', 'underline'] as const).map((k) => {
            const active =
              k === 'bold'
                ? style.fontWeight === 'bold'
                : k === 'italic'
                  ? style.fontStyle === 'italic'
                  : style.underline;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={t(`story.editor.${k}`)}
                accessibilityState={{ selected: active }}
                onPress={() =>
                  change(
                    k === 'bold'
                      ? { fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' }
                      : k === 'italic'
                        ? { fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' }
                        : { underline: !style.underline },
                  )
                }
                style={[
                  styles.styleBtn,
                  { borderColor: theme.border },
                  active && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}>
                <ThemedText
                  style={[
                    styles.styleBtnText,
                    { color: active ? theme.textOnPrimary : theme.text },
                    k === 'bold' && { fontWeight: '800' },
                    k === 'italic' && { fontStyle: 'italic' },
                    k === 'underline' && { textDecorationLine: 'underline' },
                  ]}>
                  {k === 'bold' ? 'B' : k === 'italic' ? 'I' : 'U'}
                </ThemedText>
              </Pressable>
            );
          })}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {aligns.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={t(`story.editor.align${a.key[0].toUpperCase()}${a.key.slice(1)}`)}
              accessibilityState={{ selected: style.textAlign === a.key }}
              onPress={() => change({ textAlign: a.key })}
              style={[
                styles.styleBtn,
                { borderColor: theme.border },
                style.textAlign === a.key && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}>
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: style.textAlign === a.key ? theme.textOnPrimary : theme.text,
                }}>
                {a.glyph}
              </ThemedText>
            </Pressable>
          ))}
          <View style={styles.sizeGroup}>
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.sizeLabel}>
              {t('story.editor.fontSize')}
            </ThemedText>
            <ScrubSlider
              value={webSize}
              min={18}
              max={120}
              color={theme.primary}
              ariaLabel={t('story.editor.fontSize')}
              onStart={onCheckpoint}
              onChange={(v) => change({ fontSize: Math.round(v * CANVAS_PER_WEB) }, false)}
            />
          </View>
          <ToggleChip
            label={t('story.editor.advanced')}
            active={advanced}
            onPress={() => setAdvanced((v) => !v)}
          />
        </View>

        <SwatchRow
          colors={COLOR_PRESETS}
          active={gradientOn ? null : style.fill}
          label={t('story.editor.textColor')}
          onPick={(c) => change({ fill: c })}
        />

        {advanced && (
          <View style={styles.advanced}>
            <View style={styles.advField}>
              <ThemedText themeColor="textSecondary" style={styles.advLabel}>
                {t('story.editor.fontFamily')}
              </ThemedText>
              <View style={styles.chipRow}>
                {FONT_OPTIONS.map((f) => (
                  <ToggleChip
                    key={f.key}
                    label={f.label}
                    active={style.fontFamily === f.key}
                    onPress={() => change({ fontFamily: f.key })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.advField}>
              <View style={styles.advHeader}>
                <ToggleChip
                  label={t('story.editor.gradient')}
                  active={gradientOn}
                  onPress={() =>
                    change(
                      gradientOn
                        ? { gradient: null }
                        : { gradient: style.gradient ?? { from: '#FFD600', to: '#FF6F00' } },
                    )
                  }
                />
              </View>
              {gradientOn && style.gradient && (
                <View>
                  <ThemedText themeColor="textSecondary" style={styles.advLabel}>
                    {t('story.editor.gradientFrom')}
                  </ThemedText>
                  <SwatchRow
                    colors={COLOR_PRESETS}
                    active={style.gradient.from}
                    label={t('story.editor.gradientFrom')}
                    onPick={(c) => change({ gradient: { ...style.gradient!, from: c } }, false)}
                  />
                  <ThemedText themeColor="textSecondary" style={styles.advLabel}>
                    {t('story.editor.gradientTo')}
                  </ThemedText>
                  <SwatchRow
                    colors={COLOR_PRESETS}
                    active={style.gradient.to}
                    label={t('story.editor.gradientTo')}
                    onPick={(c) => change({ gradient: { ...style.gradient!, to: c } }, false)}
                  />
                </View>
              )}
            </View>

            <View style={styles.advField}>
              <View style={styles.advHeader}>
                <ToggleChip
                  label={t('story.editor.outline')}
                  active={outlineOn}
                  onPress={() =>
                    change(
                      outlineOn
                        ? { strokeWidth: 0, stroke: null }
                        : { strokeWidth: Math.round(4 * CANVAS_PER_WEB), stroke: style.stroke ?? '#000000' },
                    )
                  }
                />
              </View>
              {outlineOn && (
                <View>
                  <View style={styles.advSliderRow}>
                    <ScrubSlider
                      value={webOutline}
                      min={1}
                      max={16}
                      color={theme.primary}
                      ariaLabel={t('story.editor.outlineWidth')}
                      onStart={onCheckpoint}
                      onChange={(v) => change({ strokeWidth: Math.round(v * CANVAS_PER_WEB) }, false)}
                    />
                  </View>
                  <SwatchRow
                    colors={OUTLINE_COLORS}
                    active={style.stroke}
                    label={t('story.editor.outline')}
                    onPick={(c) => change({ stroke: c }, false)}
                  />
                </View>
              )}
            </View>

            <View style={styles.advField}>
              <View style={styles.advHeader}>
                <ToggleChip
                  label={t('story.editor.highlight')}
                  active={highlightOn}
                  onPress={() => change({ highlight: highlightOn ? null : '#000000' })}
                />
              </View>
              {highlightOn && (
                <SwatchRow
                  colors={HIGHLIGHT_COLORS}
                  active={style.highlight}
                  label={t('story.editor.highlight')}
                  onPick={(c) => change({ highlight: c }, false)}
                />
              )}
            </View>
          </View>
        )}
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
  },
  scroll: {
    maxHeight: 240,
  },
  scrollContent: {
    gap: 8,
    paddingRight: Spacing.sm,
  },
  hint: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  styleBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 2,
  },
  sizeGroup: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sizeLabel: {
    fontSize: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  swatches: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.5)',
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: '#12A5A1',
  },
  advanced: {
    gap: 10,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
  },
  advField: {
    gap: 6,
  },
  advHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  advSliderRow: {
    flexDirection: 'row',
  },
});
