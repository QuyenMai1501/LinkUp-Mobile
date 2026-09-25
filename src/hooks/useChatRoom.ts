import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, HistoryCursor, PinnedMessage, SendMessageOptions } from '@/types/chat';
import type { ChatSocket } from './useChatSocket';
import type { ChatE2E } from './useChatE2E';

function sortByCreatedAt(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function dedupeByID(list: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const msg of list) {
    if (seen.has(msg.id)) continue;
    seen.add(msg.id);
    out.push(msg);
  }
  return out;
}

// Đánh dấu tin E2E chưa giải mã là "chờ giải mã": UI hiện placeholder
// (decrypt_failed) thay vì lộ ciphertext.
function markPendingDecrypt(list: ChatMessage[]): ChatMessage[] {
  return list.map((msg) => {
    if (msg.e2e_version === 1 && msg.content && !msg.deleted && !msg.decrypted) {
      return { ...msg, decrypt_failed: true };
    }
    return msg;
  });
}

// Thay các tin trong prev bằng phiên bản đã giải mã (theo id), chỉ khi nội
// dung thay đổi để tránh render thừa.
function mergeDecrypted(prev: ChatMessage[], chunk: ChatMessage[]): ChatMessage[] {
  if (chunk.length === 0) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  let changed = false;
  for (const m of chunk) {
    const cur = byId.get(m.id);
    if (!cur) continue;
    if (
      cur.content === m.content &&
      cur.decrypt_failed === m.decrypt_failed &&
      cur.decrypted === m.decrypted
    ) {
      continue;
    }
    byId.set(m.id, m);
    changed = true;
  }
  return changed ? sortByCreatedAt([...byId.values()]) : prev;
}

// Ghép trang tin cũ hơn vào đầu danh sách hiện tại; tin trùng id ưu tiên bản
// mới (vừa tải từ server).
function prependMessages(prev: ChatMessage[], older: ChatMessage[]): ChatMessage[] {
  if (older.length === 0) return prev;
  const byId = new Map(older.map((m) => [m.id, m]));
  for (const m of prev) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return sortByCreatedAt([...byId.values()]);
}

export interface ChatRoom {
  messages: ChatMessage[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  partnerTyping: boolean;
  pinnedMessages: PinnedMessage[];
  sendMessage: (content: string, opts?: SendMessageOptions) => void;
  sendTyping: (isTyping: boolean) => void;
  deleteMessage: (messageId: string, mode: 'all' | 'me') => void;
  pinMessage: (messageId: string) => void;
  unpinMessage: (messageId: string) => void;
  loadMoreMessages: () => void;
  searchMessages: (keyword: string) => void;
  clearSearch: () => void;
  searchResults: ChatMessage[] | null;
  searchKeyword: string;
}

interface UseChatRoomOptions {
  chatId: string | null;
  myUserId: string;
  socket: ChatSocket;
  encryption?: ChatE2E;
  onNewMessage?: () => void;
}

export function useChatRoom({
  chatId,
  myUserId,
  socket,
  encryption,
  onNewMessage,
}: UseChatRoomOptions): ChatRoom {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const cursorRef = useRef<HistoryCursor | null>(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const chatIdRef = useRef<string | null>(null);
  const tempSeqRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeChatIdRef = useRef<string | null>(null);
  const e2eReadyChatRef = useRef<string | null>(null);

  const e2eStatus = encryption?.status ?? 'unavailable';

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const decryptIncoming = useCallback(
    async (list: ChatMessage[]): Promise<ChatMessage[]> => {
      if (!encryption) return list;
      return Promise.all(
        list.map(async (msg) => {
          let updated = msg;
          if (msg.e2e_version === 1 && msg.content && !msg.deleted && !msg.decrypted) {
            try {
              const plain = await encryption.decrypt(msg.content);
              updated = { ...updated, content: plain, decrypted: true, decrypt_failed: false };
            } catch {
              return { ...updated, decrypt_failed: true };
            }
          }
          if (updated.reply_to && updated.reply_to.content && updated.e2e_version === 1) {
            const rt = updated.reply_to;
            try {
              const plain = await encryption.decrypt(rt.content);
              updated = { ...updated, reply_to: { ...rt, content: plain } };
            } catch {
              updated = {
                ...updated,
                reply_to: { id: rt.id, content: '', sender_id: rt.sender_id, sender_name: rt.sender_name, sender_avatar: rt.sender_avatar },
              };
            }
          }
          return updated;
        }),
      );
    },
    [encryption],
  );

  // Effect 1: Subscribe to events + reset state on chatId change.
  useEffect(() => {
    if (!chatId) return;

    // Chỉ reset state khi chatId THỰC SỰ thay đổi (lần đầu hoặc chuyển chat)
    if (chatIdRef.current !== chatId) {
      chatIdRef.current = chatId;
      activeChatIdRef.current = chatId;

      setMessages([]);
      setHasMore(false);
      setLoadingMore(false);
      setPartnerTyping(false);
      setSearchResults(null);
      setSearchKeyword('');
      setPinnedMessages([]);
      cursorRef.current = null;
      hasMoreRef.current = false;
      loadingMoreRef.current = false;
      e2eReadyChatRef.current = null;
      setLoading(true);
    }

    // Luôn (re-) đăng ký sự kiện — kể cả khi chatId không đổi
    // nhưng decryptIncoming hoặc myUserId thay đổi
    const unsubs = [
      socket.subscribe('message:history', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msgs: ChatMessage[] = payload.messages ?? [];
        setHasMore(payload.has_more ?? false);
        hasMoreRef.current = payload.has_more ?? false;
        cursorRef.current = payload.next_cursor ?? null;
        setLoading(false);

        // Render ngay (tin E2E hiện placeholder), rồi giải mã dần từng cụm
        const pending = sortByCreatedAt(dedupeByID(markPendingDecrypt(msgs)));
        setMessages(pending);

        // Giải mã batch 10 tin
        const size = 10;
        const list = [...msgs].reverse();
        const run = async () => {
          for (let i = 0; i < list.length; i += size) {
            const batch = list.slice(i, i + size);
            const decrypted = await decryptIncoming(batch);
            if (activeChatIdRef.current !== chatId) return;
            setMessages((prev) => mergeDecrypted(prev, decrypted));
          }
        };
        void run();
      }),

      socket.subscribe('message:history_more', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msgs: ChatMessage[] = payload.messages ?? [];
        const older = [...msgs].reverse();
        setHasMore(payload.has_more ?? false);
        hasMoreRef.current = payload.has_more ?? false;
        cursorRef.current = payload.next_cursor ?? null;

        void decryptIncoming(older).then((decrypted) => {
          if (activeChatIdRef.current !== chatId) return;
          setMessages((prev) => prependMessages(prev, decrypted));
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
      }),

      socket.subscribe('message:new', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msg = payload as ChatMessage;

        void decryptIncoming([msg]).then(([resolved]) => {
          setMessages((prev) => {
            // Thay thế optimistic temp message nếu có
            const idx = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.sender_id === myUserId &&
                m.content === resolved.content,
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = resolved;
              return sortByCreatedAt(dedupeByID(next));
            }
            return sortByCreatedAt(dedupeByID([...prev, resolved]));
          });
          onNewMessage?.();
        });
      }),

      socket.subscribe('typing', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        if (payload.user_id === myUserId) return;
        setPartnerTyping(payload.is_typing ?? false);
      }),

      socket.subscribe('message:deleted', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.message_id
              ? { ...m, deleted: true, content: '' }
              : m,
          ),
        );
      }),

      socket.subscribe('message:search_result', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msgs: ChatMessage[] = payload.messages ?? [];
        setSearchKeyword(payload.keyword ?? '');
        setSearchResults(msgs);
      }),

      socket.subscribe('message:pinned_list', (payload: any) => {
        setPinnedMessages(payload.pinned_messages ?? []);
      }),

      socket.subscribe('message:pinned', (payload: any) => {
        const pin = payload as PinnedMessage;
        if (!pin || !pin.message_id) return;
        setPinnedMessages((prev) => {
          const exists = prev.some((p) => p.message_id === pin.message_id);
          if (exists) return prev;
          return [pin, ...prev].slice(0, 2);
        });
      }),

      socket.subscribe('message:unpinned', (payload: any) => {
        if (!payload || !payload.message_id) return;
        setPinnedMessages((prev) => prev.filter((p) => p.message_id !== payload.message_id));
      }),
    ];

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- socket.subscribe is stable
  }, [chatId, socket.subscribe, myUserId, onNewMessage, decryptIncoming]);

  // Effect 2: Send chat:join when WebSocket is open.
  useEffect(() => {
    if (!chatId || socket.status !== 'open') return;
    socket.send('chat:join', { chat_id: chatId, limit: 30 });
  }, [chatId, socket.status, socket.send]);

  // Effect 3: Retry decrypt khi E2E chuyển sang ready (giống Web).
  // Giải mã lại các tin còn giữ bản mã hóa (đang hiển thị placeholder).
  useEffect(() => {
    if (!encryption || e2eStatus !== 'ready') return;
    const currentChatId = activeChatIdRef.current;
    if (e2eReadyChatRef.current === currentChatId) return;
    e2eReadyChatRef.current = currentChatId;
    void decryptIncoming(messagesRef.current).then((decrypted) => {
      if (activeChatIdRef.current !== currentChatId) return;
      setMessages((prev) => mergeDecrypted(prev, decrypted));
    });
  }, [e2eStatus, encryption, decryptIncoming]);

  const sendMessage = useCallback(
    (content: string, opts?: SendMessageOptions) => {
      if (!chatId || (!content.trim() && !opts?.mediaId && !opts?.emojiId && !opts?.gifUrl)) return;
      tempSeqRef.current += 1;
      const tempId = `temp-${tempSeqRef.current}`;
      const optimistic: ChatMessage = {
        id: tempId,
        chat_id: chatId,
        sender_id: myUserId,
        content,
        media_id: opts?.mediaId ?? null,
        media_uri: opts?.gifUrl ?? opts?.mediaUri ?? null,
        media_type: opts?.gifUrl ? 'image/gif' : opts?.mediaType ?? null,
        is_anonymized: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      // Chỉ gửi e2e_version khi content thực sự được encrypt
      if (opts?.e2eEncrypted) {
        socket.send('message:send', {
          chat_id: chatId,
          content,
          e2e_version: 1,
          emoji_id: opts?.emojiId,
          media_id: opts?.mediaId,
          gif_url: opts?.gifUrl ?? null,
          reply_to_message_id: opts?.replyToMessageId,
        });
      } else {
        // Không encrypt → gửi plaintext KHÔNG có e2e_version
        socket.send('message:send', {
          chat_id: chatId,
          content,
          emoji_id: opts?.emojiId,
          media_id: opts?.mediaId,
          gif_url: opts?.gifUrl ?? null,
          reply_to_message_id: opts?.replyToMessageId,
        });
      }
    },
    [chatId, myUserId, socket, encryption],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatId) return;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) {
        socket.send('typing:start', { chat_id: chatId });
        typingTimerRef.current = setTimeout(() => {
          socket.send('typing:stop', { chat_id: chatId });
        }, 3000);
      } else {
        socket.send('typing:stop', { chat_id: chatId });
      }
    },
    [chatId, socket],
  );

  const deleteMessage = useCallback(
    (messageId: string, mode: 'all' | 'me') => {
      if (!chatId) return;
      socket.send('message:delete', { chat_id: chatId, message_id: messageId, mode });
    },
    [chatId, socket],
  );

  const loadMoreMessages = useCallback(() => {
    if (!chatId || !hasMoreRef.current || loadingMoreRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    socket.send('chat:history:more', {
      chat_id: chatId,
      cursor: cursorRef.current,
    });
  }, [chatId, socket]);

  const pinMessage = useCallback(
    (messageId: string) => {
      if (!chatId || socket.status !== 'open') return;
      socket.send('message:pin', { chat_id: chatId, message_id: messageId });
    },
    [chatId, socket],
  );

  const unpinMessage = useCallback(
    (messageId: string) => {
      if (!chatId || socket.status !== 'open') return;
      socket.send('message:unpin', { chat_id: chatId, message_id: messageId });
    },
    [chatId, socket],
  );

  const searchMessages = useCallback(
    (keyword: string) => {
      if (!chatId || socket.status !== 'open') return;
      const trimmed = keyword.trim();
      if (!trimmed) {
        setSearchResults(null);
        setSearchKeyword('');
        return;
      }

      // E2E: server không đọc được nội dung → tìm kiếm client-side
      if (encryption?.ready) {
        const needle = trimmed.toLowerCase();
        const results = messagesRef.current.filter(
          (m) => !m.deleted && !m.decrypt_failed && m.content.toLowerCase().includes(needle),
        );
        setSearchKeyword(trimmed);
        setSearchResults(sortByCreatedAt(results));
        return;
      }

      socket.send('message:search', { chat_id: chatId, keyword: trimmed });
    },
    [chatId, socket, encryption],
  );

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchKeyword('');
  }, []);

  return useMemo(
    () => ({
      messages,
      loading,
      hasMore,
      loadingMore,
      partnerTyping,
      pinnedMessages,
      sendMessage,
      sendTyping,
      deleteMessage,
      pinMessage,
      unpinMessage,
      loadMoreMessages,
      searchMessages,
      clearSearch,
      searchResults,
      searchKeyword,
    }),
    [
      messages,
      loading,
      hasMore,
      loadingMore,
      partnerTyping,
      pinnedMessages,
      sendMessage,
      sendTyping,
      deleteMessage,
      pinMessage,
      unpinMessage,
      loadMoreMessages,
      searchMessages,
      clearSearch,
      searchResults,
      searchKeyword,
    ],
  );
}
