import { request, rawRequest } from './client';

export interface UserE2EKey {
  user_id: string;
  public_key: string;
}

export interface ChatE2EKey {
  chat_id: string;
  wrapped_key: string;
  nonce: string;
}

export interface ChatE2EKeyInput {
  chat_id: string;
  user_id: string;
  wrapped_key: string;
  nonce: string;
}

export const registerUserKey = (publicKey: string) =>
  request<{ message?: string }>('/e2e/keys', {
    method: 'PUT',
    body: JSON.stringify({ public_key: publicKey }),
  });

export const getUserKey = (userId: string) =>
  request<UserE2EKey>(`/e2e/keys/${userId}`);

export const storeChatKeys = (keys: ChatE2EKeyInput[]) =>
  request<{ message?: string }>('/e2e/chats/keys', {
    method: 'POST',
    body: JSON.stringify({ keys }),
  });

export const getChatKey = async (chatId: string): Promise<ChatE2EKey | null> => {
  const res = await rawRequest(`/e2e/chats/${chatId}/keys`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get chat key failed: ${res.status}`);
  return (await res.json()) as ChatE2EKey;
};
