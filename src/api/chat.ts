import { request, API_BASE } from './client';
import { tokenStorage } from './token-storage';
import type {
  ChatInviteItem,
  ChatInviteResponse,
  ChatListResponse,
  CreateDirectChatResponse,
  UserSearchResult,
} from '@/types/chat';

export interface UploadMediaResponse {
  data: {
    id: string;
    file_uri: string;
    file_type: string;
    file_size: number;
    duration_seconds?: number;
    status: string;
  };
}

export const listChats = () =>
  request<ChatListResponse>('/chats');

export const createDirectChat = (targetUserId: string) =>
  request<CreateDirectChatResponse>('/chats/direct', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId }),
  });

export const createChatInvite = (targetUserId: string) =>
  request<{ invite_id: string; message?: string }>('/chats/invite', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId }),
  });

export const deleteChat = (chatId: string) =>
  request<{ message: string }>(`/chats/${chatId}`, {
    method: 'DELETE',
  });

// Lời mời kết bạn chat đang chờ mình phản hồi.
export const listChatInvites = () =>
  request<{ data: ChatInviteItem[] }>('/chats/invites');

export const respondChatInvite = (inviteId: string, accept: boolean) =>
  request<ChatInviteResponse>('/chats/invite/respond', {
    method: 'POST',
    body: JSON.stringify({ invite_id: inviteId, accept }),
  });

export const searchFriends = (keyword: string) =>
  request<{ users: UserSearchResult[] }>(
    `/friends/search?keyword=${encodeURIComponent(keyword)}`,
  );

// Chia sẻ bài viết vào chat 1-1 (server tự tạo chat nếu chưa có).
export const sharePostToChat = (targetUserId: string, sharedPostId: string) =>
  request<{ message: string; data: unknown }>('/chats/share', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId, shared_post_id: sharedPostId }),
  });

export const uploadChatMedia = async (
  file: { uri: string; name: string; type: string },
  chatId: string,
  durationSeconds?: number,
): Promise<UploadMediaResponse> => {
  const token = await tokenStorage.getAccessToken();

  const formData = new FormData();
  // expo/fetch (Expo SDK 57) không chấp nhận part {uri,name,type} — nó ném
  // "Unsupported FormDataPart implementation" trước khi gửi request. Phải đọc file
  // thành Blob thật. slice(0, undefined, file.type) để ép Content-Type của part:
  // server chỉ lưu duration_seconds khi type bắt đầu bằng "audio/*"
  // (services/media.service.go) và File của RN không nhận ArrayBuffer trực tiếp.
  const raw = await fetch(file.uri);
  if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
  const blob = (await raw.blob()).slice(0, undefined, file.type);
  formData.append('file', blob, file.name);
  formData.append('chat_id', chatId);
  if (durationSeconds && durationSeconds > 0) {
    formData.append('duration_seconds', String(Math.round(durationSeconds)));
  }

  const res = await fetch(`${API_BASE}/chats/media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }

  return res.json();
};
