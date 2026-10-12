import { request } from './client';

import type {
  CreateGroupChatResponse,
  GroupChatListResponse,
  GroupChatSettingsResponse,
  GroupLeaveHistoryMode,
  GroupLeaveMode,
  SharedContentResponse,
  SharedContentTab,
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

// PUT /group-chats/:chatID/settings — name/avatar/allow_member_add yêu cầu
// admin; notifications là per-member. Mirror Web api/chats.ts updateGroupSettings.
export const updateGroupSettings = (
  chatId: string,
  input: {
    name?: string;
    avatar_uri?: string;
    allow_member_add?: boolean;
    notifications_enabled?: boolean;
  },
) =>
  request<GroupChatSettingsResponse>(`/group-chats/${chatId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

// POST /group-chats/:chatID/add-member — tạo lời mời (pending request) trong
// chat 1-1. Server enforce allow_member_add (P1.4). Mirror Web addGroupMember.
export const addGroupMember = (chatId: string, userId: string) =>
  request<{ request_id: string; message?: string }>(
    `/group-chats/${chatId}/add-member`,
    { method: 'POST', body: JSON.stringify({ user_id: userId }) },
  );

// POST /group-chats/:chatID/ban — trục xuất + chặn thành viên (admin only).
export const banGroupMember = (chatId: string, userId: string) =>
  request<{ message?: string }>(`/group-chats/${chatId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

// POST /group-chats/:chatID/mute — reason: spam|abuse|harassment|violation|other;
// durationMinutes: 1|30|60|1440|0 (0 = vĩnh viễn) — binding oneof phía server.
export const muteGroupMember = (
  chatId: string,
  userId: string,
  reason: string,
  durationMinutes: number,
) =>
  request<{ message?: string }>(`/group-chats/${chatId}/mute`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      reason,
      duration_minutes: durationMinutes,
    }),
  });

export const unmuteGroupMember = (chatId: string, userId: string) =>
  request<{ message?: string }>(`/group-chats/${chatId}/unmute`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

// POST /group-chats/:chatID/transfer-admin — chuyển quyền admin cho thành viên.
export const transferGroupAdmin = (chatId: string, targetUserId: string) =>
  request<{ message?: string }>(`/group-chats/${chatId}/transfer-admin`, {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId }),
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

// GET /group-chats/:chatID/shared-content — nội dung đã chia sẻ (media/files/
// links/posts). Mirror Web getGroupSharedContent.
export const getGroupSharedContent = (
  chatId: string,
  tab: SharedContentTab | 'all' = 'all',
  offset = 0,
  limit = 60,
) =>
  request<SharedContentResponse>(
    `/group-chats/${chatId}/shared-content?tab=${tab}&offset=${offset}&limit=${limit}`,
  );

// GET/PUT/DELETE /group-chats/:chatID/background — nền chat per-group.
// Server dto.ChatBackgroundDTO: body { type, value }; response { data: { type, value } }.
export interface GroupChatBackground {
  type: string;
  value: string;
}

export const getGroupChatBackground = (chatId: string) =>
  request<{ data: GroupChatBackground }>(
    `/group-chats/${chatId}/background`,
  );

export const updateGroupChatBackground = (
  chatId: string,
  type: string,
  value: string,
) =>
  request<{ data: GroupChatBackground }>(
    `/group-chats/${chatId}/background`,
    {
      method: 'PUT',
      body: JSON.stringify({ type, value }),
    },
  );

export const deleteGroupChatBackground = (chatId: string) =>
  request<{ message?: string }>(`/group-chats/${chatId}/background`, {
    method: 'DELETE',
  });
