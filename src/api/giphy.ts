// ===== GIPHY API client dùng chung (Mobile) — chỉ dùng cho GIF =====
// Emoji đã chuyển sang emojifyi.com (api/emojifyi.ts).
// Các helper URL GIPHY bên dưới GIỮ NGUYÊN cho nội dung cũ đã lưu trong DB
// (post/tin nhắn chứa URL media*.giphy.com) + GIF đính kèm.
// Endpoint GIF đã kiểm chứng: v1/gifs/trending | v1/gifs/search.

export const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';

const GIPHY_API = 'https://api.giphy.com';
const GIPHY_MEDIA = 'https://media.giphy.com';

/** URL chuẩn (ngắn) cho 1 item GIPHY — API trả về URL dài có token v1.Y2lk…, phải chuẩn hóa về dạng này. */
export function giphyMediaUrl(id: string, size = '200w_s.gif'): string {
  return `${GIPHY_MEDIA}/media/${id}/${size}`;
}

/** Chỉ URL canonical ngắn (emoji chèn từ picker): `media/{id}/200w.gif` → `200w_s.gif` (bản still, 1 frame). */
const GIPHY_CANONICAL_RE = /^(https:\/\/media\d?\.giphy\.com\/media\/[^/]+\/)(\d{2,4}w?|giphy)\.gif$/i;

/**
 * Đổi URL emoji GIPHY cũ (ảnh động) sang bản still tĩnh khi render.
 * URL GIF đính kèm dạng token dài (…/media/v1.Y2lk…/{id}/giphy.gif), mp4/webp
 * hoặc đã là `_s.gif` → giữ nguyên.
 */
export function giphyStillUrl(url: string): string {
  const m = url.match(GIPHY_CANONICAL_RE);
  return m ? `${m[1]}${m[2]}_s.gif` : url;
}

/** Nhận diện URL GIPHY trong text nội dung (chat/bài viết). */
const GIPHY_URL_RE = /https?:\/\/(?:media\d?|i)\.giphy\.com\/[^\s]+/gi;

export function isGiphyUrl(url: string): boolean {
  return /https?:\/\/(?:media\d?|i)\.giphy\.com\//i.test(url);
}

/**
 * Chèn khoảng trắng giữa các URL GIPHY bị dính nhau (nội dung cũ được serialize
 * thiếu separator → `url1url2…` bị renderer coi là 1 URL duy nhất).
 * Idempotent — chuỗi đã tách sẽ giữ nguyên.
 */
export function separateGiphyUrls(text: string): string {
  return text.replace(/(\S)(https:\/\/(?:media\d?|i)\.giphy\.com\/)/g, '$1 $2');
}

/** Cắt các URL GIPHY ra khỏi nội dung (trả về text thuần còn lại). */
export function stripGiphyUrls(text: string): string {
  return text.replace(GIPHY_URL_RE, '').replace(/\s+/g, ' ').trim();
}

/** Tìm URL GIPHY đầu tiên trong nội dung. */
export function firstGiphyUrl(text: string): string | null {
  const m = text.match(GIPHY_URL_RE);
  return m ? m[0] : null;
}

/** True nếu toàn bộ nội dung chỉ gồm 1 URL GIPHY (+ khoảng trắng). */
export function isSingleGiphyUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  GIPHY_URL_RE.lastIndex = 0;
  const m = GIPHY_URL_RE.exec(trimmed);
  if (!m || m[0] !== trimmed) return false;
  return stripGiphyUrls(trimmed) === '';
}

export interface GiphyGif {
  id: string;
  preview: string;
  full: string;
  title?: string;
  preview_width?: number;
  preview_height?: number;
}

interface GiphyImage {
  url: string;
  width?: string;
  height?: string;
}

interface GiphyImages {
  fixed_width?: GiphyImage;
  fixed_width_small?: GiphyImage;
  fixed_width_still?: GiphyImage;
  fixed_width_small_still?: GiphyImage;
  fixed_height_small_still?: GiphyImage;
  original?: GiphyImage;
  preview_gif?: GiphyImage;
}

interface GiphyResult {
  id: string;
  title?: string;
  images: GiphyImages;
}

interface GiphyListResponse {
  data: GiphyResult[];
  pagination?: {
    count?: number;
    offset?: number;
    total_count?: number;
    next_cursor?: number;
  };
}

function toGif(r: GiphyResult): GiphyGif | null {
  const preview = r.images.fixed_width?.url ?? r.images.original?.url;
  const full = r.images.original?.url ?? r.images.fixed_width?.url;
  if (!preview || !full) return null;
  const fw = r.images.fixed_width;
  return {
    id: r.id,
    preview,
    full,
    title: r.title,
    preview_width: fw?.width ? Number(fw.width) : undefined,
    preview_height: fw?.height ? Number(fw.height) : undefined,
  };
}

async function giphyGet(path: string, params: Record<string, string>): Promise<GiphyListResponse> {
  if (!GIPHY_KEY) return { data: [] };
  const url = new URL(`${GIPHY_API}${path}`);
  url.searchParams.set('api_key', GIPHY_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  return (await res.json()) as GiphyListResponse;
}

// ===== GIF =====

// Cache trending theo phiên — tránh gọi lại GIPHY mỗi lần mở picker.
let trendingCache: GiphyGif[] | null = null;

export async function fetchGiphyGifs(opts: { q?: string; limit?: number } = {}): Promise<GiphyGif[]> {
  const query = opts.q?.trim();
  const limit = String(opts.limit ?? 24);
  if (query) {
    const data = await giphyGet('/v1/gifs/search', { q: query, limit, rating: 'g' });
    return data.data.map(toGif).filter((g): g is GiphyGif => g !== null);
  }
  if (trendingCache) return trendingCache;
  const data = await giphyGet('/v1/gifs/trending', { limit, rating: 'g' });
  const items = data.data.map(toGif).filter((g): g is GiphyGif => g !== null);
  trendingCache = items;
  return items;
}

/** Đọc cache trending hiện có (không fetch) — để picker hiển thị ngay khi còn cache. */
export function peekGiphyGifCache(): GiphyGif[] | null {
  return trendingCache;
}
