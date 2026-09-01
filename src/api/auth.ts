import { request } from './client';

import type { AuthResponse, RegisterResponse, TokenPayload, TokenResponse } from '@/types/auth';

export const login = (email: string, password: string) =>
  request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const register = (displayName: string, email: string, password: string) =>
  request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName, email, password }),
  });

export const refresh = (refreshToken: string) =>
  request<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

export const forgotPassword = (email: string) =>
  request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as Partial<TokenPayload>;
    if (!payload.user_id || !payload.role) return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
