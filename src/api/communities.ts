import { request, API_BASE, ApiError } from './client';
import { tokenStorage } from './token-storage';
import type {
  CommunityDetail,
  CommunityInviteCode,
  CommunityJoinRequest,
  CommunityListResponse,
  CommunityMember,
  CommunityPostsResponse,
  CommunityPrivacy,
  CommunityRule,
  CreateCommunityResponse,
  JoinCommunityResponse,
  ManageableRole,
  RuleCategory,
} from '@/types/community';

/**
 * Ưu tiên message tiếng Việt của server cho UI; fallback về error code/HTTP.
 * Server community trả HTTP 400 cho gần như mọi lỗi — KHÔNG branch theo status.
 */
export const communityErrorText = (err: unknown, fallback: string): string => {
  if (err instanceof ApiError && err.serverMessage) return err.serverMessage;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

// --- Danh sách ---
export const listCommunities = (page = 1, keyword?: string, pageSize = 20) =>
  request<CommunityListResponse>(
    `/communities${qs({ page, page_size: pageSize, keyword })}`,
  );

export const listJoinedCommunities = (page = 1, keyword?: string, pageSize = 20) =>
  request<CommunityListResponse>(
    `/communities/joined${qs({ page, page_size: pageSize, keyword })}`,
  );

export const listCreatedCommunities = (page = 1, keyword?: string, pageSize = 20) =>
  request<CommunityListResponse>(
    `/communities/created${qs({ page, page_size: pageSize, keyword })}`,
  );

export const getCommunityDetail = (id: string) =>
  request<CommunityDetail>(`/communities/${id}`);

/**
 * Bài viết trong community — cursor `"<RFC3339Nano created_at>,<post_id>"`
 * (server lấy timestamp của post hoặc nhận thẳng post id). Response KHÔNG có
 * next_cursor — người gọi tự lấy từ bài cuối (`posts.at(-1)`).
 */
export const getCommunityPosts = (id: string, cursor?: string, pageSize = 10) =>
  request<CommunityPostsResponse>(
    `/communities/${id}/posts${qs({ cursor, page_size: pageSize })}`,
  );

// --- Tạo cộng đồng (multipart) ---
export interface CreateCommunityAsset {
  uri: string;
  fileName: string;
  mimeType: string;
}

export const createCommunity = async (input: {
  name: string;
  description?: string;
  privacy: CommunityPrivacy;
  autoApprove: boolean;
  avatar?: CreateCommunityAsset | null;
  background?: CreateCommunityAsset | null;
}): Promise<CreateCommunityResponse> => {
  const token = await tokenStorage.getAccessToken();
  const formData = new FormData();
  formData.append('name', input.name);
  if (input.description) formData.append('description', input.description);
  formData.append('privacy', input.privacy);
  formData.append('auto_approve', input.autoApprove ? 'true' : 'false');

  // expo/fetch (SDK 57) không chấp nhận part {uri,name,type} — đọc Blob thật
  // rồi slice ép Content-Type (giống createStories trong api/story.ts).
  const appendFile = async (field: string, asset: CreateCommunityAsset) => {
    const raw = await fetch(asset.uri);
    if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
    const mimeType = asset.mimeType || 'image/jpeg';
    const blob = (await raw.blob()).slice(0, undefined, mimeType);
    formData.append(field, blob, asset.fileName || `${field}.jpg`);
  };
  if (input.avatar) await appendFile('avatar', input.avatar);
  if (input.background) await appendFile('background', input.background);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/communities`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new ApiError(body?.error || body?.message || `HTTP ${res.status}`);
    err.code = body?.error;
    err.serverMessage = body?.message;
    throw err;
  }
  return (await res.json()) as CreateCommunityResponse;
};

// --- Cài đặt cộng đồng (admin) ---
export const updateCommunity = (
  id: string,
  fields: {
    name?: string;
    description?: string | null;
    privacy?: CommunityPrivacy;
    auto_approve?: boolean;
  },
) =>
  request<{ message: string }>(`/communities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });

// --- Tham gia / rời ---
/**
 * Join: public + auto_approve → member ngay; auto_approve=false → pending
 * (response có `request_id`). Có `code` (đúng 6 ký tự) → vào luôn.
 * invitation_only yêu cầu invitation_id (Web chưa có UI — bỏ qua ở mobile).
 */
export const joinCommunity = (id: string, code?: string) =>
  request<JoinCommunityResponse>(`/communities/${id}/join`, {
    method: 'POST',
    body: JSON.stringify(code ? { code } : {}),
  });

export const leaveCommunity = (id: string) =>
  request<{ message: string }>(`/communities/${id}/leave`, {
    method: 'DELETE',
    body: JSON.stringify({ quiet: false }),
  });

// --- Thành viên ---
export const getCommunityMembers = (id: string) =>
  request<{ members: CommunityMember[] }>(`/communities/${id}/members`);

export const updateMemberRole = (id: string, memberId: string, role: ManageableRole) =>
  request<{ message: string }>(`/communities/${id}/members/${memberId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });

export const kickMember = (id: string, memberId: string, reason: string) =>
  request<{ message: string }>(`/communities/${id}/members/${memberId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });

// --- Nội quy ---
export const getCommunityRules = (id: string) =>
  request<{ rules: CommunityRule[] }>(`/communities/${id}/rules`);

export const createCommunityRule = (
  id: string,
  rule: { category: RuleCategory; title: string; content?: string; position?: number },
) =>
  request<{ message: string; rule_id: string }>(`/communities/${id}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });

export const updateCommunityRule = (
  id: string,
  ruleId: string,
  rule: { category?: RuleCategory; title?: string; content?: string; position?: number },
) =>
  request<{ message: string; rule_id: string }>(`/communities/${id}/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
  });

export const deleteCommunityRule = (id: string, ruleId: string) =>
  request<{ message: string }>(`/communities/${id}/rules/${ruleId}`, { method: 'DELETE' });

// --- Yêu cầu tham gia (admin) ---
export const listJoinRequests = (id: string) =>
  request<{ requests: CommunityJoinRequest[] }>(`/communities/${id}/join-requests`);

export const approveJoinRequest = (id: string, requestId: string) =>
  request<{ message: string }>(`/communities/${id}/join-requests/${requestId}/approve`, {
    method: 'PUT',
  });

export const rejectJoinRequest = (id: string, requestId: string) =>
  request<{ message: string }>(`/communities/${id}/join-requests/${requestId}/reject`, {
    method: 'PUT',
  });

// --- Mã mời (admin) ---
export const createInviteCode = (id: string, maxUses = 0) =>
  request<CommunityInviteCode>(`/communities/${id}/invite-codes`, {
    method: 'POST',
    body: JSON.stringify({ max_uses: maxUses }),
  });

/** Server trả MẢNG TRẦN (không bọc key). */
export const listInviteCodes = (id: string) =>
  request<CommunityInviteCode[]>(`/communities/${id}/invite-codes`);

export const deactivateInviteCode = (id: string, codeId: string) =>
  request<{ message: string }>(`/communities/${id}/invite-codes/${codeId}`, {
    method: 'DELETE',
  });

// --- Chuyển quyền sở hữu (creator) ---
export const transferOwnership = (id: string, targetUserId: string, keepAdmin = false) =>
  request<{ message: string }>(`/communities/${id}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId, keep_admin: keepAdmin }),
  });
