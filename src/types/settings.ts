export interface PrivacySettingsResponse {
  discoverable_in_search: boolean;
  allow_stranger_messages: boolean;
}

export interface UpdatePrivacyInput {
  discoverable_in_search?: boolean;
  allow_stranger_messages?: boolean;
}

export interface UserSessionDTO {
  id: string;
  device_name: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  is_current: boolean;
}

export interface SessionsResponse {
  data: UserSessionDTO[];
}

export interface UserStorageInfo {
  quota_bytes: number;
  used_bytes: number;
  avail_bytes: number;
}

export interface AppearanceSettingsResponse {
  theme: ThemeMode;
  language: LanguageCode;
}

export interface UpdateAppearanceInput {
  theme?: ThemeMode;
  language?: LanguageCode;
}

export type ThemeMode = 'light' | 'dark';
export type LanguageCode = 'vi' | 'en';
