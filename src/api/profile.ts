import { request } from './client';

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
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const res = await fetch(`${request.toString()}/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

export const getUserMedia = (userId: string, page = 1, pageSize = 18) =>
  request<UserMediaResponse>(
    `/posts/user/${userId}/media?page=${page}&page_size=${pageSize}`,
  );
