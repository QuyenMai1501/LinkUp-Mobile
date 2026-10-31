// Phân loại media preview ở danh sách hội thoại thành 'image' | 'video' | 'gif'.
// Ưu tiên media_type từ server; fallback đoán theo phần mở rộng URL.
// Port từ web utils/chatMediaPreview.ts.
type MediaPreviewSource = {
  media_type?: string | null;
  media_uri?: string | null;
  content?: string;
};

export function mediaPreviewKind(
  msg: MediaPreviewSource,
): 'image' | 'video' | 'gif' | null {
  const mt = (msg.media_type || '').toLowerCase();
  if (mt) {
    if (mt === 'image/gif' || mt.endsWith('/gif')) return 'gif';
    if (mt.startsWith('video/')) return 'video';
    if (mt.startsWith('image/')) return 'image';
  }
  const uri = (msg.media_uri || msg.content || '').toLowerCase();
  const path = uri.replace(/[?#].*$/, '');
  if (path.endsWith('.gif')) return 'gif';
  if (/\.(mp4|webm|mov|avi|mkv|m4v)$/.test(path)) return 'video';
  if (/\.(jpe?g|png|webp|bmp|heic|avif)$/.test(path)) return 'image';
  return null;
}

/** Trả về translation key cho preview media, hoặc null nếu không phải media. */
export function mediaPreviewKey(msg: MediaPreviewSource): string | null {
  const kind = mediaPreviewKind(msg);
  if (kind === 'gif') return 'chat.mediaGif';
  if (kind === 'video') return 'chat.mediaVideo';
  if (kind === 'image') return 'chat.mediaImage';
  return null;
}
