import { request } from './client';

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
