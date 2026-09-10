import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, HistoryCursor, PinnedMessage, SendMessageOptions } from '@/types/chat';
import type { ChatSocket } from './useChatSocket';

export interface ChatRoom {
  messages: ChatMessage[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  partnerTyping: boolean;
  sendMessage: (content: string, opts?: SendMessageOptions) => void;
  sendTyping: (isTyping: boolean) => void;
  deleteMessage: (messageId: string, mode: 'all' | 'me') => void;
  loadMoreMessages: () => void;
}

interface UseChatRoomOptions {
  chatId: string | null;
  myUserId: string;
  socket: ChatSocket;
  onNewMessage?: () => void;
}

export function useChatRoom({
  chatId,
  myUserId,
  socket,
  onNewMessage,
}: UseChatRoomOptions): ChatRoom {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const cursorRef = useRef<HistoryCursor | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const tempSeqRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state on chatId change
  useEffect(() => {
    if (chatIdRef.current === chatId) return;
    chatIdRef.current = chatId;
    setMessages([]);
    setHasMore(false);
    setLoadingMore(false);
    setPartnerTyping(false);
    cursorRef.current = null;
    if (!chatId) return;

    setLoading(true);
    socket.send('chat:join', { chat_id: chatId, limit: 30 });
  }, [chatId, socket]);

  // Subscribe to events
  useEffect(() => {
    if (!chatId) return;

    const unsubs = [
      socket.subscribe('message:history', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msgs: ChatMessage[] = payload.messages ?? [];
        setMessages(msgs);
        setHasMore(payload.has_more ?? false);
        cursorRef.current = payload.next_cursor ?? null;
        setLoading(false);
      }),

      socket.subscribe('message:history_more', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msgs: ChatMessage[] = payload.messages ?? [];
        setMessages((prev) => [...msgs, ...prev]);
        setHasMore(payload.has_more ?? false);
        cursorRef.current = payload.next_cursor ?? null;
        setLoadingMore(false);
      }),

      socket.subscribe('message:new', (payload: any) => {
        if (payload.chat_id !== chatId) return;
        const msg = payload as ChatMessage;
        setMessages((prev) => {
          // Replace temp message if same sender
          const idx = prev.findIndex(
            (m) =>
              m.id.startsWith('temp-') &&
              m.sender_id === myUserId &&
              m.content === msg.content,
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = msg;
            return next;
          }
          return [...prev, msg];
        });
        onNewMessage?.();
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
    ];

    return () => unsubs.forEach((u) => u());
  }, [chatId, socket, myUserId, onNewMessage]);

  const sendMessage = useCallback(
    (content: string, opts?: SendMessageOptions) => {
      if (!chatId || !content.trim()) return;
      tempSeqRef.current += 1;
      const tempId = `temp-${tempSeqRef.current}`;
      const optimistic: ChatMessage = {
        id: tempId,
        chat_id: chatId,
        sender_id: myUserId,
        content,
        is_anonymized: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      socket.send('message:send', {
        chat_id: chatId,
        content,
        emoji_id: opts?.emojiId,
        media_id: opts?.mediaId,
        reply_to_message_id: opts?.replyToMessageId,
        e2e_version: 1,
      });
    },
    [chatId, myUserId, socket],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatId) return;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) {
        socket.send('typing:start', { chat_id: chatId });
        // Auto-stop typing after 3s
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
    if (!chatId || !hasMore || loadingMore || !cursorRef.current) return;
    setLoadingMore(true);
    socket.send('chat:history:more', {
      chat_id: chatId,
      cursor: cursorRef.current,
    });
  }, [chatId, hasMore, loadingMore, socket]);

  return useMemo(
    () => ({
      messages,
      loading,
      hasMore,
      loadingMore,
      partnerTyping,
      sendMessage,
      sendTyping,
      deleteMessage,
      loadMoreMessages,
    }),
    [
      messages,
      loading,
      hasMore,
      loadingMore,
      partnerTyping,
      sendMessage,
      sendTyping,
      deleteMessage,
      loadMoreMessages,
    ],
  );
}
