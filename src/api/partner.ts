import { API_BASE, ApiError, request } from './client';
import { tokenStorage } from './token-storage';
import type {
  AdMediaFile,
  AdOverview,
  AdPerformance,
  CreateAdInput,
  FeedAd,
  PartnerAdListItem,
  PartnerAdListResponse,
  UpdateAdInput,
} from '@/types/partner';

export interface AdListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
}

export const getMyAds = async (
  params: AdListParams = {},
): Promise<PartnerAdListResponse> => {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.page_size) sp.set('page_size', String(params.page_size));
  if (params.keyword) sp.set('keyword', params.keyword);
  if (params.status) sp.set('status', params.status);
  const qs = sp.toString();
  const res = await request<{
    data: PartnerAdListItem[];
    total?: number;
    page?: number;
    page_size?: number;
  }>(`/ads-management${qs ? `?${qs}` : ''}`);
  const ads = res.data ?? [];
  return {
    ads,
    total: res.total ?? ads.length,
    page: res.page ?? 1,
    page_size: res.page_size ?? ads.length,
  };
};

/**
 * Tạo ad — multipart `data` (JSON) + `media` (file). Không đi qua `request()`
 * vì nó luôn set Content-Type: application/json; và expo/fetch không nhận
 * part {uri,name,type} — phải đọc Blob thật (cùng pattern uploadChatMedia).
 */
export const createAd = async (
  input: CreateAdInput,
  media?: AdMediaFile,
): Promise<{ id: string }> => {
  const token = await tokenStorage.getAccessToken();

  const formData = new FormData();
  formData.append('data', JSON.stringify(input));
  if (media) {
    const raw = await fetch(media.uri);
    if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
    const blob = (await raw.blob()).slice(0, undefined, media.type);
    formData.append('media', blob, media.name);
  }

  const res = await fetch(`${API_BASE}/ads-management`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new ApiError(body?.error || body?.message || `HTTP ${res.status}`);
    err.code = body?.error;
    err.serverMessage = body?.message;
    throw err;
  }
  return res.json();
};

export const updateAd = (id: string, input: UpdateAdInput) =>
  request<unknown>(`/ads-management/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteAd = (id: string) =>
  request<unknown>(`/ads-management/${id}`, { method: 'DELETE' });

export const updateAdStatus = (id: string, status: string) =>
  request<unknown>(`/ads-management/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const getAdAnalytics = async (id: string): Promise<AdPerformance> => {
  const res = await request<{ data: AdPerformance }>(
    `/ads-management/${id}/analytics`,
  );
  return res.data;
};

export const getOverview = async (): Promise<AdOverview> => {
  const res = await request<{ data: AdOverview }>('/ads-management/overview');
  return res.data;
};

/** Server: GET /api/customer/feed → { data: FeedAd[] } (Auth required). */
export const getFeedAds = async (): Promise<FeedAd[]> => {
  const res = await request<{ data: FeedAd[] }>('/customer/feed');
  return res.data ?? [];
};

export const trackAdAction = (adId: string, action: 'impression' | 'click') =>
  request<{ status: string }>(`/customer/ads/${adId}/track`, {
    method: 'POST',
    body: JSON.stringify({ action_type: action }),
  });
