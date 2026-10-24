import type { ChatMessage } from '@/types/chat';

/** Cụm ảnh gửi cùng lúc — 1 bubble lưới 3 cột (chỉ chứa ảnh, không video/audio). */
export interface MediaClusterItem {
  kind: 'media_cluster';
  msgs: ChatMessage[];
}

/** Ảnh (loại video/audio — video vẫn bubble riêng, audio là thoại). */
function isGridImage(msg: ChatMessage): boolean {
  if (msg.deleted || msg.decrypt_failed) return false;
  if (msg.media_type?.startsWith('video/')) return false;
  if (msg.media_type?.startsWith('audio/')) return false;
  return !!(msg.media_id || msg.media_uri);
}

/**
 * Nhóm ảnh liên tiếp cùng người gửi + cùng `media_group_id` (client sinh 1 id
 * cho batch gửi nhiều ảnh) thành cụm lưới. Ảnh đơn / ảnh cũ không có group id
 * (media_group_id null) giữ nguyên bubble to. Chỉ cụm ≥2 mới gộp.
 */
export function clusterTimelineMedia(
  messages: ChatMessage[],
): (ChatMessage | MediaClusterItem)[] {
  const result: (ChatMessage | MediaClusterItem)[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    const groupId = msg.media_group_id;
    if (!groupId || !isGridImage(msg)) {
      result.push(msg);
      i++;
      continue;
    }
    const group = [msg];
    let j = i + 1;
    while (j < messages.length) {
      const next = messages[j];
      if (next.sender_id !== msg.sender_id) break;
      if (next.media_group_id !== groupId) break;
      if (!isGridImage(next)) break;
      group.push(next);
      j++;
    }
    if (group.length >= 2) result.push({ kind: 'media_cluster', msgs: group });
    else result.push(msg);
    i = j;
  }
  return result;
}
