import Constants from 'expo-constants';

import { tokenStorage } from './token-storage';

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

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body: ApiErrorBody | null = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}
