import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  decryptChat,
  encryptMessage as e2eEncrypt,
  ensureChatKey,
} from '@/utils/e2ee';

export type ChatE2EStatus = 'unavailable' | 'loading' | 'legacy' | 'ready';

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

  useEffect(() => {
    if (prevChatRef.current === chatId) return;
    prevChatRef.current = chatId;
    chatKeyRef.current = null;
    if (!chatId || !partnerUserId || !myUserId) {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    const run = async () => {
      try {
        const key = await ensureChatKey({ chatId, myUserId, partnerUserId });
        if (key) {
          chatKeyRef.current = key;
          if (!cancelled) setStatus('ready');
        } else {
          if (!cancelled) setStatus('legacy');
        }
      } catch {
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
