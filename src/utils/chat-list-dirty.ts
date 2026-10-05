// Khi có tin nhắn mới tới (notification WS type='message') trong khi app đang
// mở, danh sách hội thoại cần refresh (server không push last_message qua
// chat socket cho client chưa join phòng). notification-context phát sự kiện
// này; messages.tsx lắng nghe + debounce refresh.
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyChatListDirty(): void {
  for (const fn of listeners) fn();
}

/** Trả về hàm unsubscribe. */
export function onChatListDirty(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
