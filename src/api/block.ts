import { request } from './client';

export const blockUser = (userId: string) =>
  request<{ message: string }>(`/blocks`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
