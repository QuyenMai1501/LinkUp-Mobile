// ===== EmojiFYI (emojifyi.com) — emoji API client (Mobile) =====
// Endpoint đã kiểm chứng thực tế (khác với docs của họ):
//  - /api/search/?q=        : tìm emoji, tối đa 50 kq, KHÔNG pagination.
//                             Trả {results:[{character,cldr_name,slug,codepoint,category}]}
//  - /api/categories/       : {count, categories:[{slug,name,icon,emoji_count}]}
//  - /api/category/{slug}/  : {category,slug,icon,emojis:[{character,cldr_name,slug}]}
//                             slug thật là "smileys-and-emotion" (docs ghi sai "smileys-emotion")
//  - Ảnh: https://cdn.emojifyi.com/images/platforms/noto/emoji_u{codepoints}.png
//    (endpoint /api/emoji-image/{slug}/{platform}.{fmt} theo docs trả 404 — KHÔNG dùng)
//    codepoints: viết thường, zero-pad >= 4 hex, nối bằng "_", BỎ fe0f
//    (đã verify: fe0f trong tên file -> 404; vd ❤️ -> emoji_u2764.png, #️⃣ -> emoji_u0023_20e3.png)
//    NÊN dùng platform "noto" — nền twemoji đặt tên thất thường (fe0f giữ/bỏ không đều,
//    vd couple-with-heart giữ fe0f còn eye-in-speech-bubble bỏ), không suy ra được rule chung.
//    CDN trả Cache-Control: public, max-age=31536000, immutable.
// Rate limit 60 req/phút/IP + CORS '*' -> mọi fetch đều qua cache module-level.

const EMOJIFYI_API = 'https://emojifyi.com/api';
const EMOJIFYI_CDN = 'https://cdn.emojifyi.com/images/platforms';

export interface EmojiOption {
  /** slug emojifyi (vd "grinning-face") — dùng làm key. */
  id: string;
  /** Tên CLDR (vd "grinning face"). */
  title: string;
  /** URL ảnh CDN — render inline khi nội dung đã lưu. */
  url: string;
  /** Ảnh cho lưới picker (cùng URL — file PNG nhỏ, CDN cache immutable). */
  preview: string;
  /** Ký tự unicode (vd "😀") — chèn thẳng vào ô nhập. */
  character: string;
}

/** URL ảnh emoji trên CDN emojifyi (platform noto), sinh từ ký tự unicode. */
export function emojifyiImageUrl(character: string, platform = 'noto'): string {
  const cps = [...character]
    .map((ch) => ch.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16).padStart(4, '0'))
    .join('_');
  return `${EMOJIFYI_CDN}/${platform}/emoji_u${cps}.png`;
}

// ===== Nhận diện URL emojifyi trong text nội dung =====

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

// ===== Fetch =====

interface SearchItem {
  character: string;
  cldr_name: string;
  slug: string;
}

interface SearchResponse {
  results?: SearchItem[];
}

/** 1 category từ /api/categories/ — `icon` là ký tự unicode (vd "😀"). */
export interface EmojiCategory {
  slug: string;
  name: string;
  icon: string;
  emoji_count: number;
}

interface CategoriesResponse {
  categories?: EmojiCategory[];
}

interface CategoryDetail {
  emojis?: SearchItem[];
}

function toOption(r: SearchItem): EmojiOption {
  const url = emojifyiImageUrl(r.character);
  return { id: r.slug, title: r.cldr_name, url, preview: url, character: r.character };
}

async function emojifyiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${EMOJIFYI_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EmojiFYI ${res.status}`);
  return (await res.json()) as T;
}

// --- Cache (bắt buộc: rate limit 60 req/phút/IP) ---

const searchCache = new Map<string, EmojiOption[]>();
let categoriesCache: EmojiCategory[] | null = null;
const categoryCache = new Map<string, EmojiOption[]>();
/** Request đang chạy per-slug — dedup khi user bấm tab đúng lúc prefetch. */
const categoryInflight = new Map<string, Promise<EmojiOption[]>>();

async function searchCached(query: string): Promise<EmojiOption[]> {
  const hit = searchCache.get(query);
  if (hit) return hit;
  const data = await emojifyiGet<SearchResponse>('/search/', { q: query });
  const items = (data.results ?? []).map(toOption);
  searchCache.set(query, items);
  return items;
}

async function getCategories(): Promise<EmojiCategory[]> {
  if (categoriesCache) return categoriesCache;
  const data = await emojifyiGet<CategoriesResponse>('/categories/');
  categoriesCache = (data.categories ?? []).filter((c) => c.emoji_count > 0);
  return categoriesCache;
}

async function getCategoryEmojis(slug: string): Promise<EmojiOption[]> {
  const hit = categoryCache.get(slug);
  if (hit) return hit;
  const inflight = categoryInflight.get(slug);
  if (inflight) return inflight;
  const promise = emojifyiGet<CategoryDetail>(`/category/${slug}/`)
    .then((data) => {
      const items = (data.emojis ?? []).map(toOption);
      categoryCache.set(slug, items);
      return items;
    })
    .finally(() => {
      categoryInflight.delete(slug);
    });
  categoryInflight.set(slug, promise);
  return promise;
}

/** Danh sách category cho tab bar (đã lọc category rỗng, cache 1 lần/phiên). */
export async function fetchEmojiCategories(): Promise<EmojiCategory[]> {
  return getCategories();
}

/** Emoji của 1 category (cache per-slug — mở lại là tức thì). */
export async function fetchCategoryEmojis(slug: string): Promise<EmojiOption[]> {
  return getCategoryEmojis(slug);
}

/**
 * Tìm emoji — /api/search/ trả tối đa 50 kq, KHÔNG pagination.
 * Giữ nguyên contract trả thẳng mảng (không slice theo offset).
 */
export async function searchEmojis(query: string): Promise<EmojiOption[]> {
  return searchCached(query.trim());
}

/**
 * Nạp sẵn 1 category vào cache (fire-and-forget, nuốt lỗi).
 * Dùng cho prefetch nền — không setState, không ảnh hưởng UI.
 */
export function prefetchCategoryEmojis(slug: string): void {
  void getCategoryEmojis(slug).catch(() => {});
}

/** Xóa toàn bộ cache (dùng cho test/reset). */
export function clearEmojifyiCache(): void {
  searchCache.clear();
  categoriesCache = null;
  categoryCache.clear();
  categoryInflight.clear();
}
