import { useEffect, useState } from 'react';

import { getFriendRequests } from '@/api/friends';

// Số lời mời kết bạn đang chờ (received) — dùng cho badge sidebar "Bạn bè".
// Store module-level mirror utils/chat-list-dirty.ts: DrawerContent mount fetch
// lần đầu; friends.tsx refresh sau Accept/Reject; notification-context refresh
// khi WS đẩy notif type='friend_request'.
let cached = 0;
let fetching = false;
const listeners = new Set<(count: number) => void>();

export async function refreshFriendRequestCount(): Promise<void> {
  if (fetching) return;
  fetching = true;
  try {
    const res = await getFriendRequests();
    cached = res.received.length;
    for (const fn of listeners) fn(cached);
  } catch {
    // Giữ count cũ khi lỗi (offline/401) — badge chỉ sai tạm thời.
  } finally {
    fetching = false;
  }
}

/** Subscribe count + fetch ngay khi mount. Trả về count hiện tại. */
export function useFriendRequestCount(): number {
  const [count, setCount] = useState(cached);

  useEffect(() => {
    listeners.add(setCount);
    void refreshFriendRequestCount();
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  return count;
}
