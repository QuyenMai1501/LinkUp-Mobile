import { StyleSheet, Text } from 'react-native';

import type { EmojiItem } from '@/utils/emojis';

interface EmojiImageProps {
  emoji: EmojiItem;
  size?: number;
}

/** Render emoji native bằng ký tự unicode — không CDN ảnh. */
export function EmojiImage({ emoji, size = 24 }: EmojiImageProps) {
  return (
    <Text style={[styles.char, { fontSize: size, lineHeight: Math.round(size * 1.25) }]}>
      {emoji.emoji}
    </Text>
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
  char: {
    textAlign: 'center',
  },
});
