import { useEffect, useState } from 'react';

import { getEmojis } from '@/api/posts';
import type { EmojiItem } from '@/types/post';

// Emoji server (GET /emojis) — cache ở mức module: chỉ fetch 1 lần / phiên,
// dùng chung cho quick-react, render reaction chip, sticker bubble.
let cachedById: Map<string, EmojiItem> | null = null;
let cachedByCode: Map<string, EmojiItem> | null = null;
let inflight: Promise<void> | null = null;

function load(): Promise<void> {
  if (inflight) return inflight;
  inflight = getEmojis()
    .then((res) => {
      const byId = new Map<string, EmojiItem>();
      const byCode = new Map<string, EmojiItem>();
      for (const item of res.data ?? []) {
        byId.set(item.id, item);
        if (!byCode.has(item.code)) byCode.set(item.code, item);
      }
      cachedById = byId;
      cachedByCode = byCode;
    })
    .catch((err) => {
      inflight = null; // cho phép retry ở lần mount kế
      throw err;
    });
  return inflight;
}

export interface ServerEmojis {
  byId: Map<string, EmojiItem> | null;
  byCode: Map<string, EmojiItem> | null;
}

export function useServerEmojis(): ServerEmojis {
  const [state, setState] = useState<ServerEmojis>({
    byId: cachedById,
    byCode: cachedByCode,
  });

  useEffect(() => {
    if (cachedById && cachedByCode) return;
    let mounted = true;
    load()
      .then(() => {
        if (mounted) setState({ byId: cachedById, byCode: cachedByCode });
      })
      .catch(() => {
        /* silent — retry ở lần mount sau */
      });
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

// Quick-react codes — trùng Web MessageToolbar. Chỉ nhận emoji server THẬT
// (id không bắt đầu bằng 'emotion-' — emotion- là emoji fallback nội bộ).
export const QUICK_REACT_CODES = [
  ':like:',
  ':heart:',
  ':haha:',
  ':wow:',
  ':sad:',
  ':angry:',
  ':clap:',
  ':fire:',
];

/** Danh sách emoji quick-react (id server thật) — [] khi chưa load xong. */
export function quickReactEmojis(byCode: Map<string, EmojiItem> | null): EmojiItem[] {
  if (!byCode) return [];
  const out: EmojiItem[] = [];
  for (const code of QUICK_REACT_CODES) {
    const item = byCode.get(code);
    if (item && !item.id.startsWith('emotion-')) out.push(item);
  }
  return out;
}
