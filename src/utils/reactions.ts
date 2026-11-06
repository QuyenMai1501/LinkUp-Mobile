import type { ChatMessage } from '@/types/chat';
import type { EmojiItem } from '@/types/post';

/**
 * Thả cảm xúc tin nhắn — LOCAL ONLY (không gửi backend).
 * Bộ 6 emoji phổ biến theo chuẩn Zalo; `code` khớp emoji server
 * (`:like:`…) để map sang `emoji_id` thật khi dữ liệu server đã load.
 */
export interface ReactionEmojiDef {
  code: string;
  char: string;
}

export const REACTION_EMOJIS: ReactionEmojiDef[] = [
  { code: ':like:', char: '👍' },
  { code: ':heart:', char: '❤️' },
  { code: ':haha:', char: '😂' },
  { code: ':wow:', char: '😮' },
  { code: ':sad:', char: '😢' },
  { code: ':angry:', char: '😡' },
];

/** Tọa độ bubble trong window (measureInWindow) — neo pill reaction. */
export interface ReactionAnchor {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Key chuẩn của 1 reaction = server code (vd `:heart:`).
 * Emoji_id đã map được trong byId → lấy code; không → chính emoji_id
 * (choice local luôn là code nên round-trip ổn định).
 */
export function keyOf(
  emojiId: string,
  byId: Map<string, EmojiItem> | null | undefined,
): string {
  return byId?.get(emojiId)?.code ?? emojiId;
}

/** Key (code) → emoji_id để ghi vào list local (fallback: code). */
export function idOf(
  code: string,
  byCode: Map<string, EmojiItem> | null | undefined,
): string {
  return byCode?.get(code)?.id ?? code;
}

/** Hiển thị ký tự emoji: server item → character; không → bộ 6; còn không → null. */
export function charOf(
  emojiId: string,
  byId: Map<string, EmojiItem> | null | undefined,
): string | null {
  const item = byId?.get(emojiId);
  if (item?.character) return item.character;
  const code = item?.code ?? emojiId;
  return REACTION_EMOJIS.find((e) => e.code === code)?.char ?? null;
}

/**
 * Logic thả / hủy / đổi — mỗi user tối đa 1 emoji/tin.
 * - current === picked → null   (hủy thả)
 * - còn lại           → picked (thả mới / đổi emoji)
 * current: undefined = chưa can thiệp local (dữ liệu server giữ nguyên).
 */
export function nextChoice(
  current: string | null | undefined,
  picked: string,
): string | null {
  if (current === picked) return null;
  return picked;
}

export interface MergedReaction {
  /** Key chuẩn (code) — dùng để toggle tiếp. */
  key: string;
  char: string;
  count: number;
  mine: boolean;
}

/**
 * Gộp server reactions + override local của chính mình → danh sách render badge.
 * Override dạng patch (choice): undefined = giữ entry server của mình,
 * null = mình đã hủy, string = mình chọn emoji đó.
 */
export function mergeReactions(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  choice: string | null | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): MergedReaction[] {
  const source = message.reactions ?? [];
  const rows: { key: string; char: string; mine: boolean }[] = [];
  const push = (emojiId: string, mine: boolean) => {
    const char = charOf(emojiId, byId);
    if (!char) return; // emoji chưa load được → bỏ qua (giống chip cũ)
    rows.push({ key: keyOf(emojiId, byId), char, mine });
  };
  for (const r of source) {
    if (r.user_id === myUserId) continue;
    push(r.emoji_id, false);
  }
  if (choice === undefined) {
    for (const r of source) {
      if (r.user_id === myUserId) push(r.emoji_id, true);
    }
  } else if (choice !== null && myUserId) {
    push(choice, true); // choice là code → charOf map qua bộ 6
  }

  const grouped = new Map<string, MergedReaction>();
  for (const row of rows) {
    const existing = grouped.get(row.key);
    if (existing) {
      existing.count += 1;
      if (row.mine) existing.mine = true;
    } else {
      grouped.set(row.key, { key: row.key, char: row.char, count: 1, mine: row.mine });
    }
  }
  return [...grouped.values()].sort((a, b) => Number(b.mine) - Number(a.mine));
}

/**
 * Code emoji mình đang thả trên tin (highlight trong pill):
 * override local thắng; chưa override → lấy entry server của mình.
 */
export function activeChoiceFor(
  message: ChatMessage | undefined,
  myUserId: string | undefined,
  choice: string | null | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): string | null {
  if (choice !== undefined) return choice;
  const mine = message?.reactions?.find((r) => r.user_id === myUserId);
  return mine ? keyOf(mine.emoji_id, byId) : null;
}
