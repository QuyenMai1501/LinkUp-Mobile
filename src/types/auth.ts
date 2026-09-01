export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PARTNER' | 'USER';

export interface TokenPayload {
  user_id: string;
  email: string;
  role: UserRole;
  token_type: string;
  token_version: number;
}

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  status: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_ttl_in: number;
}

export interface StorageInfo {
  quota_bytes: number;
  used_bytes: number;
  available_bytes: number;
}

export interface AuthResponse {
  user: AuthUserResponse;
  tokens: TokenResponse;
  storage?: StorageInfo;
}

export type RegisterResponse = Omit<AuthResponse, 'tokens'> & {
  tokens?: TokenResponse;
  verify_email?: boolean;
};
