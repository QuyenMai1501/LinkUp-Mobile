import { Text, Image, type StyleProp, type TextStyle } from 'react-native';

import { isGiphyUrl } from '@/api/giphy';
import type { EmojiItem } from '@/utils/emojis';

const EMOJI_RE = /(:[a-z0-9+_-]+:)/gi;
const URL_RE = /(https?:\/\/[^\s]+)/gi;

type Segment =
  | { k: 'text'; v: string }
  | { k: 'code'; v: string }
  | { k: 'giphy'; v: string };

/** Chia nội dung thành text / `:code:` / URL GIPHY. */
export function splitContentSegments(content: string): Segment[] {
  const out: Segment[] = [];
  for (const part of content.split(EMOJI_RE)) {
    if (part.startsWith(':') && part.endsWith(':')) {
      out.push({ k: 'code', v: part });
      continue;
    }
    const segs = part.split(URL_RE);
    segs.forEach((seg, i) => {
      if (!seg) return;
      if (i % 2 === 1 && isGiphyUrl(seg)) {
        out.push({ k: 'giphy', v: seg });
      } else {
        out.push({ k: 'text', v: seg });
      }
    });
  }
  return out;
}

interface RichContentProps {
  content: string;
  style?: StyleProp<TextStyle>;
  /** Map `:code:` -> emoji. Nếu có, code render thành ảnh GIPHY (qua image inline). */
  emojiMap?: Map<string, EmojiItem>;
  /** Kích thước emoji/GIPHY inline (px). */
  size?: number;
  numberOfLines?: number;
}

/**
 * Render nội dung có hỗ trợ emoji GIPHY:
 * - URL GIPHY -> ảnh inline (emoji chèn từ picker)
 * - `:code:` -> ảnh GIPHY (nếu có emojiMap) hoặc text thô
 */
export function RichContent({ content, style, emojiMap, size = 18, numberOfLines }: RichContentProps) {
  const segments = splitContentSegments(content);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => {
        if (seg.k === 'giphy') {
          return (
            <Image
              key={i}
              source={{ uri: seg.v }}
              style={{ width: size, height: size }}
              resizeMode="contain"
            />
          );
        }
        if (seg.k === 'code' && emojiMap) {
          const emoji = emojiMap.get(seg.v);
          if (emoji) {
            return (
              <Image
                key={i}
                source={{ uri: emoji.image_uri }}
                style={{ width: size, height: size }}
                resizeMode="contain"
              />
            );
          }
        }
        return seg.v;
      })}
    </Text>
  );
}
