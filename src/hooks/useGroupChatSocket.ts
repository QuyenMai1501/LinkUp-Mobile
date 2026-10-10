import { useCallback, useEffect, useRef, useState } from 'react';
import { tokenStorage } from '@/api/token-storage';
import { API_BASE } from '@/api/client';

type EventHandler = (payload: any) => void;
type GroupChatSocketStatus = 'connecting' | 'open' | 'closed';

export interface GroupChatSocket {
  status: GroupChatSocketStatus;
  // Trả về false khi socket chưa OPEN (caller đánh dấu gửi thất bại thay vì
  // lặng lẽ nuốt frame).
  send: (type: string, payload?: unknown) => boolean;
  subscribe: (type: string, handler: EventHandler) => () => void;
  connect: () => void;
  close: () => void;
}

// Endpoint group chat: /api/group-chats/ws?token=<access JWT>
// (auth qua query param — mirror useChatSocket cho chat 1-1).
export function useGroupChatSocket(): GroupChatSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const closedByUserRef = useRef(false);
  // connectRef: ws.onclose cần gọi lại connect mà không vi phạm
  // "access before declaration" (khác useChatSocket — nơi lint error có sẵn).
  const connectRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<GroupChatSocketStatus>('closed');

  const getWsUrl = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) return null;
    const wsBase = API_BASE.replace(/^http/, 'ws');
    return `${wsBase}/group-chats/ws?token=${encodeURIComponent(token)}`;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    closedByUserRef.current = false;

    getWsUrl().then((url) => {
      if (!url) return;
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('open');
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        // Server có thể gộp nhiều frame JSON phân cách '\n' trong 1 message.
        const frames = raw.split('\n').filter(Boolean);
        for (const frame of frames) {
          try {
            const msg = JSON.parse(frame);
            const fns = handlersRef.current.get(msg.type);
            if (fns) for (const fn of fns) fn(msg.payload ?? msg);
          } catch {
            /* skip malformed */
          }
        }
      };

      ws.onclose = () => {
        setStatus('closed');
        wsRef.current = null;
        if (!closedByUserRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 2,
              30000,
            );
            connectRef.current();
          }, reconnectDelayRef.current);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    });
  }, [getWsUrl]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const close = useCallback(() => {
    closedByUserRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('closed');
  }, []);

  const send = useCallback((type: string, payload?: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type, ...(payload ? { payload } : {}) }));
    return true;
  }, []);

  const subscribe = useCallback(
    (type: string, handler: EventHandler) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set());
      }
      handlersRef.current.get(type)!.add(handler);
      return () => {
        handlersRef.current.get(type)?.delete(handler);
      };
    },
    [],
  );

  useEffect(() => {
    connect();
    return () => {
      closedByUserRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, send, subscribe, connect, close };
}
