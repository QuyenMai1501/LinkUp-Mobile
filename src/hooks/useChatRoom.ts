import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { ChatMessage, HistoryCursor, PinnedMessage, SendMessageOptions } from '@/types/chat';
import { useTranslation } from '@/hooks/useTranslation';
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

// Cập nhật tin ghim trong prev bằng phiên bản đã giải mã (theo message_id),
// chỉ khi nội dung/trạng thái thay đổi để tránh render thừa. Giữ thứ tự prev.
function mergePinned(prev: PinnedMessage[], chunk: PinnedMessage[]): PinnedMessage[] {
  if (chunk.length === 0) return prev;
  const byId = new Map(prev.map((p) => [p.message_id, p]));
  let changed = false;
  for (const p of chunk) {
    const cur = byId.get(p.message_id);
    if (!cur) continue;
    if (
      cur.content === p.content &&
      cur.decrypt_failed === p.decrypt_failed &&
      cur.decrypted === p.decrypted
    ) {
      continue;
    }
    byId.set(p.message_id, p);
    changed = true;
  }
  return changed ? [...byId.values()] : prev;
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
  const { t } = useTranslation();
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
  // Hàng đợi id bubble tạm (optimistic) theo thứ tự gửi — echo `message:new`
  // sẽ shift() từng id để thay đúng temp (Web cũng làm vậy). Không so content:
  // temp plaintext vs echo plaintext sau decrypt có thể lệch khi lỗi/đổi nội dung.
  const pendingIdsRef = useRef<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeChatIdRef = useRef<string | null>(null);
  const e2eReadyChatRef = useRef<string | null>(null);

  const e2eStatus = encryption?.status ?? 'unavailable';

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const pinnedMessagesRef = useRef<PinnedMessage[]>([]);

  useEffect(() => {
    pinnedMessagesRef.current = pinnedMessages;
  }, [pinnedMessages]);

  const decryptIncoming = useCallback(
    async (list: ChatMessage[]): Promise<ChatMessage[]> => {
      if (!encryption) return list;
      // Chưa ready (đang set-up khóa / legacy / lỗi) → chỉ đánh dấu placeholder,
      // KHÔNG gọi decrypt: tránh spam log keyCount=0 + tránh đánh dấu thất bại
      // oan khi khóa chưa về. Khi status chuyển ready, Effect 3 retry sẽ giải
      // mã lại toàn bộ (decrypt_failed → decrypted).
      if (!encryption.ready) {
        return list.map((msg) => {
          let updated = msg;
          if (msg.e2e_version === 1 && msg.content && !msg.deleted && !msg.decrypted) {
            updated = { ...updated, decrypt_failed: true };
          }
          if (
            updated.reply_to &&
            updated.reply_to.content &&
            updated.e2e_version === 1 &&
            !updated.reply_to.decrypted &&
            !updated.reply_to.decrypting
          ) {
            updated = {
              ...updated,
              reply_to: { ...updated.reply_to, decrypt_failed: true, decrypting: false },
            };
          }
          return updated;
        });
      }
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
          // Reply preview cùng chat (e2e_version ngay trên preview): giải mã
          // thành công → nội dung; fail → giữ trạng thái để UI hiện "Không thể
          // giải mã" thay vì xóa trắng snippet.
          if (
            updated.reply_to &&
            updated.reply_to.content &&
            updated.e2e_version === 1 &&
            !updated.reply_to.decrypted &&
            !updated.reply_to.decrypting
          ) {
            const rt = updated.reply_to;
            updated = { ...updated, reply_to: { ...rt, decrypting: true } };
            try {
              const plain = await encryption.decrypt(rt.content);
              updated = {
                ...updated,
                reply_to: { ...rt, content: plain, decrypted: true, decrypt_failed: false },
              };
            } catch {
              updated = { ...updated, reply_to: { ...rt, decrypt_failed: true, decrypting: false } };
            }
          }
          return updated;
        }),
      );
    },
    [encryption],
  );

  // Giải mã tin ghim E2E (cùng chat → decrypt bằng khóa chat hiện tại). Trả về
  // mảng pin đã có trạng thái decrypted/decrypt_failed để UI hiện placeholder.
  const decryptPinned = useCallback(
    async (list: PinnedMessage[]): Promise<PinnedMessage[]> => {
      if (!encryption || list.length === 0) return list;
      return Promise.all(
        list.map(async (pin) => {
          if (!pin.content || pin.decrypted) return pin;
          try {
            const plain = await encryption.decrypt(pin.content);
            return { ...pin, content: plain, decrypted: true, decrypt_failed: false };
          } catch {
            return { ...pin, decrypt_failed: true };
          }
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
            // Thay optimistic temp message theo hàng đợi id (không so content —
            // content của temp và echo luôn là plaintext nhưng so sánh từng ký tự
            // dễ sai khi gửi trùng nội dung / decrypt fail).
            if (resolved.sender_id === myUserId && pendingIdsRef.current.length > 0) {
              const tempId = pendingIdsRef.current.shift()!;
              const idx = prev.findIndex((m) => m.id === tempId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = resolved;
                return sortByCreatedAt(dedupeByID(next));
              }
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

      // Ghim tin E2E: render bản ciphertext ngay, decrypt dần (pin list từ
      // server có thể là hàng trăm ghim — không block render).
      socket.subscribe('message:pinned_list', (payload: any) => {
        const pins: PinnedMessage[] = payload.pinned_messages ?? [];
        setPinnedMessages(pins);
        void decryptPinned(pins).then((decrypted) => {
          if (activeChatIdRef.current !== chatId) return;
          setPinnedMessages((prev) => mergePinned(prev, decrypted));
        });
      }),

      socket.subscribe('message:pinned', (payload: any) => {
        const pin = payload as PinnedMessage;
        if (!pin || !pin.message_id) return;
        setPinnedMessages((prev) => {
          const exists = prev.some((p) => p.message_id === pin.message_id);
          if (exists) return prev;
          return [pin, ...prev].slice(0, 2);
        });
        void decryptPinned([pin]).then(([decrypted]) => {
          if (activeChatIdRef.current !== chatId) return;
          setPinnedMessages((prev) => mergePinned(prev, [decrypted]));
        });
      }),

      socket.subscribe('message:unpinned', (payload: any) => {
        if (!payload || !payload.message_id) return;
        setPinnedMessages((prev) => prev.filter((p) => p.message_id !== payload.message_id));
      }),
    ];

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- socket.subscribe is stable
  }, [chatId, socket.subscribe, myUserId, onNewMessage, decryptIncoming, decryptPinned]);

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
    // Tin ghim cũng giữ ciphertext khi key chưa sẵn → giải mã lại khi ready.
    void decryptPinned(pinnedMessagesRef.current).then((decrypted) => {
      if (activeChatIdRef.current !== currentChatId) return;
      setPinnedMessages((prev) => mergePinned(prev, decrypted));
    });
  }, [e2eStatus, encryption, decryptIncoming, decryptPinned]);

  const sendMessage = useCallback(
    (content: string, opts?: SendMessageOptions) => {
      if (!chatId || (!content.trim() && !opts?.mediaId && !opts?.emojiId && !opts?.gifUrl)) return;
      if (e2eStatus === 'unavailable' || e2eStatus === 'loading') {
        // Chưa phân loại E2E (ids chưa load) hoặc E2E chưa sẵn sàng → chặn gửi
        // thay vì lặng lẽ lộ plaintext ra server. (Legacy → status='legacy' →
        // vẫn gửi plaintext như cũ.)
        Alert.alert(t('chat.e2eInitializing'));
        return;
      }
      if (e2eStatus === 'partner_changed') {
        // Đối phương đổi thiết bị, không còn khôi phục được → chặn gửi.
        Alert.alert(t('chat.e2ePartnerChanged'));
        return;
      }
      tempSeqRef.current += 1;
      const tempId = `temp-${tempSeqRef.current}`;
      // Bubble tạm giữ PLAINTEXT để hiển thị đúng ngay; echo server về sẽ thay
      // đúng temp này theo id (xem pendingIdsRef). Encrypt XẢY RA Ở ĐÂY, sau
      // khi append — không để caller encrypt trước như trước đây (gây 2 bubble:
      // temp = ciphertext render raw + echo = plaintext bị append trùng).
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
      pendingIdsRef.current.push(tempId);
      setMessages((prev) => [...prev, optimistic]);

      void (async () => {
        let wireContent = content;
        let e2eEncrypted = false;
        if (encryption?.ready && content !== '') {
          try {
            wireContent = await encryption.encrypt(content);
            e2eEncrypted = true;
          } catch {
            // Encrypt fail → gỡ bubble tạm, KHÔNG gửi plaintext âm thầm.
            pendingIdsRef.current = pendingIdsRef.current.filter((id) => id !== tempId);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            Alert.alert(t('chat.e2eEncryptFailed'));
            return;
          }
        }

        if (e2eEncrypted) {
          socket.send('message:send', {
            chat_id: chatId,
            content: wireContent,
            e2e_version: 1,
            emoji_id: opts?.emojiId,
            media_id: opts?.mediaId,
            gif_url: opts?.gifUrl ?? null,
            reply_to_message_id: opts?.replyToMessageId,
          });
        } else {
          // Không encrypt (legacy / content rỗng) → gửi plaintext KHÔNG có e2e_version
          socket.send('message:send', {
            chat_id: chatId,
            content: wireContent,
            emoji_id: opts?.emojiId,
            media_id: opts?.mediaId,
            gif_url: opts?.gifUrl ?? null,
            reply_to_message_id: opts?.replyToMessageId,
          });
        }
      })();
    },
    [chatId, myUserId, socket, encryption, e2eStatus, t],
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
