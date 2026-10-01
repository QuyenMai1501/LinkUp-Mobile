export interface ChatPartner {
  user_id: string;
  display_name: string;
  avatar_uri: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  emoji_id?: string | null;
  media_id?: string | null;
  media_group_id?: string | null;
  reply_to_message_id?: string | null;
  shared_post_id?: string | null;
  shared_post?: SharedPostPreview | null;
  reply_to?: ReplyPreview | null;
  media_uri?: string | null;
  media_type?: string | null;
  sender_name?: string;
  sender_avatar?: string;
  type?: string;
  message_category?: string;
  is_anonymized: boolean;
  anonymous_name?: string | null;
  e2e_version?: number;
  decrypt_failed?: boolean;
  decrypted?: boolean;
  deleted?: boolean;
  created_at: string;
}

// Mirror server dto.SharedPostPayload — payload bài viết được chia sẻ vào chat.
export interface SharedPostPreview {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_uri: string;
  title: string;
  content: string;
  media_uri?: string;
  media_type?: string;
}

export interface ReplyPreview {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  // Server gửi e2e_version ngay trên preview: 1 = content là ciphertext của
  // CÙNG chat này (client tự giải mã), 0 = plaintext legacy.
  e2e_version?: number;
  decrypted?: boolean;
  decrypting?: boolean;
  decrypt_failed?: boolean;
}

export interface ChatConversation {
  chat_id: string;
  partner: ChatPartner;
  last_message?: ChatMessage | null;
  is_encrypted?: boolean;
  updated_at: string;
}

export interface ChatListResponse {
  data: ChatConversation[];
}

export interface HistoryCursor {
  created_at: string;
  id: string;
}

export interface ChatHistoryPayload {
  chat_id: string;
  messages: ChatMessage[];
  has_more?: boolean;
  next_cursor?: HistoryCursor | null;
}

export interface CreateDirectChatResponse {
  chat_id: string;
  message?: string;
}

export interface ChatInviteItem {
  invite_id: string;
  requester_id: string;
  requester_name?: string;
  requester_avatar?: string;
  created_at: string;
}

export interface PinnedMessage {
  id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  content: string;
  sender_id: string;
  sender_name: string;
  // Tin ghim E2E: server giữ nguyên ciphertext, client tự giải mã.
  e2e_version?: number;
  decrypted?: boolean;
  decrypt_failed?: boolean;
}

export interface SendMessageOptions {
  emojiId?: string;
  mediaId?: string;
  mediaUri?: string;
  mediaType?: string;
  gifUrl?: string;
  sharedPostId?: string;
  replyToMessageId?: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_uri: string;
}
