export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_uri: string;
}

export interface PostSearchResult {
  id: string;
  title: string;
  user_id: string;
  username: string;
  created_at: string;
  /** Thumbnail ảnh bìa bài (server trả khi có media image). */
  thumbnail_uri?: string;
  /** Số video trong bài — hiển thị badge (mirror web search page). */
  video_count?: number;
}

export interface HashtagSearchResult {
  name: string;
  post_count: number;
}

export interface CommunitySearchResult {
  id: string;
  name: string;
  avatar_uri: string;
  member_count: number;
  privacy: string;
}

export interface SearchResponse {
  users?: UserSearchResult[];
  posts?: PostSearchResult[];
  hashtags?: HashtagSearchResult[];
  communities?: CommunitySearchResult[];
  message?: string;
}
