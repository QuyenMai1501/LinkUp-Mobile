// Video xử lý xong background (WS type='media:ready'): server đã copy staging
// lên Cloudinary + cập nhật DB, cần thay URL staging bằng URL thật ngay trong
// post đang hiển thị (không cần reload feed). notification-context phát sự
// kiện này; feed.tsx lắng nghe + patch posts + feedPostCache.
// Pattern y hệt chat-list-dirty.ts.
import type { MediaReadyEvent } from '@/types/post';

type Listener = (event: MediaReadyEvent) => void;

const listeners = new Set<Listener>();

export function notifyMediaReady(event: MediaReadyEvent): void {
  for (const fn of listeners) fn(event);
}

/** Trả về hàm unsubscribe. */
export function onMediaReady(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
