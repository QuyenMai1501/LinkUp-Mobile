import { request } from './client';
import type {
  ChatListResponse,
  CreateDirectChatResponse,
  UserSearchResult,
} from '@/types/chat';

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
