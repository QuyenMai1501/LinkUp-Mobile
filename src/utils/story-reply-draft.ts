// Draft trả lời story — cùng pattern với utils/forward-draft.ts: navigate sang
// instance MỚI của chat/[chatId] nên state không truyền trực tiếp được. Screen
// chat "take" draft khi mount / khi chatId đổi và prefill vào composer.
export interface StoryReplyDraft {
  chatId: string;
  text: string;
}

let draft: StoryReplyDraft | null = null;

export function stashStoryReplyDraft(next: StoryReplyDraft): void {
  draft = next;
}

/** Lấy draft nếu khớp chatId (rút lui ngay khi đọc — tránh take 2 lần). */
export function takeStoryReplyDraft(chatId: string): StoryReplyDraft | null {
  if (draft && draft.chatId === chatId) {
    const found = draft;
    draft = null;
    return found;
  }
  return null;
}

export function clearStoryReplyDraft(): void {
  draft = null;
}
