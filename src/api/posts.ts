import { request } from './client';
import type { FeedResponse, EmojiItem } from '../types/post';

export const getFeedPosts = (cursor: string | null, pageSize = 10, filter?: string) => {
  const params = new URLSearchParams();
  params.set('page_size', String(pageSize));
  if (cursor) params.set('cursor', cursor);
  if (filter) params.set('filter', filter);
  return request<FeedResponse>(`/posts?${params.toString()}`);
};

export const reactPost = (postId: string, emojiId: string) =>
  request<{ action: string; message: string }>(`/posts/${postId}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji_id: emojiId }),
  });

export const savePost = (postId: string) =>
  request<{ action: string; message: string }>(`/posts/${postId}/save`, {
    method: 'POST',
  });

export const getEmojis = () => request<{ data: EmojiItem[] }>('/emojis');
