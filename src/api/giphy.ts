// ===== GIPHY API client dùng chung (Mobile) =====
// Endpoint đã kiểm chứng thực tế:
//  - v2/emoji      : browse catalog emoji (q BỊ BỎ QUA -> chỉ dùng offset pagination, limit max 50)
//  - v1/stickers/search : tìm kiếm emoji/sticker (q hoạt động tốt)
//  - v1/gifs/trending | v1/gifs/search : GIF

export const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';

const GIPHY_API = 'https://api.giphy.com';
const GIPHY_MEDIA = 'https://media.giphy.com';

/** URL chuẩn (ngắn) cho 1 item GIPHY — API trả về URL dài có token v1.Y2lk…, phải chuẩn hóa về dạng này. */
export function giphyMediaUrl(id: string, size = '200w.gif'): string {
  return `${GIPHY_MEDIA}/media/${id}/${size}`;
}

/** Nhận diện URL GIPHY trong text nội dung (chat/bài viết). */
const GIPHY_URL_RE = /https?:\/\/(?:media\d?|i)\.giphy\.com\/[^\s]+/gi;

export function isGiphyUrl(url: string): boolean {
  return /https?:\/\/(?:media\d?|i)\.giphy\.com\//i.test(url);
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

export interface GiphyEmoji {
  id: string;
  title: string;
  /** URL đưa vào nội dung (200x200, đủ nét cho bubble lớn). */
  url: string;
  /** Ảnh nhỏ cho lưới picker (100x100, ~17KB). */
  preview: string;
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

function toEmoji(r: GiphyResult): GiphyEmoji {
  return {
    id: r.id,
    title: r.title ?? '',
    // URL canonical 200w để chèn vào nội dung (đã verify hoạt động cho mọi id).
    url: giphyMediaUrl(r.id),
    // Ảnh nhỏ cho lưới picker — lấy từ API (đảm bảo đúng); fallback URL canonical.
    preview: r.images.preview_gif?.url ?? r.images.fixed_width_small?.url ?? giphyMediaUrl(r.id),
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

// ===== Emoji =====

export interface FetchEmojisResult {
  items: GiphyEmoji[];
  hasMore: boolean;
}

export async function fetchGiphyEmojis(
  opts: { q?: string; offset?: number } = {},
): Promise<FetchEmojisResult> {
  const query = opts.q?.trim();
  const offset = opts.offset ?? 0;
  if (query) {
    // v2/emoji bỏ qua q -> dùng stickers/search cho phần tìm kiếm
    const data = await giphyGet('/v1/stickers/search', {
      q: query,
      limit: '24',
      offset: String(offset),
      rating: 'g',
    });
    const items = data.data.map(toEmoji);
    const total = data.pagination?.total_count ?? 0;
    const count = data.pagination?.count ?? items.length;
    return { items, hasMore: offset + count < total };
  }
  const data = await giphyGet('/v2/emoji', {
    limit: '50',
    offset: String(offset),
  });
  const items = data.data.map(toEmoji);
  const next = data.pagination?.next_cursor;
  return { items, hasMore: items.length > 0 && next !== undefined && next > 0 };
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
