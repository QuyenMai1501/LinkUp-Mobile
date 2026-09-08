export type NotificationType =
  | 'like' | 'comment' | 'follow' | 'message' | 'share'
  | 'friend_request' | 'friend_accepted'
  | 'community_join_request' | 'community_join_approved' | 'community_join_rejected'
  | 'community_role_changed' | 'community_member_left' | 'community_member_kicked'
  | 'community_group_chat_added' | 'community_invite_code_used'
  | 'community_invitation_received' | 'community_invitation_accepted'
  | 'voice_call'
  | 'media_approved' | 'media_rejected' | 'media_flagged'

export interface NotificationItem {
  id: string
  sender_id?: string
  sender_name?: string
  sender_avatar?: string
  type: NotificationType
  content: string
  is_read: boolean
  created_at: string
  redirect_post_id?: string
  redirect_user_id?: string
  redirect_comment_id?: string
}

export interface NotificationGroup {
  key: string
  ids: string[]
  count: number
  is_read: boolean
  sender_id?: string
  sender_name?: string
  sender_avatar?: string
  type: NotificationType
  content: string
  created_at: string
  redirect_post_id?: string
  redirect_user_id?: string
  redirect_comment_id?: string
}

export interface NotificationListResponse {
  data: NotificationItem[]
  total: number
  page: number
}

export interface NotificationPreferences {
  like_enabled: boolean
  comment_enabled: boolean
  follow_enabled: boolean
  message_enabled: boolean
  friend_request_enabled: boolean
  community_enabled: boolean
  voice_call_enabled: boolean
}
