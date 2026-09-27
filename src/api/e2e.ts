import { request, rawRequest } from './client';

export interface UserE2EKey {
  user_id: string;
  public_key: string;
  key_version: number;
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

// Re-key: ghi đè khóa bọc row của MÌNH (không tạo khóa chat mới) sau khi đối
// phương đổi identity — gọi khi mình vẫn giữ khóa chuẩn local.
export const rekeyChat = (chatId: string, wrappedKey: string, nonce: string) =>
  request<{ message?: string }>(`/e2e/chats/${chatId}/keys`, {
    method: 'PATCH',
    body: JSON.stringify({ wrapped_key: wrappedKey, nonce }),
  });

// ── Khôi phục khóa chat trên thiết bị mới (PIN + recovery key) ──────────────

export interface RecoveryMeta {
  has_blob: boolean;
  salt?: string;
  updated_at?: string;
}

export interface PutRecoveryInput {
  salt: string;
  blob: string;
  pin_check: string;
  recovery_check: string;
}

export interface UnlockRecoveryResponse {
  blob: string;
}

// putRecovery lưu backup khóa chat (blob mã hóa + salt + 2 hash check) lên
// server. Được gọi khi bật/đổi PIN trên máy chính.
export const putRecovery = (input: PutRecoveryInput) =>
  request<{ message?: string }>('/e2e/recovery', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

// getRecoveryMeta trả về trạng thái backup (đã có blob chưa + salt cần thiết
// để dẫn khóa giải mã sau khi unlock).
export const getRecoveryMeta = () => request<RecoveryMeta>('/e2e/recovery');

// unlockRecovery gửi giá trị hash check (PIN hoặc recovery key) để nhận blob
// backup. Sai quá 5 lần → server khóa tạm thời (rate-limit tăng dần).
export const unlockRecovery = (check: string) =>
  request<UnlockRecoveryResponse>('/e2e/recovery/unlock', {
    method: 'POST',
    body: JSON.stringify({ check }),
  });

// deleteRecovery xóa backup khôi phục (tắt tính năng trên máy chính).
export const deleteRecovery = () =>
  request<{ message?: string }>('/e2e/recovery', {
    method: 'DELETE',
  });
