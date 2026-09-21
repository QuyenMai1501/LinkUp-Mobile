export interface FeedMedia {
  id: string;
  user_id: string;
  post_id?: string;
  file_uri: string;
  file_type: string;
  file_size?: number;
  status?: string;
  review_reason?: string;
  created_at?: string;
}

export interface FeedPost {
  id: string;
  user_id: string;
  community_id?: string;
  username: string;
  display_name: string;
  avatar_uri: string;
  title: string;
  content: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  status: string;
  created_at: string;
  updated_at?: string;
  media: FeedMedia[];
  is_liked: boolean;
  is_saved: boolean;
  is_shared: boolean;
  is_following: boolean;
  is_pinned: boolean;
  pinned_at?: string;
  shared_from_post_id?: string;
  share_content?: string;
  shared_post?: FeedPost;
}

export interface FeedResponse {
  page_size: number;
  next_cursor: string | null;
  data: FeedPost[];
}

export interface EmojiItem {
  id: string;
  code: string;
  image_uri: string;
}

export interface CommentItem {
  id: string;
  user_id: string;
  post_id: string;
  parent_id?: string;
  username: string;
  display_name: string;
  avatar_uri: string;
  content: string;
  status: string;
  likes_count: number;
  is_liked: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CommentListResponse {
  page: number;
  page_size: number;
  total: number;
  data: CommentItem[];
}

export interface CreateCommentResponse {
  message: string;
  data: CommentItem[];
}

export type CommentSort = 'newest' | 'oldest' | 'relevant';

export type PostStatus = 'public' | 'friend' | 'private' | 'hidden';

export interface CreatePostInput {
  title: string;
  content: string;
  status: PostStatus;
  mediaUris?: { uri: string; type: string; name: string }[];
  gifUrl?: string;
  communityId?: string;
}

export interface CreatePostResponse {
  data: FeedPost;
}
