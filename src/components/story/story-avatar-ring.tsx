import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';

/** Ring gradient thương hiệu (Instagram-like) — không phải theme token. */
export const STORY_RING_COLORS = ['#F9CE34', '#EE2A7B', '#6228D7'] as const;
export const STORY_RING_VIEWED_COLORS = ['#4A4A4A', '#6B6B6B'] as const;

const RING_PADDING = 3;
const RING_GAP = 2;

interface StoryAvatarRingProps {
  src?: string;
  name: string;
  hasStory: boolean;
  hasViewed?: boolean;
  size?: number;
  onPress?: () => void;
  /** Nội dung tuỳ biến thay cho ảnh đại diện mặc định (vd: badge camera). */
  children?: React.ReactNode;
}

/**
 * Avatar bọc ring gradient khi có story (chưa xem) / ring xám (đã xem),
 * không ring khi chưa có story. Dùng chung cho StoryBar và ProfileHeader.
 */
export function StoryAvatarRing({
  src,
  name,
  hasStory,
  hasViewed = false,
  size = 64,
  onPress,
  children,
}: StoryAvatarRingProps) {
  const innerSize = hasStory ? size - (RING_PADDING + RING_GAP) * 2 : size;

  const avatar =
    children ?? (
      src?.trim() ? (
        <Image source={{ uri: src }} style={styles.img} contentFit="cover" />
      ) : (
        <View style={[styles.img, styles.fallback]}>
          <ThemedText style={[styles.fallbackText, { fontSize: innerSize * 0.4 }]}>
            {name?.charAt(0)?.toUpperCase() || '?'}
          </ThemedText>
        </View>
      )
    );

  const inner = (
    <View style={[styles.inner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
      {avatar}
    </View>
  );

  if (!hasStory) {
    return (
      <Pressable style={{ width: size, height: size }} onPress={onPress}>
        {inner}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={hasViewed ? [...STORY_RING_VIEWED_COLORS] : [...STORY_RING_COLORS]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, padding: RING_PADDING },
        ]}>
        <View
          style={[
            styles.ringGap,
            {
              width: size - RING_PADDING * 2,
              height: size - RING_PADDING * 2,
              borderRadius: (size - RING_PADDING * 2) / 2,
              padding: RING_GAP,
            },
          ]}>
          {inner}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  inner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E8E93',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
