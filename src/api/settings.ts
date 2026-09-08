import { request } from './client';
import type {
  AppearanceSettingsResponse,
  PrivacySettingsResponse,
  SessionsResponse,
  UpdateAppearanceInput,
  UserStorageInfo,
} from '../types/settings';

export const getPrivacy = () =>
  request<PrivacySettingsResponse>('/settings/privacy');

export const updatePrivacy = (input: Record<string, boolean>) =>
  request<PrivacySettingsResponse>('/settings/privacy', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const getStorage = () =>
  request<UserStorageInfo>('/settings/storage');

export const getAppearance = () =>
  request<AppearanceSettingsResponse>('/settings/appearance');

export const updateAppearance = (input: UpdateAppearanceInput) =>
  request<AppearanceSettingsResponse>('/settings/appearance', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const getSessions = () =>
  request<SessionsResponse>('/settings/sessions');

export const revokeSession = (id: string) =>
  request<{ message: string }>(`/settings/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const revokeOtherSessions = () =>
  request<{ message: string }>('/settings/sessions/revoke-others', {
    method: 'POST',
  });

export const deactivateAccount = (password: string) =>
  request<{ message: string }>('/settings/deactivate', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
