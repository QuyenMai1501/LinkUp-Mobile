import type { NotificationType } from '../types/notification'

interface NotificationTarget {
  type: NotificationType
  redirect_post_id?: string
  redirect_user_id?: string
  redirect_comment_id?: string
}

export interface NotificationRoute {
  screen: string
  params?: Record<string, string>
}

export function notificationRoute(item: NotificationTarget): NotificationRoute | null {
  switch (item.type) {
    case 'like':
    case 'comment':
    case 'share':
      if (item.redirect_post_id) return { screen: 'posts/[id]', params: { id: item.redirect_post_id } }
      return null
    case 'follow':
    case 'friend_accepted':
      if (item.redirect_user_id) return { screen: 'profile', params: { userId: item.redirect_user_id } }
      return null
    case 'friend_request':
      return { screen: 'friends' }
    case 'message':
      return { screen: 'messages' }
    case 'media_approved':
    case 'media_rejected':
    case 'media_flagged':
      if (item.redirect_post_id) return { screen: 'posts/[id]', params: { id: item.redirect_post_id } }
      return null
    default:
      return null
  }
}
