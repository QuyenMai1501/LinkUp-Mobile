import { API_BASE, request } from './client';
import { tokenStorage } from './token-storage';
import type {
  FeedPost,
  FeedResponse,
  EmojiItem,
  CommentListResponse,
  CreateCommentResponse,
  CreatePostInput,
  CreatePostResponse,
  CommentSort,
} from '../types/post';

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

export const getUserPosts = (userId: string, cursor: string | null, pageSize = 10) => {
  const params = new URLSearchParams();
  params.set('page_size', String(pageSize));
  if (cursor) params.set('cursor', cursor);
  return request<FeedResponse>(`/posts/user/${userId}?${params.toString()}`);
};

export const getSavedPosts = (cursor: string | null, pageSize = 10) => {
  const params = new URLSearchParams();
  params.set('page_size', String(pageSize));
  if (cursor) params.set('cursor', cursor);
  return request<FeedResponse>(`/posts/saved?${params.toString()}`);
};

export const pinPost = (postId: string) =>
  request<{ message: string }>(`/posts/${postId}/pin`, {
    method: 'POST',
  });

export const unpinPost = (postId: string) =>
  request<{ message: string }>(`/posts/${postId}/pin`, {
    method: 'DELETE',
  });

export const getPostDetail = (postId: string) =>
  request<{ data: FeedPost }>(`/posts/${postId}`);

export const getComments = (
  postId: string,
  page: number,
  pageSize: number,
  sort: CommentSort = 'newest',
) =>
  request<CommentListResponse>(
    `/posts/${postId}/comments?page=${page}&page_size=${pageSize}&sort=${sort}`,
  );

export const createComment = (postId: string, content: string, parentId?: string) =>
  request<CreateCommentResponse>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parent_id: parentId }),
  });

export const toggleCommentReaction = (commentId: string, emojiId: string) =>
  request<{ action: string }>(`/posts/comments/${commentId}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji_id: emojiId }),
  });

export const sharePost = (postId: string, content?: string) =>
  request<{ message: string }>(`/posts/${postId}/share`, {
    method: 'POST',
    body: JSON.stringify({ content: content ?? '' }),
  });

export const deletePost = (postId: string) =>
  request<{ message: string }>(`/posts/${postId}`, {
    method: 'DELETE',
  });

export const createPost = async ({ title, content, status, mediaUris = [], gifUrl, communityId }: CreatePostInput): Promise<CreatePostResponse> => {
  const token = await tokenStorage.getAccessToken();
  const formData = new FormData();

  if (title) formData.append('title', title);
  if (content) formData.append('content', content);
  if (status) formData.append('status', status);
  if (gifUrl) formData.append('gif_url', gifUrl);
  if (communityId) formData.append('community_id', communityId);

  for (const file of mediaUris) {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    formData.append('media', blob, file.name);
  }

  const res = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }

  return (await res.json()) as CreatePostResponse;
};
