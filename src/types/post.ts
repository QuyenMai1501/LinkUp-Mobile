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
