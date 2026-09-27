import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  decryptChat,
  encryptMessage as e2eEncrypt,
  ensureChatKey,
  wasPartnerChanged,
  dbg,
} from '@/utils/e2ee';

export type ChatE2EStatus =
  | 'unavailable'
  | 'loading'
  | 'legacy'
  | 'partner_changed'
  | 'ready';

export interface ChatE2E {
  status: ChatE2EStatus;
  ready: boolean;
  encrypt: (plain: string) => Promise<string>;
  decrypt: (cipher: string) => Promise<string>;
}

interface UseChatE2EOptions {
  chatId: string | null;
  partnerUserId: string | null;
  myUserId: string;
}

export function useChatE2E({
  chatId,
  partnerUserId,
  myUserId,
}: UseChatE2EOptions): ChatE2E {
  const [status, setStatus] = useState<ChatE2EStatus>('unavailable');
  const chatKeyRef = useRef<string | null>(null);
  const prevChatRef = useRef<string | null>(null);

  // Reset khi đổi chat. KHÔNG gắn cờ prevChat theo chatId cho lượt chạy
  // ensureChatKey ở effect bên dưới: lần đầu partnerUserId có thể còn null
  // (conversation tải async từ listChats) — nếu ghi cờ ngay, partner về sau
  // sẽ bị early-return và ensureChatKey KHÔNG BAO GIỜ chạy (status kẹt
  // 'unavailable', decrypt luôn keyCount=0).
  useEffect(() => {
    if (prevChatRef.current === chatId) return;
    prevChatRef.current = chatId;
    chatKeyRef.current = null;
    setStatus('unavailable');
  }, [chatId]);

  // Chạy ensureChatKey ngay khi ĐỦ id. cancelled chống setState stale theo chat.
  useEffect(() => {
    if (!chatId || !partnerUserId || !myUserId) return;
    let cancelled = false;
    setStatus('loading');

    const run = async () => {
      try {
        const key = await ensureChatKey({ chatId, myUserId, partnerUserId });
        if (cancelled) return;
        if (key) {
          chatKeyRef.current = key;
          dbg('useChatE2E', chatId, 'status=ready');
          setStatus('ready');
        } else if (wasPartnerChanged(chatId)) {
          // Đối phương đổi identity/thiết bị, mình không giữ khóa chuẩn →
          // không thể tự re-key; cảnh báo thay vì âm thầm legacy.
          dbg('useChatE2E', chatId, 'status=partner_changed');
          setStatus('partner_changed');
        } else {
          // Đối phương chưa đăng ký public key → chat fallback legacy.
          dbg('useChatE2E', chatId, 'status=legacy (no key, partner unchanged)');
          setStatus('legacy');
        }
      } catch (err) {
        // Không nuốt im — nếu ensureChatKey throw thì status=legacy + log lỗi
        // để chẩn đoán (network / derive key / store keys...).
        dbg(
          'useChatE2E', chatId, 'ensureChatKey THREW → legacy:',
          err instanceof Error ? err.message : String(err),
        );
        if (!cancelled) setStatus('legacy');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [chatId, partnerUserId, myUserId]);

  const encrypt = useCallback(async (plain: string): Promise<string> => {
    const key = chatKeyRef.current;
    if (!key) throw new Error('e2e not ready');
    return e2eEncrypt(key, plain);
  }, []);

  const decrypt = useCallback(
    async (cipher: string): Promise<string> => {
      if (!chatId) throw new Error('e2e not ready');
      return decryptChat(chatId, cipher);
    },
    [chatId],
  );

  return useMemo(
    () => ({ status, ready: status === 'ready', encrypt, decrypt }),
    [status, encrypt, decrypt],
  );
}
