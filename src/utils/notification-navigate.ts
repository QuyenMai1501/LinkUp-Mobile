import type { NotificationType } from '../types/notification'

interface NotificationTarget {
  type: NotificationType
  redirect_post_id?: string | null
  redirect_user_id?: string | null
  redirect_comment_id?: string | null
}

export interface NotificationRoute {
  pathname: string
  params?: Record<string, string>
}

/**
 * Map notification → route expo-router (parallel với Web notificationHref).
 * - type 'message' mang chat id trong redirect_comment_id (server gán tại
 *   chat.service.go) → đi qua /(drawer)/messages với param chat_id, KHÔNG
 *   push thẳng vào chat screen: id có thể là group chat / không tồn tại
 *   (admin cũng dùng type 'message') và chat screen không có state lỗi.
 * - Các type không có route (voice_call, community_*, …) → null: chỉ mark
 *   as read, không điều hướng.
 */
export function notificationRoute(item: NotificationTarget): NotificationRoute | null {
  switch (item.type) {
    case 'like':
    case 'comment':
    case 'share':
    case 'media_approved':
    case 'media_rejected':
    case 'media_flagged':
      if (item.redirect_post_id) {
        return {
          pathname: '/(drawer)/post/[postId]',
          params: { postId: item.redirect_post_id },
        }
      }
      return null
    case 'follow':
    case 'friend_accepted':
      if (item.redirect_user_id) {
        return {
          pathname: '/(drawer)/profile/[userId]',
          params: { userId: item.redirect_user_id },
        }
      }
      return null
    case 'friend_request':
      return { pathname: '/(drawer)/friends' }
    case 'message':
      if (item.redirect_comment_id) {
        return { pathname: '/(drawer)/messages', params: { chat_id: item.redirect_comment_id } }
      }
      return { pathname: '/(drawer)/messages' }
    default:
      return null
  }
}

// --- Điều hướng từ notification (in-app tap + push tap) ---------------------
// Root layout gọi markNavigationReady sau khi mount. Nếu push tap đến TRƯỚC
// khi navigation sẵn sàng (cold start: app bị kill → mở từ notification),
// route được giữ lại và flush ngay khi sẵn sàng.

type NavigateFn = (route: NotificationRoute) => void

let navigate: NavigateFn | null = null
let pendingRoute: NotificationRoute | null = null

export function markNavigationReady(fn: NavigateFn): void {
  navigate = fn
  if (pendingRoute) {
    const route = pendingRoute
    pendingRoute = null
    fn(route)
  }
}

export function navigateToNotification(route: NotificationRoute): void {
  if (navigate) {
    navigate(route)
    return
  }
  pendingRoute = route
}
