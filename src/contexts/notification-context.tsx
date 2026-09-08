import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Notifications from 'expo-notifications';

import { API_BASE } from '@/api/client';
import {
  getUnreadCount,
  getNotifications,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
  registerPushToken,
} from '@/api/notifications';
import { tokenStorage } from '@/api/token-storage';
import {
  groupNotifications,
  mergeNotification,
} from '@/utils/group-notifications';
import { registerForPushNotificationsAsync } from '@/utils/register-push';
import type {
  NotificationGroup,
  NotificationItem,
} from '../types/notification';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  unreadCount: number;
  notifications: NotificationGroup[];
  loading: boolean;
  refreshUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (group: NotificationGroup) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(1000);
  const closedByUserRef = useRef(false);
  const maxReconnectDelay = 30000;

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.count);
    } catch (err) {
      console.error('Failed to get unread count:', err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications(1, 20, false);
      setNotifications(groupNotifications(res.data));
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  const markAsRead = useCallback(
    async (group: NotificationGroup) => {
      setNotifications((prev) =>
        prev.map((n) => (n.key === group.key ? { ...n, is_read: true } : n)),
      );
      try {
        await Promise.all(group.ids.map((id) => apiMarkAsRead(id)));
        refreshUnreadCount();
      } catch (err) {
        console.error('Failed to mark as read:', err);
        refreshUnreadCount();
        fetchNotifications();
      }
    },
    [refreshUnreadCount, fetchNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await apiMarkAllAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      refreshUnreadCount();
    }
  }, [refreshUnreadCount]);

  // Push notification registration + listeners
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        registerPushToken(token).catch((err) =>
          console.error('Failed to register push token:', err),
        );
      }
    });

    const receivedListener = Notifications.addNotificationReceivedListener(() => {
      refreshUnreadCount();
      fetchNotifications();
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        if (data?.type === 'message') {
          // Navigate to messages - handled by deep linking
        }
      },
    );

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, [refreshUnreadCount, fetchNotifications]);

  // WebSocket connection
  useEffect(() => {
    let isComponentMounted = true;

    const connectWS = async () => {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        wsRef.current = null;
        return;
      }

      const wsUrl = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '');
      const ws = new WebSocket(`${wsUrl}/api/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted) return;
        closedByUserRef.current = false;
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        if (!isComponentMounted) return;
        const parts = String(event.data).split('\n');
        for (const part of parts) {
          const data = part.trim();
          if (!data) continue;
          try {
            const message = JSON.parse(data);
            if (message.type === 'notification') {
              const newNotif: NotificationItem = message.data;
              setNotifications((prev) => mergeNotification(newNotif, prev));
              setUnreadCount((prev) => prev + 1);
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        }
      };

      ws.onclose = () => {
        if (!isComponentMounted || closedByUserRef.current) return;
        setTimeout(() => {
          if (isComponentMounted && !closedByUserRef.current) {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 2,
              maxReconnectDelay,
            );
            connectWS();
          }
        }, reconnectDelayRef.current);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    const initData = async () => {
      setLoading(true);
      await Promise.all([refreshUnreadCount(), fetchNotifications()]).catch(() => {});
      if (isComponentMounted) {
        setLoading(false);
      }
    };

    initData();
    connectWS();

    const pollInterval = setInterval(() => {
      if (isComponentMounted) {
        refreshUnreadCount().catch(() => {});
        fetchNotifications().catch(() => {});
      }
    }, 30000);

    return () => {
      isComponentMounted = false;
      clearInterval(pollInterval);
      if (wsRef.current) {
        closedByUserRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [refreshUnreadCount, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        loading,
        refreshUnreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
