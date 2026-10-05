import { request } from './client';

export interface UserPresence {
  user_id: string;
  status: 'online' | 'offline';
  last_seen?: string;
}

// POST /api/presence/batch — server trả { data: { [user_id]: UserPresence } }.
export const batchGetPresence = (userIds: string[]) =>
  request<{ data: Record<string, UserPresence> }>('/presence/batch', {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
