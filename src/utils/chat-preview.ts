// Preview helpers cho chat-list — mirror Web utils/chatPreview.ts.
//
// IMPORTANT: chat-list endpoints trả last_message TRIMMED (server build từ
// SELECT thủ công — không có `type`, không có `message_category`, xem
// repository/chat.repository.go + group_chat.repository.go). Detection phải
// CONTENT-based (sniff segment đầu `key|...` / JSON invite) để không render
// thô uuid (call_ended|<uuid>) hay request_id (JSON lời mời nhóm) ra UI.

import type { ChatMessage } from '@/types/chat';
import type { GroupChatInviteContent } from '@/types/group-chat';

const SYSTEM_TYPES = new Set([
  'member_invited',
  'member_joined',
  'member_left',
  'admin_transferred',
  'group_settings_updated',
]);

// Mọi key wire dạng `key|actorId|extra` client có thể dịch — mirror
// getSystemMessageText (system-message.tsx).
const SYSTEM_CONTENT_KEYS = new Set([
  'member_left',
  'member_joined',
  'member_invited',
  'admin_transferred',
  'group_settings_updated',
  'group_name_changed',
  'group_avatar_changed',
  'call_started',
  'call_ended',
  'call_timeout',
]);

const CALL_CONTENT_KEYS = new Set(['call_started', 'call_ended', 'call_timeout']);

/** Segment đầu của content pipe-encoded nếu thuộc SYSTEM_CONTENT_KEYS, ngược lại null. */
export function systemContentKey(content: string): string | null {
  if (!content.includes('|')) return null;
  const key = content.split('|')[0];
  return SYSTEM_CONTENT_KEYS.has(key) ? key : null;
}

/**
 * True khi content là group-chat invite đã serialize
 * (`{request_id, chat_id, status, ...}`) — bất kể `msg.type`
 * (list payload không mang type).
 */
export function isInvitePreviewContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Partial<GroupChatInviteContent>;
    return Boolean(parsed.request_id && parsed.chat_id && parsed.status);
  } catch {
    return false;
  }
}

/** Tin system cho preview list — metadata hoặc content-sniff (payload trimmed). */
export function isSystemPreviewMessage(
  msg: Pick<ChatMessage, 'message_category' | 'sender_id' | 'type' | 'content'>,
): boolean {
  if (
    msg.message_category === 'system' ||
    msg.sender_id === 'SYSTEM' ||
    (msg.type != null && SYSTEM_TYPES.has(msg.type))
  ) {
    return true;
  }
  // List payload thiếu type/category — sniff content.
  return systemContentKey(msg.content ?? '') !== null;
}

/** Tin lifecycle cuộc gọi nhóm (call_started|call_ended|call_timeout). */
export function isCallPreviewMessage(
  msg: Pick<ChatMessage, 'type' | 'content'>,
): boolean {
  if (msg.type != null && CALL_CONTENT_KEYS.has(msg.type)) return true;
  const key = systemContentKey(msg.content ?? '');
  return key != null && CALL_CONTENT_KEYS.has(key);
}
