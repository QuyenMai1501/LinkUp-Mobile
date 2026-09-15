export interface ViewProfileResponse {
  user_id: string;
  display_name: string;
  phone_number: string;
  date_of_birth?: string;
  avatar_uri: string;
  cover_uri: string;
  username: string;
  post_count: number;
  friend_count: number;
  created_at: string;
  bio: string;
  location: string;
  work: string;
  education: string;
  website: string;
  is_private_profile: boolean;
  is_private_posts: boolean;
  allow_stranger_friend_request: boolean;
  updated_at?: string;
}

export interface FollowStats {
  follower_count: number;
  following_count: number;
  is_following?: boolean;
}

export interface FollowToggleResponse {
  action: string;
  is_following: boolean;
  follower_count: number;
  following_count: number;
  message: string;
}

export interface FollowListItem {
  user_id: string;
  username: string;
  display_name: string;
  avatar_uri: string;
}

export interface FollowListResponse {
  data: FollowListItem[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface MutualFriendsResponse {
  data: {
    user_id: string;
    username: string;
    display_name: string;
    avatar_uri: string;
  }[];
  total: number;
}

export interface FriendStatusResponse {
  status: 'none' | 'sent' | 'received' | 'accepted' | 'self';
  request_id?: string;
}

export interface MediaItem {
  id: string;
  post_id: string;
  file_uri: string;
  file_type: string;
  file_size?: number;
  created_at: string;
}

export interface UserMediaResponse {
  data: MediaItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface UpdateProfileInput {
  display_name?: string;
  avatar_uri?: string;
  cover_uri?: string;
  bio?: string;
  location?: string;
  work?: string;
  education?: string;
  website?: string;
  date_of_birth?: string;
  is_private_profile?: boolean;
  is_private_posts?: boolean;
  allow_stranger_friend_request?: boolean;
}
