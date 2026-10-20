// Mirror Web types/index.ts (Stories section) — contract với server routes/story.routes.go.

export interface StoryItem {
  id: string;
  user_id: string;
  display_name: string;
  avatar_uri: string;
  media_uri: string;
  media_type: 'image' | 'video';
  caption: string;
  created_at: string;
  expires_at?: string;
  has_viewed: boolean;
}

export interface StoryFeedItem {
  user: {
    id: string;
    display_name: string;
    avatar_uri: string;
  };
  stories: StoryItem[];
}

export interface StoryAnalyticsViewer {
  user_id: string;
  display_name?: string;
  avatar_uri?: string;
  viewed_at: string;
  react_type?: string;
  emoji_id?: string;
  click_count: number;
  messages: string[];
}

export interface StoryAnalytics {
  story_id: string;
  total_views: number;
  total_reacts: number;
  total_replies: number;
  total_shares: number;
  viewers: StoryAnalyticsViewer[];
}

/** Item đầu vào khi tạo tin (multipart — fileUri rỗng = tin chữ). */
export interface StoryDraftItem {
  fileUri?: string;
  fileName?: string;
  mimeType?: string;
  caption: string;
}

export interface CreateStoryResponseItem {
  id: string;
  media_uri: string;
  media_type: string;
  caption: string;
  created_at: string;
  expires_at: string;
}
