import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import type { EmojiItem } from '@/utils/emojis';

interface EmojiImageProps {
  emoji: EmojiItem;
  size?: number;
}

export function EmojiImage({ emoji, size = 24 }: EmojiImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Text style={[styles.fallback, { fontSize: size }]}>{emoji.emoji}</Text>;
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: emoji.image_uri }}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={200}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const EMOJI_RE = /(:[a-z0-9+_-]+:)/gi;

export function renderEmojiContent(
  content: string,
  emojiMap: Map<string, EmojiItem>,
  keyPrefix: string,
): (string | { type: 'emoji'; emoji: EmojiItem; key: string })[] {
  const parts = content.split(EMOJI_RE);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith(':') && part.endsWith(':')) {
      const emoji = emojiMap.get(part);
      if (emoji) return { type: 'emoji' as const, emoji, key };
    }
    return part;
  });
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fallback: {
    lineHeight: 20,
  },
});
