import type { TokenResponse } from './auth';

/** Trạng thái ad (chuẩn hóa theo server; list partner trả `status` string). */
export type AdStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'pending'
  | 'rejected';

/** File media cho form tạo ad (Expo image picker — khác web File). */
export interface AdMediaFile {
  uri: string;
  name: string;
  type: string;
}

export interface PartnerAdListItem {
  id: string;
  title: string;
  status: string;
  budget: number;
  total_spent: number;
  impressions: number;
  clicks: number;
  ctr: number;
  media_uri: string;
  started_at?: string;
  expires_at?: string;
  created_at: string;
  rejection_reason?: string;
}

export interface PartnerAdListResponse {
  ads: PartnerAdListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdOverview {
  total_budget: number;
  total_spent: number;
  remaining_budget: number;
  impressions: number;
  clicks: number;
  ctr: number;
  active_ads: number;
  slots_used: number;
  max_slots: number;
  subscription_name: string;
  expires_at?: string;
}

export interface AdPerformance {
  ad_id: string;
  title: string;
  status: string;
  format: string;
  budget: number;
  daily_budget: number;
  total_spent: number;
  remaining_budget: number;
  impressions: number;
  unique_reach: number;
  clicks: number;
  interactions: number;
  ctr: number;
  cost_per_click: number;
  cost_per_thousand_impressions: number;
  video_starts?: number;
  video_completions?: number;
  started_at?: string;
  expires_at?: string;
}

export interface AdPackage {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  max_slots: number;
  max_duration_days: number;
  supports_video: boolean;
  supports_carousel: boolean;
  has_advanced_analytics: boolean;
  sort_order: number;
  created_at: string;
}

export interface SubscriptionResponse {
  id: string;
  package_name: string;
  max_slots: number;
  slots_used: number;
  slots_left: number;
  price_monthly: number;
  started_at: string;
  expires_at: string;
  status: string;
}

/** Kết quả POST /ads-management/subscribe — server tái phát hành token khi nâng role. */
export interface SubscribeResult {
  data: SubscriptionResponse;
  tokens?: TokenResponse;
}

export interface CreateAdInput {
  title: string;
  content: string;
  format: string;
  target_url: string;
  budget: number;
  daily_budget: number;
  cpm_price: number;
  cpc_price: number;
  max_impressions: number;
  started_at?: string;
  expires_at?: string;
  target_gender?: string;
  target_age_min?: number;
  target_age_max?: number;
  target_locations?: string[];
}

export interface UpdateAdInput {
  title?: string;
  content?: string;
  target_url?: string;
  budget?: number;
  daily_budget?: number;
  cpm_price?: number;
  cpc_price?: number;
  max_impressions?: number;
  started_at?: string;
  expires_at?: string;
  target_gender?: string;
  target_age_min?: number;
  target_age_max?: number;
  target_locations?: string[];
}

/** Card quảng cáo chèn vào feed (GET /customer/feed → {data}). */
export interface FeedAd {
  id: string;
  title: string;
  content: string;
  target_url: string;
  media_uri: string;
  format: string;
}
