import { request, API_BASE } from './client';
import { tokenStorage } from './token-storage';
import type {
  CreateStoryResponseItem,
  StoryAnalytics,
  StoryDraftItem,
  StoryFeedItem,
  StoryItem,
} from '@/types/story';

export const getFeedStories = () =>
  request<StoryFeedItem[]>('/stories/feed');

export const checkUserStory = (userId: string) =>
  request<{ has_story: boolean }>(`/stories/user/${userId}/active`);

export const getUserStories = (userId: string) =>
  request<{ stories: StoryItem[] }>(`/stories/user/${userId}`);

export const viewStory = (storyId: string) =>
  request<StoryItem>(`/stories/${storyId}`);

export const deleteStory = (storyId: string) =>
  request<{ message: string }>(`/stories/${storyId}`, { method: 'DELETE' });

export const getStoryAnalytics = (storyId: string) =>
  request<StoryAnalytics>(`/stories/${storyId}/analytics`);

export const toggleMuteStoryUser = (targetUserId: string) =>
  request<{ muted: boolean }>(`/stories/mutes/${targetUserId}`, { method: 'PUT' });

export const interactStory = (storyId: string, type: string, emojiId?: string, content?: string) =>
  request<{ message: string }>(`/stories/${storyId}/interact`, {
    method: 'POST',
    body: JSON.stringify({ type, emoji_id: emojiId, content }),
  });

export const reactStory = (storyId: string, emojiId: string) =>
  interactStory(storyId, 'react', emojiId);

export const shareStory = (storyId: string) =>
  interactStory(storyId, 'share');

/**
 * Tạo tin — server nhận FormData: field `file` lặp lại cho từng ảnh + mảng
 * `captions` khớp theo thứ tự; không có file thì buộc phải có caption (tin chữ).
 * Mỗi file sinh 1 story row. expo/fetch (SDK 57) không chấp nhận part
 * {uri,name,type} — phải đọc Blob thật rồi slice ép Content-Type (giống
 * uploadChatMedia trong api/chat.ts).
 */
export const createStories = async (
  items: StoryDraftItem[],
): Promise<CreateStoryResponseItem[]> => {
  const token = await tokenStorage.getAccessToken();
  const formData = new FormData();

  for (const item of items) {
    if (item.fileUri) {
      const raw = await fetch(item.fileUri);
      if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
      const mimeType = item.mimeType || 'image/jpeg';
      const blob = (await raw.blob()).slice(0, undefined, mimeType);
      formData.append('file', blob, item.fileName || 'story.jpg');
    }
    formData.append('captions', item.caption);
  }

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/stories`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }

  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as CreateStoryResponseItem[]) : [];
};
