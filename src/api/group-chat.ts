import { request } from './client';

import type {
  CreateGroupChatResponse,
  GroupChatListResponse,
  GroupChatSettingsResponse,
  GroupLeaveHistoryMode,
  GroupLeaveMode,
} from '@/types/group-chat';

// Mirror Web api/chats.ts group endpoints. Tất cả yêu cầu Bearer token
// (request() tự đính kèm) — routes group-chats đều qua AuthMiddleware.
export const listGroupChats = () =>
  request<GroupChatListResponse>('/group-chats');

export const createGroupChat = (input: {
  name: string;
  member_ids: string[];
  avatar_uri?: string;
}) =>
  request<CreateGroupChatResponse>('/group-chats', {
    method: 'POST',
    body: JSON.stringify(input),
  });

// GET /group-chats/:chatID/settings — kèm danh sách members (P0.2).
export const getGroupSettings = (chatId: string) =>
  request<GroupChatSettingsResponse>(`/group-chats/${chatId}/settings`);

// PUT /group-chats/:chatID/settings — name/avatar yêu cầu admin; notifications
// là per-member (P0 chỉ cần name + avatar, toggles P1).
export const updateGroupSettings = (
  chatId: string,
  input: { name?: string; avatar_uri?: string },
) =>
  request<GroupChatSettingsResponse>(`/group-chats/${chatId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

// POST /group-chats/:chatID/leave — rời nhóm (P0.3). Web gửi cùng body.
export const leaveGroup = (
  chatId: string,
  leaveMode: GroupLeaveMode = 'public',
  historyMode: GroupLeaveHistoryMode = 'keep',
) =>
  request<{ message?: string }>(`/group-chats/${chatId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ leave_mode: leaveMode, history_mode: historyMode }),
  });

// POST member-requests/:requestID/approve|reject — phản hồi lời mời nhóm
// trong chat 1-1 (P0.1). Mirror Web api/chats.ts.
export const approveGroupInvite = (chatId: string, requestId: string) =>
  request<{ message?: string }>(
    `/group-chats/${chatId}/member-requests/${requestId}/approve`,
    { method: 'POST' },
  );

export const rejectGroupInvite = (chatId: string, requestId: string) =>
  request<{ message?: string }>(
    `/group-chats/${chatId}/member-requests/${requestId}/reject`,
    { method: 'POST' },
  );
