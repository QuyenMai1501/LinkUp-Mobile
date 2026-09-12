import { request, API_BASE } from './client';
import { tokenStorage } from './token-storage';
import type {
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

export const deleteChat = (chatId: string) =>
  request<{ message: string }>(`/chats/${chatId}`, {
    method: 'DELETE',
  });

export const searchFriends = (keyword: string) =>
  request<{ users: UserSearchResult[] }>(
    `/friends/search?keyword=${encodeURIComponent(keyword)}`,
  );

export const uploadChatMedia = async (
  file: { uri: string; name: string; type: string },
  chatId: string,
): Promise<UploadMediaResponse> => {
  const token = await tokenStorage.getAccessToken();
  const formData = new FormData();
  formData.append('file', file as any);
  formData.append('chat_id', chatId);

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
