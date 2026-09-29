import { useCallback, useEffect, useRef, useState } from 'react';
import { tokenStorage } from '@/api/token-storage';
import { API_BASE } from '@/api/client';

type EventHandler = (payload: any) => void;
export type CallSocketStatus = 'connecting' | 'open' | 'closed';

export interface CallSocket {
  status: CallSocketStatus;
  send: (type: string, payload?: unknown) => void;
  subscribe: (type: string, handler: EventHandler) => () => void;
  connect: () => void;
  close: () => void;
}

/**
 * WebSocket riêng cho cuộc gọi: GET /api/calls/ws?token=<access JWT>.
 *
 * Khác với useChatSocket ở chỗ server bọc frame bằng 2 kiểu envelope:
 * - `{type, payload}` cho call:initiated và error (WsEvent)
 * - `{type, data}` cho mọi event call:* từ service (hub.OutgoingMessage)
 * nên handler phải đọc `payload ?? data`.
 */
export function useCallSocket(): CallSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const closedByUserRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<CallSocketStatus>('closed');

  const getWsUrl = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) return null;
    const wsBase = API_BASE.replace(/^http/, 'ws');
    return `${wsBase}/calls/ws?token=${encodeURIComponent(token)}`;
  }, []);

  const connect = useCallback(() => {
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
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
        // Server gộp nhiều message trong 1 frame, phân cách bằng \n
        const frames = raw.split('\n').filter(Boolean);
        for (const frame of frames) {
          try {
            const msg = JSON.parse(frame);
            const payload = msg.payload !== undefined ? msg.payload : msg.data;
            const fns = handlersRef.current.get(msg.type);
            if (fns) for (const fn of fns) fn(payload);
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

  const close = useCallback(() => {
    closedByUserRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('closed');
  }, []);

  const send = useCallback((type: string, payload?: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, ...(payload ? { payload } : {}) }));
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
    connectRef.current = connect;
  }, [connect]);

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
