import type { ChatMessage } from './chat';

// Mirror server dto.GroupChatConversationDTO.
export interface GroupChatConversation {
  chat_id: string;
  name: string;
  avatar_uri: string;
  member_count: number;
  last_message?: ChatMessage | null;
  updated_at: string;
  background_type?: string;
  background_value?: string;
}

export interface GroupChatListResponse {
  data: GroupChatConversation[];
}

export interface CreateGroupChatResponse {
  group_id: string;
  message?: string;
}

// Mirror server dto.GroupChatMemberDTO.
export interface GroupChatMember {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  role: 'CHAT_ADMIN' | 'CHAT_MEMBER';
  is_muted: boolean;
  joined_at: string;
}

// Mirror server dto.GroupChatSettingsResponse.
export interface GroupChatSettings {
  chat_id: string;
  name: string;
  avatar_uri: string;
  allow_member_add: boolean;
  member_settings: {
    notifications_enabled: boolean;
  };
  members?: GroupChatMember[];
  background_type?: string;
  background_value?: string;
}

// Mirror server dto.GroupChatSettingsResponse bao bọc { data } (GET/PUT settings).
export interface GroupChatSettingsResponse {
  data: GroupChatSettings;
}

// ===== Group Chat Invite (message type trong chat 1-1) =====
// Mirror server services/group_chat.service.go GroupInviteContent
// (json tags) + Web types GroupChatInviteContent.
export type GroupChatInviteStatus = 'pending' | 'accepted' | 'rejected';

export interface GroupChatInviteContent {
  request_id: string;
  chat_id: string;
  group_name: string;
  group_avatar: string;
  requester_id: string;
  requester_name: string;
  status: GroupChatInviteStatus;
}

// POST /group-chats/:id/leave — body gửi đi.
export type GroupLeaveMode = 'public' | 'silent';
export type GroupLeaveHistoryMode = 'keep' | 'anonymize';
