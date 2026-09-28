import { Text, Image, type StyleProp, type TextStyle } from 'react-native';

import { isGiphyUrl, giphyStillUrl, separateGiphyUrls } from '@/api/giphy';
import { isEmojifyiUrl } from '@/api/emojifyi';
import type { EmojiItem } from '@/utils/emojis';

const EMOJI_RE = /(:[a-z0-9+_-]+:)/gi;
const URL_RE = /(https?:\/\/[^\s]+)/gi;

type Segment =
  | { k: 'text'; v: string }
  | { k: 'code'; v: string }
  | { k: 'giphy'; v: string }
  | { k: 'emojifyi'; v: string };

/** Chia nội dung thành text / `:code:` / URL GIPHY / URL emojifyi. */
export function splitContentSegments(content: string): Segment[] {
  const out: Segment[] = [];
  // Nội dung cũ có thể dính nhiều URL GIPHY (`url1url2`) → tách trước khi split.
  for (const part of separateGiphyUrls(content).split(EMOJI_RE)) {
    if (part.startsWith(':') && part.endsWith(':')) {
      out.push({ k: 'code', v: part });
      continue;
    }
    const segs = part.split(URL_RE);
    segs.forEach((seg, i) => {
      if (!seg) return;
      if (i % 2 === 1 && isEmojifyiUrl(seg)) {
        out.push({ k: 'emojifyi', v: seg });
      } else if (i % 2 === 1 && isGiphyUrl(seg)) {
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
  /** Map `:code:` -> emoji. Nếu có, code render thành ảnh inline. */
  emojiMap?: Map<string, EmojiItem>;
  /** Kích thước emoji/GIF inline (px). */
  size?: number;
  numberOfLines?: number;
}

/**
 * Render nội dung có hỗ trợ emoji:
 * - URL emojifyi -> ảnh inline (emoji chèn từ picker)
 * - URL GIPHY cũ -> ảnh inline (nội dung legacy, đổi sang bản still)
 * - `:code:` -> ảnh (nếu có emojiMap) hoặc text thô
 */
export function RichContent({ content, style, emojiMap, size = 18, numberOfLines }: RichContentProps) {
  const segments = splitContentSegments(content);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => {
        if (seg.k === 'emojifyi') {
          return (
            <Image
              key={i}
              source={{ uri: seg.v }}
              style={{ width: size, height: size }}
              resizeMode="contain"
            />
          );
        }
        if (seg.k === 'giphy') {
          return (
            <Image
              key={i}
              source={{ uri: giphyStillUrl(seg.v) }}
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
