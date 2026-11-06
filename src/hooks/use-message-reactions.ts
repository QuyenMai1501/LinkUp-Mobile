import { useCallback, useState } from 'react';

import { incrementLocal, type LocalReactionCounts } from '@/utils/reactions';

/**
 * State LOCAL của thả cảm xúc (không gửi backend).
 * Map: messageId → { code emoji → số lần mình đã thả (accumulator) }.
 * Không có key = chưa can thiệp local → UI giữ nguyên dữ liệu server.
 */
export type MyReactionChoices = Record<string, LocalReactionCounts>;

export function useMessageReactions() {
  const [choices, setChoices] = useState<MyReactionChoices>({});

  /**
   * Tap thả: `base` = count hiện tại của emoji này (local[code] ??
   * myServerCount — tính ở call site); util tự +1. Tap trùng → +1,
   * không toggle off.
   */
  const choose = useCallback(
    (messageId: string, code: string, base: number) => {
      setChoices((prev) => ({
        ...prev,
        [messageId]: incrementLocal(prev[messageId], code, base),
      }));
    },
    [],
  );

  /**
   * Gỡ reaction (modal chi tiết): đặt local[code] = 0 (tombstone) — ẩn hẳn,
   * không fallback về data server.
   */
  const remove = useCallback((messageId: string, codes: string[]) => {
    setChoices((prev) => {
      const local = { ...(prev[messageId] ?? {}) };
      for (const code of codes) local[code] = 0;
      return { ...prev, [messageId]: local };
    });
  }, []);

  return { choices, choose, remove };
}
