import { useCallback, useState } from 'react';

import { nextChoice } from '@/utils/reactions';

/**
 * State LOCAL của thả cảm xúc (không gửi backend).
 * Map: messageId → code emoji mình chọn (`null` = mình đã hủy thả).
 * Không có key = chưa can thiệp local → UI giữ nguyên dữ liệu server.
 */
export type MyReactionChoices = Record<string, string | null>;

export function useMessageReactions() {
  const [choices, setChoices] = useState<MyReactionChoices>({});

  /** Toggle: thả mới / đổi emoji / hủy thả (xem `nextChoice`). */
  const choose = useCallback((messageId: string, pickedCode: string) => {
    setChoices((prev) => ({
      ...prev,
      [messageId]: nextChoice(prev[messageId], pickedCode),
    }));
  }, []);

  return { choices, choose };
}
