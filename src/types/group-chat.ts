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
