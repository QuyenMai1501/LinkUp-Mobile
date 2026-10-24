// Map mediaId → file local URI của phiên này. Echo WS thay temp-N bằng id
// thật làm ô lưới remount; nếu src init lại từ URL server sẽ tải lại + nháy.
// Cache này cho phép remount vẫn hiển thị file local có sẵn (không re-download).
const localUriByMediaId = new Map<string, string>();

export function rememberLocalMediaUri(mediaId: string, localUri: string): void {
  localUriByMediaId.set(mediaId, localUri);
}

export function peekLocalMediaUri(
  mediaId: string | null | undefined,
): string | null {
  if (!mediaId) return null;
  return localUriByMediaId.get(mediaId) ?? null;
}
