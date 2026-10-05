// Draft chuyển tiếp tin nhắn — lưu ở mức module vì chọn hội thoại đích sẽ
// navigate sang instance MỚI của chat/[chatId] (state trên instance cũ không
// đi theo được). Screen đích "take" draft khi mount / khi chatId đổi.
export interface ForwardDraft {
  chatId: string;
  messageId: string;
  content: string;
  emojiId?: string;
}

let draft: ForwardDraft | null = null;

export function stashForwardDraft(next: ForwardDraft): void {
  draft = next;
}

/** Lấy draft nếu khớp chatId (rút lui ngay khi đọc — tránh take 2 lần). */
export function takeForwardDraft(chatId: string): ForwardDraft | null {
  if (draft && draft.chatId === chatId) {
    const found = draft;
    draft = null;
    return found;
  }
  return null;
}

export function clearForwardDraft(): void {
  draft = null;
}
