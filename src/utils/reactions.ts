import type { ChatMessage } from '@/types/chat';
import type { EmojiItem } from '@/types/post';

/**
 * Thả cảm xúc tin nhắn — dữ liệu lấy từ server (WS `message:reacted` /
 * `group:message:reacted`). User được thả NHIỀU emoji khác nhau trên cùng một
 * tin; bấm lại đúng emoji đó = gỡ. Mọi hàm dưới đây chỉ đọc `message.reactions`.
 *
 * Bộ 6 emoji phổ biến theo chuẩn Zalo; `code` khớp emoji server
 * (`:like:`…) để map sang `emoji_id` thật khi gửi WS.
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
 * Emoji_id đã map được trong byId → lấy code; không → chính emoji_id.
 */
export function keyOf(
  emojiId: string,
  byId: Map<string, EmojiItem> | null | undefined,
): string {
  return byId?.get(emojiId)?.code ?? emojiId;
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
 * Code mình đang thả trên tin (highlight nút trong pill) — lấy từ server.
 */
export function activeChoicesFor(
  message: ChatMessage | undefined,
  myUserId: string | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): string[] {
  const set = new Set<string>();
  if (!myUserId) return [];
  for (const r of message?.reactions ?? []) {
    if (r.user_id !== myUserId) continue;
    set.add(keyOf(r.emoji_id, byId));
  }
  return [...set];
}

export interface MergedReaction {
  /** Key chuẩn (code) — dùng để map tiếp. */
  key: string;
  char: string;
  count: number;
  mine: boolean;
}

/**
 * Gộp server reactions → danh sách render badge.
 * count(X) = số người đã thả emoji X (mỗi user tối đa +1 cho mỗi emoji).
 * Sort: count giảm dần → mine thắng tie-break.
 */
export function mergeReactions(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): MergedReaction[] {
  const grouped = new Map<
    string,
    { char: string; count: number; mine: boolean }
  >();
  for (const r of message.reactions ?? []) {
    const key = keyOf(r.emoji_id, byId);
    const char = charOf(r.emoji_id, byId);
    if (!char) continue;
    const mine = !!myUserId && r.user_id === myUserId;
    const g = grouped.get(key);
    if (g) {
      g.count += 1;
      if (mine) g.mine = true;
    } else {
      grouped.set(key, { char, count: 1, mine });
    }
  }

  return [...grouped.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.count - a.count || Number(b.mine) - Number(a.mine));
}

export interface ReactionSummaryGroup {
  key: string;
  char: string;
  count: number;
  /** user_id duy nhất đã thả emoji này. */
  user_ids: string[];
}

/**
 * Chi tiết cảm xúc cho modal: nhóm theo emoji → count + danh sách người thả.
 */
export function summarizeReactions(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): ReactionSummaryGroup[] {
  const groups = new Map<
    string,
    { char: string; count: number; users: Set<string> }
  >();
  for (const r of message.reactions ?? []) {
    const key = keyOf(r.emoji_id, byId);
    const char = charOf(r.emoji_id, byId);
    if (!char) continue;
    let g = groups.get(key);
    if (!g) {
      g = { char, count: 0, users: new Set() };
      groups.set(key, g);
    }
    g.count += 1;
    g.users.add(r.user_id);
  }

  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      char: g.char,
      count: g.count,
      user_ids: [...g.users],
    }))
    .filter((g) => g.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(b.user_ids.includes(myUserId ?? '')) -
          Number(a.user_ids.includes(myUserId ?? '')),
    );
}

export interface ReactionUserItem {
  key: string;
  char: string;
  count: number;
}

export interface ReactionUserRow {
  user_id: string;
  /** Tổng số reaction của người này (sort desc). */
  total: number;
  /** Các loại reaction người này đã thả (chi tiết theo emoji). */
  items: ReactionUserItem[];
}

/**
 * Tab "Tất cả" trong modal chi tiết: liệt kê THEO USER — mỗi người các loại
 * reaction đã thả (một user có thể thả nhiều emoji).
 * Sort: dòng của mình lên đầu → total giảm dần.
 */
export function summarizeByUser(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): ReactionUserRow[] {
  const byUser = new Map<string, Map<string, ReactionUserItem>>();
  for (const r of message.reactions ?? []) {
    const key = keyOf(r.emoji_id, byId);
    const char = charOf(r.emoji_id, byId);
    if (!char) continue;
    let items = byUser.get(r.user_id);
    if (!items) {
      items = new Map();
      byUser.set(r.user_id, items);
    }
    const existing = items.get(key);
    if (existing) existing.count += 1;
    else items.set(key, { key, char, count: 1 });
  }

  const rows: ReactionUserRow[] = [...byUser.entries()].map(
    ([user_id, items]) => {
      const list = [...items.values()];
      return {
        user_id,
        total: list.reduce((sum, i) => sum + i.count, 0),
        items: list,
      };
    },
  );
  rows.sort((a, b) => {
    const mineA = a.user_id === myUserId ? 1 : 0;
    const mineB = b.user_id === myUserId ? 1 : 0;
    if (mineA !== mineB) return mineB - mineA;
    return b.total - a.total;
  });
  return rows;
}
