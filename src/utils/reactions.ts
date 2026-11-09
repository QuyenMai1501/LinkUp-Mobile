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
 * union local accumulator (>0) + entries server chưa bị local quyết định.
 * local[code] = 0 = đã gỡ → không highlight, không fallback về server.
 */
export function activeChoicesFor(
  message: ChatMessage | undefined,
  myUserId: string | undefined,
  local: LocalReactionCounts | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): string[] {
  const set = new Set<string>();
  if (myUserId) {
    for (const r of message?.reactions ?? []) {
      if (r.user_id !== myUserId) continue;
      const k = keyOf(r.emoji_id, byId);
      if (local && k in local) continue; // local đã quyết định (kể cả gỡ = 0)
      set.add(k);
    }
  }
  if (local) {
    for (const [k, v] of Object.entries(local)) {
      if (v > 0) set.add(k);
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

  // 1) Người khác — entry của mình tách riêng để local thắng (gỡ = ẩn).
  const myServer = new Map<string, number>();
  for (const r of source) {
    const key = keyOf(r.emoji_id, byId);
    if (r.user_id === myUserId) {
      myServer.set(key, (myServer.get(key) ?? 0) + 1);
      continue;
    }
    const g = ensure(key, charOf(r.emoji_id, byId));
    if (!g) continue;
    g.count += 1;
    g.users.add(r.user_id);
  }

  // 2) Mình: local[code] thắng serverMine; 0 = đã gỡ → bỏ qua.
  const mineKeys = new Set<string>([
    ...(local ? Object.keys(local) : []),
    ...myServer.keys(),
  ]);
  for (const key of mineKeys) {
    const mineCount =
      local && key in local ? local[key] : (myServer.get(key) ?? 0);
    if (mineCount <= 0 || !myUserId) continue;
    const g = ensure(key, charOf(key, byId));
    if (!g) continue;
    g.count += mineCount;
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
 * reaction đã thả (kể cả mình từ local); gỡ local = bỏ hẳn (không fallback).
 * Sort: dòng của mình lên đầu → total giảm dần.
 */
export function summarizeByUser(
  message: Pick<ChatMessage, 'reactions'>,
  myUserId: string | undefined,
  local: LocalReactionCounts | undefined,
  byId: Map<string, EmojiItem> | null | undefined,
): ReactionUserRow[] {
  const source = message.reactions ?? [];
  const byUser = new Map<string, Map<string, ReactionUserItem>>();
  const ensureItem = (
    userId: string,
    key: string,
    char: string,
    count: number,
  ) => {
    let items = byUser.get(userId);
    if (!items) {
      items = new Map();
      byUser.set(userId, items);
    }
    const existing = items.get(key);
    if (existing) existing.count += count;
    else items.set(key, { key, char, count });
  };

  // 1) Người khác.
  const myServer = new Map<string, number>();
  for (const r of source) {
    const key = keyOf(r.emoji_id, byId);
    if (r.user_id === myUserId) {
      myServer.set(key, (myServer.get(key) ?? 0) + 1);
      continue;
    }
    const char = charOf(r.emoji_id, byId);
    if (!char) continue;
    ensureItem(r.user_id, key, char, 1);
  }

  // 2) Mình: local thắng (0 = đã gỡ → bỏ).
  if (myUserId) {
    const mineKeys = new Set<string>([
      ...(local ? Object.keys(local) : []),
      ...myServer.keys(),
    ]);
    for (const key of mineKeys) {
      const mineCount =
        local && key in local ? local[key] : (myServer.get(key) ?? 0);
      if (mineCount <= 0) continue;
      const char = charOf(key, byId);
      if (!char) continue;
      ensureItem(myUserId, key, char, mineCount);
    }
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
