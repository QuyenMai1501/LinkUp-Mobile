import { Text, Image, type StyleProp, type TextStyle } from 'react-native';

import { isGiphyUrl, giphyStillUrl, separateGiphyUrls } from '@/api/giphy';
import { isEmojifyiUrl } from '@/api/emojifyi';
import { useTheme } from '@/hooks/use-theme';
import type { EmojiItem } from '@/utils/emojis';

const EMOJI_RE = /(:[a-z0-9+_-]+:)/gi;
const URL_RE = /(https?:\/\/[^\s]+)/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/giu;

type Segment =
  | { k: 'text'; v: string }
  | { k: 'code'; v: string }
  | { k: 'giphy'; v: string }
  | { k: 'emojifyi'; v: string };

/** Chia text thành đoạn thường + hashtag (mirror web POST_TOKEN_RE; tránh lookbehind để an toàn Hermes). */
function splitTextWithHashtags(text: string): { t: string; tag?: string }[] {
  const out: { t: string; tag?: string }[] = [];
  let last = 0;
  HASHTAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HASHTAG_RE.exec(text)) !== null) {
    const start = m.index;
    const prev = start > 0 ? text[start - 1] : '';
    // `a#b` / `email#x` không phải hashtag — chỉ nhận # sau khoảng trắng hoặc đầu chuỗi
    if (prev && /[\p{L}\p{N}]/u.test(prev)) continue;
    if (start > last) out.push({ t: text.slice(last, start) });
    out.push({ t: m[0], tag: m[0].slice(1) });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

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
  /** Bấm `#hashtag` (vd. mở search). Không truyền → hashtag render text thường. */
  onHashtagPress?: (tag: string) => void;
  hashtagStyle?: StyleProp<TextStyle>;
}

/**
 * Render nội dung có hỗ trợ emoji:
 * - URL emojifyi -> ảnh inline (emoji chèn từ picker)
 * - URL GIPHY cũ -> ảnh inline (nội dung legacy, đổi sang bản still)
 * - `:code:` -> ảnh (nếu có emojiMap) hoặc text thô
 * - `#hashtag` -> pressable (nếu có onHashtagPress)
 */
export function RichContent({ content, style, emojiMap, size = 18, numberOfLines, onHashtagPress, hashtagStyle }: RichContentProps) {
  const theme = useTheme();
  const segments = splitContentSegments(content);

  return (
    // Color mặc định theo theme (RN Text đen mặc định → chìm trong dark mode);
    // style caller xếp sau nên color truyền từ call site vẫn thắng.
    <Text style={[{ color: theme.text }, style]} numberOfLines={numberOfLines}>
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
              <Text key={i} style={{ fontSize: size, lineHeight: Math.round(size * 1.3) }}>
                {emoji.emoji}
              </Text>
            );
          }
        }
        if (seg.k === 'text' && onHashtagPress) {
          return splitTextWithHashtags(seg.v).map((part, j) =>
            part.tag ? (
              <Text
                key={`${i}-${j}`}
                onPress={() => onHashtagPress(part.tag!)}
                style={hashtagStyle}>
                {part.t}
              </Text>
            ) : (
              part.t
            ),
          );
        }
        return seg.v;
      })}
    </Text>
  );
}
