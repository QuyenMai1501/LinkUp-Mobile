import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type {
  ChatMessage,
  MessageReaction,
  SendMessageOptions,
} from '@/types/chat';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  BeginMediaUploadOptions,
  UploadedMediaInfo,
} from '@/hooks/useChatRoom';
import type { GroupChatSocket } from './useGroupChatSocket';

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

// Tạo tin hệ thống tổng hợp client-side (server không lưu các event này thành
// row) — mirror Web useGroupChatRoom handleMemberLeft/handleMemberAdded/...
function makeSystemMessage(
  chatId: string,
  type: string,
  actorId: string,
  extra?: string,
): ChatMessage {
  return {
    id: `sys-${type}-${actorId}-${Date.now()}`,
    chat_id: chatId,
    sender_id: actorId,
    content: extra !== undefined ? `${type}|${actorId}|${extra}` : `${type}|${actorId}`,
    type,
    message_category: 'system',
    is_anonymized: false,
    created_at: new Date().toISOString(),
  };
}

export interface GroupChatRoom {
  messages: ChatMessage[];
  loading: boolean;
  typingUsers: Set<string>;
  // Tên hiển thị theo user_id — phục vụ tin hệ thống + tên người gửi.
  memberNames: Record<string, string>;
  sendMessage: (content: string, opts?: SendMessageOptions) => void;
  sendTyping: (isTyping: boolean) => void;
  deleteMessage: (messageId: string, mode: 'all' | 'me') => void;
  reactToMessage: (messageId: string, emojiId: string) => void;
  retryMessage: (messageId: string) => void;
  discardMessage: (messageId: string) => void;
  // Luồng media 2 phase (giống chat 1-1): bubble local trước, upload nền
  // do caller chạy, xong mới complete để gửi WS.
  beginMediaUpload: (opts: BeginMediaUploadOptions) => string | null;
  completeMediaUpload: (
    tempId: string,
    uploaded: UploadedMediaInfo,
    opts?: { content?: string; replyToMessageId?: string },
  ) => Promise<void>;
  failUpload: (tempId: string) => void;
  markSending: (tempId: string) => void;
}

interface UseGroupChatRoomOptions {
  chatId: string | null;
  myUserId: string;
  socket: GroupChatSocket;
  onNewMessage?: (message: ChatMessage) => void;
}

export function useGroupChatRoom({
  chatId,
  myUserId,
  socket,
  onNewMessage,
}: UseGroupChatRoomOptions): GroupChatRoom {
  const { t } = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const chatIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef(myUserId);
  const onNewMessageRef = useRef(onNewMessage);
  const messagesRef = useRef<ChatMessage[]>([]);
  const memberNamesRef = useRef<Record<string, string>>({});

  // Hàng đợi id bubble tạm (optimistic) — echo group:message:new shift() từng
  // id để thay đúng temp (không so content).
  const pendingIdsRef = useRef<string[]>([]);
  const tempSeqRef = useRef(0);
  // Wire payload theo tempId → retry gửi lại nguyên vẹn.
  const pendingPayloadsRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const sendTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // chatId gốc của bubble upload dở — complete phải gửi đúng chat đã bắt đầu.
  const mediaUploadChatsRef = useRef<Map<string, string>>(new Map());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  // Ghi nhận sender_name → memberNames (cho tin hệ thống + hàng đợi tên).
  const rememberNames = useCallback((list: ChatMessage[]) => {
    let changed = false;
    const next = { ...memberNamesRef.current };
    for (const m of list) {
      if (m.sender_name && !next[m.sender_id]) {
        next[m.sender_id] = m.sender_name;
        changed = true;
      }
    }
    if (changed) {
      memberNamesRef.current = next;
      setMemberNames(next);
    }
  }, []);

  const clearSendTimeout = useCallback((tempId: string) => {
    const timer = sendTimeoutsRef.current.get(tempId);
    if (timer) clearTimeout(timer);
    sendTimeoutsRef.current.delete(tempId);
  }, []);

  const markSendFailed = useCallback(
    (tempId: string) => {
      clearSendTimeout(tempId);
      pendingIdsRef.current = pendingIdsRef.current.filter((id) => id !== tempId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId && m.sending
            ? { ...m, sending: false, failed: true, uploading: false }
            : m,
        ),
      );
    },
    [clearSendTimeout],
  );

  // Không có echo từ server sau SEND_TIMEOUT → coi như thất bại.
  const armSendTimeout = useCallback(
    (tempId: string) => {
      clearSendTimeout(tempId);
      const timer = setTimeout(() => {
        sendTimeoutsRef.current.delete(tempId);
        pendingIdsRef.current = pendingIdsRef.current.filter((id) => id !== tempId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId && m.sending ? { ...m, sending: false, failed: true } : m,
          ),
        );
      }, 6000);
      sendTimeoutsRef.current.set(tempId, timer);
    },
    [clearSendTimeout],
  );

  // Group chat dùng mã hóa AES phía SERVER — client gửi/nhận plaintext, không E2E.
  const sendWire = useCallback(
    (tempId: string, wire: Record<string, unknown>, wireChatId: string) => {
      pendingPayloadsRef.current.set(tempId, wire);
      if (chatIdRef.current === wireChatId) {
        pendingIdsRef.current.push(tempId);
      }
      if (!socket.send('group:message:send', wire)) {
        markSendFailed(tempId);
      } else {
        armSendTimeout(tempId);
      }
    },
    [socket, markSendFailed, armSendTimeout],
  );

  const handleHistory = useCallback(
    (payload: unknown) => {
      const data = payload as {
        chat_id?: string;
        messages?: ChatMessage[];
      };
      if (!data || data.chat_id !== chatIdRef.current) return;
      setLoading(false);
      const msgs = sortByCreatedAt(dedupeByID(data.messages ?? []));
      setMessages(msgs);
      rememberNames(msgs);

      // Tự động đánh dấu đã đọc: marker mới nhất = toàn bộ tin ≤ nó đã đọc.
      if (msgs.length > 0 && socket.status === 'open') {
        socket.send('group:message:read', {
          chat_id: data.chat_id!,
          last_message_id: msgs[msgs.length - 1].id,
        });
      }
    },
    [socket, rememberNames],
  );

  const handleNewMessage = useCallback(
    (payload: unknown) => {
      const msg = payload as ChatMessage;
      if (!msg || !msg.id || !msg.chat_id) return;
      if (msg.chat_id === chatIdRef.current) {
        rememberNames([msg]);
        const pending = pendingIdsRef.current;
        if (pending.length > 0 && msg.sender_id === myUserIdRef.current) {
          const tempID = pending[0];
          pendingIdsRef.current = pending.slice(1);
          clearSendTimeout(tempID);
          pendingPayloadsRef.current.delete(tempID);
          setMessages((prev) =>
            sortByCreatedAt(
              dedupeByID([...prev.filter((m) => m.id !== tempID), msg]),
            ),
          );
        } else {
          setMessages((prev) => sortByCreatedAt(dedupeByID([...prev, msg])));
        }
        // Tự động báo đã đọc tin của người khác (server broadcast ✓✓ cho room).
        if (msg.sender_id !== myUserIdRef.current && socket.status === 'open') {
          socket.send('group:message:read', {
            chat_id: msg.chat_id,
            last_message_id: msg.id,
          });
        }
      }
      onNewMessageRef.current?.(msg);
    },
    [socket, clearSendTimeout, rememberNames],
  );

  const handleTyping = useCallback((payload: unknown) => {
    const data = payload as {
      chat_id?: string;
      user_id?: string;
      is_typing?: boolean;
    };
    if (!data || data.chat_id !== chatIdRef.current) return;
    if (data.user_id === myUserIdRef.current) return;
    setTypingUsers((prev) => {
      const next = new Set(prev);
      if (data.is_typing) next.add(data.user_id!);
      else next.delete(data.user_id!);
      return next;
    });
  }, []);

  const handleReadState = useCallback((payload: unknown) => {
    const data = payload as {
      chat_id?: string;
      user_id?: string;
      last_read_at?: string;
    };
    if (!data || data.chat_id !== chatIdRef.current || !data.user_id || !data.last_read_at) return;
    if (data.user_id === myUserIdRef.current) return;
    const readAt = new Date(data.last_read_at).getTime();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.sender_id === data.user_id) return m;
        if (new Date(m.created_at).getTime() > readAt) return m;
        if (m.seen_by?.includes(data.user_id!)) return m;
        return { ...m, seen_by: [...(m.seen_by ?? []), data.user_id!] };
      }),
    );
  }, []);

  const handleReacted = useCallback((payload: unknown) => {
    const data = payload as {
      chat_id?: string;
      message_id?: string;
      reactions?: MessageReaction[];
    };
    if (!data || data.chat_id !== chatIdRef.current || !data.message_id) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === data.message_id ? { ...m, reactions: data.reactions ?? [] } : m,
      ),
    );
  }, []);

  const handleDeleted = useCallback((payload: unknown) => {
    const data = payload as { chat_id?: string; message_id?: string };
    if (!data || data.chat_id !== chatIdRef.current || !data.message_id) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === data.message_id ? { ...m, deleted: true, content: '' } : m)),
    );
  }, []);

  const handleError = useCallback(
    (payload: unknown) => {
      const data = payload as { message?: string };
      if (!data || !data.message) return;
      Alert.alert(t('common.error'), data.message);
      // Lỗi thường do tin mới nhất gửi đi — rollback bubble tạm cuối.
      const pending = pendingIdsRef.current;
      if (pending.length > 0) {
        const tempID = pending[pending.length - 1];
        pendingIdsRef.current = pending.slice(0, -1);
        setMessages((prev) => prev.filter((m) => m.id !== tempID));
      }
    },
    [t],
  );

  const handleMemberLeft = useCallback(
    (payload: unknown) => {
      const data = payload as {
        chat_id?: string;
        user_id?: string;
        leave_mode?: string;
      };
      if (!data || data.chat_id !== chatIdRef.current) return;
      // Chỉ hiện công khai; silent leave không broadcast nội dung.
      if (data.leave_mode !== 'public') return;
      setMessages((prev) =>
        sortByCreatedAt(
          dedupeByID([
            ...prev,
            makeSystemMessage(data.chat_id!, 'member_left', data.user_id || ''),
          ]),
        ),
      );
    },
    [],
  );

  const handleMemberAdded = useCallback((payload: unknown) => {
    const data = payload as {
      chat_id?: string;
      user_id?: string;
      user_name?: string;
      member_name?: string;
    };
    if (!data || data.chat_id !== chatIdRef.current) return;
    const name = data.user_name || data.member_name;
    if (name && data.user_id) {
      memberNamesRef.current = { ...memberNamesRef.current, [data.user_id]: name };
      setMemberNames(memberNamesRef.current);
    }
    setMessages((prev) =>
      sortByCreatedAt(
        dedupeByID([
          ...prev,
          makeSystemMessage(data.chat_id!, 'member_joined', data.user_id || ''),
        ]),
      ),
    );
  }, []);

  const handleAdminTransferred = useCallback((payload: unknown) => {
    const data = payload as {
      chat_id?: string;
      target_user_id?: string;
      by?: string;
      actor_name?: string;
    };
    if (!data || data.chat_id !== chatIdRef.current) return;
    if (data.actor_name && data.target_user_id) {
      memberNamesRef.current = {
        ...memberNamesRef.current,
        [data.target_user_id]: data.actor_name,
      };
      setMemberNames(memberNamesRef.current);
    }
    setMessages((prev) =>
      sortByCreatedAt(
        dedupeByID([
          ...prev,
          makeSystemMessage(
            data.chat_id!,
            'admin_transferred',
            data.target_user_id || '',
          ),
        ]),
      ),
    );
  }, []);

  const handleSettingsUpdated = useCallback((payload: unknown) => {
    const data = payload as {
      chat_id?: string;
      name?: string;
      by?: string;
      actor_name?: string;
      detail?: string;
    };
    if (!data || data.chat_id !== chatIdRef.current) return;
    if (data.actor_name && data.by) {
      memberNamesRef.current = { ...memberNamesRef.current, [data.by]: data.actor_name };
      setMemberNames(memberNamesRef.current);
    }
    const type =
      data.detail === 'avatar_changed' ? 'group_avatar_changed' : 'group_name_changed';
    setMessages((prev) =>
      sortByCreatedAt(
        dedupeByID([
          ...prev,
          makeSystemMessage(
            data.chat_id!,
            type,
            data.by || '',
            data.name ?? undefined,
          ),
        ]),
      ),
    );
  }, []);

  // Effect 1: reset state khi đổi chat + đăng ký sự kiện.
  useEffect(() => {
    if (!chatId) return;

    if (chatIdRef.current !== chatId) {
      chatIdRef.current = chatId;
      setMessages([]);
      setTypingUsers(new Set());
      setMemberNames({});
      memberNamesRef.current = {};
      sendTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
      sendTimeoutsRef.current.clear();
      pendingPayloadsRef.current.clear();
      pendingIdsRef.current = [];
      mediaUploadChatsRef.current.clear();
      setLoading(true);
    }

    const unsubs = [
      socket.subscribe('group:history', handleHistory),
      socket.subscribe('group:message:new', handleNewMessage),
      socket.subscribe('group:typing', handleTyping),
      socket.subscribe('group:message:read', handleReadState),
      socket.subscribe('group:message:reacted', handleReacted),
      socket.subscribe('group:message:deleted', handleDeleted),
      socket.subscribe('group:member:left', handleMemberLeft),
      socket.subscribe('group:member:added', handleMemberAdded),
      socket.subscribe('group:admin:transferred', handleAdminTransferred),
      socket.subscribe('group:settings:updated', handleSettingsUpdated),
      socket.subscribe('error', handleError),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- socket.subscribe is stable
  }, [
    chatId,
    socket.subscribe,
    handleHistory,
    handleNewMessage,
    handleTyping,
    handleReadState,
    handleReacted,
    handleDeleted,
    handleMemberLeft,
    handleMemberAdded,
    handleAdminTransferred,
    handleSettingsUpdated,
    handleError,
  ]);

  // Effect 2: gửi group:join khi socket OPEN (join lại cả khi reconnect).
  useEffect(() => {
    if (!chatId || socket.status !== 'open') return;
    socket.send('group:join', { chat_id: chatId });
  }, [chatId, socket.status, socket.send]);

  const sendMessage = useCallback(
    (content: string, opts?: SendMessageOptions) => {
      const chatID = chatIdRef.current;
      const trimmed = content.trim();
      const hasAttachment = Boolean(
        opts?.emojiId || opts?.mediaId || opts?.gifUrl,
      );
      if (!chatID || (!trimmed && !hasAttachment)) return;

      tempSeqRef.current += 1;
      const tempId = `temp-${tempSeqRef.current}`;
      const optimistic: ChatMessage = {
        id: tempId,
        chat_id: chatID,
        sender_id: myUserIdRef.current,
        content: trimmed,
        emoji_id: opts?.emojiId ?? null,
        media_id: opts?.mediaId ?? null,
        media_uri: opts?.gifUrl ?? opts?.mediaUri ?? null,
        media_type: opts?.gifUrl ? 'image/gif' : opts?.mediaType ?? null,
        duration_seconds: opts?.durationSeconds ?? null,
        reply_to_message_id: opts?.replyToMessageId ?? null,
        forwarded_from: opts?.forwardedFrom ?? null,
        is_anonymized: false,
        sending: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      const wire: Record<string, unknown> = {
        chat_id: chatID,
        content: trimmed,
        emoji_id: opts?.emojiId ?? null,
        media_id: opts?.mediaId ?? null,
        media_group_id: opts?.mediaGroupId ?? null,
        duration_seconds: opts?.durationSeconds ?? 0,
        gif_url: opts?.gifUrl ?? null,
        shared_post_id: opts?.sharedPostId ?? null,
        reply_to_message_id: opts?.replyToMessageId ?? null,
        forwarded_from: opts?.forwardedFrom ?? null,
      };
      sendWire(tempId, wire, chatID);
    },
    [sendWire],
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      const wire = pendingPayloadsRef.current.get(messageId);
      if (!wire) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, sending: true, failed: false } : m)),
      );
      sendWire(messageId, wire, chatIdRef.current ?? '');
    },
    [sendWire],
  );

  const discardMessage = useCallback(
    (messageId: string) => {
      clearSendTimeout(messageId);
      pendingPayloadsRef.current.delete(messageId);
      mediaUploadChatsRef.current.delete(messageId);
      pendingIdsRef.current = pendingIdsRef.current.filter((id) => id !== messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [clearSendTimeout],
  );

  // PHASE 1: append bubble optimistic với file local — CHƯNG push hàng đợi
  // echo / arm timeout, chờ completeMediaUpload sau upload xong.
  const beginMediaUpload = useCallback(
    (opts: BeginMediaUploadOptions): string | null => {
      const chatID = chatIdRef.current;
      if (!chatID) return null;
      tempSeqRef.current += 1;
      const tempId = `temp-${tempSeqRef.current}`;
      const optimistic: ChatMessage = {
        id: tempId,
        chat_id: chatID,
        sender_id: myUserIdRef.current,
        content: opts.content ?? '',
        media_id: null,
        media_uri: opts.localUri,
        media_type: opts.mediaType,
        duration_seconds: opts.durationSeconds ?? null,
        reply_to: opts.replyTo ?? null,
        reply_to_message_id: opts.replyToMessageId ?? null,
        is_anonymized: false,
        sending: true,
        uploading: true,
        created_at: new Date().toISOString(),
      };
      mediaUploadChatsRef.current.set(tempId, chatID);
      setMessages((prev) => [...prev, optimistic]);
      return tempId;
    },
    [],
  );

  // PHASE 2: upload xong → ghi media server vào bubble rồi gửi WS.
  const completeMediaUpload = useCallback(
    async (
      tempId: string,
      uploaded: UploadedMediaInfo,
      opts?: { content?: string; replyToMessageId?: string },
    ): Promise<void> => {
      const wireChatId =
        mediaUploadChatsRef.current.get(tempId) ?? chatIdRef.current ?? '';
      mediaUploadChatsRef.current.delete(tempId);

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === tempId);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          media_id: uploaded.mediaId,
          media_uri: uploaded.mediaUri,
          media_type: uploaded.mediaType,
          duration_seconds: uploaded.durationSeconds ?? next[idx].duration_seconds,
          content: opts?.content ?? next[idx].content,
          uploading: false,
          sending: true,
        };
        return next;
      });

      const wire: Record<string, unknown> = {
        chat_id: wireChatId,
        content: opts?.content ?? '',
        media_id: uploaded.mediaId,
        media_group_id: null,
        gif_url: null,
        shared_post_id: null,
        reply_to_message_id: opts?.replyToMessageId ?? null,
        forwarded_from: null,
        duration_seconds: uploaded.durationSeconds ?? 0,
      };
      sendWire(tempId, wire, wireChatId);
    },
    [sendWire],
  );

  const failUpload = useCallback(
    (tempId: string) => {
      mediaUploadChatsRef.current.delete(tempId);
      markSendFailed(tempId);
    },
    [markSendFailed],
  );

  const markSending = useCallback((tempId: string) => {
    const chatID = chatIdRef.current;
    if (chatID) mediaUploadChatsRef.current.set(tempId, chatID);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, sending: true, failed: false, uploading: true } : m,
      ),
    );
  }, []);

  const reactToMessage = useCallback(
    (messageId: string, emojiId: string) => {
      const chatID = chatIdRef.current;
      if (!chatID || socket.status !== 'open' || !emojiId || !messageId) return;
      socket.send('group:message:react', {
        chat_id: chatID,
        message_id: messageId,
        emoji_id: emojiId,
      });
    },
    [socket],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      const chatID = chatIdRef.current;
      if (!chatID || socket.status !== 'open') return;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) {
        socket.send('group:typing:start', { chat_id: chatID });
        typingTimerRef.current = setTimeout(() => {
          socket.send('group:typing:stop', { chat_id: chatID });
        }, 3000);
      } else {
        socket.send('group:typing:stop', { chat_id: chatID });
      }
    },
    [socket],
  );

  const deleteMessage = useCallback(
    (messageId: string, mode: 'all' | 'me') => {
      const chatID = chatIdRef.current;
      if (!chatID || socket.status !== 'open') return;
      socket.send('group:message:delete', { chat_id: chatID, message_id: messageId, mode });
    },
    [socket],
  );

  return useMemo(
    () => ({
      messages,
      loading,
      typingUsers,
      memberNames,
      sendMessage,
      sendTyping,
      deleteMessage,
      reactToMessage,
      retryMessage,
      discardMessage,
      beginMediaUpload,
      completeMediaUpload,
      failUpload,
      markSending,
    }),
    [
      messages,
      loading,
      typingUsers,
      memberNames,
      sendMessage,
      sendTyping,
      deleteMessage,
      reactToMessage,
      retryMessage,
      discardMessage,
      beginMediaUpload,
      completeMediaUpload,
      failUpload,
      markSending,
    ],
  );
}
