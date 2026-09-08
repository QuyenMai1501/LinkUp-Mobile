import type { NotificationGroup, NotificationItem } from '../types/notification'

type GroupFields = Omit<NotificationGroup, 'key' | 'ids' | 'count'>

export function groupKey(
  item: Pick<
    NotificationItem,
    'type' | 'sender_id' | 'redirect_post_id' | 'redirect_user_id' | 'redirect_comment_id'
  >,
): string {
  return [
    item.type,
    item.sender_id ?? 'null',
    item.redirect_post_id ?? 'null',
    item.redirect_user_id ?? 'null',
    item.redirect_comment_id ?? 'null',
  ].join('|')
}

export function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
  const map = new Map<string, NotificationGroup>()
  for (const item of items) {
    const key = groupKey(item)
    const existing = map.get(key)
    if (existing) {
      existing.ids.push(item.id)
      existing.count += 1
      existing.is_read = existing.is_read && item.is_read
      if (item.created_at > existing.created_at) {
        existing.created_at = item.created_at
        copyRepresentative(existing, item)
      }
    } else {
      map.set(key, toGroup(item))
    }
  }
  return Array.from(map.values())
}

export function mergeNotification(
  item: NotificationItem,
  groups: NotificationGroup[],
): NotificationGroup[] {
  const key = groupKey(item)
  const index = groups.findIndex((g) => g.key === key)
  if (index >= 0) {
    const next = [...groups]
    const current = next[index]
    next[index] = {
      ...current,
      ...representativeFields(item),
      ids: [...current.ids, item.id],
      count: current.count + 1,
      is_read: current.is_read && item.is_read,
    }
    return next
  }
  return [toGroup(item), ...groups]
}

function toGroup(item: NotificationItem): NotificationGroup {
  return {
    key: groupKey(item),
    ids: [item.id],
    count: 1,
    ...representativeFields(item),
  }
}

function representativeFields(item: NotificationItem): GroupFields {
  return {
    sender_id: item.sender_id,
    sender_name: item.sender_name,
    sender_avatar: item.sender_avatar,
    type: item.type,
    content: item.content,
    is_read: item.is_read,
    created_at: item.created_at,
    redirect_post_id: item.redirect_post_id,
    redirect_user_id: item.redirect_user_id,
    redirect_comment_id: item.redirect_comment_id,
  }
}

function copyRepresentative(target: NotificationGroup, item: NotificationItem) {
  target.sender_id = item.sender_id
  target.sender_name = item.sender_name
  target.sender_avatar = item.sender_avatar
  target.type = item.type
  target.content = item.content
  target.redirect_post_id = item.redirect_post_id
  target.redirect_user_id = item.redirect_user_id
  target.redirect_comment_id = item.redirect_comment_id
}
