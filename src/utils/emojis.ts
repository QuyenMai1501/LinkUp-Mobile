export type EmojiGroup = 'positive' | 'neutral' | 'negative';

export interface EmojiItem {
  id: string;
  code: string;
  emoji: string;
  label: string;
  group: EmojiGroup;
  image_uri: string;
}

export const EMOTION_GROUPS: EmojiGroup[] = ['positive', 'neutral', 'negative'];

const EMOTION_EMOJIS: { code: string; emoji: string; label: string; group: EmojiGroup }[] = [
  { code: ':smile:', emoji: '\u{1F604}', label: 'Smile', group: 'positive' },
  { code: ':laugh:', emoji: '\u{1F602}', label: 'Laugh', group: 'positive' },
  { code: ':love:', emoji: '\u{1F60D}', label: 'Love', group: 'positive' },
  { code: ':fire:', emoji: '\u{1F525}', label: 'Fire', group: 'positive' },
  { code: ':thumbsup:', emoji: '\u{1F44D}', label: 'Thumbs Up', group: 'positive' },
  { code: ':clap:', emoji: '\u{1F44F}', label: 'Clap', group: 'positive' },
  { code: ':heart:', emoji: '\u{2764}\u{FE0F}', label: 'Heart', group: 'positive' },
  { code: ':star:', emoji: '\u{2B50}', label: 'Star', group: 'positive' },
  { code: ':pray:', emoji: '\u{1F64F}', label: 'Pray', group: 'positive' },
  { code: ':hug:', emoji: '\u{1F917}', label: 'Hug', group: 'positive' },
  { code: ':wink:', emoji: '\u{1F609}', label: 'Wink', group: 'positive' },
  { code: ':cool:', emoji: '\u{1F60E}', label: 'Cool', group: 'positive' },

  { code: ':neutral:', emoji: '\u{1F610}', label: 'Neutral', group: 'neutral' },
  { code: ':thinking:', emoji: '\u{1F914}', label: 'Thinking', group: 'neutral' },
  { code: ':wave:', emoji: '\u{1F44B}', label: 'Wave', group: 'neutral' },
  { code: ':ok:', emoji: '\u{1F44C}', label: 'OK', group: 'neutral' },
  { code: ':peace:', emoji: '\u{270C}\u{FE0F}', label: 'Peace', group: 'neutral' },
  { code: ':raised:', emoji: '\u{261D}\u{FE0F}', label: 'Raised', group: 'neutral' },
  { code: ':shrug:', emoji: '\u{1F937}', label: 'Shrug', group: 'neutral' },
  { code: ':eyeroll:', emoji: '\u{1F644}', label: 'Eye Roll', group: 'neutral' },
  { code: ':sleepy:', emoji: '\u{1F634}', label: 'Sleepy', group: 'neutral' },

  { code: ':sad:', emoji: '\u{1F622}', label: 'Sad', group: 'negative' },
  { code: ':cry:', emoji: '\u{1F62D}', label: 'Cry', group: 'negative' },
  { code: ':angry:', emoji: '\u{1F621}', label: 'Angry', group: 'negative' },
  { code: ':rage:', emoji: '\u{1F624}', label: 'Rage', group: 'negative' },
  { code: ':disappointed:', emoji: '\u{1F61E}', label: 'Disappointed', group: 'negative' },
  { code: ':worried:', emoji: '\u{1F61F}', label: 'Worried', group: 'negative' },
  { code: ':scared:', emoji: '\u{1F628}', label: 'Scared', group: 'negative' },
];

function codepointFromEmoji(emoji: string): string {
  const codepoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) {
      codepoints.push(cp.toString(16));
    }
  }
  return codepoints.join('-');
}

function twemojiUrl(emoji: string): string {
  const codepoint = codepointFromEmoji(emoji);
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${codepoint}.png`;
}

let cachedEmojis: EmojiItem[] | null = null;

export function getEmotionEmojis(): EmojiItem[] {
  if (cachedEmojis) return cachedEmojis;
  cachedEmojis = EMOTION_EMOJIS.map((e) => ({
    id: e.code,
    code: e.code,
    emoji: e.emoji,
    label: e.label,
    group: e.group,
    image_uri: twemojiUrl(e.emoji),
  }));
  return cachedEmojis;
}

export function emojiByCode(items: EmojiItem[]): Map<string, EmojiItem> {
  const map = new Map<string, EmojiItem>();
  for (const item of items) {
    map.set(item.code, item);
  }
  return map;
}

export function singleEmojiCode(content: string, map: Map<string, EmojiItem>): string | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith(':') || !trimmed.endsWith(':')) return null;
  if (trimmed.includes(' ') || trimmed.includes('\n')) return null;
  return map.has(trimmed) ? trimmed : null;
}

export function getEmojiTextMap(): Map<string, EmojiItem> {
  return emojiByCode(getEmotionEmojis());
}
