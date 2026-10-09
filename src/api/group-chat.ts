import { request } from './client';

import type {
  CreateGroupChatResponse,
  GroupChatListResponse,
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
