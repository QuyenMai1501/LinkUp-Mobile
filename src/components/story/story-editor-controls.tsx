import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface ScrubSliderProps {
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
  onStart: () => void;
  ariaLabel: string;
}

export function ScrubSlider({ value, min, max, color, onChange, onStart, ariaLabel }: ScrubSliderProps) {
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

export function SwatchRow({ colors, active, onPick, label }: SwatchRowProps) {
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
  disabled?: boolean;
}

export function ToggleChip({ label, active, onPress, disabled }: ToggleChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.border, backgroundColor: active ? theme.primary : 'transparent' },
        disabled && styles.chipDisabled,
      ]}>
      <ThemedText
        style={[styles.chipText, { color: active ? theme.textOnPrimary : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
