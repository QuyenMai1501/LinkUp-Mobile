// ===== Nhận diện URL emojifyi (cdn.emojifyi.com) trong nội dung CŨ =====
// Emoji hiện tại lấy từ DB server (GET /emojis — api/posts.ts) và render native
// bằng `character`. File này chỉ giữ helper nhận diện URL legacy đã lưu trong DB
// (mirror web utils/emojifyi.ts) — KHÔNG còn fetch API emojifyi.

const EMOJIFYI_URL_RE = /https?:\/\/cdn\.emojifyi\.com\/images\/platforms\/[^\s]+/gi;

export function isEmojifyiUrl(url: string): boolean {
  return /https?:\/\/cdn\.emojifyi\.com\/images\/platforms\//i.test(url);
}

/** Cắt các URL emojifyi ra khỏi nội dung (trả về text thuần còn lại). */
export function stripEmojifyiUrls(text: string): string {
  return text.replace(EMOJIFYI_URL_RE, '').replace(/\s+/g, ' ').trim();
}

/** True nếu toàn bộ nội dung chỉ gồm 1 URL emojifyi (+ khoảng trắng). */
export function isSingleEmojifyiUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  EMOJIFYI_URL_RE.lastIndex = 0;
  const m = EMOJIFYI_URL_RE.exec(trimmed);
  if (!m || m[0] !== trimmed) return false;
  return stripEmojifyiUrls(trimmed) === '';
}
