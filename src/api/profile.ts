import { API_BASE, request } from './client';
import { tokenStorage } from './token-storage';

import type {
  ViewProfileResponse,
  UpdateProfileInput,
  UserMediaResponse,
} from '../types/profile';

export const getMyProfile = () =>
  request<ViewProfileResponse>('/profile');

export const getProfileByUserID = (userId: string) =>
  request<ViewProfileResponse>(`/profile/${userId}`);

export const updateProfile = (input: UpdateProfileInput) =>
  request<{ message: string; data: ViewProfileResponse }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const uploadMedia = async (fileUri: string, fileName: string, mimeType: string) => {
  const token = await tokenStorage.getAccessToken();

  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  const formData = new FormData();
  formData.append('file', blob, fileName);

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }

  return res.json();
};

export const getUserMedia = (userId: string, page = 1, pageSize = 18) =>
  request<UserMediaResponse>(
    `/posts/user/${userId}/media?page=${page}&page_size=${pageSize}`,
  );
