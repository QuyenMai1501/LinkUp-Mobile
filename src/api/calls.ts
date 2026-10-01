import { request } from './client';
import type { CallHistoryListResponse, CallType } from '@/types/call';

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

interface IceServersResponse {
  ice_servers?: IceServer[];
}

const FALLBACK_ICE_SERVERS: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export async function getIceServers(): Promise<IceServer[]> {
  try {
    const res = await request<IceServersResponse>('/calls/ice-servers');
    return res.ice_servers && res.ice_servers.length > 0
      ? res.ice_servers
      : FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
}

/** Server không filter theo partner — client tự lọc `other_user.id`. */
export function getCallHistory(
  params: { limit?: number; offset?: number; type?: CallType; status?: string } = {},
): Promise<CallHistoryListResponse> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return request<CallHistoryListResponse>(`/calls/history${qs ? `?${qs}` : ''}`);
}
