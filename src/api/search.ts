import { request } from './client';
import type { HashtagSearchResult, SearchResponse } from '../types/search';

export const search = (keyword: string, type: string = 'all') =>
  request<SearchResponse>(`/search?keyword=${encodeURIComponent(keyword)}&type=${type}`);

// Trending hashtags (server cache TTL) — mirror web api/posts.ts getTrendingHashtags.
export const getTrendingHashtags = () =>
  request<{ data: HashtagSearchResult[] }>('/trending');
