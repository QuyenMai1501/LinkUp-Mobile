import type { ChatMessage } from '@/types/chat';

const MEDIA_GROUP_WINDOW_MS = 3000;

export function isMediaMessage(msg: ChatMessage): boolean {
  if (msg.deleted || msg.decrypt_failed || msg.emoji_id || msg.shared_post_id) return false;
  if (!(msg.media_id || msg.media_uri)) return false;
  return true;
}

export interface MediaGroupItem {
  kind: 'media_group';
  msgs: ChatMessage[];
}

export function groupMediaTimeline(
  messages: ChatMessage[],
): (ChatMessage | MediaGroupItem)[] {
  const result: (ChatMessage | MediaGroupItem)[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (!isMediaMessage(msg)) {
      result.push(msg);
      i++;
      continue;
    }

    const group: ChatMessage[] = [msg];
    const groupId = msg.media_group_id;
    const senderId = msg.sender_id;
    const baseTime = new Date(msg.created_at).getTime();
    let j = i + 1;

    while (j < messages.length) {
      const next = messages[j];
      if (!isMediaMessage(next)) break;
      if (next.sender_id !== senderId) break;

      if (groupId && next.media_group_id === groupId) {
        group.push(next);
        j++;
        continue;
      }

      const nextTime = new Date(next.created_at).getTime();
      if (nextTime - baseTime <= MEDIA_GROUP_WINDOW_MS) {
        group.push(next);
        j++;
        continue;
      }

      break;
    }

    if (group.length >= 2) {
      result.push({ kind: 'media_group', msgs: group });
    } else {
      result.push(msg);
    }
    i = j;
  }

  return result;
}
