import type { ChatMessage } from '@/types/chat';
import type { EmojiItem } from '@/types/post';

/**
 * Thả cảm xúc tin nhắn — LOCAL ONLY (không gửi backend).
 * Bộ 6 emoji phổ biến theo chuẩn Zalo; `code` khớp emoji server
 * (`:like:`…) để map sang `emoji_id` thật khi dữ liệu server đã load.
 *
 * Multi-select: mình thả được NHIỀU emoji trên 1 tin, mỗi emoji là
 * accumulator số lần (tap trùng = +1, không toggle off).
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

/** Số emoji mình đã thả LOCAL theo key chuẩn (code) → count accumulator. */
export type LocalReactionCounts = Record<string, number>;

/**
 * Key chuẩn của 1 reaction = server code (vd `:heart:`).
 * Emoji_id đã map được trong byId → lấy code; không → chính emoji_id
 * (local luôn là code nên round-trip ổn định khi map đã load).
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
 * Tap thả: `next = base + 1` (mỗi tap = +1, kể cả emoji đã thả).
 * `base` do call site tính = local[code] ?? myServerCount(...) — nếu mình
 * đã có sẵn trên server thì lần tap đầu seed từ đó, không mất count.
 */
export function incrementLocal(
  local: LocalReactionCounts | undefined,
  code: string,
  base: number,
): LocalReactionCounts {
  return { ...(local ?? {}), [code]: base + 1 };
}

/** Số emoji `code` của MÌNH đang có trên server (entries chưa bị override). */
export function myServerCount(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  code: string,
  byId: Map<string, EmojiItem> | null | undefined,
): number {
  if (!myUserId) return 0;
  let n = 0;
  for (const r of message.reactions ?? []) {
    if (r.user_id === myUserId && keyOf(r.emoji_id, byId) === code) n++;
  }
  return n;
}

/**
 * Code mình đang thả trên tin (highlight nút trong pill):
 * union giữa local accumulator + entries server của mình (chưa tap → giữ).
 */
export function activeChoicesFor(
  message: ChatMessage | undefined,
  myUserId: string | undefined,
  local: LocalReactionCounts | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): string[] {
  const set = new Set<string>(local ? Object.keys(local) : []);
  if (myUserId) {
    for (const r of message?.reactions ?? []) {
      if (r.user_id === myUserId) set.add(keyOf(r.emoji_id, byId));
    }
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
 * Gộp server reactions + local của mình → danh sách render badge.
 * count(X) = số người khác (server) + myCount(X), với
 * myCount = local[X] ?? serverMine(X) (tap mới = server + 1).
 * Sort: count giảm dần → mine thắng tie-break.
 */
export function mergeReactions(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  local: LocalReactionCounts | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): MergedReaction[] {
  const source = message.reactions ?? [];
  const grouped = new Map<string, { char: string; count: number; mine: boolean }>();
  const add = (key: string, char: string | null, count: number, mine: boolean) => {
    if (!char || count <= 0) return;
    const g = grouped.get(key);
    if (g) {
      g.count += count;
      if (mine) g.mine = true;
    } else {
      grouped.set(key, { char, count, mine });
    }
  };

  // 1) Người khác: từng entry server.
  const myServer = new Map<string, number>();
  for (const r of source) {
    const key = keyOf(r.emoji_id, byId);
    if (r.user_id === myUserId) {
      myServer.set(key, (myServer.get(key) ?? 0) + 1);
      continue;
    }
    add(key, charOf(r.emoji_id, byId), 1, false);
  }

  // 2) Mình: mọi key từng thả (local ∪ server mine) — local thắng server.
  const mineKeys = new Set<string>([
    ...(local ? Object.keys(local) : []),
    ...myServer.keys(),
  ]);
  for (const key of mineKeys) {
    const mineCount =
      local && key in local ? local[key] : (myServer.get(key) ?? 0);
    add(key, charOf(key, byId), mineCount, true);
  }

  return [...grouped.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.count - a.count || Number(b.mine) - Number(a.mine));
}

export interface ReactionSummaryGroup {
  key: string;
  char: string;
  count: number;
  /** user_id duy nhất đã thả emoji này (kể cả mình). */
  user_ids: string[];
}

/**
 * Chi tiết cảm xúc cho modal: nhóm theo emoji → count + danh sách người thả.
 * count tính giống `mergeReactions`; user_ids = entries server + mình (nếu
 * local/serverMine > 0) — resolve tên/avatar ở call site.
 */
export function summarizeReactions(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  local: LocalReactionCounts | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): ReactionSummaryGroup[] {
  const source = message.reactions ?? [];
  const groups = new Map<
    string,
    { char: string; count: number; users: Set<string> }
  >();
  const ensure = (key: string, char: string | null) => {
    if (!char) return null;
    let g = groups.get(key);
    if (!g) {
      g = { char, count: 0, users: new Set() };
      groups.set(key, g);
    }
    return g;
  };

  const myServer = new Map<string, number>();
  for (const r of source) {
    const key = keyOf(r.emoji_id, byId);
    const g = ensure(key, charOf(r.emoji_id, byId));
    if (!g) continue;
    g.count += 1;
    g.users.add(r.user_id);
    if (r.user_id === myUserId) myServer.set(key, (myServer.get(key) ?? 0) + 1);
  }

  const mineKeys = new Set<string>([
    ...(local ? Object.keys(local) : []),
    ...myServer.keys(),
  ]);
  for (const key of mineKeys) {
    const mineCount =
      local && key in local ? local[key] : (myServer.get(key) ?? 0);
    if (mineCount <= 0) continue;
    const g = ensure(key, charOf(key, byId));
    if (!g || !myUserId) continue;
    // Server đã có entry của mình → count cộng phần thiếu (local thắng),
    // chưa echo → cộng đủ local.
    g.count += mineCount - (myServer.get(key) ?? 0);
    g.users.add(myUserId);
  }

  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      char: g.char,
      count: g.count,
      user_ids: [...g.users],
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count || Number(b.user_ids.includes(myUserId ?? '')) - Number(a.user_ids.includes(myUserId ?? '')));
}
