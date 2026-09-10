import Constants from 'expo-constants';

import { tokenStorage } from './token-storage';
import type { TokenResponse } from '../types/auth';

/**
 * Backend base URL resolution:
 * 1. EXPO_PUBLIC_API_URL env override (create a `.env` with `EXPO_PUBLIC_API_URL=http://<host>:8080/api`).
 * 2. Derived from the Metro dev-server host (expo-constants hostUri) on port 8080.
 *
 * Gotchas:
 * - Android emulator cannot reach `localhost` — use `10.0.2.2` instead.
 * - A physical device needs the host machine's LAN IP (the hostUri fallback handles this).
 */
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const API_BASE = (ENV_API_URL ?? (metroHost ? `http://${metroHost}:8080/api` : 'http://localhost:8080/api')).replace(
  /\/$/,
  '',
);

async function getAccessToken(): Promise<string | null> {
  const token = await tokenStorage.getAccessToken();
  return token;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

// --- Token refresh mutex ---
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

async function tryRefreshToken(): Promise<string> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) throw new Error('Refresh failed');

  const data: TokenResponse = await res.json();
  const user = await tokenStorage.getUser();
  await tokenStorage.save(data.access_token, data.refresh_token, user!);
  return data.access_token;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401 (skip for auth endpoints to avoid infinite loop)
  if (res.status === 401 && !path.startsWith('/auth/')) {
    try {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = tryRefreshToken();
      }
      const newToken = await refreshPromise!;
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    } catch {
      await tokenStorage.clear();
      throw new Error('Phiên đăng nhập đã hết hạn');
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }

  if (!res.ok) {
    const body: ApiErrorBody | null = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
