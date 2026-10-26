import { Image as RNImage, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTranslation } from '@/hooks/useTranslation';

export interface StoryTransform {
  scale: number;
  tx: number;
  ty: number;
}

export const IDENTITY_TRANSFORM: StoryTransform = { scale: 1, tx: 0, ty: 0 };

interface StoryEditFrameProps {
  uri: string;
  transform: StoryTransform;
  onCommit: (t: StoryTransform) => void;
  index: number;
  total: number;
  width: number;
  height: number;
}

export function StoryEditFrame({
  uri,
  transform,
  onCommit,
  index,
  total,
  width,
  height,
}: StoryEditFrameProps) {
  const { t } = useTranslation();

  const scale = useSharedValue(transform.scale);
  const tx = useSharedValue(transform.tx);
  const ty = useSharedValue(transform.ty);
  const startScale = useSharedValue(transform.scale);
  const startTx = useSharedValue(transform.tx);
  const startTy = useSharedValue(transform.ty);

  const saveState = () => onCommit({ scale: scale.value, tx: tx.value, ty: ty.value });

  const reset = () => {
    scale.value = withTiming(1, undefined, (finished) => {
      if (finished) runOnJS(saveState)();
    });
    tx.value = withTiming(0, undefined, () => {});
    ty.value = withTiming(0, undefined, () => {});
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(saveState)();
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(6, Math.max(0.5, startScale.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(saveState)();
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={[styles.frame, { width, height }]}>
      <RNImage source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <BlurView
        intensity={70}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <GestureDetector gesture={composed}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Image source={{ uri }} style={styles.front} contentFit="cover" />
        </Animated.View>
      </GestureDetector>

      <View style={styles.counter}>
        <ThemedText style={styles.counterText}>
          {index + 1}/{total}
        </ThemedText>
      </View>

      <Pressable
        style={styles.resetBtn}
        hitSlop={8}
        onPress={reset}
        accessibilityRole="button"
        accessibilityLabel={t('story.editor.resetPosition')}>
        <Icon name="refresh" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  front: {
    flex: 1,
  },
  counter: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
