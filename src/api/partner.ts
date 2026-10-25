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

type AdFormInput = CreateAdInput | UpdateAdInput;

/**
 * Server CreateAd/UpdateAd đọc PostForm phẳng (title, content, budget, ...)
 * — KHÔNG nhận JSON body. target_locations phải là JSON string.
 */
function buildAdFormData(input: AdFormInput): FormData {
  const fd = new FormData();
  fd.append('title', input.title ?? '');
  fd.append('content', input.content ?? '');
  fd.append('target_url', input.target_url ?? '');
  fd.append('budget', String(input.budget ?? 0));
  fd.append('daily_budget', String(input.daily_budget ?? 0));
  fd.append('cpm_price', String(input.cpm_price ?? 0));
  fd.append('cpc_price', String(input.cpc_price ?? 0));
  fd.append('max_impressions', String(input.max_impressions ?? 0));
  if ('format' in input && input.format) fd.append('format', input.format);
  if (input.started_at) fd.append('started_at', input.started_at);
  if (input.expires_at) fd.append('expires_at', input.expires_at);
  if (input.target_gender) fd.append('target_gender', input.target_gender);
  if (input.target_age_min !== undefined)
    fd.append('target_age_min', String(input.target_age_min));
  if (input.target_age_max !== undefined)
    fd.append('target_age_max', String(input.target_age_max));
  if (input.target_locations?.length)
    fd.append('target_locations', JSON.stringify(input.target_locations));
  return fd;
}

async function submitAdMultipart(
  path: string,
  method: string,
  input: AdFormInput,
  media?: AdMediaFile,
): Promise<{ message?: string; data?: unknown }> {
  const token = await tokenStorage.getAccessToken();
  const formData = buildAdFormData(input);
  if (media) {
    const raw = await fetch(media.uri);
    if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
    const blob = (await raw.blob()).slice(0, undefined, media.type);
    formData.append('media', blob, media.name);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new ApiError(body?.error || body?.message || `HTTP ${res.status}`);
    err.code = body?.error;
    err.serverMessage = body?.message;
    throw err;
  }
  return body;
}

/** Tạo ad — multipart flat fields + media (chỉ CreateAd xử lý file). */
export const createAd = (
  input: CreateAdInput,
  media?: AdMediaFile,
): Promise<{ message?: string; data?: unknown }> =>
  submitAdMultipart('/ads-management', 'POST', input, media);

/** Sửa ad — multipart flat fields (server UpdateAd không nhận file media). */
export const updateAd = (
  id: string,
  input: UpdateAdInput,
): Promise<{ message?: string; data?: unknown }> =>
  submitAdMultipart(`/ads-management/${id}`, 'PATCH', input);

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
