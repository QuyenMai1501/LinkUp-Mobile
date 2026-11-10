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
  TrackActionType,
  UpdateAdInput,
} from '@/types/partner';

export interface AdListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
}

export interface AdAnalyticsRange {
  from?: string;
  to?: string;
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

/** Không có GET /ads-management/:id — lấy trang lớn nhất rồi tìm theo id. */
export const getMyAdById = async (
  id: string,
): Promise<PartnerAdListItem | null> => {
  const res = await getMyAds({ page: 1, page_size: 100 });
  return res.ads.find((ad) => ad.id === id) ?? null;
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
  if (input.target_locations !== undefined)
    fd.append('target_locations', JSON.stringify(input.target_locations));
  return fd;
}

async function appendMediaFiles(formData: FormData, media: AdMediaFile[]) {
  for (const file of media) {
    const raw = await fetch(file.uri);
    if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
    const blob = (await raw.blob()).slice(0, undefined, file.type);
    formData.append('media', blob, file.name);
  }
}

async function submitMultipart(
  path: string,
  method: string,
  formData: FormData,
): Promise<{ message?: string; data?: unknown }> {
  const token = await tokenStorage.getAccessToken();
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

/** Tạo ad — multipart flat fields + media (image/video 1 file, carousel 2-6). */
export const createAd = async (
  input: CreateAdInput,
  media: AdMediaFile[] = [],
): Promise<{ message?: string; data?: unknown }> => {
  const formData = buildAdFormData(input);
  await appendMediaFiles(formData, media);
  return submitMultipart('/ads-management', 'POST', formData);
};

/** Sửa ad — multipart flat fields (UpdateAd không nhận file media). */
export const updateAd = (
  id: string,
  input: UpdateAdInput,
): Promise<{ message?: string; data?: unknown }> =>
  submitMultipart(`/ads-management/${id}`, 'PATCH', buildAdFormData(input));

/** Thay toàn bộ media của ad (PUT, field `media` lặp lại). */
export const replaceAdMedia = async (
  id: string,
  media: AdMediaFile[],
): Promise<{ message?: string; data?: unknown }> => {
  const formData = new FormData();
  await appendMediaFiles(formData, media);
  return submitMultipart(`/ads-management/${id}/media`, 'PUT', formData);
};

export const deleteAd = (id: string) =>
  request<unknown>(`/ads-management/${id}`, { method: 'DELETE' });

export const updateAdStatus = (id: string, status: string) =>
  request<unknown>(`/ads-management/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

/** Chỉ ad `rejected` mới gửi duyệt lại được. */
export const submitAdForReview = (id: string) =>
  request<{ message?: string; data?: unknown }>(`/ads-management/${id}/submit`, {
    method: 'POST',
  });

export const getAdAnalytics = async (
  id: string,
  range: AdAnalyticsRange = {},
): Promise<AdPerformance> => {
  const sp = new URLSearchParams();
  if (range.from) sp.set('from', range.from);
  if (range.to) sp.set('to', range.to);
  const qs = sp.toString();
  const res = await request<{ data: AdPerformance }>(
    `/ads-management/${id}/analytics${qs ? `?${qs}` : ''}`,
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

export const trackAdAction = (adId: string, action: TrackActionType) =>
  request<{ status: string; recorded?: boolean }>(
    `/customer/ads/${adId}/track`,
    {
      method: 'POST',
      body: JSON.stringify({ action_type: action }),
    },
  );
