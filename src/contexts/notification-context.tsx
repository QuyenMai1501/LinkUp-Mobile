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
import { notifyChatListDirty } from '@/utils/chat-list-dirty';
import {
  groupNotifications,
  mergeNotification,
} from '@/utils/group-notifications';
import { registerForPushNotificationsAsync } from '@/utils/register-push';
import {
  navigateToNotification,
  notificationRoute,
} from '@/utils/notification-navigate';
import type {
  NotificationGroup,
  NotificationItem,
  NotificationType,
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

  // Mirror unreadCount để WS increment lấy giá trị mới nhất mà không cần
  // side-effect trong setState updater; đồng bộ badge iOS theo cùng giá trị.
  const unreadRef = useRef(0);
  const syncUnread = useCallback((count: number) => {
    unreadRef.current = count;
    setUnreadCount(count);
    void Notifications.setBadgeCountAsync(count).catch(() => {
      /* badge không hỗ trợ trên nền tảng này — bỏ qua */
    });
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) return;
    try {
      const res = await getUnreadCount();
      syncUnread(res.count);
    } catch (err) {
      console.error('Failed to get unread count:', err);
    }
  }, [syncUnread]);

  const fetchNotifications = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) return;
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
    syncUnread(0);
    try {
      await apiMarkAllAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      refreshUnreadCount();
    }
  }, [syncUnread, refreshUnreadCount]);

  // Điều hướng khi người dùng TAP vào notification (push data chứa type +
  // redirect_* — xem server notification.service.go sendPush).
  const handledResponseRef = useRef<{ id: string; at: number } | null>(null);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response) return;
      const data = response.notification.request.content
        .data as Record<string, string | null> | undefined;
      if (!data?.type) return;

      // Tránh xử lý trùng 1 response (cold start: getLast + live event).
      const id = response.notification.request.identifier;
      const now = Date.now();
      if (
        handledResponseRef.current &&
        handledResponseRef.current.id === id &&
        now - handledResponseRef.current.at < 3000
      ) {
        return;
      }
      handledResponseRef.current = { id, at: now };

      const route = notificationRoute({
        type: data.type as NotificationType,
        redirect_post_id: data.redirect_post_id ?? undefined,
        redirect_user_id: data.redirect_user_id ?? undefined,
        redirect_comment_id: data.redirect_comment_id ?? undefined,
      });
      if (route) navigateToNotification(route);
    },
    [],
  );

  // Push notification registration + listeners
  useEffect(() => {
    const initPush = async () => {
      const token = await tokenStorage.getAccessToken();
      if (!token) return;

      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        registerPushToken(pushToken).catch((err) =>
          console.error('Failed to register push token:', err),
        );
      }
    };

    initPush();

    const receivedListener = Notifications.addNotificationReceivedListener(() => {
      refreshUnreadCount();
      fetchNotifications();
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Cold start: app bị kill → mở từ notification tap, event có thể đến TRƯỚC
    // khi listener đăng ký → đọc response gần nhất và xử lý nếu còn mới.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const date = Number(response.notification.date);
        if (Number.isNaN(date) || Date.now() - date > 15000) return;
        handleNotificationResponse(response);
      })
      .catch(() => {
        /* không có response cũ — bình thường */
      });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, [refreshUnreadCount, fetchNotifications, handleNotificationResponse]);

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
              syncUnread(unreadRef.current + 1);
              // A3: tin nhắn mới trong lúc app mở → báo danh sách hội thoại
              // refresh (chat socket không broadcast message:new cho client
              // chưa join phòng — xem ws/hub.go).
              if (newNotif.type === 'message') notifyChatListDirty();
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
  }, [refreshUnreadCount, fetchNotifications, syncUnread]);

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
