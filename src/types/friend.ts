export interface FriendUser {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  status: string;
}

export interface FriendListResponse {
  data: FriendUser[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface FriendSuggestionUser {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  mutual_count: number;
  mutual_names?: string[];
  _friendStatus?: 'sent';
}

export interface FriendSuggestionsResponse {
  data: FriendSuggestionUser[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface FriendRequestItem {
  id: string;
  user_id: string;
  display_name: string;
  avatar_uri: string;
  status: string;
  created_at: string;
  direction: 'sent' | 'received';
}

export interface FriendRequestListResponse {
  sent: FriendRequestItem[];
  received: FriendRequestItem[];
}

export interface FriendActionResponse {
  status: string;
  message: string;
}
