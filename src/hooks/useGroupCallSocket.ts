import { useCallback, useEffect, useRef, useState } from 'react';
import { tokenStorage } from '@/api/token-storage';
import { API_BASE } from '@/api/client';

type EventHandler = (payload: any) => void;
type GroupCallSocketStatus = 'connecting' | 'open' | 'closed';

export interface GroupCallSocket {
  status: GroupCallSocketStatus;
  send: (type: string, payload?: unknown) => boolean;
  subscribe: (type: string, handler: EventHandler) => () => void;
  connect: () => void;
  close: () => void;
}

// Endpoint group call: /api/group-calls/ws?token=<access JWT> —
// Hub riêng (groupws), whitelist chỉ nhận group:call:* (client.go).
export function useGroupCallSocket(): GroupCallSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const closedByUserRef = useRef(false);
  // connect() async (getWsUrl) — guard đồng bộ chặn caller thứ 2 trong lúc
  // caller thứ 1 còn đang await, nếu không sẽ tạo 2 WebSocket cùng lúc.
  const connectingRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<GroupCallSocketStatus>('closed');

  const getWsUrl = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) return null;
    const wsBase = API_BASE.replace(/^http/, 'ws');
    return `${wsBase}/group-calls/ws?token=${encodeURIComponent(token)}`;
  }, []);

  const connect = useCallback(() => {
    // readyState <= OPEN bắt cả CONNECTING (0) lẫn OPEN (1) — caller thứ 2
    // không được tạo socket trùng khi socket thứ 1 đang mở hoặc đang nối.
    if (connectingRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    closedByUserRef.current = false;
    connectingRef.current = true;

    getWsUrl().then((url) => {
      connectingRef.current = false;
      if (!url) return;
      // Re-check sau await: connect() khác có thể đã tạo socket trong lúc chờ.
      if (closedByUserRef.current) return;
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('open');
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
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
        // Chỉ socket hiện hành được null ref + schedule reconnect —
        // socket mồ côi đóng không được giết socket sống đang dùng.
        if (wsRef.current !== ws) return;
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
