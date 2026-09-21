import { request } from './client';
import type { SearchResponse } from '../types/search';

export const search = (keyword: string, type: string = 'all') =>
  request<SearchResponse>(`/search?keyword=${encodeURIComponent(keyword)}&type=${type}`);
